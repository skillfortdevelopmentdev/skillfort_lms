import crypto from 'crypto';
import type { DBStore } from '../src/types';

const SESSION_KEY_PREFIX = 'skillfort_active_session_';

export interface ActiveSessionRecord {
  sessionId: string;
  updatedAt: string;
}

function sessionKey(userId: string): string {
  return `${SESSION_KEY_PREFIX}${userId}`;
}

export function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function startStudentSession(db: DBStore, userId: string): string {
  const sessionId = createSessionId();
  db.platformKv[sessionKey(userId)] = {
    sessionId,
    updatedAt: new Date().toISOString(),
  } satisfies ActiveSessionRecord;
  return sessionId;
}

export function validateStudentSession(
  db: DBStore,
  userId: string,
  sessionId: string | undefined
): boolean {
  if (!sessionId) {
    return false;
  }
  const stored = db.platformKv[sessionKey(userId)];
  if (!stored || typeof stored !== 'object') {
    return false;
  }
  const record = stored as ActiveSessionRecord;
  return record.sessionId === sessionId;
}

export function clearStudentSession(db: DBStore, userId: string): void {
  delete db.platformKv[sessionKey(userId)];
}

export function isSessionKey(key: string): boolean {
  return key.startsWith(SESSION_KEY_PREFIX);
}
