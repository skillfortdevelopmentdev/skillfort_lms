import type { Response } from 'express';
import type { DBStore, Enrollment } from '../src/types';
import { computeExpiresAt, isEnrollmentExpired } from '../src/utils/courseValidity';
import { resolveCourseValidityDays } from './courseValiditySync';

export function createEnrollmentRecord(
  db: DBStore,
  userId: string,
  courseId: string
): Enrollment {
  const enrolledAt = new Date().toISOString();
  const courseRef = db.courses.find((c) => c.id === courseId);
  const validityDays = courseRef ? resolveCourseValidityDays(db, courseRef) : undefined;

  return {
    id: `enroll-${Math.random().toString(36).substring(2, 9)}`,
    userId,
    courseId,
    enrolledAt,
    progressPercentage: 0,
    isCompleted: false,
    expiresAt: computeExpiresAt(enrolledAt, validityDays),
  };
}

export function findEnrollment(
  db: DBStore,
  userId: string,
  courseId: string
): Enrollment | undefined {
  return db.enrollments.find((e) => e.userId === userId && e.courseId === courseId);
}

export function isEnrollmentActive(enrollment: Enrollment): boolean {
  return !isEnrollmentExpired(enrollment);
}

export function assertActiveEnrollment(
  db: DBStore,
  userId: string,
  courseId: string,
  res: Response
): Enrollment | null {
  const enrollment = findEnrollment(db, userId, courseId);
  if (!enrollment) {
    res.status(403).json({ error: 'You are not enrolled in this course.' });
    return null;
  }
  if (!isEnrollmentActive(enrollment)) {
    res.status(403).json({
      error: 'Your access to this course has expired.',
      code: 'ENROLLMENT_EXPIRED',
      expiresAt: enrollment.expiresAt,
    });
    return null;
  }
  return enrollment;
}

export function extendEnrollmentByDays(
  enrollment: Enrollment,
  extendDays: number
): Enrollment {
  const safeDays = Math.max(1, Math.floor(extendDays));
  const now = new Date();
  const base =
    enrollment.expiresAt && new Date(enrollment.expiresAt).getTime() > now.getTime()
      ? new Date(enrollment.expiresAt)
      : now;
  base.setUTCDate(base.getUTCDate() + safeDays);
  enrollment.expiresAt = base.toISOString();
  return enrollment;
}
