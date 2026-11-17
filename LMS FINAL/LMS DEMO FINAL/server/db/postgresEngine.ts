import fs from 'fs';
import path from 'path';
import pg from 'pg';
import type {
  DBStore,
  User,
  Course,
  CourseModule,
  Lesson,
  LessonProgress,
  Enrollment,
  Coupon,
  PaymentReport,
  Certificate,
  SystemSettings,
} from '../../src/types';
import { repairDatabaseIntegrity } from '../dbIntegrity';

const { Pool } = pg;

let pool: pg.Pool | null = null;

const SCHEMA_PATH = path.join(process.cwd(), 'server', 'db', 'schema.sql');

export function isPostgresEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function shouldRequirePostgres(): boolean {
  if (process.env.REQUIRE_DATABASE_URL === 'true') {
    return true;
  }
  return process.env.NODE_ENV === 'production';
}

export function assertPostgresConfigured(): void {
  if (shouldRequirePostgres() && !isPostgresEnabled()) {
    throw new Error(
      'DATABASE_URL is required. Set a PostgreSQL connection string in .env before starting the server. ' +
        'Example: postgresql://skillfort:skillfort_dev@localhost:5432/skillfort_lms'
    );
  }
}

export async function initPostgres(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for PostgreSQL');
  }

  pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err);
  });

  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  await pool.query(schemaSql);
  const { bindMediaBlobPool } = await import('../mediaBlobs');
  bindMediaBlobPool(pool);
  console.log('🐘 PostgreSQL connected and schema initialized');
}

export async function closePostgres(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

function getPool(): pg.Pool {
  if (!pool) {
    throw new Error('PostgreSQL pool is not initialized');
  }
  return pool;
}

function parseJsonColumn<T>(value: unknown): T | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }
  return value as T;
}

/** Normalize values for PostgreSQL JSONB columns (objects, arrays, and plain strings/URLs). */
function serializeJsonColumn(value: unknown): string | null {
  if (value == null) return null;

  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value));
    } catch {
      // Plain string values (URLs, tokens, etc.) — valid JSON string literal
      return JSON.stringify(value);
    }
  }

  try {
    return JSON.stringify(value);
  } catch {
    console.warn('Skipping invalid JSON column value (stringify failed)');
    return null;
  }
}

export async function isPostgresEmpty(): Promise<boolean> {
  const result = await getPool().query('SELECT COUNT(*)::int AS count FROM users');
  return result.rows[0].count === 0;
}

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    role: row.role as User['role'],
    createdAt: new Date(row.created_at as string).toISOString(),
    firstName: row.first_name as string | undefined,
    lastName: row.last_name as string | undefined,
    phone: row.phone as string | undefined,
    areaOfInterest: row.area_of_interest as string | undefined,
    companyOrCollege: row.company_or_college as string | undefined,
    professionalStatus: row.professional_status as string | undefined,
    registrationProfile: parseJsonColumn<User['registrationProfile']>(row.registration_profile),
    isBlocked: Boolean(row.is_blocked),
  };
}

function mapCourse(row: Record<string, unknown>): Course {
  const validityDaysRaw = row.validity_days;
  const validityDays =
    validityDaysRaw == null || validityDaysRaw === ''
      ? undefined
      : Number(validityDaysRaw);

  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    coverImage: row.cover_image as string,
    price: Number(row.price),
    duration: row.duration as string,
    level: row.level as Course['level'],
    category: row.category as string,
    rating: Number(row.rating),
    reviewsCount: Number(row.reviews_count),
    isPublished: Boolean(row.is_published),
    createdAt: new Date(row.created_at as string).toISOString(),
    validityDays:
      validityDays !== undefined && Number.isFinite(validityDays) && validityDays > 0
        ? validityDays
        : undefined,
  };
}

function mapModule(row: Record<string, unknown>): CourseModule {
  return {
    id: row.id as string,
    courseId: row.course_id as string,
    title: row.title as string,
    description: row.description as string,
    order: Number(row.sort_order),
  };
}

function mapLesson(row: Record<string, unknown>): Lesson {
  const lesson: Lesson = {
    id: row.id as string,
    moduleId: row.module_id as string,
    title: row.title as string,
    type: row.type as Lesson['type'],
    order: Number(row.sort_order),
  };

  if (row.vimeo_url) lesson.vimeoUrl = row.vimeo_url as string;
  if (row.vimeo_id) lesson.vimeoId = row.vimeo_id as string;
  if (row.thumbnail) lesson.thumbnail = row.thumbnail as string;
  if (row.file_url) lesson.fileUrl = row.file_url as string;
  if (row.file_name) lesson.fileName = row.file_name as string;
  if (row.file_size) lesson.fileSize = row.file_size as string;
  if (row.duration) lesson.duration = row.duration as string;
  if (row.time_limit) lesson.timeLimit = row.time_limit as string;
  if (row.pass_mark) lesson.passMark = row.pass_mark as string;
  if (row.attempts) lesson.attempts = row.attempts as string;
  if (row.questions) {
    lesson.questions = parseJsonColumn<Lesson['questions']>(row.questions);
  }

  return lesson;
}

export async function loadStoreFromPostgres(): Promise<DBStore> {
  const client = getPool();

  const [
    settingsRes,
    usersRes,
    passwordsRes,
    coursesRes,
    modulesRes,
    lessonsRes,
    progressRes,
    enrollmentsRes,
    couponsRes,
    paymentsRes,
    certificatesRes,
    platformKvRes,
  ] = await Promise.all([
    client.query('SELECT * FROM settings WHERE id = 1'),
    client.query('SELECT * FROM users ORDER BY created_at ASC'),
    client.query('SELECT * FROM passwords'),
    client.query('SELECT * FROM courses ORDER BY created_at ASC'),
    client.query('SELECT * FROM modules ORDER BY sort_order ASC'),
    client.query('SELECT * FROM lessons ORDER BY sort_order ASC'),
    client.query('SELECT * FROM lesson_progress ORDER BY updated_at ASC'),
    client.query('SELECT * FROM enrollments ORDER BY enrolled_at ASC'),
    client.query('SELECT * FROM coupons ORDER BY expiry_date ASC'),
    client.query('SELECT * FROM payments ORDER BY created_at ASC'),
    client.query('SELECT * FROM certificates ORDER BY issue_date ASC'),
    client.query('SELECT key, value FROM platform_kv ORDER BY key ASC'),
  ]);

  const settingsRow = settingsRes.rows[0];
  const settings: SystemSettings = settingsRow
    ? {
        gstRate: Number(settingsRow.gst_rate),
        systemName: settingsRow.system_name,
        supportEmail: settingsRow.support_email,
        razorpayKeyId: settingsRow.razorpay_key_id,
        themeColor: settingsRow.theme_color,
        smtpEnabled: Boolean(settingsRow.smtp_enabled),
        smtpHost: settingsRow.smtp_host ?? '',
        smtpPort: Number(settingsRow.smtp_port ?? 587),
        smtpSecure: Boolean(settingsRow.smtp_secure),
        smtpUser: settingsRow.smtp_user ?? '',
        smtpPass: settingsRow.smtp_pass ?? '',
        mailFrom: settingsRow.mail_from ?? '',
        adminNotifyEmail: settingsRow.admin_notify_email ?? '',
      }
    : {
        gstRate: 18,
        systemName: 'SkillFort LMS',
        supportEmail: 'support@skillfort.com',
        razorpayKeyId: '',
        themeColor: '#F89A15',
        smtpEnabled: false,
        smtpHost: '',
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: '',
        smtpPass: '',
        mailFrom: '',
        adminNotifyEmail: '',
      };

  const passwords: Record<string, string> = {};
  for (const row of passwordsRes.rows) {
    passwords[row.user_id] = row.password_hash;
  }

  const platformKv: Record<string, unknown> = {};
  for (const row of platformKvRes.rows) {
    platformKv[row.key] = row.value;
  }

  const store: DBStore = {
    settings,
    users: usersRes.rows.map(mapUser),
    passwords,
    courses: coursesRes.rows.map(mapCourse),
    modules: modulesRes.rows.map(mapModule),
    lessons: lessonsRes.rows.map(mapLesson),
    progress: progressRes.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      courseId: row.course_id,
      lessonId: row.lesson_id,
      currentTimestamp: Number(row.playback_seconds),
      watchDuration: Number(row.watch_duration),
      isCompleted: Boolean(row.is_completed),
      updatedAt: new Date(row.updated_at).toISOString(),
    })),
    enrollments: enrollmentsRes.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      courseId: row.course_id,
      enrolledAt: new Date(row.enrolled_at).toISOString(),
      progressPercentage: Number(row.progress_percentage),
      isCompleted: Boolean(row.is_completed),
      certificateId: row.certificate_id || undefined,
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : undefined,
    })),
    coupons: couponsRes.rows.map((row) => ({
      id: row.id,
      code: row.code,
      discountPercent: Number(row.discount_percent),
      isActive: Boolean(row.is_active),
      minAmount: Number(row.min_amount),
      expiryDate: new Date(row.expiry_date).toISOString().slice(0, 10),
    })),
    payments: paymentsRes.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name,
      courseId: row.course_id,
      courseTitle: row.course_title,
      amountPaid: Number(row.amount_paid),
      originalAmount: Number(row.original_amount),
      taxAmount: Number(row.tax_amount),
      couponApplied: row.coupon_applied || undefined,
      invoiceId: row.invoice_id,
      razorpayPaymentId: row.razorpay_payment_id,
      razorpayOrderId: row.razorpay_order_id,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    })),
    certificates: certificatesRes.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      courseId: row.course_id,
      courseTitle: row.course_title,
      certificateNumber: row.certificate_number,
      issueDate: row.issue_date,
      qrVerificationUrl: row.qr_verification_url,
    })),
    platformKv,
  };

  repairDatabaseIntegrity(store);
  return store;
}

export async function saveStoreToPostgres(store: DBStore): Promise<void> {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM certificates');
    await client.query('DELETE FROM platform_kv');
    await client.query('DELETE FROM payments');
    await client.query('DELETE FROM enrollments');
    await client.query('DELETE FROM lesson_progress');
    await client.query('DELETE FROM lessons');
    await client.query('DELETE FROM modules');
    await client.query('DELETE FROM coupons');
    await client.query('DELETE FROM courses');
    await client.query('DELETE FROM passwords');
    await client.query('DELETE FROM users');

    await client.query(
      `INSERT INTO settings (
        id, gst_rate, system_name, support_email, razorpay_key_id, theme_color,
        smtp_enabled, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, mail_from, admin_notify_email
      )
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         gst_rate = EXCLUDED.gst_rate,
         system_name = EXCLUDED.system_name,
         support_email = EXCLUDED.support_email,
         razorpay_key_id = EXCLUDED.razorpay_key_id,
         theme_color = EXCLUDED.theme_color,
         smtp_enabled = EXCLUDED.smtp_enabled,
         smtp_host = EXCLUDED.smtp_host,
         smtp_port = EXCLUDED.smtp_port,
         smtp_secure = EXCLUDED.smtp_secure,
         smtp_user = EXCLUDED.smtp_user,
         smtp_pass = EXCLUDED.smtp_pass,
         mail_from = EXCLUDED.mail_from,
         admin_notify_email = EXCLUDED.admin_notify_email`,
      [
        store.settings.gstRate,
        store.settings.systemName,
        store.settings.supportEmail,
        store.settings.razorpayKeyId,
        store.settings.themeColor,
        store.settings.smtpEnabled,
        store.settings.smtpHost,
        store.settings.smtpPort,
        store.settings.smtpSecure,
        store.settings.smtpUser,
        store.settings.smtpPass,
        store.settings.mailFrom,
        store.settings.adminNotifyEmail,
      ]
    );

    for (const user of store.users) {
      await client.query(
        `INSERT INTO users (
          id, email, name, role, created_at, first_name, last_name, phone,
          area_of_interest, company_or_college, professional_status, registration_profile, is_blocked
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          user.id,
          user.email,
          user.name,
          user.role,
          user.createdAt,
          user.firstName ?? null,
          user.lastName ?? null,
          user.phone ?? null,
          user.areaOfInterest ?? user.registrationProfile?.requiredCourse ?? null,
          user.companyOrCollege ?? user.registrationProfile?.collegeName ?? null,
          user.professionalStatus ?? null,
          user.registrationProfile ?? null,
          Boolean(user.isBlocked),
        ]
      );
    }

    for (const [userId, passwordHash] of Object.entries(store.passwords)) {
      await client.query(
        'INSERT INTO passwords (user_id, password_hash) VALUES ($1, $2)',
        [userId, passwordHash]
      );
    }

    for (const course of store.courses) {
      await client.query(
        `INSERT INTO courses (
          id, title, description, cover_image, price, duration, level, category,
          rating, reviews_count, is_published, created_at, validity_days
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          course.id,
          course.title,
          course.description,
          course.coverImage,
          course.price,
          course.duration,
          course.level,
          course.category,
          course.rating,
          course.reviewsCount,
          course.isPublished,
          course.createdAt,
          course.validityDays ?? null,
        ]
      );
    }

    for (const mod of store.modules) {
      await client.query(
        'INSERT INTO modules (id, course_id, title, description, sort_order) VALUES ($1,$2,$3,$4,$5)',
        [mod.id, mod.courseId, mod.title, mod.description, mod.order]
      );
    }

    for (const lesson of store.lessons) {
      await client.query(
        `INSERT INTO lessons (
      id, module_id, title, type, sort_order, vimeo_url, vimeo_id, thumbnail,
      file_url, file_name, file_size, duration, time_limit, pass_mark, attempts, questions
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)`,
        [
          lesson.id,
          lesson.moduleId,
          lesson.title,
          lesson.type,
          lesson.order,
          lesson.vimeoUrl ?? null,
          lesson.vimeoId ?? null,
          lesson.thumbnail ?? null,
          lesson.fileUrl ?? null,
          lesson.fileName ?? null,
          lesson.fileSize ?? null,
          lesson.duration ?? null,
          lesson.timeLimit ?? null,
          lesson.passMark ?? null,
          lesson.attempts ?? null,
          serializeJsonColumn(lesson.questions),
        ]
      );
    }

    for (const prog of store.progress) {
      await client.query(
        `INSERT INTO lesson_progress (
          id, user_id, course_id, lesson_id, playback_seconds, watch_duration, is_completed, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          prog.id,
          prog.userId,
          prog.courseId,
          prog.lessonId,
          prog.currentTimestamp,
          prog.watchDuration,
          prog.isCompleted,
          prog.updatedAt,
        ]
      );
    }

    for (const enrollment of store.enrollments) {
      await client.query(
        `INSERT INTO enrollments (
          id, user_id, course_id, enrolled_at, progress_percentage, is_completed, certificate_id, expires_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          enrollment.id,
          enrollment.userId,
          enrollment.courseId,
          enrollment.enrolledAt,
          enrollment.progressPercentage,
          enrollment.isCompleted,
          enrollment.certificateId ?? null,
          enrollment.expiresAt ?? null,
        ]
      );
    }

    for (const coupon of store.coupons) {
      await client.query(
        `INSERT INTO coupons (id, code, discount_percent, is_active, min_amount, expiry_date)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          coupon.id,
          coupon.code,
          coupon.discountPercent,
          coupon.isActive,
          coupon.minAmount,
          coupon.expiryDate,
        ]
      );
    }

    for (const payment of store.payments) {
      await client.query(
        `INSERT INTO payments (
          id, user_id, user_email, user_name, course_id, course_title, amount_paid,
          original_amount, tax_amount, coupon_applied, invoice_id, razorpay_payment_id,
          razorpay_order_id, status, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          payment.id,
          payment.userId,
          payment.userEmail,
          payment.userName,
          payment.courseId,
          payment.courseTitle,
          payment.amountPaid,
          payment.originalAmount,
          payment.taxAmount,
          payment.couponApplied ?? null,
          payment.invoiceId,
          payment.razorpayPaymentId,
          payment.razorpayOrderId,
          payment.status,
          payment.createdAt,
        ]
      );
    }

    for (const cert of store.certificates) {
      await client.query(
        `INSERT INTO certificates (
          id, user_id, user_name, course_id, course_title, certificate_number, issue_date, qr_verification_url
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          cert.id,
          cert.userId,
          cert.userName,
          cert.courseId,
          cert.courseTitle,
          cert.certificateNumber,
          cert.issueDate,
          cert.qrVerificationUrl,
        ]
      );
    }

    for (const [key, value] of Object.entries(store.platformKv || {})) {
      const serialized = serializeJsonColumn(value);
      if (serialized == null) continue;
      await client.query(
        `INSERT INTO platform_kv (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())`,
        [key, serialized]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function seedPostgresFromStore(store: DBStore): Promise<void> {
  await saveStoreToPostgres(store);
}
