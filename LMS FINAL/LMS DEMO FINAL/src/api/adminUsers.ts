import { apiFetch } from './client';
import { getPlatformValue, setPlatformValue } from './platformKv';
import type { User } from '../types';

const ADMIN_DIRECTORY_KEY = 'skillfort_admin_directory';

const ADMIN_LIST_URLS = [
  '/api/admin/admins',
  '/api/admin/users?role=admin',
  '/api/admin/students?adminsOnly=1',
] as const;

async function readJsonArray(resp: Response): Promise<User[] | null> {
  const contentType = resp.headers.get('content-type') || '';
  if (!resp.ok || !contentType.includes('application/json')) {
    return null;
  }
  try {
    const data = await resp.json();
    if (!Array.isArray(data)) return null;
    return data.filter((entry) => entry && entry.role === 'admin') as User[];
  } catch {
    return null;
  }
}

function mergeAdmins(...lists: Array<User[] | null | undefined>): User[] {
  const map = new Map<string, User>();
  for (const list of lists) {
    for (const user of list || []) {
      if (user?.id && user.role === 'admin') {
        map.set(user.id, user);
      }
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

async function readCachedAdminDirectory(): Promise<User[]> {
  const raw = await getPlatformValue<unknown>(ADMIN_DIRECTORY_KEY, null);
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as User[];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? (parsed as User[]) : [];
  } catch {
    return [];
  }
}

export async function persistAdminDirectory(admins: User[]): Promise<void> {
  if (admins.length === 0) return;
  await setPlatformValue(ADMIN_DIRECTORY_KEY, mergeAdmins(admins));
}

export async function upsertAdminInDirectory(admin: User): Promise<void> {
  const cached = await readCachedAdminDirectory();
  await persistAdminDirectory(mergeAdmins(cached, [admin]));
}

export async function removeAdminFromDirectory(adminId: string): Promise<void> {
  const cached = await readCachedAdminDirectory();
  const next = cached.filter((entry) => entry.id !== adminId);
  await setPlatformValue(ADMIN_DIRECTORY_KEY, next);
}

export async function deleteAdminAccount(
  userId: string
): Promise<{ ok: boolean; message?: string }> {
  const resp = await apiFetch(`/api/admin/admins/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  const data = await resp.json().catch(() => ({} as Record<string, unknown>));

  if (!resp.ok) {
    return {
      ok: false,
      message:
        (typeof data.error === 'string' && data.error) ||
        (typeof data.message === 'string' && data.message) ||
        `Could not delete administrator (HTTP ${resp.status}).`,
    };
  }

  await removeAdminFromDirectory(userId);
  return { ok: true };
}

export async function fetchAdminUsers(fallbackAdmin?: User): Promise<User[]> {
  for (const url of ADMIN_LIST_URLS) {
    const fromApi = await readJsonArray(await apiFetch(url));
    if (fromApi !== null) {
      await persistAdminDirectory(fromApi);
      return mergeAdmins(fromApi, fallbackAdmin ? [fallbackAdmin] : []);
    }
  }

  const cached = await readCachedAdminDirectory();
  return mergeAdmins(cached, fallbackAdmin ? [fallbackAdmin] : []);
}

export interface CreateAdminResult {
  ok: boolean;
  user?: User;
  emailSent?: boolean;
  emailErrors?: string[];
  message?: string;
}

export async function createAdminAccount(payload: {
  name: string;
  email: string;
  password: string;
}): Promise<CreateAdminResult> {
  const body = {
    name: payload.name.trim(),
    email: payload.email.trim(),
    password: payload.password,
    role: 'admin' as const,
  };

  let resp = await apiFetch('/api/admin/admins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (resp.status === 404) {
    resp = await apiFetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  const data = await resp.json().catch(() => ({} as Record<string, unknown>));

  if (!resp.ok) {
    return {
      ok: false,
      message:
        (typeof data.message === 'string' && data.message) ||
        (typeof data.error === 'string' && data.error) ||
        `Could not create administrator (HTTP ${resp.status}). Restart the server if this persists.`,
    };
  }

  const user = data.user as User;
  if (user?.id) {
    await upsertAdminInDirectory(user);
  }

  return {
    ok: true,
    user,
    emailSent: Boolean(data.emailSent),
    emailErrors: Array.isArray(data.emailErrors) ? (data.emailErrors as string[]) : undefined,
  };
}
