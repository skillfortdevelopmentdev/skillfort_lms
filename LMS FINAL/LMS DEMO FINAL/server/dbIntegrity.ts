import type { DBStore, CourseModule, Lesson, User } from '../src/types';
import { hashPassword, isHashedPassword } from './auth';
import { normalizeSettings } from './settingsUtils';
import { computeExpiresAt } from '../src/utils/courseValidity';
import { syncCourseValidityFromMetadata, resolveCourseValidityDays } from './courseValiditySync';
import { isEligibleForCertificate, issueCertificateIfEligible } from './courseCompletion';

export function deduplicateDB(dbData: DBStore): boolean {
  let modified = false;

  if (dbData.modules && Array.isArray(dbData.modules)) {
    const modulesToKeep: CourseModule[] = [];
    const moduleMap = new Map<string, string>();

    dbData.modules.forEach(m => {
      const existing = modulesToKeep.find(
        k => k.courseId === m.courseId && k.title.trim().toLowerCase() === m.title.trim().toLowerCase()
      );

      if (existing) {
        moduleMap.set(m.id, existing.id);
        modified = true;
      } else {
        modulesToKeep.push(m);
      }
    });

    if (modified) {
      dbData.modules = modulesToKeep;
    }

    if (dbData.lessons && Array.isArray(dbData.lessons) && moduleMap.size > 0) {
      dbData.lessons = dbData.lessons.map(l => {
        if (moduleMap.has(l.moduleId)) {
          modified = true;
          return { ...l, moduleId: moduleMap.get(l.moduleId)! };
        }
        return l;
      });
    }
  }

  if (dbData.lessons && Array.isArray(dbData.lessons)) {
    const lessonsToKeep: Lesson[] = [];
    const deletedLessonIds = new Set<string>();

    dbData.lessons.forEach(l => {
      const existing = lessonsToKeep.find(
        k => k.moduleId === l.moduleId && k.title.trim().toLowerCase() === l.title.trim().toLowerCase()
      );

      if (existing) {
        deletedLessonIds.add(l.id);
        modified = true;
      } else {
        lessonsToKeep.push(l);
      }
    });

    if (deletedLessonIds.size > 0) {
      dbData.lessons = lessonsToKeep;
      if (dbData.progress && Array.isArray(dbData.progress)) {
        const initialCount = dbData.progress.length;
        dbData.progress = dbData.progress.filter(p => !deletedLessonIds.has(p.lessonId));
        if (dbData.progress.length !== initialCount) {
          modified = true;
        }
      }
    }
  }

  return modified;
}

function parseDurationToSeconds(duration?: string): number {
  if (!duration) return 600;
  const parts = duration.split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secs = parseInt(parts[1], 10);
    if (!isNaN(mins) && !isNaN(secs)) {
      return mins * 60 + secs;
    }
  }
  const mins = parseInt(duration, 10);
  if (!isNaN(mins)) return mins * 60;
  return 600;
}

function recalculateEnrollmentProgress(db: DBStore): boolean {
  let modified = false;

  db.enrollments.forEach(enrollment => {
    const modules = db.modules.filter(m => m.courseId === enrollment.courseId);
    const moduleIds = modules.map(m => m.id);
    const lessons = db.lessons.filter(l => moduleIds.includes(l.moduleId));

    if (lessons.length === 0) return;

    let totalProgSum = 0;
    lessons.forEach(lesson => {
      const prog = db.progress.find(
        p => p.userId === enrollment.userId && p.lessonId === lesson.id
      );
      if (prog) {
        if (prog.isCompleted) {
          totalProgSum += 1;
        } else {
          const totalSecs = parseDurationToSeconds(lesson.duration);
          totalProgSum += totalSecs > 0
            ? Math.min(0.99, prog.currentTimestamp / totalSecs)
            : (prog.currentTimestamp > 0 ? 0.3 : 0);
        }
      }
    });

    const progressPct = Math.round((totalProgSum / lessons.length) * 100);
    if (enrollment.progressPercentage !== progressPct) {
      enrollment.progressPercentage = progressPct;
      modified = true;
    }

    const shouldBeComplete =
      Boolean(enrollment.certificateId) ||
      isEligibleForCertificate(db, enrollment.userId, enrollment.courseId);
    if (enrollment.isCompleted !== shouldBeComplete) {
      enrollment.isCompleted = shouldBeComplete;
      modified = true;
    }
  });

  return modified;
}

function migrateUserRegistrationProfiles(db: DBStore): boolean {
  let modified = false;

  db.users.forEach((user: User) => {
    if (user.role !== 'student' || user.registrationProfile) {
      return;
    }

    const hasLegacy =
      user.areaOfInterest?.trim() ||
      user.companyOrCollege?.trim() ||
      user.professionalStatus?.trim();

    if (!hasLegacy) {
      return;
    }

    user.registrationProfile = {
      branch: '',
      dateOfBirth: '',
      highestQualification: '',
      stream: '',
      collegeName: user.companyOrCollege?.trim() ?? '',
      yearOfPassout: '',
      requiredCourse: user.areaOfInterest?.trim() ?? '',
      placementRequired: 'no',
      hasWorkExperience: 'no',
      address: '',
      source: user.professionalStatus?.trim()
        ? `Legacy: ${user.professionalStatus.trim()}`
        : 'Legacy registration',
    };
    modified = true;
  });

  return modified;
}

export function repairDatabaseIntegrity(db: DBStore): boolean {
  let modified = false;

  const normalizedSettings = normalizeSettings(db.settings);
  if (JSON.stringify(normalizedSettings) !== JSON.stringify(db.settings)) {
    db.settings = normalizedSettings;
    modified = true;
  }

  db.payments.forEach(payment => {
    const course = db.courses.find(c => c.id === payment.courseId);
    if (course && payment.courseTitle !== course.title) {
      payment.courseTitle = course.title;
      modified = true;
    }
    const user = db.users.find(u => u.id === payment.userId);
    if (user) {
      if (payment.userEmail !== user.email) {
        payment.userEmail = user.email;
        modified = true;
      }
      if (payment.userName !== user.name) {
        payment.userName = user.name;
        modified = true;
      }
    }
  });

  const lessonIds = new Set(db.lessons.map(l => l.id));
  const progressBefore = db.progress.length;
  db.progress = db.progress.filter(p => lessonIds.has(p.lessonId));
  if (db.progress.length !== progressBefore) modified = true;

  const courseIds = new Set(db.courses.map(c => c.id));
  const userIds = new Set(db.users.map(u => u.id));
  const enrollBefore = db.enrollments.length;
  db.enrollments = db.enrollments.filter(
    e => courseIds.has(e.courseId) && userIds.has(e.userId)
  );
  if (db.enrollments.length !== enrollBefore) modified = true;

  db.enrollments.forEach(enrollment => {
    if (enrollment.certificateId) {
      const cert = db.certificates.find(c => c.id === enrollment.certificateId);
      if (!cert) {
        enrollment.certificateId = undefined;
        modified = true;
      }
    }
  });

  db.certificates = db.certificates.filter(cert =>
    userIds.has(cert.userId) && courseIds.has(cert.courseId)
  );

  if (recalculateEnrollmentProgress(db)) {
    modified = true;
  }

  db.enrollments.forEach((enrollment) => {
    if (issueCertificateIfEligible(db, enrollment.userId, enrollment.courseId)) {
      modified = true;
    }
  });

  if (migrateUserRegistrationProfiles(db)) {
    modified = true;
  }

  if (backfillEnrollmentExpiry(db)) {
    modified = true;
  }

  if (syncCourseValidityFromMetadata(db)) {
    modified = true;
  }

  return modified;
}

function backfillEnrollmentExpiry(db: DBStore): boolean {
  let modified = false;

  for (const enrollment of db.enrollments) {
    if (enrollment.expiresAt) continue;
    const course = db.courses.find((c) => c.id === enrollment.courseId);
    if (!course) continue;
    const validityDays = resolveCourseValidityDays(db, course);
    if (!validityDays) continue;
    const expiresAt = computeExpiresAt(enrollment.enrolledAt, validityDays);
    if (expiresAt) {
      enrollment.expiresAt = expiresAt;
      modified = true;
    }
  }

  return modified;
}

export async function migratePlaintextPasswords(db: DBStore): Promise<boolean> {
  let modified = false;
  for (const [userId, stored] of Object.entries(db.passwords)) {
    if (!isHashedPassword(stored)) {
      db.passwords[userId] = await hashPassword(stored);
      modified = true;
    }
  }
  return modified;
}
