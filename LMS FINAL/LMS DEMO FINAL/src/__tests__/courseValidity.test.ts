import {
  computeExpiresAt,
  daysRemaining,
  enrollmentAccessLabel,
  formatValidityLabel,
  isEnrollmentExpired,
  parseValidityDays,
} from '../utils/courseValidity';

describe('courseValidity', () => {
  it('treats empty validity as lifetime access', () => {
    expect(parseValidityDays('')).toBeUndefined();
    expect(parseValidityDays(null)).toBeUndefined();
    expect(formatValidityLabel(undefined)).toBe('Lifetime access');
    expect(computeExpiresAt('2026-01-01T00:00:00.000Z', undefined)).toBeUndefined();
  });

  it('computes expiry from enrollment date and validity days', () => {
    const enrolledAt = '2026-01-01T12:00:00.000Z';
    const expiresAt = computeExpiresAt(enrolledAt, 30);
    expect(expiresAt).toBe('2026-01-31T12:00:00.000Z');
  });

  it('detects expired enrollments', () => {
    const enrollment = { expiresAt: '2020-01-01T00:00:00.000Z' };
    expect(isEnrollmentExpired(enrollment, new Date('2026-01-01'))).toBe(true);
    expect(enrollmentAccessLabel(enrollment)).toContain('expired');
  });

  it('reports remaining days for active limited access', () => {
    const future = new Date('2026-06-20T12:00:00.000Z');
    const expiresAt = '2026-06-25T12:00:00.000Z';
    expect(daysRemaining(expiresAt, future)).toBeGreaterThan(0);
    expect(enrollmentAccessLabel({ expiresAt })).toContain('days left');
  });
});
