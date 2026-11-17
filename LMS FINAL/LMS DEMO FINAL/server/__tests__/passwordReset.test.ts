import {
  createPasswordResetToken,
  validatePasswordResetToken,
  markPasswordResetTokenUsed,
  PASSWORD_RESET_KV_PREFIX,
} from '../passwordReset';
import type { DBStore } from '../../src/types';
import { INITIAL_SETTINGS } from '../../src/data';

function makeStore(): DBStore {
  return {
    settings: { ...INITIAL_SETTINGS },
    users: [
      {
        id: 'user-1',
        email: 'student@test.com',
        name: 'Test Student',
        role: 'student',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ],
    passwords: { 'user-1': 'old-hash' },
    courses: [],
    modules: [],
    lessons: [],
    progress: [],
    enrollments: [],
    coupons: [],
    payments: [],
    certificates: [],
    platformKv: {},
  };
}

describe('passwordReset', () => {
  test('creates and validates a fresh token', () => {
    const db = makeStore();
    const token = createPasswordResetToken(db, 'user-1', 'student@test.com');

    expect(token).toHaveLength(64);
    expect(db.platformKv[`${PASSWORD_RESET_KV_PREFIX}${token}`]).toBeDefined();

    const validation = validatePasswordResetToken(db, token);
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.record.userId).toBe('user-1');
      expect(validation.record.email).toBe('student@test.com');
      expect(validation.record.used).toBe(false);
    }
  });

  test('rejects unknown token', () => {
    const db = makeStore();
    const validation = validatePasswordResetToken(db, 'invalid-token');
    expect(validation.ok).toBe(false);
    if (validation.ok === false) {
      expect(validation.error).toMatch(/Invalid or expired/);
    }
  });

  test('rejects used token', () => {
    const db = makeStore();
    const token = createPasswordResetToken(db, 'user-1', 'student@test.com');
    markPasswordResetTokenUsed(db, token);

    const validation = validatePasswordResetToken(db, token);
    expect(validation.ok).toBe(false);
    if (validation.ok === false) {
      expect(validation.error).toMatch(/already been used/);
    }
  });

  test('rejects expired token', () => {
    const db = makeStore();
    const token = createPasswordResetToken(db, 'user-1', 'student@test.com');
    const key = `${PASSWORD_RESET_KV_PREFIX}${token}`;
    const record = db.platformKv[key] as { expiresAt: string };
    record.expiresAt = new Date(Date.now() - 1000).toISOString();
    db.platformKv[key] = record;

    const validation = validatePasswordResetToken(db, token);
    expect(validation.ok).toBe(false);
    if (validation.ok === false) {
      expect(validation.error).toMatch(/expired/);
    }
  });
});
