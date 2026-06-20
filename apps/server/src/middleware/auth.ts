import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import type { Database } from '@game-lobby/db';
import { users } from '@game-lobby/db';
import type { UserProfile } from '@game-lobby/shared';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';

interface JwtPayload {
  sub: string;
  username: string;
  displayName: string;
  avatarColor: string;
  isGuest?: boolean;
}

export interface AuthRequest extends Request {
  user?: UserProfile;
}

export function signToken(user: UserProfile): string {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarColor: user.avatarColor,
      isGuest: user.isGuest ?? false,
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
}

export function verifyToken(token: string): UserProfile | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return {
      id: payload.sub,
      username: payload.username,
      displayName: payload.displayName,
      avatarColor: payload.avatarColor,
      isGuest: payload.isGuest ?? false,
    };
  } catch {
    return null;
  }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const user = authenticateRequest(req);
  if (!user) {
    res.status(401).json({ message: '登录已过期' });
    return;
  }
  req.user = user;
  next();
}

export function createAuthMiddleware(db: Database) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = authenticateRequest(req);
    if (!user) {
      res.status(401).json({ message: '登录已过期' });
      return;
    }

    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!row) {
      res.status(401).json({ message: '登录已过期' });
      return;
    }

    req.user = user;
    next();
  };
}

function authenticateRequest(req: AuthRequest): UserProfile | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  return verifyToken(header.slice(7));
}
