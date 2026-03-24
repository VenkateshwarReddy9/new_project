import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
    } else {
      res.status(401).json({ error: 'Invalid token' });
    }
  }
}

export function generateAccessToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  } as jwt.SignOptions);
}

export function generateRefreshToken(userId: string, email: string): string {
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';
  return jwt.sign({ userId, email }, refreshSecret, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
}

export function verifyRefreshToken(token: string): { userId: string; email: string } {
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';
  return jwt.verify(token, refreshSecret) as { userId: string; email: string };
}
