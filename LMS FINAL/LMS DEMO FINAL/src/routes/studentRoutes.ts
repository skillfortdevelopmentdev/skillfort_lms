export type StudentMenu =
  | 'dashboard'
  | 'courses'
  | 'my-courses'
  | 'cart'
  | 'orders'
  | 'profile'
  | 'certificates'
  | 'quiz-results'
  | 'notifications';

const VALID_MENUS = new Set<string>([
  'dashboard',
  'courses',
  'my-courses',
  'cart',
  'orders',
  'profile',
  'certificates',
  'quiz-results',
  'notifications',
]);

export function isStudentMenu(value: string): value is StudentMenu {
  return VALID_MENUS.has(value);
}

export function parseStudentPath(pathname: string): {
  menu: StudentMenu;
  courseId?: string;
  lessonId?: string;
  browseCourseId?: string;
} {
  const rest = pathname.replace(/^\/student\/?/, '');
  const parts = rest.split('/').filter(Boolean);

  if (parts[0] === 'courses' && parts[1]) {
    if (parts[2] === 'preview') {
      return { menu: 'courses', browseCourseId: parts[1] };
    }
    if (parts[2] === 'lessons' && parts[3]) {
      return { menu: 'my-courses', courseId: parts[1], lessonId: parts[3] };
    }
    return { menu: 'my-courses', courseId: parts[1] };
  }

  const section = parts[0] || 'dashboard';
  if (isStudentMenu(section)) {
    return { menu: section };
  }

  return { menu: 'dashboard' };
}

export function studentPath(
  menu: StudentMenu,
  courseId?: string,
  lessonId?: string
): string {
  if (courseId && lessonId) {
    return `/student/courses/${courseId}/lessons/${lessonId}`;
  }
  if (courseId) {
    return `/student/courses/${courseId}`;
  }
  return `/student/${menu}`;
}

export function studentBrowsePath(courseId: string): string {
  return `/student/courses/${courseId}/preview`;
}
