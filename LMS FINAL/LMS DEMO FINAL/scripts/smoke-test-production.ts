/**
 * Post-deploy smoke tests. Run against a live server after build/deploy.
 *
 *   npm run smoke:prod
 *   SMOKE_BASE_URL=https://lms.example.com npm run smoke:prod
 *   SMOKE_ADMIN_EMAIL=... SMOKE_ADMIN_PASSWORD=... npm run smoke:prod
 */
import 'dotenv/config';

const BASE_URL = (process.env.SMOKE_BASE_URL || process.env.APP_URL || 'http://localhost:3000').replace(
  /\/$/,
  ''
);

type CheckResult = { name: string; ok: boolean; detail: string };

async function request(
  path: string,
  init?: RequestInit
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  let body: unknown;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

function record(results: CheckResult[], name: string, ok: boolean, detail: string): void {
  results.push({ name, ok, detail });
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} ${name}: ${detail}`);
}

async function main(): Promise<void> {
  console.log(`\nSkillFort production smoke test → ${BASE_URL}\n`);
  const results: CheckResult[] = [];

  // 1. Health
  try {
    const { status, body } = await request('/api/health');
    const data = body as { ok?: boolean; database?: string; courses?: number };
    const healthy = status === 200 && data.ok === true;
    record(
      results,
      'Health endpoint',
      healthy,
      healthy
        ? `ok (database=${data.database}, courses=${data.courses ?? '?'})`
        : `HTTP ${status}`
    );
    if (healthy && data.database === 'json') {
      record(
        results,
        'Database backend',
        false,
        'Using db.json — set DATABASE_URL for production'
      );
    } else if (healthy) {
      record(results, 'Database backend', true, data.database ?? 'unknown');
    }
  } catch (err) {
    record(results, 'Health endpoint', false, err instanceof Error ? err.message : String(err));
  }

  // 2. Public courses API
  try {
    const { status, body } = await request('/api/courses');
    const list = Array.isArray(body) ? body : null;
    record(
      results,
      'Public courses API',
      status === 200 && list !== null,
      status === 200 ? `${list?.length ?? 0} courses` : `HTTP ${status}`
    );
  } catch (err) {
    record(results, 'Public courses API', false, err instanceof Error ? err.message : String(err));
  }

  // 3. SPA index
  try {
    const res = await fetch(`${BASE_URL}/`);
    const html = await res.text();
    record(
      results,
      'SPA index',
      res.status === 200 && html.includes('<!DOCTYPE html'),
      `HTTP ${res.status}`
    );
  } catch (err) {
    record(results, 'SPA index', false, err instanceof Error ? err.message : String(err));
  }

  // 4. Admin routes require auth
  try {
    const { status, body } = await request('/api/admin/settings');
    const err = (body as { error?: string })?.error;
    record(
      results,
      'Admin auth guard',
      status === 401,
      status === 401 ? (err ?? 'Unauthorized') : `Expected 401, got ${status}`
    );
  } catch (err) {
    record(results, 'Admin auth guard', false, err instanceof Error ? err.message : String(err));
  }

  // 5. Invalid login rejected
  try {
    const { status } = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'smoke-invalid@example.com', password: 'wrong-password-xyz' }),
    });
    record(results, 'Login rejection', status === 401, `HTTP ${status}`);
  } catch (err) {
    record(results, 'Login rejection', false, err instanceof Error ? err.message : String(err));
  }

  // 6. Optional admin login
  const adminEmail = process.env.SMOKE_ADMIN_EMAIL?.trim();
  const adminPassword = process.env.SMOKE_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    try {
      const { status, body } = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      const token = (body as { token?: string })?.token;
      if (status !== 200 || !token) {
        record(results, 'Admin login', false, `HTTP ${status}`);
      } else {
        const me = await request('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const role = (me.body as { role?: string })?.role;
        record(
          results,
          'Admin login',
          me.status === 200 && role === 'admin',
          role === 'admin' ? 'authenticated as admin' : `role=${role ?? 'unknown'}`
        );
      }
    } catch (err) {
      record(results, 'Admin login', false, err instanceof Error ? err.message : String(err));
    }
  } else {
    console.log('○ Admin login: skipped (set SMOKE_ADMIN_EMAIL + SMOKE_ADMIN_PASSWORD to test)');
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed\n`);

  if (failed.length > 0) {
    console.error('Failed checks:');
    failed.forEach((f) => console.error(`  - ${f.name}: ${f.detail}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
