import {
  deleteCourseReview,
  getApprovedReviewsForCourse,
  submitCourseReview,
  syncCourseRatingFromReviews,
  updateCourseReviewStatus,
} from '../courseReviews';
import type { DBStore } from '../../src/types';
import { INITIAL_SETTINGS } from '../../src/data';

function makeStore(): DBStore {
  return {
    settings: { ...INITIAL_SETTINGS },
    users: [
      {
        id: 'student-1',
        email: 'student@skillfort.com',
        name: 'Test Student',
        role: 'student',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    passwords: {},
    courses: [
      {
        id: 'course-1',
        title: 'Java Full Stack Academy',
        description: 'Test course',
        coverImage: '/cover.jpg',
        price: 1000,
        duration: '10h',
        level: 'Beginner',
        category: 'Programming',
        rating: 4.5,
        reviewsCount: 10,
        isPublished: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    modules: [],
    lessons: [],
    progress: [],
    enrollments: [
      {
        id: 'enr-1',
        userId: 'student-1',
        courseId: 'course-1',
        enrolledAt: '2026-01-02T00:00:00.000Z',
        progressPercentage: 100,
        isCompleted: true,
      },
    ],
    coupons: [],
    payments: [],
    certificates: [],
    platformKv: {},
  };
}

describe('courseReviews', () => {
  test('submits review for completed enrollment', () => {
    const db = makeStore();
    const result = submitCourseReview(db, {
      userId: 'student-1',
      studentName: 'Test Student',
      courseId: 'course-1',
      rating: 5,
      comment: 'Excellent course with strong placement support.',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.review.status).toBe('pending');
      expect(getApprovedReviewsForCourse(db, 'course-1')).toHaveLength(0);
    }
  });

  test('rejects review when course is not completed', () => {
    const db = makeStore();
    db.enrollments[0].progressPercentage = 80;
    db.enrollments[0].isCompleted = false;

    const result = submitCourseReview(db, {
      userId: 'student-1',
      studentName: 'Test Student',
      courseId: 'course-1',
      rating: 4,
      comment: 'Still working through the final module.',
    });

    expect(result.ok).toBe(false);
  });

  test('approval updates course rating and count', () => {
    const db = makeStore();
    const submitted = submitCourseReview(db, {
      userId: 'student-1',
      studentName: 'Test Student',
      courseId: 'course-1',
      rating: 4,
      comment: 'Great instructors and practical assignments.',
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    const approved = updateCourseReviewStatus(db, submitted.review.id, 'approved', true);
    expect(approved.ok).toBe(true);

    syncCourseRatingFromReviews(db, 'course-1');
    expect(db.courses[0].reviewsCount).toBe(1);
    expect(db.courses[0].rating).toBe(4);
    expect(getApprovedReviewsForCourse(db, 'course-1')).toHaveLength(1);
  });

  test('deleting approved review recalculates course rating', () => {
    const db = makeStore();
    const submitted = submitCourseReview(db, {
      userId: 'student-1',
      studentName: 'Test Student',
      courseId: 'course-1',
      rating: 5,
      comment: 'Outstanding learning experience overall.',
    });
    if (!submitted.ok) throw new Error('submit failed');

    updateCourseReviewStatus(db, submitted.review.id, 'approved');
    expect(db.courses[0].reviewsCount).toBe(1);

    const deleted = deleteCourseReview(db, submitted.review.id);
    expect(deleted.ok).toBe(true);
    expect(db.courses[0].reviewsCount).toBe(0);
    expect(db.courses[0].rating).toBe(0);
  });
});
