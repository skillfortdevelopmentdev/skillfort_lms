import type { AuthPayload } from './auth';

import { isSessionKey } from './sessions';

const ADMIN_EXACT_KEYS = new Set([
  'skillfort_quizzes_mgmt',
  'skillfort_questions_mgmt',
  'skillfort_instructors',
  'skillfort_course_statuses_map',
  'skillfort_categories',
  'skillfort_reviews',
  'skillfort_course_draft_backup',
  'skillfort_admin_directory',
]);

/** Readable by any authenticated user; writes remain admin-only. */
const STUDENT_READABLE_EXACT_KEYS = new Set(['skillfort_certificate_template']);

const QA_THREADS_PREFIX = 'skillfort_qa_threads_';

export interface PlatformKvAccessOptions {
  /** Course IDs the authenticated student is enrolled in. */
  enrolledCourseIds?: Set<string>;
}

export function parseQaThreadCourseId(key: string): string | null {
  if (!key.startsWith(QA_THREADS_PREFIX)) {
    return null;
  }
  const courseId = key.slice(QA_THREADS_PREFIX.length);
  return courseId || null;
}

export function canAccessPlatformKey(
  key: string,
  auth: AuthPayload,
  opts: PlatformKvAccessOptions = {}
): boolean {
  if (!key.startsWith('skillfort_')) {
    return false;
  }

  if (isSessionKey(key)) {
    return false;
  }

  if (STUDENT_READABLE_EXACT_KEYS.has(key)) {
    return true;
  }

  if (ADMIN_EXACT_KEYS.has(key) || key.startsWith('skillfort_course_metadata_')) {
    return auth.role === 'admin';
  }

  if (key.startsWith('skillfort_wishlist_')) {
    return auth.role === 'admin' || key === `skillfort_wishlist_${auth.userId}`;
  }

  if (key.startsWith('skillfort_photo_')) {
    return auth.role === 'admin' || key === `skillfort_photo_${auth.userId}`;
  }

  if (key.startsWith('skillfort_emails_')) {
    return auth.role === 'admin' || key === `skillfort_emails_${auth.userId}`;
  }

  if (key.startsWith('skillfort_quizzes_')) {
    return auth.role === 'admin' || key === `skillfort_quizzes_${auth.userId}`;
  }

  if (key.startsWith('skillfort_progress_')) {
    return auth.role === 'admin' || key.includes(`_${auth.userId}_`);
  }

  if (key.startsWith(QA_THREADS_PREFIX)) {
    if (auth.role === 'admin') {
      return true;
    }
    const courseId = parseQaThreadCourseId(key);
    if (!courseId || !opts.enrolledCourseIds) {
      return false;
    }
    return opts.enrolledCourseIds.has(courseId);
  }

  if (key.startsWith('skillfort_prefs_')) {
    return auth.role === 'admin' || key === `skillfort_prefs_${auth.userId}`;
  }

  return auth.role === 'admin';
}

export function canWritePlatformKey(
  key: string,
  auth: AuthPayload,
  opts: PlatformKvAccessOptions = {}
): boolean {
  if (STUDENT_READABLE_EXACT_KEYS.has(key)) {
    return auth.role === 'admin';
  }
  return canAccessPlatformKey(key, auth, opts);
}
