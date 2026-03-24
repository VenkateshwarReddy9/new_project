import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
    });

    const accessToken = generateAccessToken(user.id, user.email);
    const refreshTokenStr = generateRefreshToken(user.id, user.email);

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({
      data: { token: refreshTokenStr, userId: user.id, expiresAt },
    });

    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
      accessToken,
      refreshToken: refreshTokenStr,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Delete old refresh tokens for this user
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    const accessToken = generateAccessToken(user.id, user.email);
    const refreshTokenStr = generateRefreshToken(user.id, user.email);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({
      data: { token: refreshTokenStr, userId: user.id, expiresAt },
    });

    res.json({
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
      accessToken,
      refreshToken: refreshTokenStr,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    const payload = verifyRefreshToken(refreshToken);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    // Rotate refresh token
    await prisma.refreshToken.delete({ where: { token: refreshToken } });

    const newAccessToken = generateAccessToken(payload.userId, payload.email);
    const newRefreshToken = generateRefreshToken(payload.userId, payload.email);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({
      data: { token: newRefreshToken, userId: payload.userId, expiresAt },
    });

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Logout
router.post('/logout', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.json({ message: 'Logged out' });
  } catch {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, avatar: true, createdAt: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update profile
router.put('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, avatar } = z.object({
      name: z.string().min(1).max(100).optional(),
      avatar: z.string().url().optional().nullable(),
    }).parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { ...(name && { name }), ...(avatar !== undefined && { avatar }) },
      select: { id: true, name: true, email: true, avatar: true },
    });
    res.json(user);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(500).json({ error: 'Update failed' });
  }
});

export default router;
