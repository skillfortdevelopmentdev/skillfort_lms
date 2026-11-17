import fs from 'fs';
import path from 'path';
import type { DBStore, Lesson } from '../../src/types';
import {
  INITIAL_SETTINGS,
  INITIAL_COUPONS,
  INITIAL_COURSES,
  INITIAL_MODULES,
  INITIAL_LESSONS,
} from '../../src/data';
import { deduplicateDB, repairDatabaseIntegrity } from '../dbIntegrity';

const DB_FILE = path.join(process.cwd(), 'db.json');
const BACKUP_FILE = path.join(process.cwd(), '.db_backup.json');

function extractVimeoId(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const match = url.match(/(?:\/video\/|\/|)\b(\d{8,12})\b/);
  return match ? match[1] : undefined;
}

export function createFreshJsonStore(): DBStore {
  return {
    settings: INITIAL_SETTINGS,
    coupons: INITIAL_COUPONS,
    courses: INITIAL_COURSES,
    modules: INITIAL_MODULES,
    lessons: INITIAL_LESSONS,
    users: [
      { id: 'user-admin', email: 'admin@skillfort.com', name: 'Sarah Connor (Admin)', role: 'admin', createdAt: new Date().toISOString() },
      { id: 'user-student', email: 'student@skillfort.com', name: 'John Doe', role: 'student', createdAt: new Date().toISOString() },
    ],
    passwords: {
      'user-admin': 'admin123',
      'user-student': 'student123',
    },
    progress: [
      {
        id: 'prog-react-11',
        userId: 'user-student',
        courseId: 'course-react',
        lessonId: 'lesson-react-11',
        currentTimestamp: 600,
        watchDuration: 600,
        isCompleted: true,
        updatedAt: new Date().toISOString(),
      },
    ],
    enrollments: [
      {
        id: 'enroll-1',
        userId: 'user-student',
        courseId: 'course-1',
        enrolledAt: new Date().toISOString(),
        progressPercentage: 0,
        isCompleted: false,
      },
      {
        id: 'enroll-react',
        userId: 'user-student',
        courseId: 'course-react',
        enrolledAt: new Date().toISOString(),
        progressPercentage: 0,
        isCompleted: false,
      },
    ],
    payments: [],
    certificates: [],
    platformKv: {},
  };
}

function runJsonMigrations(dbData: DBStore): boolean {
  let migrated = false;

  if (dbData.courses?.some(c => c.id === 'course-react-tested') === false) {
    const reactTestedCourse = INITIAL_COURSES.find(c => c.id === 'course-react-tested');
    if (reactTestedCourse) {
      dbData.courses.push(reactTestedCourse);
      migrated = true;
    }
  }

  if (!dbData.modules.some(m => m.courseId === 'course-react-tested')) {
    dbData.modules.push(...INITIAL_MODULES.filter(m => m.courseId === 'course-react-tested'));
    migrated = true;
  }

  const reactTestedLessons = INITIAL_LESSONS.filter(l => l.moduleId === 'module-react-tested-1');
  reactTestedLessons.forEach(l => {
    if (!dbData.lessons.some(dl => dl.id === l.id)) {
      dbData.lessons.push(l);
      migrated = true;
    }
  });

  dbData.lessons = dbData.lessons.map(l => {
    if (l.type === 'video' && l.vimeoUrl && !l.vimeoId) {
      const vId = extractVimeoId(l.vimeoUrl);
      if (vId) {
        migrated = true;
        return { ...l, vimeoId: vId };
      }
    }
    return l;
  });

  dbData.courses.forEach(c => {
    const cMods = dbData.modules.filter(m => m.courseId === c.id).sort((a, b) => a.order - b.order);
    if (cMods.length === 0) return;
    const cModIds = cMods.map(m => m.id);
    const cLessons = dbData.lessons.filter(l => cModIds.includes(l.moduleId));
    if (cLessons.some(l => l.type === 'quiz')) return;

    const lastMod = cMods[cMods.length - 1];
    const maxOrder = cLessons
      .filter(l => l.moduleId === lastMod.id)
      .reduce((max, l) => (l.order > max ? l.order : max), 0);

    const newQuizLesson: Lesson = {
      id: `quiz-${c.id}-${Math.random().toString(36).substring(2, 6)}`,
      moduleId: lastMod.id,
      title: `${c.title} Evaluation & Syllabus Quiz`,
      type: 'quiz',
      order: maxOrder + 1,
      passMark: '80',
      timeLimit: '15',
    };
    dbData.lessons.push(newQuizLesson);
    migrated = true;
  });

  return migrated;
}

export function loadStoreFromJsonFile(): DBStore {
  let dbData: DBStore | null = null;

  if (fs.existsSync(DB_FILE)) {
    try {
      dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
      console.error('Failed to parse primary db.json file:', e);
    }
  }

  if (!dbData && fs.existsSync(BACKUP_FILE)) {
    try {
      dbData = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
      console.log('Restored primary database from .db_backup.json');
      fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
    } catch (e) {
      console.error('Failed to parse backup database file:', e);
    }
  }

  if (!dbData) {
    const fresh = createFreshJsonStore();
    persistJsonStore(fresh);
    return fresh;
  }

  if (!dbData.platformKv || typeof dbData.platformKv !== 'object') {
    dbData.platformKv = {};
  }

  const migrated = runJsonMigrations(dbData);
  const deduped = deduplicateDB(dbData);
  const integrityFixed = repairDatabaseIntegrity(dbData);

  if (migrated || deduped || integrityFixed) {
    persistJsonStore(dbData);
  }

  return dbData;
}

export function persistJsonStore(store: DBStore): void {
  const serialized = JSON.stringify(store, null, 2);
  fs.writeFileSync(DB_FILE, serialized);
  fs.writeFileSync(BACKUP_FILE, serialized);
}

export function loadJsonStoreFromPath(filePath: string): DBStore {
  const raw = fs.readFileSync(filePath, 'utf8');
  const store = JSON.parse(raw) as DBStore;
  repairDatabaseIntegrity(store);
  return store;
}
