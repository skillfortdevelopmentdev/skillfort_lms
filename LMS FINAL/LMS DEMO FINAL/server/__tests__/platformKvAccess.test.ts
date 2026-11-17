import {
  canAccessPlatformKey,
  parseQaThreadCourseId,
} from '../platformKvAccess';
import type { AuthPayload } from '../auth';

const student: AuthPayload = {
  userId: 'user-student-1',
  role: 'student',
  email: 'student@test.com',
};

const admin: AuthPayload = {
  userId: 'user-admin-1',
  role: 'admin',
  email: 'admin@test.com',
};

describe('platformKvAccess Q&A threads', () => {
  const qaKey = 'skillfort_qa_threads_course-react-19';

  test('parseQaThreadCourseId extracts course id', () => {
    expect(parseQaThreadCourseId(qaKey)).toBe('course-react-19');
    expect(parseQaThreadCourseId('skillfort_wishlist_x')).toBeNull();
  });

  test('admin can access any Q&A thread', () => {
    expect(canAccessPlatformKey(qaKey, admin)).toBe(true);
  });

  test('student denied without enrollment context', () => {
    expect(canAccessPlatformKey(qaKey, student)).toBe(false);
  });

  test('enrolled student can access course Q&A', () => {
    expect(
      canAccessPlatformKey(qaKey, student, {
        enrolledCourseIds: new Set(['course-react-19']),
      })
    ).toBe(true);
  });

  test('student cannot access Q&A for unenrolled course', () => {
    expect(
      canAccessPlatformKey(qaKey, student, {
        enrolledCourseIds: new Set(['course-other']),
      })
    ).toBe(false);
  });
});

describe('platformKvAccess user-scoped keys', () => {
  test('student can access own wishlist only', () => {
    const key = `skillfort_wishlist_${student.userId}`;
    expect(canAccessPlatformKey(key, student)).toBe(true);
    expect(canAccessPlatformKey('skillfort_wishlist_other-user', student)).toBe(false);
  });

  test('admin-only keys blocked for students', () => {
    expect(canAccessPlatformKey('skillfort_instructors', student)).toBe(false);
    expect(canAccessPlatformKey('skillfort_instructors', admin)).toBe(true);
  });
});
