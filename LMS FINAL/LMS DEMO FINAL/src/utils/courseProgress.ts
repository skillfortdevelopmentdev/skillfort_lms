import type { CourseModule, Lesson, LessonProgress } from '../types';

export function getOrderedCourseLessons(
  courseId: string,
  modules: CourseModule[],
  lessons: Lesson[]
): Lesson[] {
  const courseModules = modules
    .filter((m) => m.courseId === courseId)
    .sort((a, b) => a.order - b.order);

  return lessons
    .filter((l) => courseModules.some((m) => m.id === l.moduleId))
    .sort((a, b) => {
      const m1 = courseModules.find((m) => m.id === a.moduleId);
      const m2 = courseModules.find((m) => m.id === b.moduleId);
      if (!m1 || !m2) return 0;
      if (m1.order !== m2.order) return m1.order - m2.order;
      return a.order - b.order;
    });
}

export function getPreviewLesson(
  courseId: string,
  modules: CourseModule[],
  lessons: Lesson[]
): Lesson | null {
  const ordered = getOrderedCourseLessons(courseId, modules, lessons);
  return ordered.find((l) => l.type === 'video' && l.vimeoId) ?? null;
}

export interface ContinueTarget {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  progressPercentage: number;
}

export function findContinueTarget(
  courseId: string,
  courseTitle: string,
  progressPercentage: number,
  modules: CourseModule[],
  lessons: Lesson[],
  progressList: LessonProgress[]
): ContinueTarget | null {
  const courseModules = modules
    .filter((m) => m.courseId === courseId)
    .sort((a, b) => a.order - b.order);
  const ordered = getOrderedCourseLessons(courseId, modules, lessons);

  for (const lesson of ordered) {
    const record = progressList.find((p) => p.lessonId === lesson.id);
    if (!record?.isCompleted) {
      const mod = courseModules.find((m) => m.id === lesson.moduleId);
      return {
        courseId,
        courseTitle,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        moduleTitle: mod?.title ?? 'Module',
        progressPercentage,
      };
    }
  }

  if (ordered[0]) {
    const mod = courseModules.find((m) => m.id === ordered[0].moduleId);
    return {
      courseId,
      courseTitle,
      lessonId: ordered[0].id,
      lessonTitle: ordered[0].title,
      moduleTitle: mod?.title ?? 'Module',
      progressPercentage,
    };
  }

  return null;
}
