import { apiUrl } from './config';

export function clearAuthSession(): void {
  localStorage.removeItem('skillfort_token');
  localStorage.removeItem('skillfort_user');
}

export function getAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  const token = localStorage.getItem('skillfort_token');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function resolveRequestUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input === 'string' && input.startsWith('/')) {
    return apiUrl(input);
  }
  return input;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = {
    ...getAuthHeaders(),
    ...(init.headers as Record<string, string> | undefined),
  };
  const response = await fetch(resolveRequestUrl(input), { ...init, headers });

  if (response.status === 401) {
    try {
      const data = await response.clone().json();
      if (data.code === 'SESSION_REPLACED') {
        clearAuthSession();
        window.dispatchEvent(
          new CustomEvent('skillfort:session-replaced', {
            detail: data.error as string,
          })
        );
      }
    } catch {
      // ignore non-JSON 401 bodies
    }
  }

  return response;
}
