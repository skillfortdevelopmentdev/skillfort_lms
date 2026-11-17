import { apiFetch } from './client';
import type { CourseReview } from '../types';

export interface PublicCourseReview {
  id: string;
  courseId: string;
  studentName: string;
  rating: number;
  comment: string;
  isPinned: boolean;
  createdAt: string;
}

export async function fetchCourseReviews(courseId: string): Promise<PublicCourseReview[]> {
  try {
    const resp = await apiFetch(`/api/courses/${encodeURIComponent(courseId)}/reviews`);
    if (!resp.ok) return [];
    return await resp.json();
  } catch {
    return [];
  }
}

export async function fetchStudentCourseReviews(): Promise<CourseReview[]> {
  try {
    const resp = await apiFetch('/api/student/course-reviews');
    if (!resp.ok) return [];
    return await resp.json();
  } catch {
    return [];
  }
}

export async function submitCourseReview(
  courseId: string,
  payload: { rating: number; comment: string }
): Promise<{ ok: true; review: CourseReview } | { ok: false; error: string }> {
  try {
    const resp = await apiFetch(`/api/courses/${encodeURIComponent(courseId)}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { ok: false, error: data.error || 'Failed to submit review.' };
    }
    return { ok: true, review: data as CourseReview };
  } catch {
    return { ok: false, error: 'Network error while submitting review.' };
  }
}

export async function fetchAdminCourseReviews(): Promise<CourseReview[]> {
  const resp = await apiFetch('/api/admin/course-reviews');
  if (!resp.ok) {
    throw new Error('Failed to load course reviews');
  }
  return await resp.json();
}

export async function moderateCourseReview(
  reviewId: string,
  payload: { status: CourseReview['status']; isPinned?: boolean }
): Promise<CourseReview> {
  const resp = await apiFetch(`/api/admin/course-reviews/${encodeURIComponent(reviewId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || 'Failed to update review');
  }
  return data as CourseReview;
}

export async function deleteCourseReview(reviewId: string): Promise<void> {
  const resp = await apiFetch(`/api/admin/course-reviews/${encodeURIComponent(reviewId)}`, {
    method: 'DELETE',
  });
  if (!resp.ok) {
    const data = await resp.json();
    throw new Error(data.error || 'Failed to delete review');
  }
}
