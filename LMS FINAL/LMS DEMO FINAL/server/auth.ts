import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { DBStore } from '../src/types';
import { validateStudentSession } from './sessions';

export interface AuthPayload {
  userId: string;
  role: 'admin' | 'student';
  email: string;
  /** Present for students — only one active browser session allowed. */
  sessionId?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  return 'skillfort-dev-jwt-secret-change-me';
}

const SALT_ROUNDS = 10;

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, getJwtSecret()) as AuthPayload;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function isHashedPassword(stored: string): boolean {
  return stored.startsWith('$2a$') || stored.startsWith('$2b$');
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  if (isHashedPassword(stored)) {
    return bcrypt.compare(plain, stored);
  }
  return stored === plain;
}

/** Lowercase + trim; Gmail ignores dots and +tags in the local part. */
export function normalizeEmailAddress(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return trimmed;

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const localWithoutTag = local.split('+')[0].replace(/\./g, '');
    return `${localWithoutTag}@gmail.com`;
  }
  return trimmed;
}

export function findUserByEmail<T extends { email: string }>(
  users: T[],
  email: string
): T | undefined {
  const normalized = normalizeEmailAddress(email);
  return users.find((u) => normalizeEmailAddress(u.email) === normalized);
}

type AuthFailure = {
  ok: false;
  status: number;
  body: { error: string; code?: string };
};

type AuthSuccess = { ok: true; payload: AuthPayload };

export async function authenticateRequest(
  req: Request,
  loadDB: () => Promise<DBStore>
): Promise<AuthSuccess | AuthFailure> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return { ok: false, status: 401, body: { error: 'Unauthorized' } };
  }

  try {
    const payload = verifyToken(header.slice(7));

    if (payload.role === 'student') {
      const db = await loadDB();
      if (!validateStudentSession(db, payload.userId, payload.sessionId)) {
        return {
          ok: false,
          status: 401,
          body: {
            error: 'Your account was signed in on another browser or device.',
            code: 'SESSION_REPLACED',
          },
        };
      }
    }

    req.auth = payload;
    return { ok: true, payload };
  } catch {
    return { ok: false, status: 401, body: { error: 'Invalid or expired token' } };
  }
}

export function createRequireAuth(loadDB: () => Promise<DBStore>) {
  return async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const result = await authenticateRequest(req, loadDB);
    if (result.ok === false) {
      res.status(result.status).json(result.body);
      return;
    }
    next();
  };
}

export function createRequireAdmin(loadDB: () => Promise<DBStore>) {
  const requireAuth = createRequireAuth(loadDB);
  return async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    await requireAuth(req, res, () => {
      if (req.auth?.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      next();
    });
  };
}

export function assertSelfOrAdmin(req: Request, res: Response, targetUserId: string): boolean {
  if (req.auth?.role === 'admin' || req.auth?.userId === targetUserId) {
    return true;
  }
  res.status(403).json({ error: 'Forbidden' });
  return false;
}
