export interface StudentRegistrationProfile {
  branch: string;
  dateOfBirth: string;
  highestQualification: string;
  stream: string;
  collegeName: string;
  yearOfPassout: string;
  knownTechnologies?: string;
  requiredCourse: string;
  placementRequired: 'yes' | 'no';
  preferredCallbackTime?: string;
  hasWorkExperience: 'yes' | 'no';
  address: string;
  panNo?: string;
  aadharNo?: string;
  source: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'student';
  createdAt: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  /** @deprecated use registrationProfile.requiredCourse */
  areaOfInterest?: string;
  /** @deprecated use registrationProfile.collegeName */
  companyOrCollege?: string;
  /** @deprecated removed from registration form */
  professionalStatus?: string;
  registrationProfile?: StudentRegistrationProfile;
  isBlocked?: boolean;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  price: number;
  duration: string; // e.g., "12h 45m"
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  category: string;
  rating: number;
  reviewsCount: number;
  isPublished: boolean;
  createdAt: string;
  /** Optional access window in days from enrollment. Omit for lifetime access. */
  validityDays?: number;
  /** Populated by GET /api/courses — unique enrolled students for this course. */
  studentCount?: number;
}

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  type: 'video' | 'pdf' | 'download' | 'quiz';
  order: number;
  // Video specific attributes
  vimeoUrl?: string;
  vimeoId?: string;
  thumbnail?: string;
  // Resource attributes
  fileUrl?: string; // PDF or generic downloadable file
  fileName?: string;
  fileSize?: string;
  duration?: string; // Duration in format e.g. "12:35" or minutes
  // Quiz specific attributes
  timeLimit?: string;
  passMark?: string;
  attempts?: string;
  questions?: {
    id: string;
    questionText: string;
    grade: number;
    answers: {
      text: string;
      isCorrect: boolean;
    }[];
  }[];
}

export interface LessonProgress {
  id: string;
  userId: string;
  courseId: string;
  lessonId: string;
  currentTimestamp: number; // in seconds
  watchDuration: number;    // total seconds watched
  isCompleted: boolean;
  updatedAt: string;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  enrolledAt: string;
  progressPercentage: number;
  isCompleted: boolean;
  certificateId?: string;
  /** Set when the course has validityDays; omitted for lifetime access. */
  expiresAt?: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountPercent: number; // e.g. 15 for 15%
  isActive: boolean;
  minAmount: number;
  expiryDate: string;
  /** When set, coupon is valid only for carts that include this course. */
  courseId?: string;
}

export interface PaymentReport {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  courseId: string;
  courseTitle: string;
  amountPaid: number;
  originalAmount: number;
  taxAmount: number; // 18% GST typical in India
  couponApplied?: string;
  invoiceId: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  status: 'captured' | 'failed' | 'refunded';
  createdAt: string;
}

export interface Certificate {
  id: string;
  userId: string;
  userName: string;
  courseId: string;
  courseTitle: string;
  certificateNumber: string; // Unique, e.g. SF-2026-XXXXX
  issueDate: string;
  qrVerificationUrl: string;
}

export interface SystemSettings {
  gstRate: number; // default: 18
  systemName: string;
  supportEmail: string;
  razorpayKeyId: string;
  razorpayKeySecret?: string;
  themeColor: string;
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  mailFrom: string;
  adminNotifyEmail: string;
}

export interface CheckoutLineItem {
  courseId: string;
  courseTitle: string;
  originalAmount: number;
  amountToPay: number;
  taxAmount: number;
}

export interface CheckoutSession {
  mode: 'live' | 'simulator';
  razorpayKeyId: string;
  orderId: string;
  courseIds: string[];
  lineItems: CheckoutLineItem[];
  originalAmount: number;
  amountToPay: number;
  taxAmount: number;
  couponApplied: string | null;
  customer: {
    name: string;
    email: string;
  };
}

export interface CartResponse {
  courseIds: string[];
  items: Course[];
}

export const DEFAULT_MAIL_SETTINGS: Pick<
  SystemSettings,
  | 'smtpEnabled'
  | 'smtpHost'
  | 'smtpPort'
  | 'smtpSecure'
  | 'smtpUser'
  | 'smtpPass'
  | 'mailFrom'
  | 'adminNotifyEmail'
> = {
  smtpEnabled: false,
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPass: '',
  mailFrom: '',
  adminNotifyEmail: '',
};

export interface WallOfSuccessEntry {
  id: string;
  imageUrl: string;
  filename: string;
  createdAt: string;
}

export type LandingBannerLinkTarget = 'courses' | 'contact' | 'register';

/** @deprecated use LandingBannerLinkTarget */
export type LandingBannerCtaTarget = LandingBannerLinkTarget;

export interface LandingBannerConfig {
  heroImageUrl: string;
  linkTarget: LandingBannerLinkTarget;
  updatedAt: string;
}

export type CourseReviewStatus = 'pending' | 'approved' | 'rejected';

export interface CourseReview {
  id: string;
  courseId: string;
  courseTitle: string;
  userId: string;
  studentName: string;
  rating: number;
  comment: string;
  status: CourseReviewStatus;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DBStore {
  settings: SystemSettings;
  coupons: Coupon[];
  courses: Course[];
  modules: CourseModule[];
  lessons: Lesson[];
  users: User[];
  passwords: Record<string, string>;
  progress: LessonProgress[];
  enrollments: Enrollment[];
  payments: PaymentReport[];
  certificates: Certificate[];
  platformKv: Record<string, unknown>;
}
