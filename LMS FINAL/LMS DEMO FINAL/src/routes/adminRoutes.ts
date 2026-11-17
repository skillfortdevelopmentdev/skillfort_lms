export type AdminTab =
  | 'dashboard'
  | 'courses-all'
  | 'courses-add'
  | 'courses-categories'
  | 'courses-reviews'
  | 'lessons-all'
  | 'lessons-add'
  | 'quiz-all'
  | 'quiz-add'
  | 'quiz-questions'
  | 'orders-all'
  | 'landing-banner'
  | 'wall-of-success'
  | 'students-all'
  | 'students-add'
  | 'admins-all'
  | 'admins-add'
  | 'instructors-all'
  | 'instructors-add'
  | 'settings'
  | 'courses-cert-template'
  | 'mail_sandbox';

const VALID_TABS = new Set<string>([
  'dashboard',
  'courses-all',
  'courses-add',
  'courses-categories',
  'courses-reviews',
  'lessons-all',
  'lessons-add',
  'quiz-all',
  'quiz-add',
  'quiz-questions',
  'orders-all',
  'landing-banner',
  'wall-of-success',
  'students-all',
  'students-add',
  'admins-all',
  'admins-add',
  'instructors-all',
  'instructors-add',
  'settings',
  'courses-cert-template',
  'mail_sandbox',
]);

export function isAdminTab(value: string): value is AdminTab {
  return VALID_TABS.has(value);
}

export function parseAdminPath(pathname: string): AdminTab {
  const rest = pathname.replace(/^\/admin\/?/, '');
  const tab = rest.split('/').filter(Boolean)[0] || 'dashboard';
  if (isAdminTab(tab)) {
    return tab;
  }
  return 'dashboard';
}

export function adminPath(tab: AdminTab): string {
  return tab === 'dashboard' ? '/admin/dashboard' : `/admin/${tab}`;
}
