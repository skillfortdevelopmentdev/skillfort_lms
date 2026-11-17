/** Optional access window in days from enrollment. Empty / undefined = lifetime access. */
export function parseValidityDays(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

export function computeExpiresAt(
  enrolledAt: string,
  validityDays?: number | null
): string | undefined {
  const days = parseValidityDays(validityDays);
  if (!days) return undefined;
  const start = new Date(enrolledAt);
  if (Number.isNaN(start.getTime())) return undefined;
  const expires = new Date(start);
  expires.setUTCDate(expires.getUTCDate() + days);
  return expires.toISOString();
}

export function isEnrollmentExpired(
  enrollment: { expiresAt?: string | null },
  now: Date = new Date()
): boolean {
  if (!enrollment.expiresAt) return false;
  return new Date(enrollment.expiresAt).getTime() <= now.getTime();
}

export function formatValidityLabel(validityDays?: number | null): string {
  if (!validityDays) return 'Lifetime access';
  if (validityDays === 1) return '1 day access from enrollment';
  return `${validityDays} days access from enrollment`;
}

export function formatExpiresAtLabel(expiresAt?: string | null): string | null {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function daysRemaining(
  expiresAt?: string | null,
  now: Date = new Date()
): number | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - now.getTime()) / (24 * 60 * 60 * 1000)));
}

export function enrollmentAccessLabel(enrollment: {
  expiresAt?: string | null;
}): string {
  if (!enrollment.expiresAt) return 'Lifetime access';
  if (isEnrollmentExpired(enrollment)) {
    const ended = formatExpiresAtLabel(enrollment.expiresAt);
    return ended ? `Access expired on ${ended}` : 'Access expired';
  }
  const remaining = daysRemaining(enrollment.expiresAt);
  const until = formatExpiresAtLabel(enrollment.expiresAt);
  if (remaining !== null && remaining <= 7) {
    return until ? `${remaining} day${remaining === 1 ? '' : 's'} left · until ${until}` : `${remaining} days left`;
  }
  return until ? `Valid until ${until}` : 'Limited access';
}
