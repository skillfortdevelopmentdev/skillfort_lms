import * as crypto from 'crypto';
import type { DBStore } from '../src/types';

const TOKEN_TTL_MS = 60 * 60 * 1000;
export const PASSWORD_RESET_KV_PREFIX = 'skillfort_password_reset_';

export interface PasswordResetRecord {
  userId: string;
  email: string;
  expiresAt: string;
  used: boolean;
}

export function createPasswordResetToken(db: DBStore, userId: string, email: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const record: PasswordResetRecord = {
    userId,
    email,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    used: false,
  };
  db.platformKv[`${PASSWORD_RESET_KV_PREFIX}${token}`] = record;
  return token;
}

export function getPasswordResetRecord(db: DBStore, token: string): PasswordResetRecord | null {
  if (!token?.trim()) return null;
  const raw = db.platformKv[`${PASSWORD_RESET_KV_PREFIX}${token.trim()}`];
  if (!raw || typeof raw !== 'object') return null;
  return raw as PasswordResetRecord;
}

export function validatePasswordResetToken(
  db: DBStore,
  token: string
): { ok: true; record: PasswordResetRecord } | { ok: false; error: string } {
  const record = getPasswordResetRecord(db, token);
  if (!record) {
    return { ok: false, error: 'Invalid or expired reset link.' };
  }
  if (record.used) {
    return { ok: false, error: 'This reset link has already been used.' };
  }
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    delete db.platformKv[`${PASSWORD_RESET_KV_PREFIX}${token.trim()}`];
    return { ok: false, error: 'This reset link has expired. Request a new one.' };
  }
  return { ok: true, record };
}

export function markPasswordResetTokenUsed(db: DBStore, token: string): void {
  const record = getPasswordResetRecord(db, token);
  if (!record) return;
  record.used = true;
  db.platformKv[`${PASSWORD_RESET_KV_PREFIX}${token.trim()}`] = record;
}
