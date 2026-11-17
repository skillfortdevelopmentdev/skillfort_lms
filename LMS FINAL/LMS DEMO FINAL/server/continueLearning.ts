import type { DBStore } from '../src/types';
import { findContinueTarget } from '../src/utils/courseProgress';
import { isEnrollmentExpired } from '../src/utils/courseValidity';

export interface ServerContinueTarget {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  progressPercentage: number;
}

export function buildContinueTargets(db: DBStore, userId: string): ServerContinueTarget[] {
  const enrollments = db.enrollments.filter(
    (e) =>
      e.userId === userId &&
      e.progressPercentage < 100 &&
      !isEnrollmentExpired(e)
  );

  const targets: ServerContinueTarget[] = [];

  for (const enrollment of enrollments) {
    const course = db.courses.find((c) => c.id === enrollment.courseId);
    if (!course) continue;

    const progressList = db.progress.filter(
      (p) => p.userId === userId && p.courseId === course.id
    );

    const target = findContinueTarget(
      course.id,
      course.title,
      enrollment.progressPercentage,
      db.modules,
      db.lessons,
      progressList
    );

    if (target) {
      targets.push(target);
    }
  }

  return targets;
}
