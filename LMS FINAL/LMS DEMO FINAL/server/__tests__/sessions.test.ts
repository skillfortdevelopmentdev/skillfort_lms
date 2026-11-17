import {
  startStudentSession,
  validateStudentSession,
  clearStudentSession,
  isSessionKey,
} from '../sessions';
import type { DBStore } from '../../src/types';

function makeDb(): DBStore {
  return {
    settings: {} as DBStore['settings'],
    coupons: [],
    courses: [],
    modules: [],
    lessons: [],
    users: [],
    passwords: {},
    progress: [],
    enrollments: [],
    payments: [],
    certificates: [],
    platformKv: {},
  };
}

describe('student sessions', () => {
  test('startStudentSession replaces previous session', () => {
    const db = makeDb();
    const first = startStudentSession(db, 'user-student-1');
    const second = startStudentSession(db, 'user-student-1');

    expect(first).not.toBe(second);
    expect(validateStudentSession(db, 'user-student-1', first)).toBe(false);
    expect(validateStudentSession(db, 'user-student-1', second)).toBe(true);
  });

  test('clearStudentSession invalidates token session id', () => {
    const db = makeDb();
    const sessionId = startStudentSession(db, 'user-student-1');
    clearStudentSession(db, 'user-student-1');
    expect(validateStudentSession(db, 'user-student-1', sessionId)).toBe(false);
  });

  test('isSessionKey identifies server-only keys', () => {
    expect(isSessionKey('skillfort_active_session_user-1')).toBe(true);
    expect(isSessionKey('skillfort_wishlist_user-1')).toBe(false);
  });
});
