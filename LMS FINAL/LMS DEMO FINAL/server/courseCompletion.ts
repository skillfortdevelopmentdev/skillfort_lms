import type { Certificate, DBStore, Lesson } from '../src/types';
import { formatCertificateDateRange } from '../src/utils/certificateTemplate';

function buildVerifyUrl(certificateNumber: string): string {
  return `/verify/${certificateNumber}`;
}

export function getCourseLessons(db: DBStore, courseId: string): Lesson[] {
  const moduleIds = db.modules.filter((m) => m.courseId === courseId).map((m) => m.id);
  return db.lessons
    .filter((l) => moduleIds.includes(l.moduleId))
    .sort((a, b) => a.order - b.order);
}

export function isLessonComplete(db: DBStore, userId: string, lessonId: string): boolean {
  return Boolean(
    db.progress.find((p) => p.userId === userId && p.lessonId === lessonId && p.isCompleted)
  );
}

/** Certificate when all videos, quizzes, and other lesson types are completed. */
export function isEligibleForCertificate(
  db: DBStore,
  userId: string,
  courseId: string
): boolean {
  const lessons = getCourseLessons(db, courseId);
  if (lessons.length === 0) {
    return false;
  }

  return lessons.every((lesson) => isLessonComplete(db, userId, lesson.id));
}

/** Issue a certificate when every lesson is complete and none exists yet. */
export function issueCertificateIfEligible(
  db: DBStore,
  userId: string,
  courseId: string
): Certificate | null {
  const enrollIndex = db.enrollments.findIndex(
    (e) => e.userId === userId && e.courseId === courseId
  );
  if (enrollIndex === -1) {
    return null;
  }

  const enrollment = db.enrollments[enrollIndex];
  if (enrollment.certificateId) {
    return db.certificates.find((c) => c.id === enrollment.certificateId) ?? null;
  }

  if (!isEligibleForCertificate(db, userId, courseId)) {
    return null;
  }

  const userObj = db.users.find((u) => u.id === userId);
  const courseObj = db.courses.find((c) => c.id === courseId);
  if (!userObj || !courseObj) {
    return null;
  }

  const certNo = `SF-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const certId = `cert-${Math.random().toString(36).substring(2, 9)}`;
  const newCert: Certificate = {
    id: certId,
    userId,
    userName: userObj.name,
    courseId,
    courseTitle: courseObj.title,
    certificateNumber: certNo,
    issueDate: formatCertificateDateRange(enrollment.enrolledAt, new Date()),
    qrVerificationUrl: buildVerifyUrl(certNo),
  };

  db.certificates.push(newCert);
  enrollment.certificateId = certId;
  enrollment.isCompleted = true;
  return newCert;
}
