/**
 * PostgreSQL persistence + CRUD smoke test.
 * Requires DATABASE_URL in .env (Neon, Render Postgres, or local Docker).
 *
 * Usage: npm run db:test
 */
import 'dotenv/config';
import type { Course, User } from '../src/types';
import { hashPassword } from '../server/auth';
import { applyStudentAdminUpdate } from '../server/studentAdmin';
import {
  closePostgres,
  initPostgres,
  loadStoreFromPostgres,
} from '../server/db/postgresEngine';
import {
  initDatabase,
  invalidateCache,
  loadDB,
  saveDB,
  isUsingPostgres,
} from '../server/db/index';

const TEST_EMAIL = `pg-crud-test-${Date.now()}@skillfort.test`;
const TEST_COURSE_ID = `course-pg-test-${Date.now()}`;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  OK: ${message}`);
}

function sampleRegistrationProfile() {
  return {
    branch: 'Chennai',
    dateOfBirth: '2000-05-15',
    highestQualification: 'B.E / B.Tech',
    stream: 'Computer Science',
    collegeName: 'PG Test College',
    yearOfPassout: '2024',
    knownTechnologies: 'Java, React',
    requiredCourse: 'Java Full Stack Developer Certification Program',
    placementRequired: 'yes' as const,
    preferredCallbackTime: '10 AM - 12 PM',
    hasWorkExperience: 'no' as const,
    address: '123 Test Street, Chennai',
    panNo: 'ABCDE1234F',
    aadharNo: '987654321012',
    source: 'Website',
  };
}

async function verifyPostgresUserRow(userId: string): Promise<User | undefined> {
  const fresh = await loadStoreFromPostgres();
  return fresh.users.find((u) => u.id === userId);
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('\nDATABASE_URL is not set in .env');
    console.error('Add your PostgreSQL connection string, then run: npm run db:test\n');
    console.error('Example (Neon):');
    console.error(
      'DATABASE_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require\n'
    );
    process.exit(1);
  }

  console.log('\n=== SkillFort PostgreSQL CRUD Test ===\n');

  await initDatabase();
  assert(isUsingPostgres(), 'App is using PostgreSQL backend');

  const db = await loadDB();
  const beforeUsers = db.users.length;
  const beforeCourses = db.courses.length;

  // --- CREATE student with full registration profile ---
  console.log('\n1. CREATE student + registrationProfile');
  const userId = `user-pgtest-${Date.now()}`;
  const profile = sampleRegistrationProfile();
  const newUser: User = {
    id: userId,
    email: TEST_EMAIL,
    name: 'PG Test Student',
    role: 'student',
    createdAt: new Date().toISOString(),
    firstName: 'PG',
    lastName: 'Test',
    phone: '9000000001',
    areaOfInterest: profile.requiredCourse,
    companyOrCollege: profile.collegeName,
    registrationProfile: profile,
  };

  db.users.push(newUser);
  db.passwords[userId] = await hashPassword('TestPass123!');
  await saveDB(db);

  invalidateCache();
  const afterCreate = await loadDB();
  const created = afterCreate.users.find((u) => u.id === userId);
  assert(Boolean(created), 'Student exists after save');
  assert(
    created?.registrationProfile?.branch === profile.branch,
    'registrationProfile.branch persisted in loadDB()'
  );
  assert(
    created?.registrationProfile?.collegeName === profile.collegeName,
    'registrationProfile.collegeName persisted in loadDB()'
  );

  const fromPg = await verifyPostgresUserRow(userId);
  assert(Boolean(fromPg?.registrationProfile), 'registrationProfile readable from PostgreSQL directly');
  assert(
    fromPg?.registrationProfile?.requiredCourse === profile.requiredCourse,
    'registrationProfile JSONB round-trip via PostgreSQL'
  );

  // --- UPDATE student (admin-style partial merge) ---
  console.log('\n2. UPDATE student (admin merge)');
  const user = afterCreate.users.find((u) => u.id === userId)!;
  await applyStudentAdminUpdate(
    user,
    {
      firstName: 'PG',
      lastName: 'Updated',
      phone: '9000000002',
      registrationProfile: {
        ...profile,
        stream: 'Information Technology',
        address: '',
      },
    },
    afterCreate.passwords
  );
  await saveDB(afterCreate);

  invalidateCache();
  const afterUpdate = await loadDB();
  const updated = afterUpdate.users.find((u) => u.id === userId);
  assert(updated?.lastName === 'Updated', 'Student name fields updated');
  assert(
    updated?.registrationProfile?.stream === 'Information Technology',
    'Registration stream updated'
  );
  assert(
    updated?.registrationProfile?.address === profile.address,
    'Empty address in update did not wipe existing address (merge)'
  );

  // --- CREATE course ---
  console.log('\n3. CREATE course');
  const testCourse: Course = {
    id: TEST_COURSE_ID,
    title: 'PG CRUD Test Course',
    description: 'Temporary course for postgres CRUD verification',
    coverImage: 'https://placehold.co/600x400',
    price: 999,
    duration: '2h',
    level: 'Beginner',
    category: 'Testing',
    rating: 4.5,
    reviewsCount: 0,
    isPublished: false,
    createdAt: new Date().toISOString(),
  };

  afterUpdate.courses.push(testCourse);
  await saveDB(afterUpdate);

  invalidateCache();
  const afterCourseCreate = await loadDB();
  assert(
    afterCourseCreate.courses.some((c) => c.id === TEST_COURSE_ID),
    'Course created and persisted'
  );

  // --- UPDATE course ---
  console.log('\n4. UPDATE course');
  const course = afterCourseCreate.courses.find((c) => c.id === TEST_COURSE_ID)!;
  course.title = 'PG CRUD Test Course (Updated)';
  course.price = 1499;
  await saveDB(afterCourseCreate);

  invalidateCache();
  const afterCourseUpdate = await loadDB();
  const updatedCourse = afterCourseUpdate.courses.find((c) => c.id === TEST_COURSE_ID);
  assert(updatedCourse?.title.includes('Updated'), 'Course title updated');
  assert(updatedCourse?.price === 1499, 'Course price updated');

  // --- DELETE course ---
  console.log('\n5. DELETE course');
  afterCourseUpdate.courses = afterCourseUpdate.courses.filter((c) => c.id !== TEST_COURSE_ID);
  await saveDB(afterCourseUpdate);

  invalidateCache();
  const afterCourseDelete = await loadDB();
  assert(
    !afterCourseDelete.courses.some((c) => c.id === TEST_COURSE_ID),
    'Course deleted from PostgreSQL'
  );

  // --- DELETE test student ---
  console.log('\n6. DELETE test student');
  afterCourseDelete.users = afterCourseDelete.users.filter((u) => u.id !== userId);
  delete afterCourseDelete.passwords[userId];
  await saveDB(afterCourseDelete);

  invalidateCache();
  const finalDb = await loadDB();
  assert(!finalDb.users.some((u) => u.id === userId), 'Test student removed');
  assert(finalDb.users.length === beforeUsers, 'User count restored after cleanup');
  assert(finalDb.courses.length === beforeCourses, 'Course count restored after cleanup');

  console.log('\n=== ALL POSTGRES CRUD TESTS PASSED ===\n');
  await closePostgres();
}

main().catch(async (err) => {
  console.error('\n=== POSTGRES CRUD TEST FAILED ===');
  console.error(err);
  try {
    await closePostgres();
  } catch {
    // ignore
  }
  process.exit(1);
});
