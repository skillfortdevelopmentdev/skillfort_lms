import * as crypto from 'crypto';
import type { CourseReview, CourseReviewStatus, DBStore } from '../src/types';

export const COURSE_REVIEWS_KV_KEY = 'skillfort_course_reviews';

function isReview(value: unknown): value is CourseReview {
  if (!value || typeof value !== 'object') return false;
  const row = value as CourseReview;
  return (
    typeof row.id === 'string' &&
    typeof row.courseId === 'string' &&
    typeof row.courseTitle === 'string' &&
    typeof row.userId === 'string' &&
    typeof row.studentName === 'string' &&
    typeof row.rating === 'number' &&
    typeof row.comment === 'string' &&
    (row.status === 'pending' || row.status === 'approved' || row.status === 'rejected') &&
    typeof row.isPinned === 'boolean' &&
    typeof row.createdAt === 'string' &&
    typeof row.updatedAt === 'string'
  );
}

export function getAllCourseReviews(db: DBStore): CourseReview[] {
  const raw = db.platformKv[COURSE_REVIEWS_KV_KEY];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(isReview).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function saveReviews(db: DBStore, reviews: CourseReview[]): void {
  db.platformKv[COURSE_REVIEWS_KV_KEY] = reviews;
}

export function getApprovedReviewsForCourse(db: DBStore, courseId: string): CourseReview[] {
  return getAllCourseReviews(db).filter(
    (review) => review.courseId === courseId && review.status === 'approved'
  );
}

export function getStudentReviews(db: DBStore, userId: string): CourseReview[] {
  return getAllCourseReviews(db).filter((review) => review.userId === userId);
}

export function getStudentReviewForCourse(
  db: DBStore,
  userId: string,
  courseId: string
): CourseReview | undefined {
  return getAllCourseReviews(db).find(
    (review) => review.userId === userId && review.courseId === courseId
  );
}

export function isEnrollmentComplete(db: DBStore, userId: string, courseId: string): boolean {
  const enrollment = db.enrollments.find(
    (entry) => entry.userId === userId && entry.courseId === courseId
  );
  if (!enrollment) return false;
  return enrollment.progressPercentage >= 100 || enrollment.isCompleted === true;
}

export function syncCourseRatingFromReviews(db: DBStore, courseId: string): void {
  const approved = getApprovedReviewsForCourse(db, courseId);
  const course = db.courses.find((entry) => entry.id === courseId);
  if (!course) return;

  if (approved.length === 0) {
    course.reviewsCount = 0;
    course.rating = 0;
    return;
  }

  const total = approved.reduce((sum, review) => sum + review.rating, 0);
  course.reviewsCount = approved.length;
  course.rating = Math.round((total / approved.length) * 10) / 10;
}

export function submitCourseReview(
  db: DBStore,
  input: {
    userId: string;
    studentName: string;
    courseId: string;
    rating: number;
    comment: string;
  }
): { ok: true; review: CourseReview } | { ok: false; error: string } {
  const course = db.courses.find((entry) => entry.id === input.courseId);
  if (!course) {
    return { ok: false, error: 'Course not found.' };
  }

  if (!isEnrollmentComplete(db, input.userId, input.courseId)) {
    return { ok: false, error: 'You can review a course only after completing it.' };
  }

  const rating = Math.round(input.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: 'Rating must be between 1 and 5.' };
  }

  const comment = input.comment.trim();
  if (comment.length < 10) {
    return { ok: false, error: 'Review must be at least 10 characters.' };
  }
  if (comment.length > 2000) {
    return { ok: false, error: 'Review must be 2000 characters or fewer.' };
  }

  const reviews = getAllCourseReviews(db);
  const existing = reviews.find(
    (review) => review.userId === input.userId && review.courseId === input.courseId
  );

  const now = new Date().toISOString();

  if (existing?.status === 'approved') {
    return { ok: false, error: 'Your review for this course is already published.' };
  }

  if (existing) {
    existing.rating = rating;
    existing.comment = comment;
    existing.status = 'pending';
    existing.isPinned = false;
    existing.updatedAt = now;
    saveReviews(db, reviews);
    return { ok: true, review: existing };
  }

  const review: CourseReview = {
    id: `rev-${crypto.randomBytes(8).toString('hex')}`,
    courseId: input.courseId,
    courseTitle: course.title,
    userId: input.userId,
    studentName: input.studentName,
    rating,
    comment,
    status: 'pending',
    isPinned: false,
    createdAt: now,
    updatedAt: now,
  };

  saveReviews(db, [review, ...reviews]);
  return { ok: true, review };
}

export function updateCourseReviewStatus(
  db: DBStore,
  reviewId: string,
  status: CourseReviewStatus,
  isPinned?: boolean
): { ok: true; review: CourseReview } | { ok: false; error: string } {
  const reviews = getAllCourseReviews(db);
  const review = reviews.find((entry) => entry.id === reviewId);
  if (!review) {
    return { ok: false, error: 'Review not found.' };
  }

  review.status = status;
  if (typeof isPinned === 'boolean') {
    review.isPinned = isPinned;
  } else if (status === 'approved') {
    review.isPinned = review.isPinned;
  } else {
    review.isPinned = false;
  }
  review.updatedAt = new Date().toISOString();

  saveReviews(db, reviews);
  syncCourseRatingFromReviews(db, review.courseId);
  return { ok: true, review };
}

export function deleteCourseReview(
  db: DBStore,
  reviewId: string
): { ok: true; courseId: string } | { ok: false; error: string } {
  const reviews = getAllCourseReviews(db);
  const review = reviews.find((entry) => entry.id === reviewId);
  if (!review) {
    return { ok: false, error: 'Review not found.' };
  }

  saveReviews(
    db,
    reviews.filter((entry) => entry.id !== reviewId)
  );
  syncCourseRatingFromReviews(db, review.courseId);
  return { ok: true, courseId: review.courseId };
}
