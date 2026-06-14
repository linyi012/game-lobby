import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { users, type Database } from '@game-lobby/db';
import { signToken } from '../middleware/auth.js';

const registerSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(6).max(64),
  displayName: z.string().min(1).max(64).optional(),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

const AVATAR_COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444'];

export function authRouter(db: Database) {
  const router = Router();

  router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: '参数无效' });
      return;
    }

    const { username, password, displayName } = parsed.data;
    const [existing] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existing) {
      res.status(409).json({ message: '用户名已存在' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!;

    const [user] = await db
      .insert(users)
      .values({
        username,
        passwordHash,
        displayName: displayName ?? username,
        avatarColor,
      })
      .returning();

    const token = signToken({
      id: user!.id,
      username: user!.username,
      displayName: user!.displayName,
      avatarColor: user!.avatarColor,
    });

    res.status(201).json({
      token,
      user: {
        id: user!.id,
        username: user!.username,
        displayName: user!.displayName,
        avatarColor: user!.avatarColor,
      },
    });
  });

  router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: '参数无效' });
      return;
    }

    const { username, password } = parsed.data;
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ message: '用户名或密码错误' });
      return;
    }

    const token = signToken({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarColor: user.avatarColor,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarColor: user.avatarColor,
      },
    });
  });

  return router;
}
