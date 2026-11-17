import type { Course, DBStore } from '../src/types';
import { parseValidityDays } from '../src/utils/courseValidity';

export function resolveCourseValidityDays(db: DBStore, course: Course): number | undefined {
  const onCourse = parseValidityDays(course.validityDays);
  if (onCourse) return onCourse;

  const meta = db.platformKv[`skillfort_course_metadata_${course.id}`];
  if (meta && typeof meta === 'object' && meta !== null) {
    return parseValidityDays((meta as Record<string, unknown>).validityDays);
  }

  return undefined;
}

export function enrichCourseWithValidity(db: DBStore, course: Course): Course {
  const validityDays = resolveCourseValidityDays(db, course);
  if (!validityDays) return course;
  return { ...course, validityDays };
}

/** Persist validityDays from wizard metadata onto course records when missing. */
export function syncCourseValidityFromMetadata(db: DBStore): boolean {
  let modified = false;

  for (const course of db.courses) {
    if (parseValidityDays(course.validityDays)) continue;
    const validityDays = resolveCourseValidityDays(db, course);
    if (!validityDays) continue;
    course.validityDays = validityDays;
    modified = true;
  }

  return modified;
}
