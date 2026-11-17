import { apiFetch } from './client';

const memoryCache = new Map<string, unknown>();

export function primePlatformCache(entries: Record<string, unknown>): void {
  Object.entries(entries).forEach(([key, value]) => {
    memoryCache.set(key, value);
  });
}

export function readPlatformCache<T>(key: string, fallback: T): T {
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as T;
  }
  return fallback;
}

export function parsePlatformValue<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export async function syncPlatformCache(): Promise<void> {
  try {
    const resp = await apiFetch('/api/platform/sync');
    if (!resp.ok) return;
    const data = await resp.json();
    if (data.entries && typeof data.entries === 'object') {
      primePlatformCache(data.entries);
    }
  } catch {
    // ignore offline bootstrap failures
  }
}

export async function getPlatformValue<T>(key: string, fallback: T): Promise<T> {
  try {
    const resp = await apiFetch(`/api/platform/kv/${encodeURIComponent(key)}`);
    if (resp.status === 404) return fallback;
    if (!resp.ok) return fallback;
    const data = await resp.json();
    const value = (data.value ?? fallback) as T;
    memoryCache.set(key, value);
    return value;
  } catch {
    return fallback;
  }
}

export async function setPlatformValue(key: string, value: unknown): Promise<boolean> {
  try {
    memoryCache.set(key, value);
    const resp = await apiFetch(`/api/platform/kv/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function migrateLocalStorageToServer(userId?: string): Promise<void> {
  if (localStorage.getItem('skillfort_platform_migrated') === '1') {
    localStorage.removeItem('skillfort_user');
    return;
  }

  const skip = new Set([
    'skillfort_token',
    'skillfort_user',
    'skillfort_dark_mode',
    'skillfort_platform_migrated',
  ]);
  const keys = Object.keys(localStorage).filter(
    (key) => key.startsWith('skillfort_') && !skip.has(key)
  );

  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      await setPlatformValue(key, JSON.parse(raw));
    } catch {
      await setPlatformValue(key, raw);
    }
  }

  if (userId) {
    const { migrateLegacyDarkModeToDb } = await import('./userPreferences');
    await migrateLegacyDarkModeToDb(userId);
  }

  localStorage.setItem('skillfort_platform_migrated', '1');
  localStorage.removeItem('skillfort_user');
  localStorage.removeItem('skillfort_dark_mode');
}
