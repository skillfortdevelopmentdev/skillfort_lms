/** Backend origin when frontend is hosted separately (e.g. Vercel + Render). */
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
}

/** Resolve relative upload paths to the backend when API is on another origin. */
export function resolveMediaUrl(url: string | undefined): string {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  return apiUrl(url);
}
