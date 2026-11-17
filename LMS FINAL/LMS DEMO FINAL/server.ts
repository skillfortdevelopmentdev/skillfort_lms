import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createHttpServer } from 'http';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initializeApp as initAdminApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createServer as createViteServer } from 'vite';
import { 
  User, Course, CourseModule, Lesson, LessonProgress, 
  Enrollment, Coupon, PaymentReport, Certificate, SystemSettings, DBStore
} from './src/types';
import { 
  INITIAL_SETTINGS, INITIAL_COUPONS, INITIAL_COURSES, 
  INITIAL_MODULES, INITIAL_LESSONS 
} from './src/data';
import {
  signToken,
  hashPassword,
  verifyPassword,
  createRequireAuth,
  createRequireAdmin,
  assertSelfOrAdmin,
  findUserByEmail,
} from './server/auth';
import { startStudentSession, clearStudentSession } from './server/sessions';
import {
  initDatabase,
  loadDB,
  saveDB,
  invalidateCache,
  isUsingPostgres,
  registerJsonSaveHook,
  runDatabaseMaintenance,
} from './server/db/index';
import { canAccessPlatformKey, canWritePlatformKey } from './server/platformKvAccess';
import type { AuthPayload } from './server/auth';
import { validateProductionEnvironment } from './server/startupValidation';
import { mergeSettingsUpdate, settingsForAdminResponse, settingsForPublicResponse } from './server/settingsUtils';
import { priceCartLines } from './server/payments/pricing';
import {
  createPaymentOrder,
  resolvePaymentMode,
  verifyRazorpaySignature,
  verifyWebhookSignature,
} from './server/payments/razorpayService';
import { captureLineItems } from './server/payments/capture';
import { refundCapturedPayment } from './server/payments/refund';
import { saveCourseBannerDataUrl } from './server/uploads/courseBanner';
import { savePlacementSuccessDataUrl } from './server/uploads/placementSuccess';
import {
  addWallOfSuccessEntry,
  getWallOfSuccessEntries,
  removeWallOfSuccessEntry,
} from './server/wallOfSuccess';
import {
  deleteCourseReview,
  getAllCourseReviews,
  getApprovedReviewsForCourse,
  getStudentReviews,
  submitCourseReview,
  updateCourseReviewStatus,
} from './server/courseReviews';
import { getLandingBanner, saveLandingBanner } from './server/landingBanner';
import { saveLandingBannerDataUrl } from './server/uploads/landingBanner';
import { isCloudinaryConfigured } from './server/uploads/cloudinaryStorage';
import { shouldPersistMediaInDatabase } from './server/mediaBlobs';
import { serveUploadsMiddleware } from './server/uploads/serveUploads';
import {
  addToCart,
  readCartIds,
  removeFromCart,
  writeCartIds,
} from './server/cart';
import { buildContinueTargets } from './server/continueLearning';
import {
  createEnrollmentRecord,
  assertActiveEnrollment,
  extendEnrollmentByDays,
} from './server/enrollmentAccess';
import { parseValidityDays } from './src/utils/courseValidity';
import { enrichCourseWithValidity } from './server/courseValiditySync';
import { checkAbandonedReminders, touchWishlistMeta } from './server/reminders';
import { applyStudentAdminUpdate } from './server/studentAdmin';
import {
  getCourseLessons,
  issueCertificateIfEligible,
} from './server/courseCompletion';
import {
  notifyCertificateEarned,
  notifyContactForm,
  notifyManualEnrollment,
  notifyPasswordChanged,
  notifyPasswordResetRequest,
  notifyPaymentFailed,
  isSmtpConfigured,
  notifyPaymentSuccess,
  notifyStudentRegistration,
  notifyAdminAccountCreated,
  sendSmtpTestEmail,
  verifySmtpConnection,
} from './server/mail/send';

const requireAuth = createRequireAuth(loadDB);
const requireAdmin = createRequireAdmin(loadDB);

function issueAuthToken(db: DBStore, user: User): string {
  if (user.role === 'student') {
    const sessionId = startStudentSession(db, user.id);
    return signToken({
      userId: user.id,
      role: user.role,
      email: user.email,
      sessionId,
    });
  }
  return signToken({ userId: user.id, role: user.role, email: user.email });
}

function buildVerifyUrl(certificateNumber: string): string {
  const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/verify/${encodeURIComponent(certificateNumber)}`;
}

function enrolledCourseIdsForUser(db: DBStore, userId: string): Set<string> {
  return new Set(
    db.enrollments.filter((e) => e.userId === userId).map((e) => e.courseId)
  );
}

function platformKvAccessOptions(db: DBStore, auth: AuthPayload) {
  if (auth.role === 'admin') {
    return {};
  }
  return { enrolledCourseIds: enrolledCourseIdsForUser(db, auth.userId) };
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

function corsAllowedOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  return appUrl ? [appUrl] : [];
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = corsAllowedOrigins();
  if (origin && (allowed.length === 0 || allowed.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const db = await loadDB();
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body ?? '');

    if (resolvePaymentMode(db.settings) === 'live') {
      if (!signature || !verifyWebhookSignature(db.settings, rawBody, signature)) {
        res.status(400).json({ error: 'Invalid webhook signature' });
        return;
      }
    }

    const payload = JSON.parse(rawBody);
    const event = payload?.event;
    if (event === 'payment.captured') {
      const paymentEntity = payload?.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;
      const notes = paymentEntity?.notes ?? {};
      const userId = notes.userId;
      const courseIdsRaw = notes.courseIds as string | undefined;
      if (userId && courseIdsRaw && orderId && paymentId) {
        const courseIds = courseIdsRaw.split(',').filter(Boolean);
        const userObj = db.users.find((u) => u.id === userId);
        const courses = courseIds
          .map((id) => db.courses.find((c) => c.id === id))
          .filter(Boolean) as Course[];
        if (userObj && courses.length > 0) {
          const pricing = priceCartLines(courses, db.coupons, null);
          await captureLineItems(db, userObj, pricing.lineItems, orderId, paymentId, null);
          await saveDB(db);
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[WEBHOOK] razorpay error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

app.use(express.json({ limit: '12mb' }));
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  // Vercel frontend loads /uploads images from this API host — same-origin blocks cross-site <img>.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/register', rateLimit({ windowMs: 15 * 60 * 1000, max: 15, standardHeaders: true, legacyHeaders: false }));
app.use('/api/contact', rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false }));

// ==========================================
// DB ENGINE (ROBUST PERSISTENT STATE ON DISK)
// ==========================================

function extractVimeoId(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const match = url.match(/(?:\/video\/|\/|)\b(\d{8,12})\b/);
  return match ? match[1] : undefined;
}

// ==========================================
// FIREBASE CLOUD DATABASE ENGINE (OPTIONAL SYNC)
// ==========================================
let firestoreDb: any = null;

function initializeFirebaseAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    try {
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }
      
      initAdminApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      
      firestoreDb = getFirestore();
      console.log('💚 SUCCESS: Secure cloud-hosted Firebase Database initialized successfully in server!');
    } catch (err) {
      console.error('❌ Failed to initialize Firebase admin with provided credentials:', err);
    }
  } else {
    console.log('ℹ️ Firebase optional sync available when FIREBASE_* env vars are set (JSON file mode only).');
  }
}

async function loadDBFromFirebase(): Promise<DBStore | null> {
  if (!firestoreDb) return null;
  try {
    const keys = [
      'settings', 'coupons', 'courses', 'modules', 'lessons', 
      'users', 'passwords', 'progress', 'enrollments', 'payments', 'certificates'
    ];
    
    const store: Partial<DBStore> = {};
    const ref = firestoreDb.collection('skillfort_lms_v1');
    
    const promises = keys.map(async (key) => {
      const doc = await ref.doc(key).get();
      if (doc.exists) {
        const data = doc.data();
        if (data && 'list' in data) {
          return { key, value: data.list };
        } else if (data && 'value' in data) {
          return { key, value: data.value };
        }
      }
      return { key, value: null };
    });
    
    const results = await Promise.all(promises);
    let foundAny = false;
    for (const res of results) {
      if (res.value !== null) {
        store[res.key as keyof DBStore] = res.value;
        foundAny = true;
      }
    }
    
    if (foundAny) {
      console.log('📥 Restored database state directly from cloud Firestore collections!');
      return store as DBStore;
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes('PERMISSION_DENIED') || errMsg.includes('firestore.googleapis.com') || errMsg.includes('disabled') || errMsg.includes('7')) {
      console.warn('⚠️ [FIREBASE NOTICE] Cloud Firestore API is disabled or not permitted in this Firebase project (lms-e65f3). Reverting cleanly to secure local file storage.');
      firestoreDb = null;
    } else {
      console.error('❌ Failed to fetch database state from Firebase:', err);
    }
  }
  return null;
}

async function saveDBToFirebase(store: DBStore) {
  if (!firestoreDb) return;
  try {
    const ref = firestoreDb.collection('skillfort_lms_v1');
    const batch = firestoreDb.batch();
    
    // Safely serialize and parse back the store to prune any "undefined" keys
    // which Firebase collections reject during batch set operations.
    const cleanStore = JSON.parse(JSON.stringify(store));
    
    Object.entries(cleanStore).forEach(([key, val]) => {
      const docRef = ref.doc(key);
      if (Array.isArray(val)) {
        batch.set(docRef, { list: val });
      } else {
        batch.set(docRef, { value: val });
      }
    });
    
    await batch.commit();
    console.log('📤 Synchronized database state to cloud Firestore collections safely!');
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes('PERMISSION_DENIED') || errMsg.includes('firestore.googleapis.com') || errMsg.includes('disabled') || errMsg.includes('7')) {
      console.warn('⚠️ [FIREBASE NOTICE] Cloud Firestore API is disabled or not permitted in this Firebase project (lms-e65f3). Reverting cleanly to secure local file storage.');
      firestoreDb = null;
    } else {
      console.error('❌ Failed to sync database state to Firebase:', err);
    }
  }
}

// ==========================================
// API ROUTING ENDPOINTS
// ==========================================

app.get('/api/health', async (_req, res) => {
  try {
    const db = await loadDB();
    res.json({
      ok: true,
      database: isUsingPostgres() ? 'postgres' : 'json',
      users: db.users.length,
      courses: db.courses.length,
    });
  } catch {
    res.status(503).json({ ok: false, error: 'Database unavailable' });
  }
});

app.get('/api/wall-of-success', async (_req, res) => {
  try {
    const db = await loadDB();
    res.json(getWallOfSuccessEntries(db));
  } catch {
    res.status(503).json({ error: 'Unable to load wall of success' });
  }
});

app.get('/api/landing-banner', async (_req, res) => {
  try {
    const db = await loadDB();
    res.json(getLandingBanner(db));
  } catch {
    res.status(503).json({ error: 'Unable to load landing banner' });
  }
});

app.get('/api/courses/:courseId/reviews', async (req, res) => {
  try {
    const db = await loadDB();
    const reviews = getApprovedReviewsForCourse(db, req.params.courseId).map((review) => ({
      id: review.id,
      courseId: review.courseId,
      studentName: review.studentName,
      rating: review.rating,
      comment: review.comment,
      isPinned: review.isPinned,
      createdAt: review.createdAt,
    }));
    res.json(reviews);
  } catch {
    res.status(503).json({ error: 'Unable to load course reviews' });
  }
});

app.post('/api/courses/:courseId/reviews', requireAuth, async (req, res) => {
  if (!req.auth || req.auth.role !== 'student') {
    res.status(403).json({ error: 'Only students can submit reviews.' });
    return;
  }

  const { rating, comment } = req.body as { rating?: number; comment?: string };
  if (rating === undefined || comment === undefined) {
    res.status(400).json({ error: 'rating and comment are required.' });
    return;
  }

  try {
    const db = await loadDB();
    const user = db.users.find((entry) => entry.id === req.auth!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const result = submitCourseReview(db, {
      userId: user.id,
      studentName: user.name,
      courseId: req.params.courseId,
      rating,
      comment,
    });

    if (result.ok === false) {
      res.status(400).json({ error: result.error });
      return;
    }

    await saveDB(db);
    res.status(201).json(result.review);
  } catch {
    res.status(503).json({ error: 'Unable to submit review' });
  }
});

app.get('/api/student/course-reviews', requireAuth, async (req, res) => {
  if (!req.auth || req.auth.role !== 'student') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const db = await loadDB();
    res.json(getStudentReviews(db, req.auth.userId));
  } catch {
    res.status(503).json({ error: 'Unable to load your reviews' });
  }
});

// 1. AUTHENTICATION MODULE API
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const db = await loadDB();
  const user = findUserByEmail(db.users, email);
  const storedPassword = user ? db.passwords[user.id] : undefined;

  if (!user || !storedPassword || !(await verifyPassword(storedPassword, password))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (user.isBlocked) {
    res.status(403).json({ error: 'Your account has been blocked. Please contact support.' });
    return;
  }

  if (!(storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$'))) {
    db.passwords[user.id] = await hashPassword(password);
  }

  const token = issueAuthToken(db, user);
  await saveDB(db);

  res.json({
    token,
    user,
  });
});

app.post('/api/auth/register', async (req, res) => {
  const {
    email,
    password,
    name,
    firstName,
    lastName,
    phone,
    registrationProfile,
  } = req.body;

  if (!email || !password || !name) {
    res.status(400).json({ error: 'Name, email, and password are required' });
    return;
  }

  const profile = registrationProfile as User['registrationProfile'];
  const requiredProfileFields: Array<[string, unknown]> = [
    ['branch', profile?.branch],
    ['dateOfBirth', profile?.dateOfBirth],
    ['highestQualification', profile?.highestQualification],
    ['stream', profile?.stream],
    ['collegeName', profile?.collegeName],
    ['yearOfPassout', profile?.yearOfPassout],
    ['requiredCourse', profile?.requiredCourse],
    ['placementRequired', profile?.placementRequired],
    ['hasWorkExperience', profile?.hasWorkExperience],
    ['address', profile?.address],
    ['source', profile?.source],
  ];

  for (const [field, value] of requiredProfileFields) {
    if (!value || (typeof value === 'string' && !value.trim())) {
      res.status(400).json({ error: `Registration field "${field}" is required.` });
      return;
    }
  }

  if (!firstName?.trim() || !lastName?.trim() || !phone?.trim()) {
    res.status(400).json({ error: 'First name, last name, and phone are required.' });
    return;
  }

  const db = await loadDB();
  if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    res.status(400).json({ error: 'Email already registered' });
    return;
  }

  const newId = `user-${Math.random().toString(36).substring(2, 11)}`;
  const newUser: User = {
    id: newId,
    email: email.toLowerCase(),
    name,
    role: 'student',
    createdAt: new Date().toISOString(),
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    phone: String(phone).trim(),
    areaOfInterest: profile!.requiredCourse,
    companyOrCollege: profile!.collegeName,
    registrationProfile: {
      branch: profile!.branch.trim(),
      dateOfBirth: profile!.dateOfBirth,
      highestQualification: profile!.highestQualification.trim(),
      stream: profile!.stream.trim(),
      collegeName: profile!.collegeName.trim(),
      yearOfPassout: profile!.yearOfPassout.trim(),
      knownTechnologies: profile!.knownTechnologies?.trim() || undefined,
      requiredCourse: profile!.requiredCourse.trim(),
      placementRequired: profile!.placementRequired,
      preferredCallbackTime: profile!.preferredCallbackTime?.trim() || undefined,
      hasWorkExperience: profile!.hasWorkExperience,
      address: profile!.address.trim(),
      panNo: profile!.panNo?.trim() || undefined,
      aadharNo: profile!.aadharNo?.trim() || undefined,
      source: profile!.source.trim(),
    },
  };

  db.users.push(newUser);
  db.passwords[newId] = await hashPassword(password);
  await saveDB(db);

  void notifyStudentRegistration(db.settings, newUser).catch((err) =>
    console.error('[MAIL] registration notify failed:', err)
  );

  const token = issueAuthToken(db, newUser);
  await saveDB(db);

  res.json({
    token,
    user: newUser,
  });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const db = await loadDB();
  const user = db.users.find((u) => u.id === req.auth!.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (user.isBlocked && user.role === 'student') {
    res.status(403).json({ error: 'Your account has been blocked. Please contact support.' });
    return;
  }
  res.json(user);
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  if (req.auth?.role === 'student') {
    const db = await loadDB();
    clearStudentSession(db, req.auth.userId);
    await saveDB(db);
  }
  res.json({ success: true });
});

// Get user profile
app.get('/api/auth/profile/:userId', requireAuth, async (req, res) => {
  if (!assertSelfOrAdmin(req, res, req.params.userId)) return;
  const { userId } = req.params;
  const db = await loadDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

// Update profile name
app.post('/api/auth/profile-update/:userId', requireAuth, async (req, res) => {
  if (!assertSelfOrAdmin(req, res, req.params.userId)) return;
  const { userId } = req.params;
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const db = await loadDB();
  const userIndex = db.users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  db.users[userIndex].name = name;
  await saveDB(db);
  res.json(db.users[userIndex]);
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.auth!.userId;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current and new password are required' });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters' });
    return;
  }

  const db = await loadDB();
  const stored = db.passwords[userId];
  if (!stored || !(await verifyPassword(stored, currentPassword))) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }

  db.passwords[userId] = await hashPassword(newPassword);
  await saveDB(db);

  const user = db.users.find((u) => u.id === userId);
  if (user) {
    void notifyPasswordChanged(db.settings, user).catch((err) =>
      console.error('[MAIL] password changed notify failed:', err)
    );
  }

  res.json({ success: true });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const email = String(req.body?.email || '').trim();
  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  const db = await loadDB();
  const user = findUserByEmail(db.users, email);

  if (!user) {
    res.json({
      accountFound: false,
      message: 'No student account is registered with this email address. Check the spelling or register first.',
    });
    return;
  }

  if (user.isBlocked) {
    res.json({
      accountFound: true,
      blocked: true,
      message: 'This account has been blocked. Please contact support for help.',
    });
    return;
  }

  const { createPasswordResetToken } = await import('./server/passwordReset');
  const token = createPasswordResetToken(db, user.id, user.email);
  await saveDB(db);

  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const resetPath = `/reset-password?token=${encodeURIComponent(token)}`;

  const mailResult = await notifyPasswordResetRequest(db.settings, user, resetUrl);

  const smtpReady = isSmtpConfigured(db.settings);
  const response: {
    accountFound: boolean;
    message: string;
    emailSent?: boolean;
    resetPath: string;
    devResetUrl?: string;
    maskedEmail?: string;
  } = {
    accountFound: true,
    message: mailResult.sent
      ? `Reset instructions were sent to ${user.email}. You can also use the button below.`
      : smtpReady
        ? `We could not deliver email to ${user.email}. Use the button below to reset your password.`
        : `Account found for ${user.email}. Email is not configured on this server — use the button below to reset your password.`,
    emailSent: mailResult.sent,
    resetPath,
    devResetUrl: resetUrl,
    maskedEmail: user.email,
  };

  if (!mailResult.sent) {
    console.log(
      `[PASSWORD RESET] Email not sent${smtpReady ? ` (${mailResult.error || 'delivery failed'})` : ' (SMTP not configured)'}. Reset link for ${user.email}: ${resetUrl}`
    );
  }

  res.json(response);
});

app.get('/api/auth/reset-password/validate', async (req, res) => {
  const token = String(req.query.token || '').trim();
  if (!token) {
    res.status(400).json({ error: 'Reset token is required' });
    return;
  }

  const db = await loadDB();
  const { validatePasswordResetToken } = await import('./server/passwordReset');
  const validation = validatePasswordResetToken(db, token);
  if (validation.ok === false) {
    res.status(400).json({ error: validation.error });
    return;
  }

  res.json({ valid: true, email: validation.record.email });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const newPassword = String(req.body?.newPassword || '');

  if (!token || !newPassword) {
    res.status(400).json({ error: 'Token and new password are required' });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters' });
    return;
  }

  const db = await loadDB();
  const { validatePasswordResetToken, markPasswordResetTokenUsed } = await import('./server/passwordReset');
  const validation = validatePasswordResetToken(db, token);
  if (validation.ok === false) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const user = db.users.find((u) => u.id === validation.record.userId);
  if (!user) {
    res.status(400).json({ error: 'Invalid or expired reset link.' });
    return;
  }

  db.passwords[user.id] = await hashPassword(newPassword);
  markPasswordResetTokenUsed(db, token);
  await saveDB(db);

  void notifyPasswordChanged(db.settings, user).catch((err) =>
    console.error('[MAIL] password reset notify failed:', err)
  );

  res.json({ success: true });
});


// 2. SYSTEM SETTINGS & SYSTEM DATA
app.get('/api/settings', async (req, res) => {
  const db = await loadDB();
  res.json({
    settings: settingsForPublicResponse(db.settings),
    coupons: db.coupons.filter(c => c.isActive)
  });
});

app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    res.status(400).json({ error: 'Name, email, and message are required.' });
    return;
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(String(email).trim())) {
    res.status(400).json({ error: 'Please provide a valid email address.' });
    return;
  }

  const db = await loadDB();
  const result = await notifyContactForm(db.settings, {
    name: String(name).trim(),
    email: String(email).trim(),
    message: String(message).trim(),
  });

  if (!result.sent) {
    res.status(503).json({
      error: result.error || 'Unable to send your message right now. Please try again later.',
    });
    return;
  }

  res.json({ success: true });
});

// Protect all admin routes
app.use('/api/admin', requireAdmin);

app.get('/api/admin/settings', async (req, res) => {
  const db = await loadDB();
  res.json(settingsForAdminResponse(db.settings));
});

app.post('/api/admin/settings', async (req, res) => {
  const db = await loadDB();
  db.settings = mergeSettingsUpdate(db.settings, req.body);
  await saveDB(db);
  res.json(settingsForAdminResponse(db.settings));
});

app.post('/api/admin/uploads/course-banner', async (req, res) => {
  const { dataUrl } = req.body as { dataUrl?: string };
  if (!dataUrl || typeof dataUrl !== 'string') {
    res.status(400).json({ error: 'Image data is required.' });
    return;
  }
  try {
    const saved = await saveCourseBannerDataUrl(dataUrl);
    res.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    res.status(400).json({ error: message });
  }
});

app.get('/api/admin/wall-of-success', async (_req, res) => {
  const db = await loadDB();
  res.json(getWallOfSuccessEntries(db));
});

app.get('/api/admin/landing-banner', async (_req, res) => {
  const db = await loadDB();
  res.json(getLandingBanner(db));
});

app.put('/api/admin/landing-banner', async (req, res) => {
  const db = await loadDB();
  const result = saveLandingBanner(db, req.body as Record<string, unknown>);
  if (result.ok === false) {
    res.status(400).json({ error: result.error });
    return;
  }
  await saveDB(db);
  res.json(result.config);
});

app.post('/api/admin/landing-banner/image', async (req, res) => {
  const { dataUrl } = req.body as { dataUrl?: string };
  if (!dataUrl || typeof dataUrl !== 'string') {
    res.status(400).json({ error: 'Image data is required.' });
    return;
  }
  try {
    const saved = await saveLandingBannerDataUrl(dataUrl);
    const db = await loadDB();
    const result = saveLandingBanner(db, { heroImageUrl: saved.url });
    if (result.ok === false) {
      res.status(400).json({ error: result.error });
      return;
    }
    await saveDB(db);
    res.json(result.config);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    res.status(400).json({ error: message });
  }
});

app.post('/api/admin/wall-of-success', async (req, res) => {
  const { dataUrl } = req.body as { dataUrl?: string };
  if (!dataUrl || typeof dataUrl !== 'string') {
    res.status(400).json({ error: 'Image data is required.' });
    return;
  }
  try {
    const saved = await savePlacementSuccessDataUrl(dataUrl);
    const db = await loadDB();
    const entry = addWallOfSuccessEntry(db, saved.url, saved.filename);
    await saveDB(db);
    res.status(201).json(entry);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    res.status(400).json({ error: message });
  }
});

app.delete('/api/admin/wall-of-success/:id', async (req, res) => {
  const db = await loadDB();
  const removed = await removeWallOfSuccessEntry(db, req.params.id);
  if (!removed) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }
  await saveDB(db);
  res.json({ success: true });
});

app.get('/api/admin/course-reviews', async (_req, res) => {
  const db = await loadDB();
  res.json(getAllCourseReviews(db));
});

app.patch('/api/admin/course-reviews/:id', async (req, res) => {
  const { status, isPinned } = req.body as {
    status?: 'pending' | 'approved' | 'rejected';
    isPinned?: boolean;
  };

  if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'Valid status is required.' });
    return;
  }

  const db = await loadDB();
  const result = updateCourseReviewStatus(db, req.params.id, status, isPinned);
  if (result.ok === false) {
    res.status(404).json({ error: result.error });
    return;
  }

  await saveDB(db);
  res.json(result.review);
});

app.delete('/api/admin/course-reviews/:id', async (req, res) => {
  const db = await loadDB();
  const result = deleteCourseReview(db, req.params.id);
  if (result.ok === false) {
    res.status(404).json({ error: result.error });
    return;
  }

  await saveDB(db);
  res.json({ success: true, courseId: result.courseId });
});

app.post('/api/admin/mail/verify', async (req, res) => {
  const db = await loadDB();
  const result = await verifySmtpConnection(db.settings);
  if (!result.ok) {
    res.status(400).json(result);
    return;
  }
  res.json({ ok: true, message: 'SMTP connection verified successfully' });
});

app.post('/api/admin/mail/test', async (req, res) => {
  const { to } = req.body;
  if (!to) {
    res.status(400).json({ error: 'Recipient email (to) is required' });
    return;
  }
  const db = await loadDB();
  const result = await sendSmtpTestEmail(db.settings, String(to));
  if (!result.sent) {
    res.status(400).json(result);
    return;
  }
  res.json({ sent: true, message: `Test email sent to ${to}` });
});


// 3. COURSE, MODULES & LESSONS INVENTORY
function getStudentCountsByCourse(db: DBStore): Map<string, number> {
  const byCourse = new Map<string, Set<string>>();
  const track = (courseId: string, userId: string) => {
    if (!courseId || !userId) return;
    let students = byCourse.get(courseId);
    if (!students) {
      students = new Set();
      byCourse.set(courseId, students);
    }
    students.add(userId);
  };

  for (const enrollment of db.enrollments) {
    track(enrollment.courseId, enrollment.userId);
  }
  for (const payment of db.payments) {
    if (payment.status === 'captured') {
      track(payment.courseId, payment.userId);
    }
  }

  const counts = new Map<string, number>();
  for (const [courseId, students] of byCourse) {
    counts.set(courseId, students.size);
  }
  return counts;
}

app.get('/api/courses', async (req, res) => {
  const db = await loadDB();
  const studentCounts = getStudentCountsByCourse(db);
  // Return courses, annotated with details
  const result = db.courses.map(course => {
    const enriched = enrichCourseWithValidity(db, course);
    const modules = db.modules.filter(m => m.courseId === course.id);
    const moduleIds = modules.map(m => m.id);
    const lessons = db.lessons.filter(l => moduleIds.includes(l.moduleId));
    return {
      ...enriched,
      modulesCount: modules.length,
      lessonsCount: lessons.length,
      studentCount: studentCounts.get(course.id) ?? 0,
    };
  });
  res.json(result);
});

app.get('/api/courses/:courseId', async (req, res) => {
  const { courseId } = req.params;
  const db = await loadDB();
  const course = db.courses.find(c => c.id === courseId);
  if (!course) {
    res.status(404).json({ error: "Course not found" });
    return;
  }
  const modules = db.modules
    .filter(m => m.courseId === courseId)
    .sort((a, b) => a.order - b.order);
  
  const lessons = db.lessons
    .filter(l => modules.some(m => m.id === l.moduleId))
    .sort((a, b) => a.order - b.order);

  res.json({
    course: enrichCourseWithValidity(db, course),
    modules,
    lessons
  });
});

app.get('/api/courses/:courseId/preview', async (req, res) => {
  const { courseId } = req.params;
  const db = await loadDB();
  const course = db.courses.find((c) => c.id === courseId);
  if (!course) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }

  const modules = db.modules
    .filter((m) => m.courseId === courseId)
    .sort((a, b) => a.order - b.order);

  const orderedLessons = db.lessons
    .filter((l) => modules.some((m) => m.id === l.moduleId))
    .sort((a, b) => {
      const m1 = modules.find((m) => m.id === a.moduleId);
      const m2 = modules.find((m) => m.id === b.moduleId);
      if (!m1 || !m2) return 0;
      if (m1.order !== m2.order) return m1.order - m2.order;
      return a.order - b.order;
    });

  const previewLesson = orderedLessons.find((l) => l.type === 'video' && l.vimeoId);
  if (!previewLesson) {
    res.status(404).json({ error: 'No preview lesson available' });
    return;
  }

  const previewModule = modules.find((m) => m.id === previewLesson.moduleId);
  res.json({
    courseId,
    courseTitle: course.title,
    lesson: {
      id: previewLesson.id,
      title: previewLesson.title,
      vimeoId: previewLesson.vimeoId,
      thumbnail: previewLesson.thumbnail,
      duration: previewLesson.duration,
    },
    moduleTitle: previewModule?.title ?? 'Introduction',
  });
});

// Admin modification APIs
app.post('/api/admin/courses', async (req, res) => {
  const { title, description, coverImage, price, duration, level, category, validityDays } = req.body;
  if (!title || !description || price === undefined) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const db = await loadDB();
  const newCourse: Course = {
    id: `course-${Math.random().toString(36).substring(2, 9)}`,
    title,
    description,
    coverImage: coverImage || "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80",
    price: Number(price),
    duration: duration || "10h 0m",
    level: level || "Intermediate",
    category: category || "Development",
    rating: 5.0,
    reviewsCount: 0,
    isPublished: true,
    createdAt: new Date().toISOString(),
    validityDays: parseValidityDays(validityDays),
  };
  db.courses.push(newCourse);
  await saveDB(db);
  res.json(newCourse);
});

app.put('/api/admin/courses/:courseId', async (req, res) => {
  const { courseId } = req.params;
  const { title, description, coverImage, price, duration, level, category, isPublished, validityDays } = req.body;
  const db = await loadDB();
  const index = db.courses.findIndex(c => c.id === courseId);
  if (index === -1) {
    res.status(404).json({ error: "Course not found" });
    return;
  }
  db.courses[index] = {
    ...db.courses[index],
    title: title ?? db.courses[index].title,
    description: description ?? db.courses[index].description,
    coverImage: coverImage ?? db.courses[index].coverImage,
    price: price !== undefined ? Number(price) : db.courses[index].price,
    duration: duration ?? db.courses[index].duration,
    level: level ?? db.courses[index].level,
    category: category ?? db.courses[index].category,
    isPublished: isPublished ?? db.courses[index].isPublished,
    validityDays:
      validityDays !== undefined
        ? parseValidityDays(validityDays)
        : db.courses[index].validityDays,
  };
  await saveDB(db);
  res.json(db.courses[index]);
});

app.delete('/api/admin/courses/:courseId', async (req, res) => {
  const { courseId } = req.params;
  const db = await loadDB();
  db.courses = db.courses.filter(c => c.id !== courseId);
  // clean cascaded
  const modulesToClear = db.modules.filter(m => m.courseId === courseId).map(m => m.id);
  db.modules = db.modules.filter(m => m.courseId !== courseId);
  db.lessons = db.lessons.filter(l => !modulesToClear.includes(l.moduleId));
  db.enrollments = db.enrollments.filter(e => e.courseId !== courseId);
  await saveDB(db);
  res.json({ success: true });
});

// Admin endpoint to seed a default syllabus (modules + lessons) for empty custom courses in preview
app.post('/api/admin/courses/:courseId/seed-syllabus', async (req, res) => {
  const { courseId } = req.params;
  const db = await loadDB();
  const course = db.courses.find(c => c.id === courseId);
  if (!course) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  // Clear existing to avoid double seeds if any
  const existingModulesIds = db.modules.filter(m => m.courseId === courseId).map(m => m.id);
  db.modules = db.modules.filter(m => m.courseId !== courseId);
  db.lessons = db.lessons.filter(l => !existingModulesIds.includes(l.moduleId));

  // Module 1
  const moduleId1 = `module-${Math.random().toString(36).substring(2, 9)}`;
  const module1: CourseModule = {
    id: moduleId1,
    courseId,
    title: "Chapter 1: Getting Started & Video Playback Tools",
    description: "Introductory lessons covering platform tools, workspace guides, and Vimeo media streaming controls.",
    order: 1
  };

  // Module 2
  const moduleId2 = `module-${Math.random().toString(36).substring(2, 9)}`;
  const module2: CourseModule = {
    id: moduleId2,
    courseId,
    title: "Chapter 2: Essential Documents & Technical Handbook",
    description: "Deep dive resources, cheat sheets, and downloadable technical specifications.",
    order: 2
  };

  db.modules.push(module1, module2);

  // Lesson 1 on Module 1 (Video)
  const lesson1: Lesson = {
    id: `lesson-${Math.random().toString(36).substring(2, 9)}`,
    moduleId: moduleId1,
    title: "Platform Overview & Vimeo Integration Guide",
    type: "video",
    order: 1,
    vimeoUrl: "https://vimeo.com/76979871",
    vimeoId: "76979871",
    thumbnail: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=400",
    duration: "12:15"
  };

  // Lesson 2 on Module 1 (Video)
  const lesson2: Lesson = {
    id: `lesson-${Math.random().toString(36).substring(2, 9)}`,
    moduleId: moduleId1,
    title: "Advanced Media Controls & Sync Systems",
    type: "video",
    order: 2,
    vimeoUrl: "https://vimeo.com/112390623",
    vimeoId: "112390623",
    thumbnail: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?q=80&w=400",
    duration: "18:40"
  };

  // Lesson 3 on Module 2 (PDF)
  const lesson3: Lesson = {
    id: `lesson-${Math.random().toString(36).substring(2, 9)}`,
    moduleId: moduleId2,
    title: "SkillFort Curriculum Syllabus Handbook (PDF)",
    type: "pdf",
    order: 1,
    fileUrl: "/assets/java-oop-principles.pdf",
    fileName: "skillfort-syllabus-handbook.pdf",
    fileSize: "2.4 MB"
  };

  // Lesson 4 on Module 2 (Quiz)
  const lesson4: Lesson = {
    id: `lesson-${Math.random().toString(36).substring(2, 9)}`,
    moduleId: moduleId2,
    title: `${course.title} Evaluation & Syllabus Quiz`,
    type: "quiz",
    order: 2,
    passMark: "80",
    timeLimit: "15"
  };

  db.lessons.push(lesson1, lesson2, lesson3, lesson4);
  await saveDB(db);

  res.json({
    success: true,
    modules: [module1, module2],
    lessons: [lesson1, lesson2, lesson3, lesson4]
  });
});

// Admin modules endpoint
app.post('/api/admin/modules', async (req, res) => {
  const { courseId, title, description, order } = req.body;
  if (!courseId || !title) {
    res.status(400).json({ error: "CourseId and Title are required" });
    return;
  }
  const db = await loadDB();
  const newModule: CourseModule = {
    id: `module-${Math.random().toString(36).substring(2, 9)}`,
    courseId,
    title,
    description: description || "",
    order: Number(order) || (db.modules.filter(m => m.courseId === courseId).length + 1)
  };
  db.modules.push(newModule);
  await saveDB(db);
  res.json(newModule);
});

app.put('/api/admin/modules/:moduleId', async (req, res) => {
  const { moduleId } = req.params;
  const { title, description, order } = req.body;
  const db = await loadDB();
  const idx = db.modules.findIndex(m => m.id === moduleId);
  if (idx === -1) {
    res.status(404).json({ error: "Module not found" });
    return;
  }
  db.modules[idx] = {
    ...db.modules[idx],
    title: title ?? db.modules[idx].title,
    description: description ?? db.modules[idx].description,
    order: (order !== undefined && order !== "") ? Number(order) : db.modules[idx].order
  };
  await saveDB(db);
  res.json(db.modules[idx]);
});

app.delete('/api/admin/modules/:moduleId', async (req, res) => {
  const { moduleId } = req.params;
  const db = await loadDB();
  db.modules = db.modules.filter(m => m.id !== moduleId);
  db.lessons = db.lessons.filter(l => l.moduleId !== moduleId);
  await saveDB(db);
  res.json({ success: true });
});

// Admin lessons endpoint
app.post('/api/admin/lessons', async (req, res) => {
  const {
    moduleId,
    title,
    type,
    vimeoUrl,
    vimeoId,
    thumbnail,
    fileUrl,
    fileName,
    fileSize,
    duration,
    order,
    passMark,
    timeLimit,
    attempts,
    questions,
  } = req.body;
  if (!moduleId || !title || !type) {
    res.status(400).json({ error: "ModuleId, title, and type are required" });
    return;
  }
  const db = await loadDB();
  const moduleObj = db.modules.find(m => m.id === moduleId);
  if (!moduleObj) {
    res.status(404).json({ error: "Parent module not found" });
    return;
  }

  const resolvedVimeoId = vimeoId || (type === 'video' ? extractVimeoId(vimeoUrl) : undefined);

  const newLesson: Lesson = {
    id: `lesson-${Math.random().toString(36).substring(2, 9)}`,
    moduleId,
    title,
    type,
    order: Number(order) || (db.lessons.filter(l => l.moduleId === moduleId).length + 1),
    vimeoUrl,
    vimeoId: resolvedVimeoId,
    thumbnail: thumbnail || (resolvedVimeoId ? `https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80` : undefined),
    fileUrl,
    fileName,
    fileSize,
    duration: duration || (type === 'video' ? "10:00" : undefined),
  };

  if (type === 'quiz') {
    newLesson.passMark = passMark ? String(passMark) : '80';
    newLesson.timeLimit = timeLimit ? String(timeLimit) : '15';
    newLesson.attempts = attempts ? String(attempts) : '3';
    if (Array.isArray(questions) && questions.length > 0) {
      newLesson.questions = questions;
    }
  }

  db.lessons.push(newLesson);
  await saveDB(db);
  res.json(newLesson);
});

app.put('/api/admin/lessons/:lessonId', async (req, res) => {
  const { lessonId } = req.params;
  const fields = req.body;
  const db = await loadDB();
  const idx = db.lessons.findIndex(l => l.id === lessonId);
  if (idx === -1) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }

  const updatedType = fields.type !== undefined ? fields.type : db.lessons[idx].type;
  const updatedVimeoUrl = fields.vimeoUrl !== undefined ? fields.vimeoUrl : db.lessons[idx].vimeoUrl;
  let resolvedVimeoId = fields.vimeoId !== undefined ? fields.vimeoId : db.lessons[idx].vimeoId;

  if (updatedType === 'video' && updatedVimeoUrl && !resolvedVimeoId) {
    resolvedVimeoId = extractVimeoId(updatedVimeoUrl);
  }

  db.lessons[idx] = {
    ...db.lessons[idx],
    ...fields,
    vimeoId: resolvedVimeoId,
    order: (fields.order !== undefined && fields.order !== "") ? Number(fields.order) : db.lessons[idx].order,
    ...(fields.passMark !== undefined ? { passMark: String(fields.passMark) } : {}),
    ...(fields.timeLimit !== undefined ? { timeLimit: String(fields.timeLimit) } : {}),
    ...(fields.attempts !== undefined ? { attempts: String(fields.attempts) } : {}),
    ...(fields.questions !== undefined ? { questions: fields.questions } : {}),
  };
  await saveDB(db);
  res.json(db.lessons[idx]);
});

app.delete('/api/admin/lessons/:lessonId', async (req, res) => {
  const { lessonId } = req.params;
  const db = await loadDB();
  db.lessons = db.lessons.filter(l => l.id !== lessonId);
  db.progress = db.progress.filter(p => p.lessonId !== lessonId);
  await saveDB(db);
  res.json({ success: true });
});


// 4. LESSON PROGRESS AUTO-SAVE & TRACKING
app.get('/api/progress/:userId/:courseId', requireAuth, async (req, res) => {
  const { userId, courseId } = req.params;
  if (!assertSelfOrAdmin(req, res, userId)) return;
  const db = await loadDB();
  if (!assertActiveEnrollment(db, userId, courseId, res)) return;
  const userProgress = db.progress.filter(p => p.userId === userId && p.courseId === courseId);
  res.json(userProgress);
});

function parseDurationToSeconds(duration?: string): number {
  if (!duration) return 600; // default 10 minutes (600s)
  const parts = duration.split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secs = parseInt(parts[1], 10);
    if (!isNaN(mins) && !isNaN(secs)) {
      return mins * 60 + secs;
    }
  }
  const mins = parseInt(duration, 10);
  if (!isNaN(mins)) {
    return mins * 60;
  }
  return 600;
}

app.post('/api/progress/save', requireAuth, async (req, res) => {
  const { userId, courseId, lessonId, currentTimestamp, watchDuration, isCompleted } = req.body;
  if (!userId || !courseId || !lessonId) {
    res.status(400).json({ error: "Missing required core parameters" });
    return;
  }
  if (!assertSelfOrAdmin(req, res, userId)) return;

  const db = await loadDB();
  if (!assertActiveEnrollment(db, userId, courseId, res)) return;
  
  // Find or create progress record
  let recordIndex = db.progress.findIndex(p => p.userId === userId && p.lessonId === lessonId);
  const nowStr = new Date().toISOString();

  if (recordIndex === -1) {
    const newProgress: LessonProgress = {
      id: `prog-${Math.random().toString(36).substring(2, 9)}`,
      userId,
      courseId,
      lessonId,
      currentTimestamp: Number(currentTimestamp) || 0,
      watchDuration: Number(watchDuration) || 0,
      isCompleted: !!isCompleted,
      updatedAt: nowStr
    };
    db.progress.push(newProgress);
  } else {
    db.progress[recordIndex] = {
      ...db.progress[recordIndex],
      currentTimestamp: Number(currentTimestamp) ?? db.progress[recordIndex].currentTimestamp,
      watchDuration: db.progress[recordIndex].watchDuration + (Number(watchDuration) || 0),
      isCompleted: db.progress[recordIndex].isCompleted || !!isCompleted,
      updatedAt: nowStr
    };
  }

  // Recalculate Course progress percentage using micro-progress increments
  const totalLessonsInCourse = getCourseLessons(db, courseId);
  
  let totalProgSum = 0;
  totalLessonsInCourse.forEach(l => {
    const prog = db.progress.find(p => p.userId === userId && p.lessonId === l.id);
    if (prog) {
      if (prog.isCompleted) {
        totalProgSum += 1.0;
      } else {
        const totalSecs = parseDurationToSeconds(l.duration);
        if (totalSecs > 0) {
          totalProgSum += Math.min(0.99, prog.currentTimestamp / totalSecs);
        } else {
          totalProgSum += prog.currentTimestamp > 0 ? 0.3 : 0;
        }
      }
    }
  });

  let progressPct = 0;
  if (totalLessonsInCourse.length > 0) {
    progressPct = Math.round((totalProgSum / totalLessonsInCourse.length) * 100);
  }

  // Find enrollment index
  const enrollIndex = db.enrollments.findIndex(e => e.userId === userId && e.courseId === courseId);
  let certificateCreated: Certificate | null = null;

  if (enrollIndex !== -1) {
    db.enrollments[enrollIndex].progressPercentage = progressPct;
    certificateCreated = issueCertificateIfEligible(db, userId, courseId);
  }

  await saveDB(db);
  res.json({
    success: true,
    progressPercentage: progressPct,
    certificateCreated
  });

  if (certificateCreated) {
    const userObj = db.users.find((u) => u.id === userId);
    if (userObj) {
      void notifyCertificateEarned(
        db.settings,
        userObj,
        certificateCreated,
        buildVerifyUrl(certificateCreated.certificateNumber)
      ).catch((err) => console.error('[MAIL] certificate notify failed:', err));
    }
  }
});


// 5. COUPON CODE VALIDATION & DEALS
app.post('/api/coupons/validate', async (req, res) => {
  const { code, cartAmount, courseIds } = req.body;
  if (!code) {
    res.status(400).json({ error: "Code is required" });
    return;
  }
  const db = await loadDB();
  const coupon = db.coupons.find(c => c.code.toUpperCase() === code.toUpperCase() && c.isActive);
  
  if (!coupon) {
    res.status(404).json({ error: "Invalid coupon code" });
    return;
  }

  if (coupon.courseId) {
    const ids = Array.isArray(courseIds) ? courseIds : [];
    if (ids.length === 0 || !ids.includes(coupon.courseId)) {
      res.status(400).json({ error: "This coupon is not valid for the selected course(s)." });
      return;
    }
  }

  if (cartAmount && Number(cartAmount) < coupon.minAmount) {
    res.status(400).json({ error: `Minimum purchase of ₹${coupon.minAmount} is required for this discount.` });
    return;
  }

  res.json(coupon);
});

// Admin Coupon Management
app.get('/api/admin/coupons', async (req, res) => {
  const db = await loadDB();
  res.json(db.coupons);
});

app.post('/api/admin/coupons', async (req, res) => {
  const { code, discountPercent, minAmount, expiryDate, courseId } = req.body;
  if (!code || !discountPercent) {
    res.status(400).json({ error: "Code and discount percentage are required" });
    return;
  }
  const db = await loadDB();
  const normalizedCode = String(code).toUpperCase();
  const duplicate = db.coupons.find((c) => c.code.toUpperCase() === normalizedCode);
  if (duplicate) {
    res.status(409).json({ error: "Another coupon already uses this code" });
    return;
  }
  const newCoupon: Coupon = {
    id: `coupon-${Math.random().toString(36).substring(2, 9)}`,
    code: normalizedCode,
    discountPercent: Number(discountPercent),
    minAmount: Number(minAmount) || 0,
    isActive: true,
    expiryDate: expiryDate || "2027-12-31",
    ...(courseId ? { courseId: String(courseId) } : {}),
  };
  db.coupons.push(newCoupon);
  await saveDB(db);
  res.json(newCoupon);
});

app.put('/api/admin/coupons/:id', async (req, res) => {
  const { id } = req.params;
  const fields = req.body;
  const db = await loadDB();
  const idx = db.coupons.findIndex(c => c.id === id);
  if (idx === -1) {
    res.status(404).json({ error: "Coupon not found" });
    return;
  }
  if (fields.code) {
    const normalizedCode = String(fields.code).toUpperCase();
    const duplicate = db.coupons.find(
      (c) => c.id !== id && c.code.toUpperCase() === normalizedCode
    );
    if (duplicate) {
      res.status(409).json({ error: "Another coupon already uses this code" });
      return;
    }
    fields.code = normalizedCode;
  }
  db.coupons[idx] = {
    ...db.coupons[idx],
    ...fields
  };
  await saveDB(db);
  res.json(db.coupons[idx]);
});

app.delete('/api/admin/coupons/:id', async (req, res) => {
  const { id } = req.params;
  const db = await loadDB();
  db.coupons = db.coupons.filter(c => c.id !== id);
  await saveDB(db);
  res.json({ success: true });
});


// 6. ENROLLMENTS & STUDENTS HISTORY FOR USER
app.get('/api/students/enrollments/:userId', requireAuth, async (req, res) => {
  const { userId } = req.params;
  if (!assertSelfOrAdmin(req, res, userId)) return;
  const db = await loadDB();
  const userEnrols = db.enrollments.filter(e => e.userId === userId);
  const result = userEnrols.map(e => {
    const course = db.courses.find(c => c.id === e.courseId);
    return {
      ...e,
      course
    };
  });
  res.json(result);
});

app.get('/api/students/continue/:userId', requireAuth, async (req, res) => {
  const { userId } = req.params;
  if (!assertSelfOrAdmin(req, res, userId)) return;
  const db = await loadDB();
  res.json(buildContinueTargets(db, userId));
});


// Free course enrollment (skip checkout when price is 0)
app.post('/api/enrollments/free', requireAuth, async (req, res) => {
  const { courseId } = req.body;
  const userId = req.auth!.userId;

  if (!courseId) {
    res.status(400).json({ error: 'courseId is required' });
    return;
  }

  const db = await loadDB();
  const course = db.courses.find((c) => c.id === courseId);
  if (!course) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }

  if (course.price > 0) {
    res.status(400).json({ error: 'This course is not free. Use checkout to enroll.' });
    return;
  }

  const existing = db.enrollments.find((e) => e.userId === userId && e.courseId === courseId);
  if (existing) {
    res.status(409).json({ error: 'You are already enrolled in this course.', enrollment: existing });
    return;
  }

  const enrollment = createEnrollmentRecord(db, userId, courseId);

  db.enrollments.push(enrollment);
  await saveDB(db);
  res.status(201).json({ enrollment });
});


// 7. SHOPPING CART (persisted in platform_kv)
app.get('/api/cart', requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const db = await loadDB();
  const courseIds = readCartIds(db, userId);
  const enrolled = new Set(
    db.enrollments.filter((e) => e.userId === userId).map((e) => e.courseId)
  );
  const availableIds = courseIds.filter((id) => !enrolled.has(id));
  if (availableIds.length !== courseIds.length) {
    writeCartIds(db, userId, availableIds);
    await saveDB(db);
  }
  const items = availableIds
    .map((id) => db.courses.find((c) => c.id === id))
    .filter(Boolean);

  const user = db.users.find((u) => u.id === userId);
  if (user) {
    void checkAbandonedReminders(db, user, db.settings).catch((err) =>
      console.error('[REMINDERS]', err)
    );
  }

  res.json({ courseIds: availableIds, items });
});

app.post('/api/cart/add', requireAuth, async (req, res) => {
  const { courseId } = req.body;
  const userId = req.auth!.userId;
  if (!courseId) {
    res.status(400).json({ error: 'courseId is required' });
    return;
  }
  const db = await loadDB();
  const course = db.courses.find((c) => c.id === courseId);
  if (!course) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }
  if (db.enrollments.some((e) => e.userId === userId && e.courseId === courseId)) {
    res.status(409).json({ error: 'You are already enrolled in this course.' });
    return;
  }
  const courseIds = addToCart(db, userId, courseId);
  await saveDB(db);
  const items = courseIds.map((id) => db.courses.find((c) => c.id === id)).filter(Boolean);
  res.json({ courseIds, items });
});

app.delete('/api/cart/:courseId', requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const { courseId } = req.params;
  const db = await loadDB();
  const courseIds = removeFromCart(db, userId, courseId);
  await saveDB(db);
  const items = courseIds.map((id) => db.courses.find((c) => c.id === id)).filter(Boolean);
  res.json({ courseIds, items });
});

app.put('/api/cart', requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const { courseIds } = req.body;
  if (!Array.isArray(courseIds)) {
    res.status(400).json({ error: 'courseIds array is required' });
    return;
  }
  const db = await loadDB();
  const valid = courseIds.filter(
    (id: string) =>
      typeof id === 'string' &&
      db.courses.some((c) => c.id === id) &&
      !db.enrollments.some((e) => e.userId === userId && e.courseId === id)
  );
  writeCartIds(db, userId, valid);
  await saveDB(db);
  const items = valid.map((id) => db.courses.find((c) => c.id === id)).filter(Boolean);
  res.json({ courseIds: valid, items });
});

// 8. PAYMENTS INTEGRATION & WEBHOOKS
function normalizeCourseIds(body: { courseId?: string; courseIds?: string[] }): string[] {
  if (Array.isArray(body.courseIds) && body.courseIds.length > 0) {
    return [...new Set(body.courseIds)];
  }
  if (body.courseId) return [body.courseId];
  return [];
}

app.post('/api/payments/checkout', requireAuth, async (req, res) => {
  const { userId, couponCode } = req.body;
  const courseIds = normalizeCourseIds(req.body);
  if (!userId || courseIds.length === 0) {
    res.status(400).json({ error: 'userId and at least one courseId are required' });
    return;
  }
  if (!assertSelfOrAdmin(req, res, userId)) return;

  const db = await loadDB();
  const userObj = db.users.find((u) => u.id === userId);
  if (!userObj) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const courses = courseIds
    .map((id) => db.courses.find((c) => c.id === id))
    .filter(Boolean) as Course[];

  if (courses.length !== courseIds.length) {
    res.status(404).json({ error: 'One or more courses were not found' });
    return;
  }

  const alreadyEnrolled = courses.filter((c) =>
    db.enrollments.some((e) => e.userId === userId && e.courseId === c.id)
  );
  if (alreadyEnrolled.length > 0) {
    res.status(409).json({
      error: `Already enrolled: ${alreadyEnrolled.map((c) => c.title).join(', ')}`,
    });
    return;
  }

  const pricing = priceCartLines(courses, db.coupons, couponCode);
  const receipt = `rcpt_${userId}_${Date.now()}`;
  const { mode, orderId } = await createPaymentOrder(
    db.settings,
    pricing.amountToPay,
    receipt,
    { userId, courseIds: courseIds.join(',') }
  );

  res.json({
    mode,
    razorpayKeyId: db.settings.razorpayKeyId,
    orderId,
    courseIds,
    courseId: courseIds.length === 1 ? courseIds[0] : undefined,
    courseTitle: courses.length === 1 ? courses[0].title : `${courses.length} courses`,
    lineItems: pricing.lineItems,
    originalAmount: pricing.originalAmount,
    amountToPay: pricing.amountToPay,
    taxAmount: pricing.taxAmount,
    couponApplied: pricing.couponApplied,
    customer: {
      name: userObj.name,
      email: userObj.email,
    },
  });
});

app.post('/api/payments/capture', requireAuth, async (req, res) => {
  const {
    userId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    couponApplied,
    lineItems,
  } = req.body;
  const courseIds = normalizeCourseIds(req.body);

  if (!userId || !razorpayPaymentId || courseIds.length === 0) {
    res.status(400).json({ error: 'Incomplete payment capture payloads' });
    return;
  }
  if (!assertSelfOrAdmin(req, res, userId)) return;

  const db = await loadDB();
  const userObj = db.users.find((u) => u.id === userId);
  if (!userObj) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const mode = resolvePaymentMode(db.settings);
  if (mode === 'live') {
    if (!razorpayOrderId || !razorpaySignature) {
      res.status(400).json({ error: 'Payment signature verification required' });
      return;
    }
    const valid = verifyRazorpaySignature(
      db.settings,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );
    if (!valid) {
      res.status(400).json({ error: 'Invalid payment signature' });
      return;
    }
  }

  const courses = courseIds
    .map((id) => db.courses.find((c) => c.id === id))
    .filter(Boolean) as Course[];

  if (courses.length === 0) {
    res.status(404).json({ error: 'Courses not found' });
    return;
  }

  const alreadyEnrolled = courses.filter((c) =>
    db.enrollments.some((e) => e.userId === userId && e.courseId === c.id)
  );
  if (alreadyEnrolled.length > 0) {
    res.status(409).json({
      error: `Already enrolled: ${alreadyEnrolled.map((c) => c.title).join(', ')}`,
    });
    return;
  }

  let resolvedLines = Array.isArray(lineItems) ? lineItems : [];
  if (resolvedLines.length === 0) {
    const pricing = priceCartLines(courses, db.coupons, couponApplied);
    resolvedLines = pricing.lineItems;
  }

  const payments = await captureLineItems(
    db,
    userObj,
    resolvedLines,
    razorpayOrderId || `order_rec_${Math.random().toString(36).substring(2, 9)}`,
    razorpayPaymentId,
    couponApplied
  );

  await saveDB(db);
  res.json({ success: true, payments, payment: payments[0] ?? null });
});

app.post('/api/payments/failed', requireAuth, async (req, res) => {
  const { userId, courseId, reason, razorpayOrderId } = req.body;
  if (!userId || !courseId) {
    res.status(400).json({ error: 'userId and courseId are required' });
    return;
  }
  if (!assertSelfOrAdmin(req, res, userId)) return;

  const db = await loadDB();
  const userObj = db.users.find((u) => u.id === userId);
  const courseObj = db.courses.find((c) => c.id === courseId);
  if (!userObj || !courseObj) {
    res.status(404).json({ error: 'User or course not found' });
    return;
  }

  const failedPayment: PaymentReport = {
    id: `pmt-fail-${Math.random().toString(36).substring(2, 11)}`,
    userId,
    userEmail: userObj.email,
    userName: userObj.name,
    courseId,
    courseTitle: courseObj.title,
    originalAmount: courseObj.price,
    amountPaid: 0,
    taxAmount: 0,
    invoiceId: `SF-FAIL-${Date.now()}`,
    razorpayPaymentId: 'failed',
    razorpayOrderId: razorpayOrderId || `order_fail_${Date.now()}`,
    status: 'failed',
    createdAt: new Date().toISOString(),
  };

  db.payments.push(failedPayment);
  await saveDB(db);

  void notifyPaymentFailed(db.settings, userObj, courseObj, reason).catch((err) =>
    console.error('[MAIL] payment failed notify failed:', err)
  );

  res.json({ success: true, recorded: true });
});

// Payment reports overview & invoices lists
app.get('/api/admin/payments', async (req, res) => {
  const db = await loadDB();
  res.json(db.payments);
});

app.post('/api/admin/payments/:paymentId/refund', async (req, res) => {
  try {
    const db = await loadDB();
    const result = await refundCapturedPayment(db, req.params.paymentId);
    await saveDB(db);
    res.json({
      success: true,
      payment: result.payment,
      mode: result.mode,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Refund failed';
    const status = message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

app.get('/api/payments/me', requireAuth, async (req, res) => {
  const db = await loadDB();
  const payments = db.payments.filter(p => p.userId === req.auth!.userId);
  res.json(payments);
});

// Admin Students list management
function listAdminUsersFromDb(db: DBStore) {
  return db.users
    .filter((u) => u.role === 'admin')
    .map(({ id, email, name, role, createdAt }) => ({ id, email, name, role, createdAt }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

app.get('/api/admin/enrollments', async (_req, res) => {
  const db = await loadDB();
  res.json(db.enrollments);
});

app.get('/api/admin/students', async (req, res) => {
  const db = await loadDB();
  if (req.query.adminsOnly === '1' || req.query.adminsOnly === 'true') {
    res.json(listAdminUsersFromDb(db));
    return;
  }

  const students = db.users.filter(u => u.role === 'student');
  const result = students.map(st => {
    const enrols = db.enrollments.filter(e => e.userId === st.id);
    const pmts = db.payments.filter(p => p.userId === st.id);
    return {
      ...st,
      enrollmentsCount: enrols.length,
      totalSpent: pmts.reduce((sum, p) => sum + p.amountPaid, 0)
    };
  });
  res.json(result);
});

app.get('/api/admin/admins', async (_req, res) => {
  const db = await loadDB();
  res.json(listAdminUsersFromDb(db));
});

/** List users for admin console (optional ?role=admin|student). */
app.get('/api/admin/users', async (req, res) => {
  const roleFilter = typeof req.query.role === 'string' ? req.query.role : '';
  const db = await loadDB();
  if (roleFilter === 'admin') {
    res.json(listAdminUsersFromDb(db));
    return;
  }

  let users = db.users;
  if (roleFilter === 'student') {
    users = users.filter((u) => u.role === 'student');
  }
  const result = users
    .map(({ id, email, name, role, createdAt, isBlocked }) => ({
      id,
      email,
      name,
      role,
      createdAt,
      isBlocked,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(result);
});

app.post('/api/admin/admins', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name?.trim() || !email?.trim() || !password) {
    res.status(400).json({ message: 'Name, email, and password are required' });
    return;
  }
  if (String(password).length < 8) {
    res.status(400).json({ message: 'Password must be at least 8 characters' });
    return;
  }

  const db = await loadDB();
  const createdBy = db.users.find((u) => u.id === req.auth!.userId && u.role === 'admin');
  if (!createdBy) {
    res.status(403).json({ message: 'Only administrators can create admin accounts' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    res.status(409).json({ message: 'Email already registered' });
    return;
  }

  const newId = `user-${Math.random().toString(36).substring(2, 11)}`;
  const newUser: User = {
    id: newId,
    email: normalizedEmail,
    name: String(name).trim(),
    role: 'admin',
    createdAt: new Date().toISOString(),
  };

  db.users.push(newUser);
  db.passwords[newId] = await hashPassword(password);
  await saveDB(db);

  const mailResult = await notifyAdminAccountCreated(db.settings, newUser, createdBy, String(password));

  res.status(201).json({
    user: newUser,
    emailSent: mailResult.welcomeSent,
    adminNotifySent: mailResult.notifySent,
    emailErrors: mailResult.errors,
  });
});

app.delete('/api/admin/admins/:userId', async (req, res) => {
  const { userId } = req.params;
  const db = await loadDB();

  if (userId === req.auth!.userId) {
    res.status(400).json({ error: 'You cannot delete your own administrator account.' });
    return;
  }

  const target = db.users.find((u) => u.id === userId && u.role === 'admin');
  if (!target) {
    res.status(404).json({ error: 'Administrator not found' });
    return;
  }

  const adminCount = db.users.filter((u) => u.role === 'admin').length;
  if (adminCount <= 1) {
    res.status(400).json({ error: 'Cannot delete the last administrator account.' });
    return;
  }

  db.users = db.users.filter((u) => u.id !== userId);
  delete db.passwords[userId];
  clearStudentSession(db, userId);

  await saveDB(db);
  res.json({ success: true });
});

app.get('/api/admin/students/:userId', async (req, res) => {
  const db = await loadDB();
  const user = db.users.find((u) => u.id === req.params.userId && u.role === 'student');
  if (!user) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }
  const enrols = db.enrollments.filter((e) => e.userId === user.id);
  const pmts = db.payments.filter((p) => p.userId === user.id);
  const enrollments = enrols.map((e) => {
    const course = db.courses.find((c) => c.id === e.courseId);
    return {
      ...e,
      courseTitle: course?.title || e.courseId,
      courseValidityDays: course?.validityDays,
    };
  });
  res.json({
    ...user,
    enrollmentsCount: enrols.length,
    totalSpent: pmts.reduce((sum, p) => sum + p.amountPaid, 0),
    enrollments,
  });
});

app.put('/api/admin/students/:userId', async (req, res) => {
  const { userId } = req.params;
  const {
    firstName,
    lastName,
    email,
    phone,
    name,
    registrationProfile,
    newPassword,
  } = req.body;

  const db = await loadDB();
  const user = db.users.find((u) => u.id === userId && u.role === 'student');
  if (!user) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }

  if (email && db.users.some((u) => u.id !== userId && u.email.toLowerCase() === String(email).toLowerCase())) {
    res.status(409).json({ error: 'Email is already used by another account.' });
    return;
  }

  await applyStudentAdminUpdate(
    user,
    { firstName, lastName, email, phone, name, registrationProfile, newPassword },
    db.passwords
  );
  await saveDB(db);

  res.json({ user });
});

app.patch('/api/admin/students/:userId/block', async (req, res) => {
  const { userId } = req.params;
  const { isBlocked } = req.body;

  if (typeof isBlocked !== 'boolean') {
    res.status(400).json({ error: 'isBlocked boolean is required' });
    return;
  }

  const db = await loadDB();
  const user = db.users.find((u) => u.id === userId && u.role === 'student');
  if (!user) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }

  user.isBlocked = isBlocked;
  await saveDB(db);
  res.json({ user });
});

app.post('/api/admin/users', async (req, res) => {
  const { name, email, password, role = 'student' } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ message: 'Name, email, and password are required' });
    return;
  }
  if (!['student', 'admin'].includes(role)) {
    res.status(400).json({ message: 'Invalid role' });
    return;
  }

  const db = await loadDB();
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    res.status(409).json({ message: 'Email already registered' });
    return;
  }

  const newId = `user-${Math.random().toString(36).substring(2, 11)}`;
  const newUser: User = {
    id: newId,
    email: email.toLowerCase(),
    name,
    role,
    createdAt: new Date().toISOString(),
  };

  db.users.push(newUser);
  db.passwords[newId] = await hashPassword(password);
  await saveDB(db);

  if (role === 'admin') {
    const createdBy = db.users.find((u) => u.id === req.auth!.userId && u.role === 'admin');
    if (createdBy) {
      try {
        const mailResult = await notifyAdminAccountCreated(
          db.settings,
          newUser,
          createdBy,
          String(password)
        );
        res.status(201).json({
          user: newUser,
          emailSent: mailResult.welcomeSent,
          adminNotifySent: mailResult.notifySent,
          emailErrors: mailResult.errors,
        });
        return;
      } catch (err) {
        console.error('[MAIL] Admin account notification failed:', err);
        res.status(201).json({
          user: newUser,
          emailSent: false,
          emailErrors: ['Account created but welcome email could not be sent'],
        });
        return;
      }
    }
  }

  res.status(201).json({ user: newUser });
});

app.post('/api/admin/enrollments/manual', async (req, res) => {
  const { userId, courseId } = req.body;

  if (!userId || !courseId) {
    res.status(400).json({ message: 'userId and courseId are required' });
    return;
  }

  const db = await loadDB();
  const user = db.users.find(u => u.id === userId);
  const course = db.courses.find(c => c.id === courseId);

  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  if (!course) {
    res.status(404).json({ message: 'Course not found' });
    return;
  }

  const existing = db.enrollments.find(e => e.userId === userId && e.courseId === courseId);
  if (existing) {
    res.status(409).json({ message: 'User already enrolled in this course', enrollment: existing });
    return;
  }

  const enrollment = createEnrollmentRecord(db, userId, courseId);

  db.enrollments.push(enrollment);
  await saveDB(db);

  void notifyManualEnrollment(db.settings, user, course).catch((err) =>
    console.error('[MAIL] manual enrollment notify failed:', err)
  );

  res.status(201).json({ enrollment });
});

app.patch('/api/admin/students/:userId/enrollments/:courseId/access', async (req, res) => {
  const { userId, courseId } = req.params;
  const { extendDays, makeLifetime } = req.body as {
    extendDays?: number | string;
    makeLifetime?: boolean;
  };

  const db = await loadDB();
  const user = db.users.find((u) => u.id === userId && u.role === 'student');
  if (!user) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }

  const enrollment = db.enrollments.find((e) => e.userId === userId && e.courseId === courseId);
  if (!enrollment) {
    res.status(404).json({ error: 'Enrollment not found for this student/course.' });
    return;
  }

  if (makeLifetime === true) {
    enrollment.expiresAt = undefined;
  } else {
    const parsedDays = Number(extendDays);
    if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
      res.status(400).json({ error: 'extendDays must be a positive number.' });
      return;
    }
    extendEnrollmentByDays(enrollment, parsedDays);
  }

  await saveDB(db);
  res.json({ enrollment });
});


// 7B. PLATFORM KEY-VALUE STORE (replaces browser localStorage for LMS data)
app.get('/api/platform/kv/:key', requireAuth, async (req, res) => {
  const key = decodeURIComponent(req.params.key);
  const db = await loadDB();
  if (!req.auth || !canAccessPlatformKey(key, req.auth, platformKvAccessOptions(db, req.auth))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  if (!(key in db.platformKv)) {
    res.status(404).json({ error: 'Key not found' });
    return;
  }

  res.json({ key, value: db.platformKv[key] });
});

app.put('/api/platform/kv/:key', requireAuth, async (req, res) => {
  const key = decodeURIComponent(req.params.key);
  const db = await loadDB();
  if (!req.auth || !canWritePlatformKey(key, req.auth, platformKvAccessOptions(db, req.auth))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { value } = req.body;
  if (value === undefined) {
    res.status(400).json({ error: 'value is required' });
    return;
  }

  db.platformKv[key] = value;
  if (key.startsWith('skillfort_wishlist_') && !key.includes('_meta_')) {
    const userId = key.replace('skillfort_wishlist_', '');
    touchWishlistMeta(db, userId);
  }
  await saveDB(db);

  res.json({ key, value });
});

app.get('/api/platform/sync', requireAuth, async (req, res) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const db = await loadDB();
  const entries: Record<string, unknown> = {};
  const kvOpts = platformKvAccessOptions(db, req.auth);
  for (const [key, value] of Object.entries(db.platformKv || {})) {
    if (canAccessPlatformKey(key, req.auth, kvOpts)) {
      entries[key] = value;
    }
  }

  const user = db.users.find((u) => u.id === req.auth.userId);
  if (user) {
    void checkAbandonedReminders(db, user, db.settings).catch((err) =>
      console.error('[REMINDERS]', err)
    );
  }

  res.json({ entries });
});


// 8. CERTIFICATES ARCHIVE API
app.get('/api/certificates/:userId', requireAuth, async (req, res) => {
  const { userId } = req.params;
  if (!assertSelfOrAdmin(req, res, userId)) return;
  const db = await loadDB();
  const certs = db.certificates.filter(c => c.userId === userId);
  res.json(certs);
});

app.get('/api/certificates/verify/:certNo', async (req, res) => {
  const { certNo } = req.params;
  const db = await loadDB();
  const cert = db.certificates.find(c => c.certificateNumber === certNo);
  if (!cert) {
    res.status(404).json({ error: "Certificate number is invalid or not registered in SkillFort directory." });
    return;
  }
  res.json(cert);
});

// Admin Certificate Registry View
app.get('/api/admin/certificates', async (req, res) => {
  const db = await loadDB();
  res.json(db.certificates);
});


// ==========================================
// STATIC VITE DEV SERVING & ROOT HANDLER
// ==========================================
async function startServer() {
  validateProductionEnvironment();
  initializeFirebaseAdmin();

  registerJsonSaveHook((store) => {
    if (firestoreDb && !isUsingPostgres()) {
      saveDBToFirebase(store).catch((err) => console.error('Async Firebase cloud sync failed:', err));
    }
  });

  await initDatabase();
  await runDatabaseMaintenance();

  // If Firestore is available, perform initial sync download of the state
  if (firestoreDb && !isUsingPostgres()) {
    try {
      console.log('🔄 [FIREBASE STATUS] Connected. Syncing cloud state to local database cache...');
      const cloudState = await loadDBFromFirebase();
      if (cloudState) {
        invalidateCache();
        await saveDB(cloudState);
        console.log('💚 [FIREBASE STATUS] Cloud-to-Local synchronization complete!');
      } else {
        console.log('📤 [FIREBASE STATUS] Cloud is empty. Syncing local database state up to cloud Firestore...');
        const localState = await loadDB();
        await saveDBToFirebase(localState);
      }
    } catch (err) {
      console.error('❌ Failed during initial Firebase sync:', err);
    }
  }

  const httpServer = createHttpServer(app);

  app.use('/uploads', (req, res, next) => {
    void serveUploadsMiddleware(req, res, next);
  });

  if (process.env.NODE_ENV === 'production') {
    if (isCloudinaryConfigured()) {
      console.log('🖼️  Media storage: Cloudinary');
    } else if (shouldPersistMediaInDatabase()) {
      console.log('🖼️  Media storage: PostgreSQL (media_blobs)');
    } else {
      console.warn('⚠️  Media storage: local disk only — uploads will not survive redeploys');
    }
  }

  if (process.env.NODE_ENV !== "production") {
    const ignoreDatabaseWatch = (watchPath: string) => {
      const base = path.basename(watchPath.replace(/\\/g, '/'));
      return base === 'db.json' || base === '.db_backup.json';
    };

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
        watch:
          process.env.DISABLE_HMR === 'true'
            ? null
            : {
                // db.json is rewritten on nearly every API call — ignore or Vite reloads in a loop.
                ignored: [ignoreDatabaseWatch],
              },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve build bundle
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/uploads/')) {
        res.status(404).type('text/plain').send('Not found');
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`(LMS SERVER ACTIVE) SkillFort backend live on http://localhost:${PORT}`);
  });
  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the existing process (see PowerShell commands below) or set PORT to another value.`);
      console.error(`  Get-NetTCPConnection -LocalPort ${PORT} -State Listen | Select-Object OwningProcess`);
      console.error(`  Stop-Process -Id <PID> -Force`);
      process.exit(1);
    }
    throw err;
  });
}

startServer();
