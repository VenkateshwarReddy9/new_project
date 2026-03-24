import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';

import authRoutes from './routes/auth';
import groupRoutes from './routes/groups';
import expenseRoutes from './routes/expenses';
import settlementRoutes from './routes/settlements';
import dashboardRoutes from './routes/dashboard';
import aiRoutes from './routes/ai';
import { authenticate } from './middleware/auth';

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});

// Make io available in routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
const uploadsDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', authenticate, groupRoutes);
app.use('/api/expenses', authenticate, expenseRoutes);
app.use('/api/settlements', authenticate, settlementRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use('/api/ai', authenticate, aiRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err: Error & { status?: number; code?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

// Socket.io auth + room management
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('No token'));
  try {
    const jwt = require('jsonwebtoken');
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as { userId: string };
    (socket as any).userId = payload.userId;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = (socket as any).userId;

  socket.on('join:group', (groupId: string) => {
    socket.join(`group:${groupId}`);
  });

  socket.on('leave:group', (groupId: string) => {
    socket.leave(`group:${groupId}`);
  });

  socket.on('disconnect', () => {
    // cleanup handled by socket.io
  });
});

const PORT = parseInt(process.env.PORT || '3001', 10);
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { prisma, io };
