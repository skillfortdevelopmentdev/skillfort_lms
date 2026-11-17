import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { User, Course, CourseModule, Lesson, Coupon, PaymentReport, Certificate, SystemSettings, CourseReview, Enrollment } from '../types';
import { 
  BarChart, Users, BookOpen, Layers, Award, ShieldCheck, 
  Settings, LogOut, CheckCircle, Plus, Trash2, Edit2, 
  Save, X, Receipt, Tag, ExternalLink, HelpCircle,
  ChevronDown, ChevronRight, Star, FileText, LayoutGrid,
  Mail, RefreshCw, Menu, Upload, Trophy, Globe
} from 'lucide-react';
import QuizAdmin from './admin/QuizAdmin';
import PeopleAdmin from './admin/PeopleAdmin';
import AdminsAdmin from './admin/AdminsAdmin';
import AdminDashboard from './admin/AdminDashboard';
import CertificateBuilder from './admin/CertificateBuilder';
import MailSettings from './admin/MailSettings';
import WallOfSuccessAdmin from './admin/WallOfSuccessAdmin';
import LandingBannerAdmin from './admin/LandingBannerAdmin';
import MobileNavSheet from './ui/MobileNavSheet';
import { SkillFortLogo } from './SkillFortLogo';
import { apiFetch } from '../api/client';
import { resolveMediaUrl } from '../api/config';
import { readPlatformCache, setPlatformValue, parsePlatformValue } from '../api/platformKv';
import { adminPath, parseAdminPath, type AdminTab } from '../routes/adminRoutes';
import {
  deleteCourseReview,
  fetchAdminCourseReviews,
  moderateCourseReview,
} from '../api/courseReviews';

const COURSE_WIZARD_DRAFT_KEY = 'skillfort_course_wizard_draft';

type CourseWizardStep = 'basic' | 'more' | 'content' | 'finish';

function isCourseWizardStep(value: string | null): value is CourseWizardStep {
  return value === 'basic' || value === 'more' || value === 'content' || value === 'finish';
}

function readCourseWizardDraft(): {
  editingCourseId: string | null;
  courseAddTab: CourseWizardStep;
  courseFormEx: Record<string, unknown>;
  courseChapters: unknown[];
} | null {
  try {
    const raw = sessionStorage.getItem(COURSE_WIZARD_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
      sessionStorage.removeItem(COURSE_WIZARD_DRAFT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistCourseWizardDraft(payload: {
  editingCourseId: string | null;
  courseAddTab: CourseWizardStep;
  courseFormEx: Record<string, unknown>;
  courseChapters: unknown[];
}) {
  sessionStorage.setItem(
    COURSE_WIZARD_DRAFT_KEY,
    JSON.stringify({ ...payload, savedAt: Date.now() })
  );
}

function clearCourseWizardDraft() {
  sessionStorage.removeItem(COURSE_WIZARD_DRAFT_KEY);
}

function adminShellTheme(isDarkMode: boolean) {
  return {
    sidebar: isDarkMode ? 'border-[#222222] bg-[#0A0A0A]' : 'border-slate-200 bg-white shadow-sm',
    sidebarHeader: isDarkMode ? 'border-[#222222]' : 'border-slate-200',
    sidebarFooter: isDarkMode ? 'border-[#222222] bg-[#0A0A0A]/85' : 'border-slate-200 bg-slate-50',
    groupLabel: isDarkMode ? 'text-gray-500' : 'text-slate-500',
    collapseBtn: isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900',
    collapseBtnMuted: isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-slate-500 hover:text-slate-800',
    nestedBorder: isDarkMode ? 'border-neutral-800' : 'border-slate-200',
    navActiveMain: isDarkMode
      ? 'bg-[#111111] text-[#F89A15] border border-[#222222]'
      : 'bg-amber-50 text-[#c77d0f] border border-amber-200',
    navActiveSub: isDarkMode
      ? 'bg-[#111111] text-[#F89A15] border border-neutral-800'
      : 'bg-amber-50 text-[#c77d0f] border border-amber-200',
    navIdleMain: isDarkMode
      ? 'text-gray-400 hover:text-white'
      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50',
    navIdleSub: isDarkMode
      ? 'text-gray-400 hover:text-white'
      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50',
    userName: isDarkMode ? 'text-white' : 'text-slate-900',
    userRole: isDarkMode ? 'text-gray-500' : 'text-slate-500',
    themeToggle: isDarkMode
      ? 'border-[#222222] bg-black/40 text-gray-400 hover:text-white hover:border-[#F89A15]/40'
      : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-[#F89A15]/40 shadow-sm',
    logoutBtn: isDarkMode
      ? 'border-[#222222] text-gray-400 hover:bg-neutral-950 hover:text-white'
      : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  };
}

type AdminShellTheme = ReturnType<typeof adminShellTheme>;

function navMainClass(shell: AdminShellTheme, active: boolean) {
  return `w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left font-bold transition-all ${
    active ? shell.navActiveMain : shell.navIdleMain
  }`;
}

function navSubClass(shell: AdminShellTheme, active: boolean) {
  return `w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs font-semibold transition-all ${
    active ? shell.navActiveSub : shell.navIdleSub
  }`;
}

interface AdminPanelProps {
  currentUser: User;
  courses: Course[];
  modules: CourseModule[];
  lessons: Lesson[];
  students: any[];
  admins: User[];
  enrollments: Enrollment[];
  coupons: Coupon[];
  payments: PaymentReport[];
  certificates: Certificate[];
  settings: SystemSettings;
  onLogout: () => void;
  onRefreshData: () => Promise<void>;
  onAdminCreated?: (admin: User) => void;
  onAdminDeleted?: (adminId: string) => void;
  onViewInvoice: (payment: PaymentReport) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function AdminPanel({
  currentUser,
  courses,
  modules,
  lessons,
  students,
  admins,
  enrollments,
  coupons,
  payments,
  certificates,
  settings,
  onLogout,
  onRefreshData,
  onAdminCreated,
  onAdminDeleted,
  onViewInvoice,
  isDarkMode,
  onToggleDarkMode
}: AdminPanelProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const courseWizardRestoredRef = useRef(false);

  useEffect(() => {
    setActiveTab(parseAdminPath(location.pathname));
  }, [location.pathname]);

  const goToTab = (tab: AdminTab) => {
    navigate(adminPath(tab));
    setMobileNavOpen(false);
  };

  // Simulation Lab states
  const [selectedSimStudentId, setSelectedSimStudentId] = useState<string>('');
  const [selectedSimCourseId, setSelectedSimCourseId] = useState<string>('');
  
  // Collapse sidebar folder state
  const [manageCourseExpanded, setManageCourseExpanded] = useState(true);
  const [websiteExpanded, setWebsiteExpanded] = useState(true);

  // Filter States for Courses Table
  const [courseSearch, setCourseSearch] = useState('');
  const [courseFilterCategory, setCourseFilterCategory] = useState('All');
  const [courseFilterStatus, setCourseFilterStatus] = useState('All');
  const [courseFilterType, setCourseFilterType] = useState('All');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilterStatus, setOrderFilterStatus] = useState('All');
  const [orderFilterCoupon, setOrderFilterCoupon] = useState('All');
  const [orderFilterDate, setOrderFilterDate] = useState('All');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState('');

  // Course Tab switching state
  const [courseAddTab, setCourseAddTab] = useState<'basic' | 'more' | 'content' | 'finish'>('basic');

  // Course status mapping state persistent across table re-renders
  const [courseStatuses, setCourseStatuses] = useState<Record<string, 'Approved' | 'Pending' | 'Rejected'>>(() => {
    try {
      const saved = readPlatformCache('skillfort_course_statuses_map', null);
      return parsePlatformValue(saved, {});
    } catch {
      return {};
    }
  });

  // Curriculum state & Modals matching Laravel screens
  const [courseChapters, setCourseChapters] = useState<any[]>([]);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  
  const [chapterModalOpen, setChapterModalOpen] = useState(false);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [chapterFormTitle, setChapterFormTitle] = useState('');
  const [chapterFormOrder, setChapterFormOrder] = useState('1');

  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [editingLessonIdInChap, setEditingLessonIdInChap] = useState<string | null>(null);
  const [activeLessonType, setActiveLessonType] = useState<'lesson' | 'document'>('lesson');
  const [lessonFormEx, setLessonFormEx] = useState({
    title: '',
    source: 'Vimeo',
    fileType: 'Video',
    duration: '10',
    path: '',
    description: '',
    isPreview: false
  });

  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [editingQuizIdInChap, setEditingQuizIdInChap] = useState<string | null>(null);
  const [quizFormEx, setQuizFormEx] = useState({
    title: '',
    timeLimit: '',
    attempts: '',
    totalMark: '100',
    passMark: '80'
  });

  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [activeQuizIdInChap, setActiveQuizIdInChap] = useState<string | null>(null);
  const [editingQuestionIdInChap, setEditingQuestionIdInChap] = useState<string | null>(null);
  const [questionFormEx, setQuestionFormEx] = useState<{
    questionText: string;
    grade: string;
    answers: Array<{ text: string; isCorrect: boolean }>;
  }>({
    questionText: '',
    grade: '1',
    answers: [{ text: '', isCorrect: false }]
  });

  // Extended Multi-Tab course creation state to align with Laravel specifications
  const [courseFormEx, setCourseFormEx] = useState({
    title: '',
    slug: '',
    shortDescription: '',
    fullDescription: '',
    coverImage: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=600&auto=format&fit=crop',
    previewVideo: '',
    category: 'Full Stack Training',
    subCategory: '',
    language: 'English',
    level: 'Intermediate',
    instructor: 'Prof. Rajesh Kumar',
    tags: 'java, spring, enterprise',
    status: 'Active',
    // Tab 2 Details
    duration: '40 hours',
    totalLessons: '12',
    totalQuizzes: '3',
    certificateAvailable: true,
    validityDays: '',
    whatYouWillLearn: [
      'Master OOP principles and database connection pools',
      'Build MVC backend endpoints with spring boot and Hibernate JPA',
      'Optimize query throughput on transactional schemas'
    ],
    requirements: [
      'Basic literacy of functional programming syntax',
      'Understand relational DB table cells briefly'
    ],
    whoThisCourseIsFor: [
      'Engineers looking to pivot inside Java and enterprise stacks',
      'Undergrads seeking immediate corporate placement paths'
    ],
    courseIncludes: {
      videoLessons: true,
      downloadableResources: true,
      certificate: true,
      liveProjects: true,
      mockInterviews: true
    },
    // Tab 4 SEO
    metaTitle: '',
    metaDescription: '',
    metaKeywords: '',
    ogImage: '',
    // Tab 5 Pricing
    courseType: 'Paid',
    price: '5000',
    discountPrice: '4500',
    discountStartDate: '2026-06-01',
    discountEndDate: '2026-06-30',
    enrollmentLimit: '0',
    couponCode: '',
    couponDiscountPercent: '',
    couponExpiryDate: '2027-12-31',
  });

  // Entity Form state triggers
  const [courseForm, setCourseForm] = useState({ title: '', description: '', coverImage: '', price: '', duration: '', level: 'Intermediate', category: '' });
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [coverImageUploading, setCoverImageUploading] = useState(false);

  // Restore in-progress course wizard after navigation or remount
  useEffect(() => {
    if (parseAdminPath(location.pathname) !== 'courses-add') {
      courseWizardRestoredRef.current = false;
      return;
    }
    if (courseWizardRestoredRef.current) return;

    const urlCourseId = searchParams.get('courseId');
    const urlStep = searchParams.get('step');
    const draft = readCourseWizardDraft();

    if (urlCourseId) setEditingCourseId(urlCourseId);
    else if (draft?.editingCourseId) setEditingCourseId(draft.editingCourseId);

    if (isCourseWizardStep(urlStep)) setCourseAddTab(urlStep);
    else if (draft?.courseAddTab) setCourseAddTab(draft.courseAddTab);

    if (draft?.courseFormEx && typeof draft.courseFormEx === 'object') {
      setCourseFormEx((prev) => ({ ...prev, ...draft.courseFormEx }));
    }
    if (Array.isArray(draft?.courseChapters)) {
      setCourseChapters(draft.courseChapters);
    }

    courseWizardRestoredRef.current = true;
  }, [location.pathname, searchParams]);

  // Keep wizard progress in sessionStorage while on the add/edit course screen
  useEffect(() => {
    if (parseAdminPath(location.pathname) !== 'courses-add') return;
    if (!courseFormEx.title?.trim()) return;
    persistCourseWizardDraft({
      editingCourseId,
      courseAddTab,
      courseFormEx,
      courseChapters,
    });
  }, [location.pathname, editingCourseId, courseAddTab, courseFormEx, courseChapters]);

  const [moduleForm, setModuleForm] = useState({ courseId: '', title: '', description: '', order: '' });
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);

  const [lessonForm, setLessonForm] = useState({ moduleId: '', title: '', type: 'video', vimeoUrl: '', vimeoId: '', thumbnail: '', fileUrl: '', fileName: '', fileSize: '', duration: '', order: '' });
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  const [couponForm, setCouponForm] = useState({ code: '', discountPercent: '', minAmount: '', expiryDate: '' });
  const [settingsForm, setSettingsForm] = useState({ ...settings });
  const [showNotification, setShowNotification] = useState('');

  // Course Categories
  const [categories, setCategories] = useState<any[]>(() => {
    try {
      const saved = readPlatformCache('skillfort_categories', null);
      return parsePlatformValue(saved, [
        { id: 'cat-1', name: 'Software Development', description: 'Java Full Stack, Python Full Stack, and Web architectures' },
        { id: 'cat-2', name: 'Data & Analytics', description: 'Data Science, Statistics, and Data Analyst certifications' },
        { id: 'cat-3', name: 'Database Administration', description: 'Oracle Masteries and relational SQL indexing' },
        { id: 'cat-4', name: 'Cloud Computing & DevOps', description: 'AWS architecting, GCP structures, and Docker engines' }
      ]);
    } catch { return []; }
  });
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });

  // Course Reviews
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'pending' | 'all'>('pending');

  // Quizzes persistent state
  const [quizzes, setQuizzes] = useState<any[]>(() => {
    try {
      const saved = readPlatformCache('skillfort_quizzes_mgmt', null);
      return parsePlatformValue(saved, [
        { id: 'quiz-1', title: 'OOP Foundations Challenge', courseId: '', courseTitle: 'Java Full Stack Academy', passingScore: 80 },
        { id: 'quiz-2', title: 'Relational Database Normalization', courseId: '', courseTitle: 'Data Science & Visual Analytics', passingScore: 75 }
      ]);
    } catch { return []; }
  });
  const [quizForm, setQuizForm] = useState({ title: '', courseTitle: 'Java Full Stack Academy', passingScore: '80' });

  // Quiz Questions state
  const [quizQuestions, setQuizQuestions] = useState<any[]>(() => {
    try {
      const saved = readPlatformCache('skillfort_questions_mgmt', null);
      return parsePlatformValue(saved, [
        { id: 'q-1', quizId: 'quiz-1', questionText: 'Which keyword is used to establish inheritance in Java?', optA: 'implements', optB: 'extends', optC: 'inherits', optD: 'super', correct: 'B' },
        { id: 'q-2', quizId: 'quiz-1', questionText: 'What is the default size of a float variable in memory?', optA: '16 bits', optB: '64 bits', optC: '32 bits', optD: '8 bits', correct: 'C' },
        { id: 'q-3', quizId: 'quiz-2', questionText: 'Which normal form addresses transitive dependencies?', optA: '1NF', optB: '2NF', optC: '3NF', optD: 'BCNF', correct: 'C' }
      ]);
    } catch { return []; }
  });
  const [questionForm, setQuestionForm] = useState({ quizId: 'quiz-1', questionText: '', optA: '', optB: '', optC: '', optD: '', correct: 'A' });

  // Students management
  const [studentForm, setStudentForm] = useState({ name: '', email: '', password: '', role: 'student' });

  // Instructors management
  const [instructors, setInstructors] = useState<any[]>(() => {
    try {
      const saved = readPlatformCache('skillfort_instructors', null);
      return parsePlatformValue(saved, [
        { id: 'inst-1', name: 'Prof. Rajesh Kumar', email: 'rajesh@skillfort.co', expertise: 'Enterprise Java / Spring Boot MVC', bio: 'Former Senior Architect at Oracle India with 15+ years training cohorts.' },
        { id: 'inst-2', name: 'Dr. Amit Patel', email: 'amit@skillfort.co', expertise: 'Data Science / Machine Learning', bio: 'AI researcher and certified instructor specializing in pandas and predictive modeling.' },
        { id: 'inst-3', name: 'Ms. Sunita Sharma', email: 'sunita@skillfort.co', expertise: 'AWS Cloud / Docker Infrastructure', bio: 'Certified Solutions Architect Champion. Enthusiastic about Serverless scalability.' }
      ]);
    } catch { return []; }
  });
  const [instructorForm, setInstructorForm] = useState({ name: '', email: '', expertise: '', bio: '' });

  // Auto notification alert popup — stable ref so child admin panels don't re-fetch in a loop
  const notify = useCallback((msg: string) => {
    setShowNotification(msg);
    setTimeout(() => {
      setShowNotification('');
    }, 4000);
  }, []);

  const handleRefundPayment = async (payment: PaymentReport) => {
    if (payment.status === 'refunded') {
      notify('This payment is already refunded.');
      return;
    }
    if (payment.status !== 'captured') {
      notify('Only captured payments can be refunded.');
      return;
    }
    const confirmed = window.confirm(
      `Refund ₹${payment.amountPaid} to ${payment.userName} and revoke course access for "${payment.courseTitle}"?`
    );
    if (!confirmed) return;

    try {
      const res = await apiFetch(`/api/admin/payments/${payment.id}/refund`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || 'Refund failed');
        return;
      }
      notify(
        data.mode === 'simulator'
          ? 'Refund recorded (simulator mode — no live Razorpay call).'
          : 'Refund processed successfully.'
      );
      await onRefreshData();
    } catch {
      notify('Refund request failed');
    }
  };

  const handleUpdateStatus = (courseId: string, newStatus: 'Approved' | 'Pending' | 'Rejected') => {
    try {
      const updatedStatuses = { ...courseStatuses, [courseId]: newStatus };
      setCourseStatuses(updatedStatuses);
      void setPlatformValue('skillfort_course_statuses_map', updatedStatuses);
      
      const saved = readPlatformCache(`skillfort_course_metadata_${courseId}`, null);
      if (saved) {
        const extra = parsePlatformValue<Record<string, unknown>>(saved, {});
        extra.status = newStatus;
        void setPlatformValue(`skillfort_course_metadata_${courseId}`, extra);
      }
      notify(`Course status updated to ${newStatus}`);
    } catch (err) {
      console.error(err);
    }
  };

  const formatTimestamp = (isoStr?: string) => {
    if (!isoStr) return "2026-06-07 12:59";
    try {
      const d = new Date(isoStr);
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      const hr = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${yr}-${mo}-${dy} ${hr}:${mi}`;
    } catch {
      return "2026-06-07 12:59";
    }
  };

  const getUpdatedTimestamp = (c: Course) => {
    const extra = readCourseExtraMetadata(c.id);
    if (extra.updatedAt) return formatTimestamp(extra.updatedAt);
    const baseDate = new Date(c.createdAt || "2026-06-07T12:00:00Z");
    return formatTimestamp(new Date(baseDate.getTime() + 3600000).toISOString());
  };

  // COURSE METHODS
  const handleCourseBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      notify('Please choose a JPG, PNG, WebP, or GIF image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify('Image must be 5 MB or smaller.');
      return;
    }

    setCoverImageUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Could not read image file'));
        reader.readAsDataURL(file);
      });

      const resp = await apiFetch('/api/admin/uploads/course-banner', {
        method: 'POST',
        body: JSON.stringify({ dataUrl }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setCourseFormEx((prev) => ({ ...prev, coverImage: data.url }));
      notify('Course banner uploaded successfully.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Banner upload failed');
    } finally {
      setCoverImageUploading(false);
    }
  };

  const readCourseExtraMetadata = (courseId: string): Record<string, any> => {
    const saved = readPlatformCache(`skillfort_course_metadata_${courseId}`, null);
    return parsePlatformValue(saved, {});
  };

  const buildCourseWizardState = (c: Course) => {
    const extraData = readCourseExtraMetadata(c.id);
    const linkedCoupon = coupons.find((coupon) => coupon.courseId === c.id && coupon.isActive);
    const courseCourseModules = modules.filter(m => m.courseId === c.id);
    courseCourseModules.sort((a, b) => a.order - b.order);

    const nestedChapters = courseCourseModules.map(m => {
      const moduleLessons = lessons.filter(l => l.moduleId === m.id);
      moduleLessons.sort((a, b) => a.order - b.order);

      const mappedLessons = moduleLessons.map(l => ({
        id: l.id,
        title: l.title,
        type: l.type === 'pdf' ? 'document' : 'lesson',
        source: l.vimeoUrl ? 'Vimeo' : 'YouTube',
        path: l.vimeoUrl || l.fileUrl || '',
        duration: l.duration || '10',
        description: l.fileName || '',
        isPreview: false,
        fileType: l.type === 'pdf' ? 'Document' : 'Video'
      }));

      const localQuizzesStr = readPlatformCache('skillfort_quizzes_mgmt', []);
      const localQuizzes = parsePlatformValue(localQuizzesStr, []);
      const moduleQuizzes = localQuizzes.filter((qz: any) => qz.moduleId === m.id);

      const localQuestionsStr = readPlatformCache('skillfort_questions_mgmt', []);
      const localQuestions = parsePlatformValue(localQuestionsStr, []);

      const mappedQuizzes = moduleQuizzes.map((qz: any) => {
        const qQuestions = localQuestions.filter((quest: any) => quest.quizId === qz.id);
        return {
          id: qz.id,
          title: qz.title,
          type: 'quiz',
          timeLimit: qz.timeLimit || '',
          attempts: qz.attempts || '',
          totalMark: qz.totalMark || '100',
          passMark: qz.passMark || '80',
          questions: qQuestions.map((quest: any) => ({
            id: quest.id,
            questionText: quest.questionText,
            grade: quest.grade || 1,
            answers: quest.answers || []
          }))
        };
      });

      return {
        id: m.id,
        title: m.title,
        order: m.order || '1',
        items: [...mappedLessons, ...mappedQuizzes]
      };
    });

    const form = {
      title: c.title,
      slug: extraData.slug || c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
      shortDescription: extraData.shortDescription || c.description.slice(0, 100),
      fullDescription: extraData.fullDescription || c.description,
      coverImage: c.coverImage,
      previewVideo: extraData.previewVideo || '',
      category: c.category || 'Full Stack Training',
      subCategory: extraData.subCategory || 'Backend Automation',
      language: extraData.language || 'English',
      level: c.level || 'Intermediate',
      instructor: extraData.instructor || instructors[0]?.name || 'Prof. Rajesh Kumar',
      tags: extraData.tags || 'java, spring, development',
      status: extraData.status || (courseStatuses[c.id] || 'Approved'),
      duration: c.duration || '40 hours',
      totalLessons: extraData.totalLessons || '12',
      totalQuizzes: extraData.totalQuizzes || '3',
      certificateAvailable: extraData.certificateAvailable !== undefined ? extraData.certificateAvailable : true,
      validityDays:
        c.validityDays != null
          ? String(c.validityDays)
          : extraData.validityDays != null && extraData.validityDays !== ''
            ? String(extraData.validityDays)
            : extraData.accessType === 'Limited' && extraData.limitedDuration
              ? String(extraData.limitedDuration)
              : '',
      whatYouWillLearn: extraData.whatYouWillLearn || ['Master OOP principles and modular encapsulation'],
      requirements: extraData.requirements || ['Basic programming structures'],
      whoThisCourseIsFor: extraData.whoThisCourseIsFor || ['Systems engineers looking to scale up'],
      courseIncludes: extraData.courseIncludes || { videoLessons: true, downloadableResources: true, certificate: true, liveProjects: true, mockInterviews: true },
      metaTitle: extraData.metaTitle || '',
      metaDescription: extraData.metaDescription || '',
      metaKeywords: extraData.metaKeywords || '',
      ogImage: extraData.ogImage || '',
      courseType: c.price > 0 ? 'Paid' : 'Free',
      price: c.price.toString(),
      discountPrice: extraData.discountPrice || (c.price * 0.9).toString(),
      discountStartDate: extraData.discountStartDate || '',
      discountEndDate: extraData.discountEndDate || '',
      enrollmentLimit: extraData.enrollmentLimit || '0',
      couponCode: extraData.couponCode || linkedCoupon?.code || '',
      couponDiscountPercent:
        extraData.couponDiscountPercent ||
        (linkedCoupon ? String(linkedCoupon.discountPercent) : ''),
      couponExpiryDate:
        extraData.couponExpiryDate || linkedCoupon?.expiryDate || '2027-12-31',
      qaEnabled: extraData.qaEnabled ?? false,
      certEnabled: extraData.certEnabled ?? extraData.certificateAvailable ?? false,
    };

    return { form, chapters: nestedChapters };
  };

  const getWizardSnapshot = () => {
    const courseId = editingCourseId || searchParams.get('courseId');
    if (courseFormEx.title?.trim()) {
      return { form: courseFormEx, chapters: courseChapters, courseId };
    }
    if (courseId) {
      const c = courses.find((x) => x.id === courseId);
      if (c) {
        const built = buildCourseWizardState(c);
        return { form: built.form, chapters: built.chapters, courseId };
      }
    }
    return { form: courseFormEx, chapters: courseChapters, courseId };
  };

  const syncWizardState = (snapshot: ReturnType<typeof getWizardSnapshot>) => {
    if (snapshot.courseId) setEditingCourseId(snapshot.courseId);
    setCourseFormEx(snapshot.form);
    setCourseChapters(snapshot.chapters);
  };

  // Re-hydrate wizard when URL has courseId but in-memory form was lost
  useEffect(() => {
    if (parseAdminPath(location.pathname) !== 'courses-add') return;
    if (courseFormEx.title?.trim()) return;
    const courseId = searchParams.get('courseId') || editingCourseId;
    if (!courseId) return;
    const c = courses.find((x) => x.id === courseId);
    if (!c) return;
    const built = buildCourseWizardState(c);
    setEditingCourseId(courseId);
    setCourseFormEx(built.form);
    setCourseChapters(built.chapters);
    persistCourseWizardDraft({
      editingCourseId: courseId,
      courseAddTab,
      courseFormEx: built.form,
      courseChapters: built.chapters,
    });
  }, [location.pathname, searchParams, courses, editingCourseId, courseFormEx.title, courseAddTab]);

  useEffect(() => {
    if (activeTab !== 'courses-reviews') return;
    let cancelled = false;
    void (async () => {
      setReviewsLoading(true);
      try {
        const data = await fetchAdminCourseReviews();
        if (!cancelled) setReviews(data);
      } catch {
        if (!cancelled) notify('Failed to load course reviews');
      } finally {
        if (!cancelled) setReviewsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'landing-banner' || activeTab === 'wall-of-success') {
      setWebsiteExpanded(true);
    }
  }, [activeTab]);

  const handleApproveReview = async (reviewId: string) => {
    try {
      const updated = await moderateCourseReview(reviewId, { status: 'approved', isPinned: true });
      setReviews((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      await onRefreshData();
      notify('Review approved and published on the course page.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to approve review');
    }
  };

  const handleRejectReview = async (reviewId: string) => {
    try {
      const updated = await moderateCourseReview(reviewId, { status: 'rejected', isPinned: false });
      setReviews((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      notify('Review rejected.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to reject review');
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    try {
      await deleteCourseReview(reviewId);
      setReviews((prev) => prev.filter((entry) => entry.id !== reviewId));
      await onRefreshData();
      notify('Review removed');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete review');
    }
  };

  const syncCourseCouponFromWizard = async (courseId: string, form: typeof courseFormEx) => {
    const code = form.couponCode?.trim().toUpperCase();
    const discountRaw = form.couponDiscountPercent?.trim();
    const linkedCoupon = coupons.find((coupon) => coupon.courseId === courseId);

    if (!code || !discountRaw) {
      if (linkedCoupon) {
        await apiFetch(`/api/admin/coupons/${linkedCoupon.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: false }),
        });
      }
      return;
    }

    const payload = {
      code,
      discountPercent: Number(discountRaw),
      minAmount: Number(form.price) || 0,
      expiryDate: form.couponExpiryDate || '2027-12-31',
      courseId,
      isActive: true,
    };

    if (linkedCoupon) {
      const resp = await apiFetch(`/api/admin/coupons/${linkedCoupon.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Could not update course coupon');
      }
      return;
    }

    const resp = await apiFetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || 'Could not create course coupon');
    }
  };

  const handleSaveCourse = async (e?: React.FormEvent, targetNextTab?: 'basic' | 'more' | 'content' | 'finish' | 'exit') => {
    if (e) e.preventDefault();

    const snapshot = getWizardSnapshot();
    if (!courseFormEx.title?.trim() && snapshot.form.title?.trim()) {
      syncWizardState(snapshot);
    }

    const activeForm = snapshot.form.title?.trim() ? snapshot.form : courseFormEx;
    const activeChapters = snapshot.form.title?.trim() ? snapshot.chapters : courseChapters;
    const activeCourseId = snapshot.courseId || editingCourseId;

    if (!activeForm.title?.trim()) {
      notify('Course title is required. Please enter a title on the Basic Info tab.');
      return;
    }

    const shouldSaveCurriculum = targetNextTab === 'finish' || targetNextTab === 'exit';
    const url = activeCourseId ? `/api/admin/courses/${activeCourseId}` : '/api/admin/courses';
    const method = activeCourseId ? 'PUT' : 'POST';

    const payload = {
      title: activeForm.title,
      description: activeForm.fullDescription || activeForm.shortDescription || "No description specified.",
      coverImage: activeForm.coverImage || "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=600&auto=format&fit=crop",
      price: Number(activeForm.price || 0),
      duration: activeForm.duration || "40 Hours",
      level: activeForm.level || "Intermediate",
      category: activeForm.category || "Full Stack Training",
      validityDays: activeForm.validityDays === '' ? undefined : activeForm.validityDays,
    };

    try {
      const resp = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (resp.ok) {
        const result = await resp.json();
        const finalCourseId = activeCourseId || result.id || `course-${Math.random().toString(36).substring(2, 9)}`;

        // Advance wizard immediately — do not wait for metadata/curriculum saves
        if (!activeCourseId) setEditingCourseId(finalCourseId);
        if (targetNextTab && targetNextTab !== 'exit') {
          setCourseAddTab(targetNextTab);
          navigate(
            `${adminPath('courses-add')}?courseId=${encodeURIComponent(finalCourseId)}&step=${targetNextTab}`,
            { replace: true }
          );
          persistCourseWizardDraft({
            editingCourseId: finalCourseId,
            courseAddTab: targetNextTab,
            courseFormEx: activeForm,
            courseChapters: activeChapters,
          });
        }
        
        const metadataPayload = { ...activeForm, updatedAt: new Date().toISOString() };
        const metadataOk = await setPlatformValue(`skillfort_course_metadata_${finalCourseId}`, metadataPayload);

        try {
          await syncCourseCouponFromWizard(finalCourseId, activeForm);
          if (
            activeForm.couponCode?.trim() ||
            coupons.some((coupon) => coupon.courseId === finalCourseId)
          ) {
            await onRefreshData();
          }
        } catch (couponErr) {
          console.error(couponErr);
          notify(
            couponErr instanceof Error
              ? couponErr.message
              : 'Course saved, but coupon could not be synced.'
          );
        }
        
        const currentStatuses = { ...courseStatuses, [finalCourseId]: activeForm.status as any || 'Approved' };
        setCourseStatuses(currentStatuses);
        await setPlatformValue('skillfort_course_statuses_map', currentStatuses);

        if (shouldSaveCurriculum) {
          try {
            // Reconcile and clean up deleted elements (chapters, lessons, documents, quizzes)
            if (activeCourseId) {
              const origModules = modules.filter(m => m.courseId === activeCourseId);
              const finalModuleIds = new Set(activeChapters.map(ch => ch.id));
              const removedModules = origModules.filter(m => !finalModuleIds.has(m.id));

              const origLessons = lessons.filter(l => origModules.some(m => m.id === l.moduleId));
              const finalLessonIds = new Set<string>();
              activeChapters.forEach(chap => {
                if (chap.items) {
                  chap.items.forEach((itm: any) => {
                    if (itm.type === 'lesson' || itm.type === 'document') {
                      finalLessonIds.add(itm.id);
                    }
                  });
                }
              });

              const removedLessons = origLessons.filter(l => {
                const parentModuleKept = finalModuleIds.has(l.moduleId);
                return parentModuleKept && !finalLessonIds.has(l.id);
              });

              for (const m of removedModules) {
                try {
                  await apiFetch(`/api/admin/modules/${m.id}`, { method: 'DELETE' });
                } catch (err) {
                  console.error("Failed to delete removed module inside course:", m.id, err);
                }
              }

              for (const l of removedLessons) {
                try {
                  await apiFetch(`/api/admin/lessons/${l.id}`, { method: 'DELETE' });
                } catch (err) {
                  console.error("Failed to delete removed lesson inside course:", l.id, err);
                }
              }

              const finalQuizIds = new Set<string>();
              activeChapters.forEach(chap => {
                if (chap.items) {
                  chap.items.forEach((itm: any) => {
                    if (itm.type === 'quiz') {
                      finalQuizIds.add(itm.id);
                    }
                  });
                }
              });

              try {
                const parentQuizzesStr = readPlatformCache('skillfort_quizzes_mgmt', []);
                const parentQuizzes = parsePlatformValue(parentQuizzesStr, []);
                const filteredQuizzes = parentQuizzes.filter((pq: any) => {
                  const belongsToThisCourse = pq.courseId === activeCourseId;
                  if (!belongsToThisCourse) return true;
                  return finalQuizIds.has(pq.id);
                });
                void setPlatformValue('skillfort_quizzes_mgmt', filteredQuizzes);

                const parentQuestionsStr = readPlatformCache('skillfort_questions_mgmt', []);
                const parentQuestions = parsePlatformValue(parentQuestionsStr, []);
                const filteredQuestions = parentQuestions.filter((q: any) => {
                  const quizObj = parentQuizzes.find((pq: any) => pq.id === q.quizId);
                  if (!quizObj) return true;
                  const belongsToThisCourse = quizObj.courseId === activeCourseId;
                  if (!belongsToThisCourse) return true;
                  return finalQuizIds.has(q.quizId);
                });
                void setPlatformValue('skillfort_questions_mgmt', filteredQuestions);
              } catch (err) {
                console.error("Failed to clean up quiz localStorage:", err);
              }
            }

            const updatedChaps = [...activeChapters];
            for (let i = 0; i < updatedChaps.length; i++) {
              const chap = updatedChaps[i];
              const isNewChap = chap.id.startsWith('chap-');
              const chapUrl = isNewChap ? '/api/admin/modules' : `/api/admin/modules/${chap.id}`;
              const chapMethod = isNewChap ? 'POST' : 'PUT';

              const chapResp = await apiFetch(chapUrl, {
                method: chapMethod,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  courseId: finalCourseId,
                  title: chap.title,
                  order: Number(chap.order) || 1
                })
              });

              if (chapResp.ok) {
                const chapData = await chapResp.json();
                const realChapId = isNewChap ? chapData.id : chap.id;

                if (isNewChap) {
                  updatedChaps[i] = { ...chap, id: realChapId };
                }

                const updatedItems = [...(chap.items || [])];
                for (let j = 0; j < updatedItems.length; j++) {
                  const item = updatedItems[j];
                  const itemOrder = j + 1;
                  if (item.type === 'lesson' || item.type === 'document') {
                    const isNewLess = item.id.startsWith('less-') || item.id.startsWith('quiz-');
                    const lessUrl = isNewLess ? '/api/admin/lessons' : `/api/admin/lessons/${item.id}`;
                    const lessMethod = isNewLess ? 'POST' : 'PUT';

                    const lessResp = await apiFetch(lessUrl, {
                      method: lessMethod,
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        moduleId: realChapId,
                        title: item.title,
                        type: item.fileType === 'Document' ? 'pdf' : 'video',
                        vimeoUrl: item.source === 'Vimeo' ? item.path : undefined,
                        fileUrl: item.source !== 'Vimeo' ? item.path : undefined,
                        fileName: item.description,
                        duration: item.duration,
                        order: itemOrder,
                      }),
                    });

                    if (lessResp.ok && isNewLess) {
                      const lessData = await lessResp.json();
                      updatedItems[j] = { ...item, id: lessData.id };
                    }
                  } else if (item.type === 'quiz') {
                    const isNewQuiz = item.id.startsWith('quiz-') || item.id.startsWith('less-');
                    const isServerLesson = item.id.startsWith('lesson-');
                    const quizUrl = isServerLesson ? `/api/admin/lessons/${item.id}` : '/api/admin/lessons';
                    const quizMethod = isServerLesson ? 'PUT' : 'POST';

                    const quizQuestions = (item.questions || []).map((q: any) => ({
                      id: q.id || `q-${Math.random().toString(36).substring(2, 9)}`,
                      questionText: q.questionText,
                      grade: Number(q.grade) || 1,
                      answers:
                        q.answers ||
                        [
                          { text: q.optA || 'Option A', isCorrect: q.correct === 'A' },
                          { text: q.optB || 'Option B', isCorrect: q.correct === 'B' },
                          { text: q.optC || 'Option C', isCorrect: q.correct === 'C' },
                          { text: q.optD || 'Option D', isCorrect: q.correct === 'D' },
                        ].filter((a: { text: string }) => a.text),
                    }));

                    const quizResp = await apiFetch(quizUrl, {
                      method: quizMethod,
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        moduleId: realChapId,
                        title: item.title,
                        type: 'quiz',
                        order: itemOrder,
                        passMark: String(item.passMark || item.passingScore || 80),
                        timeLimit: item.timeLimit || '15',
                        attempts: item.attempts || '3',
                        questions: quizQuestions,
                      }),
                    });

                    if (quizResp.ok) {
                      const quizData = await quizResp.json();
                      if (isNewQuiz || !isServerLesson) {
                        updatedItems[j] = { ...item, id: quizData.id };
                      }
                    }

                    const parentQuizzesStr = readPlatformCache('skillfort_quizzes_mgmt', []);
                    const parentQuizzes = parsePlatformValue(parentQuizzesStr, []);
                    const quizId = updatedItems[j].id;
                    const listQuizzes = parentQuizzes.filter((pq: any) => pq.id !== quizId);
                    listQuizzes.push({
                      id: quizId,
                      title: item.title,
                      courseId: finalCourseId,
                      courseTitle: activeForm.title,
                      moduleId: realChapId,
                      passingScore: Number(item.passMark) || 80,
                      timeLimit: item.timeLimit,
                      attempts: item.attempts,
                      totalMark: item.totalMark,
                      passMark: item.passMark,
                    });
                    void setPlatformValue('skillfort_quizzes_mgmt', listQuizzes);

                    const parentQuestionsStr = readPlatformCache('skillfort_questions_mgmt', []);
                    const parentQuestions = parsePlatformValue(parentQuestionsStr, []);
                    let listQuestions = parentQuestions.filter((pq: any) => pq.quizId !== quizId);
                    quizQuestions.forEach((q: any) => {
                      listQuestions.push({
                        id: q.id,
                        quizId,
                        questionText: q.questionText,
                        grade: q.grade,
                        answers: q.answers,
                      });
                    });
                    void setPlatformValue('skillfort_questions_mgmt', listQuestions);
                  }
                }
                updatedChaps[i].items = updatedItems;
              }
            }
            setCourseChapters(updatedChaps);
          } catch (curriculumErr) {
            console.error('Curriculum save error:', curriculumErr);
            notify('Course saved, but some chapters or lessons may not have synced. Review in the catalog.');
          }
        }

        if (targetNextTab === 'exit') {
          clearCourseWizardDraft();
          courseWizardRestoredRef.current = false;
          setEditingCourseId(null);
          setCourseAddTab('basic');
          setCourseChapters([]);
          setCourseFormEx({
            title: '',
            slug: '',
            shortDescription: '',
            fullDescription: '',
            coverImage: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=600&auto=format&fit=crop',
            previewVideo: '',
            category: 'Full Stack Training',
            subCategory: '',
            language: 'English',
            level: 'Intermediate',
            instructor: instructors[0]?.name || 'Prof. Rajesh Kumar',
            tags: 'java, spring, enterprise',
            status: 'Active',
            duration: '40 hours',
            totalLessons: '12',
            totalQuizzes: '3',
            certificateAvailable: true,
            validityDays: '',
            whatYouWillLearn: [
              'Master OOP principles and database connection pools',
              'Build MVC backend endpoints with spring boot and Hibernate JPA',
              'Optimize query throughput on transactional schemas'
            ],
            requirements: [
              'Basic literacy of functional programming syntax',
              'Understand relational DB table cells briefly'
            ],
            whoThisCourseIsFor: [
              'Engineers looking to pivot inside Java and enterprise stacks',
              'Undergrads seeking immediate corporate placement paths'
            ],
            courseIncludes: {
              videoLessons: true,
              downloadableResources: true,
              certificate: true,
              liveProjects: true,
              mockInterviews: true
            },
            metaTitle: '',
            metaDescription: '',
            metaKeywords: '',
            ogImage: '',
            courseType: 'Paid',
            price: '5000',
            discountPrice: '4500',
            discountStartDate: '2026-06-01',
            discountEndDate: '2026-06-30',
            enrollmentLimit: '0',
            couponCode: '',
            couponDiscountPercent: '',
            couponExpiryDate: '2027-12-31',
          });
          await onRefreshData();
          navigate(adminPath('courses-all'), { replace: true });
          notify('Course published successfully!');
        } else if (targetNextTab) {
          if (shouldSaveCurriculum) {
            await onRefreshData();
            notify(metadataOk ? 'Course and curriculum saved successfully!' : 'Course saved, but extended details may not have synced.');
          } else {
            notify(metadataOk ? 'Progress saved — continue to the next step.' : 'Course saved, but instructor/details sync failed. Click Save again.');
          }
        } else {
          await onRefreshData();
          setEditingCourseId(null);
          setCourseChapters([]);
          goToTab('courses-all');
          notify('Course saved.');
        }
      } else {
        let errorMsg = 'Save failed';
        try {
          const errJson = await resp.json();
          errorMsg = errJson.error || errorMsg;
        } catch {
          errorMsg = await resp.text();
        }
        notify(`Could not save course: ${errorMsg}`);
      }
    } catch (err) {
      console.error(err);
      notify("Internal compliance gateway server error.");
    }
  };

  const handleEditCourse = (c: Course) => {
    const { form, chapters } = buildCourseWizardState(c);
    setEditingCourseId(c.id);
    setCourseAddTab('basic');
    setCourseChapters(chapters);
    setCourseFormEx(form);
  };

  const handleDeleteCourse = async (id: string) => {
    if (!window.confirm("Verify you intend to permanently delete this course modules tree? Selected progress, syllabus data and enrollments will instantly flush structural nodes.")) return;
    try {
      const resp = await apiFetch(`/api/admin/courses/${id}`, { method: 'DELETE' });
      if (resp.ok) {
        notify("Course deleted successfully");
        await onRefreshData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // MODULE METHODS
  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleForm.courseId || !moduleForm.title) return alert("Please specify target Course ID and title parameters.");
    const url = editingModuleId ? `/api/admin/modules/${editingModuleId}` : '/api/admin/modules';
    const method = editingModuleId ? 'PUT' : 'POST';

    try {
      const resp = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(moduleForm)
      });
      if (resp.ok) {
        notify("Module database catalog resolved.");
        setModuleForm({ courseId: '', title: '', description: '', order: '' });
        setEditingModuleId(null);
        await onRefreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteModule = async (id: string) => {
    if (!window.confirm("Delete this module and all nested lessons?")) return;
    try {
      const resp = await apiFetch(`/api/admin/modules/${id}`, { method: 'DELETE' });
      if (resp.ok) {
        notify("Module records removed");
        await onRefreshData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // LESSON METHODS
  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonForm.moduleId || !lessonForm.title) return alert("Select parent module target & title specs.");
    const url = editingLessonId ? `/api/admin/lessons/${editingLessonId}` : '/api/admin/lessons';
    const method = editingLessonId ? 'PUT' : 'POST';

    try {
      const resp = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lessonForm)
      });
      if (resp.ok) {
        notify("Module lesson nodes mapped");
        setLessonForm({ moduleId: '', title: '', type: 'video', vimeoUrl: '', vimeoId: '', thumbnail: '', fileUrl: '', fileName: '', fileSize: '', duration: '', order: '' });
        setEditingLessonId(null);
        await onRefreshData();
      }
    } catch (err) {
      console.log(err);
    }
  };

  const handleDeleteLesson = async (id: string) => {
    if (!window.confirm("Delete this lesson segment?")) return;
    try {
      const resp = await apiFetch(`/api/admin/lessons/${id}`, { method: 'DELETE' });
      if (resp.ok) {
        notify("Lesson nodes cleared");
        await onRefreshData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // COUPON METHODS
  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const resp = await apiFetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(couponForm)
      });
      if (resp.ok) {
        notify("Voucher voucher code registry verified!");
        setCouponForm({ code: '', discountPercent: '', minAmount: '', expiryDate: '' });
        await onRefreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateCoupon = async (id: string, activeStatus: boolean) => {
    try {
      await apiFetch(`/api/admin/coupons/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: activeStatus })
      });
      notify("Coupon activation adjusted");
      await onRefreshData();
    } catch (e) {
      console.error(e);
    }
  };

  // SETTINGS METHODS
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const resp = await apiFetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm)
      });
      if (resp.ok) {
        notify("Secure registry settings customized");
        await onRefreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };


  // EMAIL SIMULATOR DISPATCH METHODS
  const handleTriggerSimWelcome = () => {
    const student = students.find(s => s.id === selectedSimStudentId) || students[0];
    if (!student) {
      notify("Please select or create an active Student account first.");
      return;
    }
    
    const newId = `email-sandbox-wel-${Date.now()}`;
    const newMail = {
      id: newId,
      subject: `Welcome to SkillFort Academy Hub! 🎓 Account Initialized`,
      sender: `admissions@skillfort.com`,
      recipient: student.email,
      date: new Date().toISOString().split('T')[0],
      read: false,
      category: 'welcome',
      body: `
        <div style="font-family: 'Poppins', sans-serif; max-width: 650px; margin: 0 auto; padding: 25px; background-color: #0a0a0a; color: #e5e5e5; border: 1px solid #262626; border-radius: 12px; font-size: 14px; line-height: 1.6;">
          <div style="text-align: center; border-bottom: 2px solid #F89A15; padding-bottom: 15px; margin-bottom: 20px;">
            <h1 style="color: #F89A15; margin: 0; font-size: 24px;">SKILLFORT ACADEMY</h1>
            <p style="color: #737373; margin: 5px 0 0 0; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px;">Sandbox Welcome Correspondence</p>
          </div>
          <p>Dear <strong>${student.name}</strong>,</p>
          <p>Welcome Note Simulator activated successfully! We've prepared a premier student sandbox profile associated with email: <strong>${student.email}</strong>.</p>
          <div style="background-color: #171717; border: 1px dashed #404040; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #F89A15; font-size: 13px;">YOUR ACADEMY PROFILE SUMMARY:</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #a3a3a3;">
              <tr><td style="padding: 4px 0;"><strong>Active Member:</strong></td><td style="text-align: right; color: #fff;">${student.name}</td></tr>
              <tr><td style="padding: 4px 0;"><strong>Academic Email:</strong></td><td style="text-align: right; color: #fff;">${student.email}</td></tr>
            </table>
          </div>
          <p>To begin immediately, visit your catalog, purchase curriculum programs, completed interactive tasks, and claim verifiable achievements. Your professional sandbox space is active.</p>
          <hr style="border: 0; border-top: 1px solid #262626; margin: 20px 0;" />
          <p style="font-size: 11px; color: #737373; text-align: center; margin: 0;">This email is a dynamic sandbox registration simulator. Admissions Desk, India.</p>
        </div>
      `
    };

    let mailList = [];
    try {
      const saved = readPlatformCache(`skillfort_emails_${student.id}`, null);
      if (saved) {
        mailList = JSON.parse(saved);
      }
    } catch {}

    const updated = [newMail, ...mailList];
    void setPlatformValue(`skillfort_emails_${student.id}`, updated);
    notify(`Dispatched simulated Welcome Note to ${student.name}'s Inbox!`);
  };

  const handleTriggerSimReceipt = () => {
    const student = students.find(s => s.id === selectedSimStudentId) || students[0];
    if (!student) {
      notify("Please select or create an active Student account first.");
      return;
    }

    const course = courses.find(c => c.id === selectedSimCourseId) || courses[0];
    const courseTitle = course ? course.title : "Artificial Intelligence & Generative Deep Learning";
    const coursePrice = course ? course.price : 4999;

    const base = Math.round((coursePrice / 1.18) * 100) / 100;
    const gst = Math.round((coursePrice - base) * 100) / 100;
    const invoiceId = `SF-INV-${Math.floor(100000 + Math.random() * 900000)}`;
    const razorpayOrderId = `order_${Math.random().toString(36).substring(2, 10)}`;
    const razorpayPaymentId = `pay_${Math.random().toString(36).substring(2, 10)}`;

    const newId = `email-sandbox-rec-${Date.now()}`;
    const purchaseReceiptEmail = {
      id: newId,
      subject: `Invoice Receipt of Purchase: ${courseTitle} (Inv No: ${invoiceId})`,
      sender: `billing@skillfort.com`,
      recipient: student.email,
      date: new Date().toISOString().split('T')[0],
      read: false,
      category: 'receipt',
      body: `
        <div style="font-family: 'Poppins', sans-serif; max-width: 650px; margin: 0 auto; padding: 25px; background-color: #0c0a09; color: #f5f5f4; border: 1px solid #292524; border-radius: 16px; font-size: 14px; line-height: 1.6;">
          <table style="width: 100%; margin-bottom: 25px;">
            <tr>
              <td>
                <h2 style="color: #F89A15; margin: 0; font-size: 20px;">SKILLFORT LMS INVOICE</h2>
                <span style="font-size: 10px; color: #a8a29e;">GSTIN: 27AAECT9382M1Z0</span>
              </td>
              <td style="text-align: right;">
                <span style="display: inline-block; padding: 4px 10px; border-radius: 100px; font-size: 10px; font-weight: bold; background-color: #064e3b; color: #34d399; border: 1px solid #047857;">CAPTURED & PAID</span>
              </td>
            </tr>
          </table>
          <hr style="border: 0; border-top: 1px solid #292524; margin: 20px 0;" />
          <p>Hello <strong>${student.name}</strong>,</p>
          <p>Thank you for purchasing premium course credentials! Below is your official digital itemized tax receipt of purchase:</p>
          <div style="background-color: #1c1917; border-radius: 10px; padding: 15px; margin: 20px 0;">
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #292524;"><th style="text-align: left; padding: 8px 0; color: #a8a29e;">Item Curriculum</th><th style="text-align: right; padding: 8px 0; color: #a8a29e;">Subtotal Value</th></tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold;">${courseTitle} <br/><span style="font-weight: normal; font-size: 10px; color: #a8a29e;">SAC Code: 999249</span></td>
                <td style="text-align: right; font-weight: bold;">₹${base}</td>
              </tr>
              <tr style="border-top: 1px solid #292524;"><td style="padding: 6px 0; color: #a8a29e; font-size: 12px;">Taxable Amount Base</td><td style="text-align: right; font-size: 12px;">₹${base}</td></tr>
              <tr><td style="padding: 4px 0; color: #a8a29e; font-size: 12px;">CGST/SGST Breakup (18%)</td><td style="text-align: right; font-size: 12px;">₹${gst}</td></tr>
              <tr style="border-top: 2px solid #F89A15; font-size: 16px; font-weight: bold;"><td style="padding: 10px 0; color: #F89A15;">Grand Total Paid</td><td style="text-align: right; color: #F89A15;">₹${coursePrice}</td></tr>
            </table>
          </div>
          <p style="font-size: 11px; color: #78716c; text-align: center; margin-top: 20px;">Receipt Ref ID: ${invoiceId}. Compliant computer generated output.</p>
        </div>
      `
    };

    const paymentStatusEmail = {
      id: `email-status-${Date.now()}`,
      subject: `Secure Transaction Completed Successfully: Standard Capture Status Confirmed`,
      sender: `payments@skillfort.com`,
      recipient: student.email,
      date: new Date().toISOString().split('T')[0],
      read: false,
      category: 'payment_status',
      body: `
        <div style="font-family: 'Poppins', sans-serif; max-width: 650px; margin: 0 auto; padding: 25px; background-color: #0b1329; color: #cbd5e1; border: 1px solid #1e293b; border-radius: 12px; font-size: 13px; line-height: 1.6;">
          <div style="text-align: center; margin-bottom: 25px;">
            <div style="display: inline-block; width: 44px; height: 44px; border-radius: 50%; background-color: #34d399; text-align: center; line-height: 44px; color: #fff; font-size: 20px; font-weight: bold; margin-bottom: 10px; margin-left: auto; margin-right: auto;">✓</div>
            <h3 style="color: #34d399; margin: 0; text-transform: uppercase;">Payment Captured Successfully</h3>
            <p style="color: #64748b; margin: 3px 0 0 0; font-size: 10px;">Authorization Gateway Ledger Integration</p>
          </div>
          <p>Hello Student, secure webhook confirmation indicates your purchase has been successfully CAPTURED:</p>
          <div style="background-color: #0a0f1d; border: 1px solid #1e293b; border-radius: 8px; padding: 15px; margin: 15px 0; font-family: 'Poppins', sans-serif; font-size: 11px;">
            <table style="width: 100%;">
              <tr><td style="color: #64748b; padding: 2px 0;">PAYEE IDENTITY:</td><td style="text-align: right; color: #fff;">${student.name}</td></tr>
              <tr><td style="color: #64748b; padding: 2px 0;">TRANS AMOUNT:</td><td style="text-align: right; color: #34d399; font-weight: bold;">INR ${coursePrice}.00</td></tr>
              <tr><td style="color: #64748b; padding: 2px 0;">RAZORPAY ORDER:</td><td style="text-align: right; color: #fff;">${razorpayOrderId}</td></tr>
              <tr><td style="color: #64748b; padding: 2px 0;">CAPTURE STATUS:</td><td style="text-align: right; color: #34d399; font-weight: bold;">SECURE_CAPTURED</td></tr>
            </table>
          </div>
          <p>Your curriculum dashboard is fully synchronized. Head to Classroom and enjoy verified credentials modules. Thank you!</p>
        </div>
      `
    };

    let mailList = [];
    try {
      const saved = readPlatformCache(`skillfort_emails_${student.id}`, null);
      if (saved) {
        mailList = JSON.parse(saved);
      }
    } catch {}

    const updated = [purchaseReceiptEmail, paymentStatusEmail, ...mailList];
    void setPlatformValue(`skillfort_emails_${student.id}`, updated);
    notify(`Simulated course purchase tax receipt and captured transaction reports sent to ${student.name}!`);
  };

  const handleTriggerSimReset = () => {
    const student = students.find(s => s.id === selectedSimStudentId) || students[0];
    if (!student) {
      notify("Please select or create an active Student account first.");
      return;
    }

    const newId = `email-sandbox-pwd-${Date.now()}`;
    const newMail = {
      id: newId,
      subject: `Secure Password Reset Access Token Requested for SkillFort Account`,
      sender: `security@skillfort.com`,
      recipient: student.email,
      date: new Date().toISOString().split('T')[0],
      read: false,
      category: 'password_reset',
      body: `
        <div style="font-family: 'Poppins', sans-serif; max-width: 650px; margin: 0 auto; padding: 25px; background-color: #0b0f19; color: #cbd5e1; border: 1px solid #1e293b; border-radius: 12px; font-size: 14px; line-height: 1.6;">
          <div style="text-align: center; border-bottom: 2px solid #ef4444; padding-bottom: 12px; margin-bottom: 20px;">
            <h3 style="color: #ef4444; margin: 0; font-size: 18px; text-transform: uppercase;">Password Reset Request</h3>
            <span style="font-size: 10px; color: #64748b;">Identity Access Management Simulation</span>
          </div>
          <p>Dear <strong>${student.name}</strong>,</p>
          <p>A simulated security request was issued to reset your main account authentication key. We have compiled a temporary access token for your email <strong>${student.email}</strong>:</p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="#reset" style="display: inline-block; padding: 12px 28px; background-color: #ef4444; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Reset My Account Code</a>
          </div>
          <p style="font-size: 12px; color: #94a3b8;">If you did not issue this security reset request, ignore this default email list block safely. Your verification code token is valid for 15 mins.</p>
        </div>
      `
    };

    let mailList = [];
    try {
      const saved = readPlatformCache(`skillfort_emails_${student.id}`, null);
      if (saved) {
        mailList = JSON.parse(saved);
      }
    } catch {}

    const updated = [newMail, ...mailList];
    void setPlatformValue(`skillfort_emails_${student.id}`, updated);
    notify(`Simulated security password reset alerts dispatched to ${student.name}!`);
  };

  const handleTriggerSimCertificate = () => {
    const student = students.find(s => s.id === selectedSimStudentId) || students[0];
    if (!student) {
      notify("Please select or create an active Student account first.");
      return;
    }

    const course = courses.find(c => c.id === selectedSimCourseId) || courses[0];
    const courseTitle = course ? course.title : "AWS Certified Solutions Architect & DevOps Synergy";
    const verID = `SF-2026-${Math.floor(10000 + Math.random() * 90000)}`;

    const newId = `email-sandbox-crt-${Date.now()}`;
    const newMail = {
      id: newId,
      subject: `Congratulations! Your professional certificate is ready: ${courseTitle} 🏆`,
      sender: `credentials@skillfort.com`,
      recipient: student.email,
      date: new Date().toISOString().split('T')[0],
      read: false,
      category: 'certificate',
      body: `
        <div style="font-family: 'Poppins', sans-serif; max-width: 650px; margin: 0 auto; padding: 25px; background-color: #0b0f19; color: #cbd5e1; border: 1px solid #1e293b; border-radius: 12px; font-size: 14px; line-height: 1.6;">
          <div style="text-align: center; border-bottom: 2px solid #F89A15; padding-bottom: 12px; margin-bottom: 20px;">
            <h3 style="color: #F89A15; margin: 0; font-size: 18px; text-transform: uppercase;">Credential Issued</h3>
            <span style="font-size: 10px; color: #64748b;">Global Blockchain Registry Verification Hub</span>
          </div>
          <p>Hello <strong>${student.name}</strong>,</p>
          <p>Phenomenal work! We are proud to confirm you have completed all classroom lessons under academic syllabus for <strong>${courseTitle}</strong>. Your verifiable certificate was issued:</p>
          <div style="background-color: #070d19; border: 1px solid #1e293b; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <table style="width: 100%; font-size: 12px;">
              <tr><td style="color: #64748b;">STUDENT NAME:</td><td style="text-align: right; color: #fff; font-weight: bold;">${student.name}</td></tr>
              <tr><td style="color: #64748b;">CURRICULUM:</td><td style="text-align: right; color: #fff;">${courseTitle}</td></tr>
              <tr><td style="color: #64748b;">VERIFICATION NO:</td><td style="text-align: right; color: #F89A15; font-family: 'Poppins', sans-serif; font-weight: bold;">${verID}</td></tr>
            </table>
          </div>
          <p>This dynamic ledger record can be printed or shared. Keep building high performance code!</p>
        </div>
      `
    };

    let mailList = [];
    try {
      const saved = readPlatformCache(`skillfort_emails_${student.id}`, null);
      if (saved) {
        mailList = JSON.parse(saved);
      }
    } catch {}

    const updated = [newMail, ...mailList];
    void setPlatformValue(`skillfort_emails_${student.id}`, updated);
    notify(`Simulated Graduation congratulations diploma email dispatched to ${student.name}!`);
  };


  const shell = adminShellTheme(isDarkMode);

  const enrollmentCountByCourse = useMemo(() => {
    const byCourse = new Map<string, Set<string>>();
    const track = (courseId: string, userId: string) => {
      if (!courseId || !userId) return;
      if (!byCourse.has(courseId)) byCourse.set(courseId, new Set());
      byCourse.get(courseId)!.add(userId);
    };

    for (const enrollment of enrollments) {
      track(enrollment.courseId, enrollment.userId);
    }
    for (const payment of payments) {
      if (payment.status === 'captured') {
        track(payment.courseId, payment.userId);
      }
    }

    const counts = new Map<string, number>();
    for (const [courseId, userIds] of byCourse) {
      counts.set(courseId, userIds.size);
    }
    return counts;
  }, [enrollments, payments]);

  return (
    <div className={`min-h-screen font-sans flex overflow-hidden ${isDarkMode ? 'bg-black text-white' : 'bg-slate-100 text-slate-900'}`}>
      {/* ADMIN CONTROL SIDEBAR NAVIGATION */}
      <aside className={`w-64 border-r shrink-0 hidden lg:flex flex-col ${shell.sidebar}`}>
        <div className={`h-20 border-b flex items-center px-4 shrink-0 ${shell.sidebarHeader}`}>
          <SkillFortLogo />
        </div>

        <nav className="p-4 flex-1 space-y-4 overflow-y-auto text-xs">
          {/* GROUP 1: OVERVIEW */}
          <div className="space-y-1">
            <span className={`px-3 text-[9px] font-mono tracking-widest font-extrabold uppercase block ${shell.groupLabel}`}>Monitor</span>
            <button 
              onClick={() => goToTab('dashboard')}
              className={navMainClass(shell, activeTab === 'dashboard')}
            >
              <BarChart size={13} /> Dashboard
            </button>
          </div>

          {/* GROUP 2: RECREATED COLLAPSIBLE MANAGE COURSE DIRECTORY */}
          <div className="space-y-1">
            <button 
              onClick={() => setManageCourseExpanded(!manageCourseExpanded)}
              className={`w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono tracking-widest font-black uppercase transition-colors ${shell.collapseBtn}`}
            >
              <span>📂 Manage Course</span>
              {manageCourseExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>

            {manageCourseExpanded && (
              <div className={`pl-3.5 space-y-0.5 border-l ml-3 ${shell.nestedBorder}`}>
                <button 
                  onClick={() => goToTab('courses-all')}
                  className={navSubClass(shell, activeTab === 'courses-all' || activeTab === 'courses-add')}
                >
                  <LayoutGrid size={11} className="shrink-0" />
                  <span>• Courses</span>
                </button>

                <button 
                  onClick={() => goToTab('courses-categories')}
                  className={navSubClass(shell, activeTab === 'courses-categories')}
                >
                  <Layers size={11} className="shrink-0" />
                  <span>• Category</span>
                </button>

                <button 
                  onClick={() => goToTab('courses-reviews')}
                  className={navSubClass(shell, activeTab === 'courses-reviews')}
                >
                  <Star size={11} className="shrink-0" />
                  <span>• Course Reviews</span>
                </button>
              </div>
            )}
          </div>

          {/* NEW GROUP FOR CERTIFICATE BUILDER OUTSIDE AS DIRECT ITEM */}
          <div className="space-y-1 block">
            <span className={`px-3 text-[9px] font-mono tracking-widest font-extrabold uppercase block ${shell.groupLabel}`}>Certifications</span>
            <button 
              onClick={() => goToTab('courses-cert-template')}
              className={navMainClass(shell, activeTab === 'courses-cert-template')}
            >
              <ShieldCheck size={13} /> Certificate Builder
            </button>
          </div>

          {/* GROUP 3: ORDERS & ENROLLMENTS */}
          <div className="space-y-1">
            <span className={`px-3 text-[9px] font-mono tracking-widest font-extrabold uppercase block ${shell.groupLabel}`}>Sales & Registration</span>
            <button 
              onClick={() => goToTab('orders-all')}
              className={navMainClass(shell, activeTab === 'orders-all')}
            >
              <Receipt size={13} /> All Orders
            </button>
          </div>

          {/* WEBSITE / LANDING PAGE */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setWebsiteExpanded(!websiteExpanded)}
              className={`w-full flex items-center justify-between px-3 py-1 text-[9px] font-mono tracking-widest font-extrabold uppercase transition-colors ${shell.collapseBtnMuted}`}
            >
              <span className="flex items-center gap-2">
                <Globe size={11} /> Website
              </span>
              {websiteExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>

            {websiteExpanded && (
              <div className={`pl-3.5 space-y-0.5 border-l ml-3 ${shell.nestedBorder}`}>
                <button
                  onClick={() => goToTab('landing-banner')}
                  className={navSubClass(shell, activeTab === 'landing-banner')}
                >
                  <Upload size={11} className="shrink-0" />
                  <span>• Landing Banner</span>
                </button>
                <button
                  onClick={() => goToTab('wall-of-success')}
                  className={navSubClass(shell, activeTab === 'wall-of-success')}
                >
                  <Trophy size={11} className="shrink-0" />
                  <span>• Wall of Success</span>
                </button>
              </div>
            )}
          </div>

          {/* GROUP 4: STUDENTS */}
          <div className="space-y-1">
            <span className={`px-3 text-[9px] font-mono tracking-widest font-extrabold uppercase block ${shell.groupLabel}`}>Student Directory</span>
            <button 
              onClick={() => goToTab('students-all')}
              className={navMainClass(shell, activeTab === 'students-all')}
            >
              <Users size={13} /> All Students ({students.length})
            </button>
            <button 
              onClick={() => goToTab('students-add')}
              className={navMainClass(shell, activeTab === 'students-add')}
            >
              <Plus size={13} /> Add Student Access
            </button>
          </div>

          {/* GROUP: ADMINISTRATORS */}
          <div className="space-y-1">
            <span className={`px-3 text-[9px] font-mono tracking-widest font-extrabold uppercase block ${shell.groupLabel}`}>Administrators</span>
            <button
              onClick={() => goToTab('admins-all')}
              className={navMainClass(shell, activeTab === 'admins-all')}
            >
              <ShieldCheck size={13} /> All Admins ({admins.length})
            </button>
            <button
              onClick={() => goToTab('admins-add')}
              className={navMainClass(shell, activeTab === 'admins-add')}
            >
              <Plus size={13} /> Add Administrator
            </button>
          </div>

          {/* GROUP 5: INSTRUCTORS */}
          <div className="space-y-1">
            <span className={`px-3 text-[9px] font-mono tracking-widest font-extrabold uppercase block ${shell.groupLabel}`}>Faculty</span>
            <button 
              onClick={() => goToTab('instructors-all')}
              className={navMainClass(shell, activeTab === 'instructors-all')}
            >
              <Users size={13} /> Faculty Instructors ({instructors.length})
            </button>
            <button 
              onClick={() => goToTab('instructors-add')}
              className={navMainClass(shell, activeTab === 'instructors-add')}
            >
              <Plus size={13} /> Recruit Instructor
            </button>
          </div>

          {/* GROUP 8: SYSTEM */}
          <div className="space-y-1">
            <span className={`px-3 text-[9px] font-mono tracking-widest font-extrabold uppercase block ${shell.groupLabel}`}>System Controls</span>
            <button 
              onClick={() => goToTab('settings')}
              className={navMainClass(shell, activeTab === 'settings')}
            >
              <Settings size={13} /> ERP Settings
            </button>
            <button 
              onClick={() => goToTab('mail_sandbox')}
              className={navMainClass(shell, activeTab === 'mail_sandbox')}
            >
              <Mail size={13} /> Email / SMTP
            </button>
          </div>
        </nav>

        <div className={`p-4 border-t ${shell.sidebarFooter}`}>
          <div className="flex gap-2.5 items-center mb-3">
            <div className="w-8 h-8 bg-[#F89A15]/10 text-[#F89A15] flex items-center justify-center font-black text-xs rounded-full">A</div>
            <div>
              <p className={`text-[11px] font-bold truncate max-w-[130px] ${shell.userName}`}>{currentUser.name}</p>
              <p className={`text-[9px] font-mono ${shell.userRole}`}>System Master Admin</p>
            </div>
          </div>

          <button 
            onClick={onToggleDarkMode}
            className={`w-full py-1.5 mb-2 border rounded-lg text-[9px] uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-1.5 font-mono cursor-pointer ${shell.themeToggle}`}
          >
            {isDarkMode ? '☀️ Switch Light' : '🌙 Switch Dark'}
          </button>

          <button 
            onClick={onLogout}
            className={`w-full flex items-center justify-center gap-2 py-1.5 border transition-colors text-[9px] uppercase font-bold tracking-wider text-center cursor-pointer ${shell.logoutBtn}`}
          >
            <LogOut size={10} /> Exit Dashboard
          </button>
        </div>
      </aside>

      {/* CORE CONTROL AREA PANELS VIEW */}
      <main className={`flex-1 min-w-0 overflow-y-auto p-4 md:p-8 lg:p-10 space-y-6 md:space-y-8 ${isDarkMode ? '' : 'bg-slate-50'}`}>
        
        {/* Mobile header */}
        <div className={`flex lg:hidden sticky top-0 z-30 -mx-4 px-4 py-3 items-center justify-between gap-3 border-b backdrop-blur-sm ${
          isDarkMode ? 'border-[#222222] bg-black/95' : 'border-slate-200 bg-white/95'
        }`}>
          <SkillFortLogo />
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileNavOpen(true)}
            className={`rounded-lg border p-2.5 transition-colors ${
              isDarkMode
                ? 'border-[#222222] bg-[#111111] text-white hover:text-[#F89A15]'
                : 'border-slate-200 bg-white text-slate-800 hover:text-[#F89A15]'
            }`}
          >
            <Menu size={18} />
          </button>
        </div>

        <MobileNavSheet open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} title="Admin Menu" isDarkMode={isDarkMode}>
          <div className="space-y-1">
            {([
              ['dashboard', 'Dashboard'],
              ['courses-all', 'Courses'],
              ['courses-categories', 'Categories'],
              ['courses-reviews', 'Course Reviews'],
              ['courses-cert-template', 'Certificate Builder'],
              ['orders-all', 'All Orders'],
              ['landing-banner', 'Landing Banner'],
              ['wall-of-success', 'Wall of Success'],
              ['students-all', `All Students (${students.length})`],
              ['students-add', 'Add Student Access'],
              ['admins-all', `All Admins (${admins.length})`],
              ['admins-add', 'Add Administrator'],
              ['instructors-all', `Faculty Instructors (${instructors.length})`],
              ['instructors-add', 'Recruit Instructor'],
              ['settings', 'ERP Settings'],
              ['mail_sandbox', 'Email / SMTP'],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => goToTab(tab)}
                className={`w-full rounded-xl px-4 py-3 text-left text-sm font-semibold ${
                  activeTab === tab
                    ? 'bg-[#F89A15]/15 text-[#F89A15] border border-[#F89A15]/40'
                    : isDarkMode ? 'text-gray-200 hover:bg-white/5' : 'text-slate-800 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={`mt-6 space-y-2 border-t pt-4 ${isDarkMode ? 'border-[#222222]' : 'border-slate-200'}`}>
            <button
              type="button"
              onClick={onToggleDarkMode}
              className={`w-full rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${
                isDarkMode
                  ? 'border-[#222222] bg-[#111111] text-white hover:border-[#F89A15]/40'
                  : 'border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200'
              }`}
            >
              {isDarkMode ? '☀️ Light mode' : '🌙 Dark mode'}
            </button>
            <button
              type="button"
              onClick={() => { setMobileNavOpen(false); onLogout(); }}
              className={`w-full rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${
                isDarkMode
                  ? 'border-[#222222] bg-[#111111] text-gray-200 hover:text-white'
                  : 'border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200'
              }`}
            >
              Exit Dashboard
            </button>
          </div>
        </MobileNavSheet>

        {/* Toast Alerts Notification banner HUD */}
        {showNotification && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs flex items-center gap-2 max-w-sm sticky top-4 z-40 shadow-lg">
            <CheckCircle size={15} /> <span>{showNotification}</span>
          </div>
        )}

        {activeTab !== 'dashboard' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <span className={`text-[10px] uppercase tracking-wider font-mono ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>SKILLFORT ERP INFRASTRUCTURE</span>
            <h1 className={`text-xl sm:text-3xl font-display font-black capitalize truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{activeTab} Admin Registry Workspace</h1>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onRefreshData}
              className={`px-3.5 py-1.5 border rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                isDarkMode
                  ? 'bg-[#111111] border-[#222222] hover:bg-[#222222]'
                  : 'bg-white border-slate-200 text-slate-800 hover:border-[#F89A15]/40 shadow-sm'
              }`}
            >
              Sync Storage Refreshes
            </button>
          </div>
        </div>
        )}

        {/* 1. ADMIN DASHBOARD METRICS MAP */}
        {activeTab === 'dashboard' && (
          <AdminDashboard
            currentUser={currentUser}
            students={students}
            courses={courses}
            modules={modules}
            payments={payments}
            certificates={certificates}
            isDarkMode={isDarkMode}
            onNavigate={goToTab}
            onRefresh={() => void onRefreshData()}
          />
        )}

        {/* 2A. ALL COURSES MAIN DATA-GRID TABLE */}
        {activeTab === 'courses-all' && (() => {
          // Filters mapping logic
          const filteredCourses = courses.filter(c => {
            const matchesSearch = c.title.toLowerCase().includes(courseSearch.toLowerCase()) || 
                                  (c.category && c.category.toLowerCase().includes(courseSearch.toLowerCase()));
            const matchesCategory = courseFilterCategory === 'All' || c.category === courseFilterCategory;
            const matchesLevel = courseFilterStatus === 'All' || 
                                 (courseFilterStatus === 'Active' && c.price > 0) || // simulation match
                                 (courseFilterStatus === 'Draft' && c.price === 0);
            const matchesType = courseFilterType === 'All' || 
                                (courseFilterType === 'Free' && c.price === 0) || 
                                (courseFilterType === 'Paid' && c.price > 0);
            return matchesSearch && matchesCategory && matchesLevel && matchesType;
          });

          const handleToggleSelectAll = () => {
            if (selectedCourseIds.length === filteredCourses.length) {
              setSelectedCourseIds([]);
            } else {
              setSelectedCourseIds(filteredCourses.map(c => c.id));
            }
          };

          const handleToggleSelectOne = (id: string) => {
            if (selectedCourseIds.includes(id)) {
              setSelectedCourseIds(selectedCourseIds.filter(cid => cid !== id));
            } else {
              setSelectedCourseIds([...selectedCourseIds, id]);
            }
          };

          const handleApplyBulkAction = async () => {
            if (selectedCourseIds.length === 0) {
              alert("Please select at least one course to perform operations.");
              return;
            }
            if (!bulkAction) {
              alert("Choose a valid bulk state action.");
              return;
            }
            if (bulkAction === 'delete') {
              if (window.confirm(`Verify you intend to bulk delete ${selectedCourseIds.length} course elements?`)) {
                try {
                  await Promise.all(
                    selectedCourseIds.map(id => apiFetch(`/api/admin/courses/${id}`, { method: 'DELETE' }))
                  );
                  notify(`Successfully deleted ${selectedCourseIds.length} syllabus records.`);
                } catch (err) {
                  console.error("Bulk course deletion error:", err);
                  notify("An issue occurred during bulk deletion processing.");
                } finally {
                  setSelectedCourseIds([]);
                  await onRefreshData();
                }
              }
            } else {
              notify(`Bulk action: "${bulkAction}" applied successfully to compliance database.`);
              setSelectedCourseIds([]);
            }
          };

          return (
            <div className="space-y-6">
              
              {/* Breadcrumb Navbar */}
              <div className="flex justify-between items-center bg-[#111111] p-4 rounded-xl border border-[#222222]">
                <div>
                  <h3 className="font-display font-black text-sm text-white uppercase tracking-wide">Manage Course Catalog ({filteredCourses.length})</h3>
                  <div className="text-[10px] text-gray-500 font-sans mt-0.5">
                    LMS Admin panel / Course Modules / <span className="text-[#F89A15]">All Courses Directory</span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    clearCourseWizardDraft();
                    courseWizardRestoredRef.current = false;
                    setEditingCourseId(null);
                    setCourseAddTab('basic');
                    setCourseChapters([]);
                    setCourseFormEx({
                      title: '',
                      slug: '',
                      shortDescription: '',
                      fullDescription: '',
                      coverImage: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=600&auto=format&fit=crop',
                      previewVideo: '',
                      category: 'Full Stack Training',
                      subCategory: '',
                      language: 'English',
                      level: 'Intermediate',
                      instructor: instructors[0]?.name || 'Prof. Rajesh Kumar',
                      tags: 'java, spring, enterprise',
                      status: 'Active',
                      duration: '40 hours',
                      totalLessons: '12',
                      totalQuizzes: '3',
                      certificateAvailable: true,
                      validityDays: '',
                      whatYouWillLearn: ['Master core syntax structures', 'Deploy scalable frameworks to sandboxes'],
                      requirements: ['Basic internet and desktop literacy'],
                      whoThisCourseIsFor: ['Cohort members pivoting to deep tech engineering roles'],
                      courseIncludes: { videoLessons: true, downloadableResources: true, certificate: true, liveProjects: true, mockInterviews: true },
                      metaTitle: '',
                      metaDescription: '',
                      metaKeywords: '',
                      ogImage: '',
                      courseType: 'Paid',
                      price: '5000',
                      discountPrice: '4500',
                      discountStartDate: '2026-06-01',
                      discountEndDate: '2026-06-30',
                      enrollmentLimit: '0',
                      couponCode: '',
                      couponDiscountPercent: '',
                      couponExpiryDate: '2027-12-31',
                    });
                    navigate(adminPath('courses-add'), { replace: true });
                  }}
                  className="px-4 py-2 bg-[#F89A15] hover:bg-white text-black font-extrabold text-xs rounded-lg transition-all font-sans uppercase tracking-wider shadow-lg flex items-center gap-1.5"
                >
                  <Plus size={12} /> Add Dynamic Course
                </button>
              </div>

              {/* Horizontal Filters Bar matching Laravel spec */}
              <div className="bg-[#111111] border border-[#222222] p-5 rounded-2xl space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  
                  {/* Search Title */}
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-gray-500">Query Phrase Search</span>
                    <input 
                      type="text" 
                      value={courseSearch} 
                      onChange={e => setCourseSearch(e.target.value)}
                      placeholder="Search by course title..."
                      className="w-full bg-black border border-[#222222] text-xs p-2.5 rounded-lg text-white"
                    />
                  </div>

                  {/* Category Filter */}
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-gray-500">Department Category</span>
                    <select 
                      value={courseFilterCategory} 
                      onChange={e => setCourseFilterCategory(e.target.value)}
                      className="w-full bg-black border border-[#222222] text-xs p-2.5 rounded-lg text-white"
                    >
                      <option value="All">All Categories</option>
                      {categories.map(cat => <option key={cat.id || cat.name} value={cat.name}>{cat.name}</option>)}
                    </select>
                  </div>

                  {/* Status Selection */}
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-gray-500">Lifecycle Status</span>
                    <select 
                      value={courseFilterStatus} 
                      onChange={e => setCourseFilterStatus(e.target.value)}
                      className="w-full bg-black border border-[#222222] text-xs p-2.5 rounded-lg text-white"
                    >
                      <option value="All">All Lifecycles</option>
                      <option value="Active">Active / Paid</option>
                      <option value="Draft">Draft / Free</option>
                      <option value="Inactive">Offline / Inactive</option>
                    </select>
                  </div>

                  {/* Type options */}
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-gray-500">Pricing Model</span>
                    <select 
                      value={courseFilterType} 
                      onChange={e => setCourseFilterType(e.target.value)}
                      className="w-full bg-black border border-[#222222] text-xs p-2.5 rounded-lg text-white"
                    >
                      <option value="All">All Structures</option>
                      <option value="Free">Free Tuition</option>
                      <option value="Paid">Premium Paid</option>
                    </select>
                  </div>

                </div>

                {/* Bulk Actions Block */}
                <div className="pt-3 border-t border-[#222222]/40 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <select 
                      value={bulkAction} 
                      onChange={e => setBulkAction(e.target.value)}
                      className="bg-black border border-[#222222] text-xs p-2 rounded-lg text-white"
                    >
                      <option value="">-- Apply Bulk Action --</option>
                      <option value="delete">Bulk Delete Selected</option>
                      <option value="active">Bulk status Set: Active</option>
                      <option value="inactive">Bulk status Set: Offline</option>
                    </select>
                    <button 
                      onClick={handleApplyBulkAction}
                      className="px-3.5 py-2 bg-slate-200 dark:bg-[#222222] text-black dark:text-white border border-slate-300 dark:border-neutral-800 hover:bg-[#F89A15] dark:hover:bg-[#F89A15] hover:text-black dark:hover:text-black hover:border-[#F89A15] dark:hover:border-[#F89A15] rounded-lg text-xs font-bold uppercase transition duration-150"
                    >
                      Apply Action
                    </button>
                  </div>

                  <button 
                    onClick={() => {
                      setCourseSearch('');
                      setCourseFilterCategory('All');
                      setCourseFilterStatus('All');
                      setCourseFilterType('All');
                    }}
                    className="text-xs text-gray-400 hover:text-white font-mono transition"
                  >
                    ✕ Reset Filter Attributes
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-300 border-collapse">
                    <thead>
                      <tr className="bg-black text-[10px] font-mono border-b border-[#222222] text-gray-400 uppercase tracking-wider">
                        <th className="p-4 w-10 text-center">
                          <input 
                            type="checkbox" 
                            checked={filteredCourses.length > 0 && selectedCourseIds.length === filteredCourses.length}
                            onChange={handleToggleSelectAll}
                            className="rounded accent-[#F89A15]"
                          />
                        </th>
                        <th className="p-4 w-12 text-center">SN</th>
                        <th className="p-4 w-20">Thumbnail</th>
                        <th className="p-4 text-xs">Title</th>
                        <th className="p-4 text-center">Instructor Name</th>
                        <th className="p-4 text-right">Price</th>
                        <th className="p-4 text-center">Student Count</th>
                        <th className="p-4 text-center">Created Time</th>
                        <th className="p-4 text-center">Updated Time</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCourses.length > 0 ? (
                        filteredCourses.map((c, idx) => {
                          const isSelected = selectedCourseIds.includes(c.id);
                          const isFree = c.price === 0;
                          const mappedSlug = c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                          const studentCountValue =
                            c.studentCount ?? enrollmentCountByCourse.get(c.id) ?? 0;

                          const instructorName = (() => {
                            const extra = readCourseExtraMetadata(c.id);
                            if (extra.instructor) return extra.instructor;
                            return instructors[0]?.name || "Prof. Rajesh Kumar";
                          })();

                          const currentStatus = courseStatuses[c.id] || 'Approved';

                          return (
                            <tr 
                              key={c.id} 
                              className={`border-b border-[#222222]/50 hover:bg-black/30 transition-colors ${isSelected ? 'bg-orange-500/5' : ''}`}
                            >
                              <td className="p-4 text-center">
                                <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectOne(c.id)}
                                  className="rounded accent-[#F89A15]"
                                />
                              </td>
                              <td className="p-4 text-center font-mono font-bold text-gray-500">{idx + 1}</td>
                              <td className="p-4">
                                <img 
                                  src={resolveMediaUrl(c.coverImage) || "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=600&auto=format&fit=crop"} 
                                  className="w-14 h-10 object-cover rounded border border-[#222222]" 
                                  alt="Course Cover" 
                                  referrerPolicy="no-referrer"
                                />
                              </td>
                              <td className="p-4">
                                <span className="font-bold text-white block text-sm">{c.title}</span>
                                <span className="text-[10px] text-gray-500 font-mono block mt-0.5">/courses/{mappedSlug}</span>
                              </td>
                              <td className="p-4 text-center font-semibold text-gray-300">
                                {instructorName}
                              </td>
                              <td className="p-4 text-right font-mono font-bold text-white text-sm">
                                {isFree ? "Free" : `₹${c.price}`}
                              </td>
                              <td className="p-4 text-center text-gray-400 font-bold">
                                {studentCountValue}
                              </td>
                              <td className="p-4 text-center text-gray-400 font-mono text-[10px]">
                                {formatTimestamp(c.createdAt)}
                              </td>
                              <td className="p-4 text-center text-gray-400 font-mono text-[10px]">
                                {getUpdatedTimestamp(c)}
                              </td>
                              <td className="p-4 text-center">
                                <select
                                  value={currentStatus}
                                  onChange={(e) => handleUpdateStatus(c.id, e.target.value as any)}
                                  className={`bg-black text-[10px] uppercase font-mono tracking-wider font-extrabold p-1.5 rounded border border-[#333333] text-center focus:ring-0 ${
                                    currentStatus === 'Approved' ? 'text-emerald-400 border-emerald-500/30' :
                                    currentStatus === 'Pending' ? 'text-[#F89A15] border-amber-500/30' :
                                    'text-red-400 border-red-500/30'
                                  }`}
                                >
                                  <option value="Approved" className="bg-black text-emerald-400 font-bold">Approved</option>
                                  <option value="Pending" className="bg-black text-[#F89A15] font-bold">Pending</option>
                                  <option value="Rejected" className="bg-black text-red-400 font-bold">Rejected</option>
                                </select>
                              </td>
                              <td className="p-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button 
                                    onClick={() => {
                                      handleEditCourse(c);
                                      courseWizardRestoredRef.current = true;
                                      navigate(
                                        `${adminPath('courses-add')}?courseId=${encodeURIComponent(c.id)}&step=basic`,
                                        { replace: true }
                                      );
                                    }}
                                    className="p-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-[#F89A15] hover:text-black text-slate-700 dark:text-gray-400 rounded transition"
                                    title="Edit specifications"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteCourse(c.id)}
                                    className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded transition"
                                    title="Trash element"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={11} className="p-8 text-center text-gray-500 italic">
                            No courses matched the filter attributes from current session memory bank.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer Pagination */}
                <div className="p-4 bg-black/40 border-t border-[#222222] flex items-center justify-between text-[11px] text-gray-500">
                  <span>Showing 1 to {filteredCourses.length} of {filteredCourses.length} persistent indexes</span>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 text-xs text-gray-400 dark:text-gray-500 rounded" disabled>Prev</button>
                    <button className="px-3 py-1 bg-neutral-900 border border-neutral-800 text-xs text-[#F89A15] rounded">1</button>
                    <button className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 text-xs text-gray-400 dark:text-gray-500 rounded" disabled>Next</button>
                  </div>
                </div>
              </div>

            </div>
          );
        })()}

        {/* 2B. ADD/EDIT COURSE MULTI-TAB EXPANDED COMPONENT */}
        {activeTab === 'courses-add' && (
          <div className="bg-[#111111] border border-[#222222] rounded-3xl p-6 md:p-8 space-y-6">
            
            {/* Title Section */}
            <div className="border-b border-[#222222]/60 pb-4">
              <h3 className="font-display font-black text-base text-[#F89A15] uppercase tracking-wider">
                {editingCourseId ? "⚙️ Modify Dynamic Course Element" : "📝 Instantiate New Academic Program"}
              </h3>
              <p className="text-[10px] text-gray-500 mt-1">Configure structural schema records, pricing indexes, and curriculum chapters.</p>
            </div>

            {/* Horizontal Tabs Navigation */}
            <div className="flex border-b border-neutral-900 overflow-x-auto gap-1">
              {[
                { id: 'basic', label: '📝 Basic Info' },
                { id: 'more', label: '🔍 More Info' },
                { id: 'content', label: '🎓 Course Content' },
                { id: 'finish', label: '🏁 Finish' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    // Save draft locally first
                    void setPlatformValue(`skillfort_course_draft_backup`, courseFormEx);
                    setCourseAddTab(tab.id as any);
                  }}
                  className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition whitespace-nowrap ${courseAddTab === tab.id ? 'border-[#F89A15] text-[#F89A15] bg-[#F89A15]/5' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Form Container */}
            <div className="space-y-6 text-xs text-gray-300">
              
              {/* TAB 1: BASIC INFO */}
              {courseAddTab === 'basic' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-400">Course Title</label>
                      <input 
                        type="text" 
                        value={courseFormEx.title} 
                        onChange={e => {
                          const slugified = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                          setCourseFormEx({ ...courseFormEx, title: e.target.value, slug: slugified });
                        }}
                        className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-semibold"
                        placeholder="e.g. Kotlin Android Native Architecture"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-400">URL Slug Route</label>
                      <input 
                        type="text" 
                        value={courseFormEx.slug} 
                        onChange={e => setCourseFormEx({ ...courseFormEx, slug: e.target.value })}
                        className="w-full bg-black border border-[#222222] text-xs p-3 font-mono rounded-lg text-gray-400"
                        placeholder="kotlin-android-native-architecture"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-400">Instructor Name / Faculty Member</label>
                      <select 
                        value={courseFormEx.instructor} 
                        onChange={e => setCourseFormEx({ ...courseFormEx, instructor: e.target.value })}
                        className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
                      >
                        {courseFormEx.instructor &&
                          !instructors.some((inst) => inst.name === courseFormEx.instructor) && (
                          <option value={courseFormEx.instructor}>{courseFormEx.instructor}</option>
                        )}
                        {instructors.map(inst => (
                          <option key={inst.id} value={inst.name}>{inst.name} ({inst.expertise})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[10px] uppercase font-bold text-gray-400">Course Banner</label>
                      <div className="rounded-xl border border-[#222222] bg-black/40 p-4 space-y-3">
                        {courseFormEx.coverImage ? (
                          <img
                            src={resolveMediaUrl(courseFormEx.coverImage)}
                            alt="Course banner preview"
                            className="w-full max-h-40 object-cover rounded-lg border border-[#222222]"
                          />
                        ) : (
                          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-[#333333] text-[10px] text-gray-500 uppercase tracking-wider">
                            No banner yet
                          </div>
                        )}
                        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#F89A15]/40 bg-[#F89A15]/10 px-4 py-2.5 text-xs font-bold text-[#F89A15] hover:bg-[#F89A15]/20 transition-colors">
                          <Upload size={14} />
                          {coverImageUploading ? 'Uploading…' : 'Upload banner image'}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            disabled={coverImageUploading}
                            onChange={handleCourseBannerUpload}
                          />
                        </label>
                        <p className="text-[9px] text-gray-500">JPG, PNG, WebP, or GIF — max 5 MB. Recommended 1200×675 px.</p>
                        <div className="space-y-1.5 pt-1 border-t border-[#222222]/60">
                          <label className="text-[9px] uppercase font-bold text-gray-500">Or paste image URL</label>
                          <input
                            type="text"
                            value={courseFormEx.coverImage}
                            onChange={e => setCourseFormEx({ ...courseFormEx, coverImage: e.target.value })}
                            className="w-full bg-black border border-[#222222] text-xs p-3 font-mono rounded-lg text-white"
                            placeholder="https://images.unsplash.com/photo-..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Syllabus Core Description (Main Summary)</label>
                    <textarea 
                      rows={5} 
                      value={courseFormEx.fullDescription} 
                      onChange={e => setCourseFormEx({ ...courseFormEx, fullDescription: e.target.value })}
                      className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white resize-none"
                      placeholder="Specify full course descriptions, layout parameters, exam patterns, etc..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-[#222222]/40 pt-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-400">Vimeo Demo Video / Teaser Source Link</label>
                      <input 
                        type="text" 
                        value={courseFormEx.previewVideo} 
                        onChange={e => setCourseFormEx({ ...courseFormEx, previewVideo: e.target.value })}
                        className="w-full bg-black border border-[#222222] text-xs p-3 font-mono rounded-lg text-white"
                        placeholder="https://vimeo.com/76979871"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-400">Base Price (INR)</label>
                      <input 
                        type="number" 
                        value={courseFormEx.price} 
                        onChange={e => setCourseFormEx({ ...courseFormEx, price: e.target.value })}
                        className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
                        placeholder="5000"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-400">Discount Price (INR)</label>
                      <input 
                        type="number" 
                        value={courseFormEx.discountPrice} 
                        onChange={e => setCourseFormEx({ ...courseFormEx, discountPrice: e.target.value })}
                        className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
                        placeholder="4500"
                      />
                    </div>
                  </div>

                  <div className="bg-black/40 border border-[#222222] p-4 rounded-xl space-y-3 mt-4">
                    <span className="text-[10px] uppercase font-bold text-[#F89A15] block tracking-wider">
                      Checkout coupon (optional)
                    </span>
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                      Students enter this code at checkout. Minimum cart amount is set from the base price above.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-gray-400">Coupon code</label>
                        <input
                          type="text"
                          value={courseFormEx.couponCode}
                          onChange={(e) =>
                            setCourseFormEx({
                              ...courseFormEx,
                              couponCode: e.target.value.toUpperCase(),
                            })
                          }
                          className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-mono uppercase"
                          placeholder="e.g. JAVA20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-gray-400">Discount (%)</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={courseFormEx.couponDiscountPercent}
                          onChange={(e) =>
                            setCourseFormEx({ ...courseFormEx, couponDiscountPercent: e.target.value })
                          }
                          className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
                          placeholder="20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-gray-400">Valid until</label>
                        <input
                          type="date"
                          value={courseFormEx.couponExpiryDate}
                          onChange={(e) =>
                            setCourseFormEx({ ...courseFormEx, couponExpiryDate: e.target.value })
                          }
                          className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-black/40 border border-[#222222] p-4 rounded-xl space-y-3 mt-4">
                    <span className="text-[10px] uppercase font-bold text-[#F89A15] block tracking-wider">SEO Placement Parameters (Search Index Engine)</span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-gray-500">SEO Meta Title</span>
                        <input 
                          type="text" 
                          value={courseFormEx.metaTitle} 
                          onChange={e => setCourseFormEx({ ...courseFormEx, metaTitle: e.target.value })}
                          className="w-full bg-black border border-neutral-800 text-xs p-2 rounded text-white"
                          placeholder="Meta Title"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-gray-500">SEO Meta Keywords</span>
                        <input 
                          type="text" 
                          value={courseFormEx.metaKeywords} 
                          onChange={e => setCourseFormEx({ ...courseFormEx, metaKeywords: e.target.value })}
                          className="w-full bg-black border border-neutral-800 text-xs p-2 rounded text-white"
                          placeholder="java, spring, certification"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-gray-500">SEO Meta Description</span>
                        <input 
                          type="text" 
                          value={courseFormEx.metaDescription} 
                          onChange={e => setCourseFormEx({ ...courseFormEx, metaDescription: e.target.value })}
                          className="w-full bg-black border border-neutral-800 text-xs p-2 rounded text-white"
                          placeholder="Search engine brief snippet description..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Save button for step 1 */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-[#222222]/40">
                    <button 
                      type="button"
                      onClick={() => handleSaveCourse(undefined, 'more')}
                      className="px-6 py-2.5 bg-[#F89A15] hover:bg-white text-black font-extrabold uppercase text-[11px] rounded-lg tracking-wider transition-all duration-300"
                    >
                      ✔ Save & Continue to More Info
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: MORE INFO */}
              {courseAddTab === 'more' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-400">Course Duration (estimated study hours)</label>
                      <input 
                        type="text" 
                        value={courseFormEx.duration} 
                        onChange={e => setCourseFormEx({ ...courseFormEx, duration: e.target.value })}
                        className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
                        placeholder="e.g. 40 Hours"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-400">
                        Access validity (optional)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={courseFormEx.validityDays}
                        onChange={(e) =>
                          setCourseFormEx({ ...courseFormEx, validityDays: e.target.value })
                        }
                        className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
                        placeholder="Leave empty for lifetime access"
                      />
                      <p className="text-[10px] text-gray-500">
                        Number of days students can access this course after enrollment. Leave blank for unlimited access.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-400">Department Category Selection</label>
                      <select 
                        value={courseFormEx.category} 
                        onChange={e => setCourseFormEx({ ...courseFormEx, category: e.target.value })}
                        className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
                      >
                        {categories.map(cat => (
                          <option key={cat.id || cat.name} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Q&A Switch */}
                    <div className="p-5 bg-neutral-900/40 rounded-xl border border-neutral-800 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-white block">Enable Discussion Forum (Q&A)</span>
                        <span className="text-[10px] text-gray-500">Allow cohort members to query doubts direct to the Faculty panel.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const val = !(courseFormEx as any).qaEnabled;
                          setCourseFormEx({ ...courseFormEx, qaEnabled: val } as any);
                          notify(val ? "Q&A capability enabled!" : "Q&A capability muted");
                        }}
                        className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 focus:outline-none ${
                          (courseFormEx as any).qaEnabled ? 'bg-emerald-500' : 'bg-neutral-800'
                        }`}
                      >
                        <div className={`bg-black w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                          (courseFormEx as any).qaEnabled ? 'translate-x-6' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    {/* Certificate Switch */}
                    <div className="p-5 bg-neutral-900/40 rounded-xl border border-neutral-800 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-white block">Generate Completion Certificate</span>
                        <span className="text-[10px] text-gray-500">Inject automated PDF academic credentials after modules and exams are flagged.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const val = !(courseFormEx as any).certEnabled;
                          setCourseFormEx({ ...courseFormEx, certEnabled: val } as any);
                          notify(val ? "Interactive PDF completion certificate activated!" : "Completion certificate suspended");
                        }}
                        className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 focus:outline-none ${
                          (courseFormEx as any).certEnabled ? 'bg-emerald-500' : 'bg-neutral-800'
                        }`}
                      >
                        <div className={`bg-black w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                          (courseFormEx as any).certEnabled ? 'translate-x-6' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  </div>

                  {/* Save button for step 2 */}
                  <div className="flex justify-between items-center pt-4 border-t border-[#222222]/40">
                    <button 
                      type="button"
                      onClick={() => setCourseAddTab('basic')}
                      className="px-4 py-2 border border-[#222222] text-gray-400 hover:text-white rounded font-bold uppercase text-[10px]"
                    >
                      ← Back to Basic
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleSaveCourse(undefined, 'content')}
                      className="px-6 py-2.5 bg-[#F89A15] hover:bg-white text-black font-extrabold uppercase text-[11px] rounded-lg tracking-wider transition-all duration-300"
                    >
                      ✔ Save & Continue to Course Content
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: COURSE CONTENT BUILDER */}
              {courseAddTab === 'content' && (
                <div className="space-y-6">
                  <div className="p-4 bg-black/40 border border-[#222222] rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">🎓 Nested Chapter Curriculum Directory</span>
                      <span className="text-[10px] text-gray-400">Stellate dynamic lessons, quizzes and documents in serialised modules.</span>
                    </div>

                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        id="quick_new_chapter"
                        placeholder="Chapter Title"
                        className="bg-black border border-[#222222] text-xs p-1.5 px-3 rounded w-44 text-white font-semibold"
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          const inputEl = document.getElementById('quick_new_chapter') as HTMLInputElement;
                          if (inputEl && inputEl.value.trim()) {
                            const newCh = {
                              id: `chap-${Date.now()}`,
                              title: inputEl.value,
                              order: (courseChapters.length + 1).toString(),
                              items: []
                            };
                            setCourseChapters([...courseChapters, newCh]);
                            inputEl.value = '';
                            notify(`Chapter "${newCh.title}" introduced!`);
                          } else {
                            alert("Input a valid title identifier string.");
                          }
                        }}
                        className="px-3.5 py-1.5 bg-emerald-500 hover:bg-white text-black font-mono font-black text-[10px] uppercase rounded"
                      >
                        + Create Chapter
                      </button>
                    </div>
                  </div>

                  {/* Render chapters list */}
                  <div className="space-y-6">
                    {courseChapters.map((chap, chapIdx) => (
                      <div key={chap.id} className="p-5 bg-black/60 rounded-2xl border border-neutral-900 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-900 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-neutral-900 border border-neutral-800 text-[10px] rounded font-mono text-gray-400">INDEX #{chapIdx + 1}</span>
                            <input 
                              type="text" 
                              value={chap.title}
                              onChange={e => {
                                const list = courseChapters.map(c => c.id === chap.id ? { ...c, title: e.target.value } : c);
                                setCourseChapters(list);
                              }}
                              className="bg-black border-b border-neutral-800 focus:border-[#F89A15] text-xs text-white uppercase font-bold p-1 px-2 rounded w-64 focus:outline-none"
                            />
                            <input 
                              type="number" 
                              value={chap.order}
                              onChange={e => {
                                const list = courseChapters.map(c => c.id === chap.id ? { ...c, order: e.target.value } : c);
                                setCourseChapters(list);
                              }}
                              className="bg-black text-center text-gray-400 text-[10px] font-mono px-1 py-0.5 border border-neutral-800 rounded w-12"
                              title="Chapter display order positions"
                            />
                          </div>

                          <button 
                            type="button"
                            onClick={() => {
                              const filtered = courseChapters.filter(c => c.id !== chap.id);
                              setCourseChapters(filtered);
                              notify("Chapter discarded of transient staging.");
                            }}
                            className="p-1 px-2.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded text-[10px] font-sans transition-colors"
                          >
                            Discard Chapter
                          </button>
                        </div>

                        {/* List lessons and quizzes under this chapter */}
                        <div className="pl-4 border-l border-neutral-800 space-y-2.5">
                          {chap.items && chap.items.length > 0 ? (
                            chap.items.map((item: any, itemIdx: number) => (
                              <div key={item.id} className="p-3.5 bg-neutral-950/40 rounded-xl border border-neutral-900/60 flex flex-wrap justify-between items-center gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 text-[8px] uppercase tracking-wider font-extrabold rounded ${
                                      item.type === 'quiz' ? 'bg-orange-500/10 text-[#F89A15]' :
                                      item.fileType === 'Document' ? 'bg-teal-500/10 text-teal-400' : 'bg-blue-500/10 text-sky-400'
                                    }`}>
                                      {item.type === 'quiz' ? 'Quiz Assessment' : item.fileType}
                                    </span>
                                    <span className="font-bold text-gray-200 text-xs">{item.title}</span>
                                  </div>

                                  <div className="text-[10px] text-gray-500 font-mono flex items-center gap-3">
                                    {item.type !== 'quiz' && (
                                      <>
                                        <span>Source: <strong className="text-gray-400">{item.source || 'Vimeo'}</strong></span>
                                        <span>Link: <strong className="text-gray-400">{item.path || '—'}</strong></span>
                                        <span>Duration: <strong className="text-gray-400">{item.duration} mins</strong></span>
                                      </>
                                    )}
                                    {item.type === 'quiz' && (
                                      <>
                                        <span>Passing Score Goal: <strong className="text-emerald-400 font-bold">{item.passMark}%</strong></span>
                                        <span>Questions Staged: <strong className="text-sky-400 font-bold">{item.questions?.length || 0} questions</strong></span>
                                      </>
                                    )}
                                  </div>

                                  {/* Sublist of individual questions with edit / delete support */}
                                  {item.type === 'quiz' && item.questions && item.questions.length > 0 && (
                                    <div className="mt-3.5 pl-3 border-l-2 border-[#222222] space-y-2 w-full max-w-xl">
                                      <p className="text-[9px] uppercase tracking-wider text-gray-500 font-black">Staged Questions List:</p>
                                      <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                                        {item.questions.map((q: any, qIdx: number) => (
                                          <div key={q.id || qIdx} className="bg-black/30 p-2 rounded-lg border border-neutral-900/60 flex items-center justify-between gap-3 text-xs">
                                            <div className="space-y-0.5">
                                              <p className="text-gray-300 font-medium">
                                                Q{qIdx + 1}: {q.questionText}
                                              </p>
                                              <p className="text-[9px] text-[#F89A15] font-mono">
                                                Weight: {q.grade} marks • {q.answers?.length || 0} choice options
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setActiveQuizIdInChap(item.id);
                                                  setEditingQuestionIdInChap(q.id || `q-${qIdx}`);
                                                  setQuestionFormEx({
                                                    questionText: q.questionText,
                                                    grade: (q.grade || 10).toString(),
                                                    answers: q.answers ? q.answers.map((a: any) => ({ text: a.text, isCorrect: !!a.isCorrect })) : []
                                                  });
                                                  setQuestionModalOpen(true);
                                                }}
                                                className="px-2 py-0.5 border border-neutral-800 hover:bg-[#F89A15] hover:text-black rounded text-[9px] font-bold uppercase transition text-emerald-400"
                                              >
                                                Edit
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (!window.confirm("Delete this question from layout?")) return;
                                                  const updatedChapters = courseChapters.map(ch => {
                                                    const updatedChapItems = ch.items ? ch.items.map((it: any) => {
                                                      if (it.id === item.id) {
                                                        const listQ = it.questions ? it.questions.filter((ques: any, idx: number) => (ques.id || `q-${idx}`) !== (q.id || `q-${qIdx}`)) : [];
                                                        return { ...it, questions: listQ };
                                                      }
                                                      return it;
                                                    }) : [];
                                                    return { ...ch, items: updatedChapItems };
                                                  });
                                                  setCourseChapters(updatedChapters);
                                                  notify("Question popped from quiz configuration.");
                                                }}
                                                className="px-2 py-0.5 border border-neutral-800 hover:bg-red-500 hover:text-white rounded text-[9px] font-bold uppercase transition text-red-100"
                                              >
                                                Del
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {item.type === 'quiz' && (
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                        setActiveQuizIdInChap(item.id);
                                        setEditingQuestionIdInChap(null);
                                        setQuestionFormEx({
                                          questionText: '',
                                          grade: '10',
                                          answers: [
                                            { text: 'Choice A', isCorrect: true },
                                            { text: 'Choice B', isCorrect: false }
                                          ]
                                        });
                                        setQuestionModalOpen(true);
                                      }}
                                      className="p-1 px-2.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black rounded text-[9px] font-bold uppercase transition"
                                    >
                                      + Add Assess Question
                                    </button>
                                  )}

                                  {item.type !== 'quiz' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveChapterId(chap.id);
                                        setEditingLessonIdInChap(item.id);
                                        setActiveLessonType(item.type === 'document' ? 'document' : 'lesson');
                                        setLessonFormEx({
                                          title: item.title || '',
                                          source: item.source || 'Vimeo',
                                          fileType: item.fileType || 'Video',
                                          duration: item.duration || '15',
                                          path: item.path || '',
                                          description: item.description || '',
                                          isPreview: !!item.isPreview,
                                        });
                                        setLessonModalOpen(true);
                                      }}
                                      className="p-1 px-2.5 bg-[#222222] hover:bg-[#F89A15] hover:text-black text-gray-300 rounded text-[9px] font-bold uppercase transition"
                                    >
                                      Edit
                                    </button>
                                  )}

                                  <button 
                                    type="button"
                                    onClick={() => {
                                      // Remove item from chap.items
                                      const updatedItems = chap.items.filter((itm: any) => itm.id !== item.id);
                                      const updatedChaps = courseChapters.map(c => c.id === chap.id ? { ...c, items: updatedItems } : c);
                                      setCourseChapters(updatedChaps);
                                      notify("Item deleted from staging chapter registry.");
                                    }}
                                    className="p-1.5 bg-neutral-900 hover:bg-red-500 text-red-400 hover:text-white rounded transition"
                                    title="Delete modular content item"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-3 text-center text-gray-600 italic text-[10px]">
                              Empty Chapter block. Click buttons below to deploy resources in this structural chapter.
                            </div>
                          )}

                          {/* Trigger interactive actions */}
                          <div className="pt-2 flex flex-wrap gap-2 items-center">
                            
                            {/* Action to add Lesson */}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveChapterId(chap.id);
                                setEditingLessonIdInChap(null);
                                setActiveLessonType('lesson');
                                setLessonFormEx({
                                  title: '',
                                  source: 'Vimeo',
                                  fileType: 'Video',
                                  duration: '15',
                                  path: '',
                                  description: 'Demo video lesson details',
                                  isPreview: false
                                });
                                setLessonModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 bg-[#222222] hover:bg-neutral-800 border border-neutral-800 text-[10px] text-[#F89A15] rounded font-bold uppercase"
                            >
                              + Video Lesson
                            </button>

                            {/* Action to add Document */}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveChapterId(chap.id);
                                setEditingLessonIdInChap(null);
                                setActiveLessonType('document');
                                setLessonFormEx({
                                  title: '',
                                  source: 'Manual Upload',
                                  fileType: 'Document',
                                  duration: '5',
                                  path: 'https://skillfort.org/syllabus.pdf',
                                  description: 'Interactive documentation resource details',
                                  isPreview: false
                                });
                                setLessonModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 bg-[#222222] hover:bg-neutral-800 border border-neutral-800 text-[10px] text-teal-400 rounded font-bold uppercase"
                            >
                              + PDF Document
                            </button>

                            {/* Action to add Quiz */}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveChapterId(chap.id);
                                setEditingQuizIdInChap(null);
                                setQuizFormEx({
                                  title: 'Structural Quiz Evaluation',
                                  timeLimit: '15',
                                  attempts: '2',
                                  totalMark: '100',
                                  passMark: '80'
                                });
                                setQuizModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 bg-[#222222] hover:bg-neutral-800 border border-neutral-800 text-[10px] text-amber-400 rounded font-bold uppercase"
                            >
                              + Exam Quiz Assessment
                            </button>

                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Save button for step 3 */}
                  <div className="flex justify-between items-center pt-4 border-t border-[#222222]/40">
                    <button 
                      type="button"
                      onClick={() => setCourseAddTab('more')}
                      className="px-4 py-2 border border-[#222222] text-gray-400 hover:text-white rounded font-bold uppercase text-[10px]"
                    >
                      ← Back to More Info
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleSaveCourse(undefined, 'finish')}
                      className="px-6 py-2.5 bg-[#F89A15] hover:bg-white text-black font-extrabold uppercase text-[11px] rounded-lg tracking-wider transition-all duration-300"
                    >
                      ✔ Save & Go to Finish Tab
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: FINISH */}
              {courseAddTab === 'finish' && (
                <div className="space-y-6">
                  
                  <div className="bg-gradient-to-tr from-[#111111] to-black border border-neutral-800 rounded-2xl p-6 space-y-4">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider font-mono text-[#F89A15]">Final Administrative Audit</span>
                    <h4 className="font-display font-black text-lg text-white">Let's verify your academic syllabus before final publication:</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-2 bg-neutral-950/40 p-4 rounded-xl border border-neutral-800">
                        <div className="text-gray-400">Program Identifier: <strong className="text-white ml-2">{courseFormEx.title || "Untitled course"}</strong></div>
                        <div className="text-gray-400">Academic Route: <strong className="text-white ml-2">/courses/{courseFormEx.slug}</strong></div>
                        <div className="text-gray-400">Assigned Faculty: <strong className="text-[#F89A15] ml-2">{courseFormEx.instructor}</strong></div>
                        <div className="text-gray-400">Duration study: <strong className="text-white ml-2">{courseFormEx.duration || "40 hours"}</strong></div>
                        <div className="text-gray-400">Access validity: <strong className="text-white ml-2">{courseFormEx.validityDays ? `${courseFormEx.validityDays} days from enrollment` : 'Lifetime (no limit)'}</strong></div>
                        <div className="text-gray-400">Department Category: <strong className="text-white ml-2">{courseFormEx.category}</strong></div>
                      </div>

                      <div className="space-y-2 bg-neutral-950/40 p-4 rounded-xl border border-neutral-800">
                        <div className="text-gray-400">Price Structure: <strong className="text-emerald-400 font-bold ml-2">₹{courseFormEx.price} (INR)</strong></div>
                        <div className="text-gray-400">Promo discount Price: <strong className="text-emerald-400 ml-2">₹{courseFormEx.discountPrice} (INR)</strong></div>
                        <div className="text-gray-400">Checkout coupon: <strong className={`ml-2 ${courseFormEx.couponCode ? 'text-[#F89A15] font-bold' : 'text-gray-500'}`}>
                          {courseFormEx.couponCode
                            ? `${courseFormEx.couponCode} (−${courseFormEx.couponDiscountPercent || '0'}%)`
                            : 'None'}
                        </strong></div>
                        <div className="text-gray-400">Q&A doubt forums: <strong className={`ml-2 ${courseFormEx.qaEnabled || (courseFormEx as any).qaEnabled ? 'text-emerald-400 font-bold' : 'text-gray-500'}`}>
                          {courseFormEx.qaEnabled || (courseFormEx as any).qaEnabled ? 'ACTIVE / OPEN' : 'MUTED'}
                        </strong></div>
                        <div className="text-gray-400">PDF Certificate: <strong className={`ml-2 ${(courseFormEx as any).certEnabled ? 'text-emerald-400 font-bold' : 'text-gray-500'}`}>
                          {(courseFormEx as any).certEnabled ? 'ENABLED' : 'DISABLED'}
                        </strong></div>
                        <div className="text-gray-400 font-bold text-[#F89A15]">Staged Chapters count: <strong className="text-white font-black ml-2">{courseChapters.length} Chapters</strong></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-[#222222]/40">
                    <button 
                      type="button"
                      onClick={() => setCourseAddTab('content')}
                      className="px-4 py-2 border border-[#222222] text-gray-400 hover:text-white rounded font-bold uppercase text-[10px]"
                    >
                      ← Back to Course Content
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleSaveCourse(undefined, 'exit')}
                      className="px-8 py-3 bg-emerald-500 hover:bg-white text-black font-extrabold uppercase text-xs rounded-xl tracking-widest transition-all duration-300 shadow-lg glow"
                    >
                      🏁 Finalize, Save & Publish Course
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* NESTED DYNAMIC MODALS SECTION FOR STAGING MODULAR CHAPTER CONTENTS */}
            {lessonModalOpen && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                <div className="bg-[#111111] border border-neutral-800 rounded-3xl w-full max-w-md p-6 md:p-8 space-y-4">
                  <div className="flex justify-between items-center border-b border-neutral-900 pb-3">
                    <h4 className="text-sm font-black text-[#F89A15] uppercase tracking-wider font-display">
                      {editingLessonIdInChap ? 'Edit' : 'Add'} {activeLessonType === 'lesson' ? 'Video Lesson' : 'PDF Document'}
                    </h4>
                    <button 
                      type="button" 
                      onClick={() => {
                        setEditingLessonIdInChap(null);
                        setLessonModalOpen(false);
                      }}
                      className="text-gray-500 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Item Name Title</span>
                      <input 
                        type="text"
                        value={lessonFormEx.title}
                        onChange={e => setLessonFormEx({ ...lessonFormEx, title: e.target.value })}
                        className="w-full bg-black border border-neutral-800 p-2.5 rounded text-white"
                        placeholder="e.g. Master MVC Spring JPA setup"
                      />
                    </div>

                    {activeLessonType === 'lesson' && (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Select Video Source Provider</span>
                        <select
                          value={lessonFormEx.source}
                          onChange={e => setLessonFormEx({ ...lessonFormEx, source: e.target.value })}
                          className="w-full bg-black border border-neutral-800 p-2.5 rounded text-white"
                        >
                          <option value="Manual Upload">Manual Storage Video Link</option>
                          <option value="YouTube">YouTube Integration</option>
                          <option value="Vimeo">Vimeo Provider API</option>
                          <option value="Google Drive">Google Drive Shared Video URL</option>
                        </select>
                      </div>
                    )}

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Source Object URL Path</span>
                      <input 
                        type="text"
                        value={lessonFormEx.path}
                        onChange={e => setLessonFormEx({ ...lessonFormEx, path: e.target.value })}
                        className="w-full bg-black border border-neutral-800 p-2.5 rounded text-white font-mono"
                        placeholder="https://..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Duration (Minutes / study length)</span>
                        <input 
                          type="number"
                          value={lessonFormEx.duration}
                          onChange={e => setLessonFormEx({ ...lessonFormEx, duration: e.target.value })}
                          className="w-full bg-black border border-neutral-800 p-2.5 rounded text-white font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Brief File Type Label</span>
                        <input 
                          type="text"
                          value={lessonFormEx.fileType}
                          onChange={e => setLessonFormEx({ ...lessonFormEx, fileType: e.target.value })}
                          className="w-full bg-black border border-neutral-800 p-2.5 rounded text-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Brief syllabus description notes</span>
                      <input 
                        type="text"
                        value={lessonFormEx.description}
                        onChange={e => setLessonFormEx({ ...lessonFormEx, description: e.target.value })}
                        className="w-full bg-black border border-neutral-800 p-2.5 rounded text-white"
                        placeholder="Explain topic boundaries briefly..."
                      />
                    </div>

                    <div className="flex gap-2 pt-3">
                      <button 
                        type="button"
                        onClick={() => {
                          setEditingLessonIdInChap(null);
                          setLessonModalOpen(false);
                        }}
                        className="flex-1 py-2.5 border border-neutral-800 hover:text-white text-gray-400 rounded uppercase font-bold"
                      >
                        Cancel
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          if (!lessonFormEx.title.trim()) { alert("Please specify item title."); return; }
                          const newItem = {
                            id: editingLessonIdInChap || `less-${Date.now()}`,
                            type: activeLessonType === 'lesson' ? 'lesson' : 'document',
                            title: lessonFormEx.title,
                            fileType: activeLessonType === 'lesson' ? 'Video' : 'Document',
                            source: lessonFormEx.source,
                            path: lessonFormEx.path || 'https://raw.githubusercontent.com/project/static/main/doc.pdf',
                            duration: lessonFormEx.duration,
                            description: lessonFormEx.description
                          };
                          // Append to target chapter items array
                          const curChaps = courseChapters.map(ch => {
                            if (ch.id === activeChapterId) {
                              const existingIdx = ch.items ? ch.items.findIndex((it: any) => it.id === newItem.id) : -1;
                              let newItemsList = ch.items ? [...ch.items] : [];
                              if (existingIdx !== -1) {
                                newItemsList[existingIdx] = newItem;
                              } else {
                                newItemsList.push(newItem);
                              }
                              return { ...ch, items: newItemsList };
                            }
                            return ch;
                          });
                          setCourseChapters(curChaps);
                          const wasEditing = !!editingLessonIdInChap;
                          setEditingLessonIdInChap(null);
                          setLessonModalOpen(false);
                          notify(wasEditing ? "Lesson updated in staging chapter!" : "Item appended to staging chapter!");
                        }}
                        className="flex-1 py-2.5 bg-[#F89A15] text-black hover:bg-white rounded uppercase font-black"
                      >
                        {editingLessonIdInChap ? '✔ Update Resource' : '✔ Append Resource'}
                      </button>
                    </div>

                  </div>
                </div>
              </div>
            )}

            {quizModalOpen && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                <div className="bg-[#111111] border border-neutral-800 rounded-3xl w-full max-w-md p-6 md:p-8 space-y-4">
                  <div className="flex justify-between items-center border-b border-neutral-900 pb-3">
                    <h4 className="text-sm font-black text-amber-500 uppercase tracking-widest font-display">Add Quiz Assessment</h4>
                    <button type="button" onClick={() => setQuizModalOpen(false)} className="text-gray-500 hover:text-white">✕</button>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Quiz Title / Introduction Header</span>
                      <input 
                        type="text"
                        value={quizFormEx.title}
                        onChange={e => setQuizFormEx({ ...quizFormEx, title: e.target.value })}
                        className="w-full bg-black border border-neutral-800 p-2.5 rounded text-white"
                        placeholder="e.g. Master level exam evaluation"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Passing Marks (%)</span>
                        <input 
                          type="number"
                          value={quizFormEx.passMark}
                          onChange={e => setQuizFormEx({ ...quizFormEx, passMark: e.target.value })}
                          className="w-full bg-black border border-neutral-800 p-2.5 rounded text-white font-mono"
                          placeholder="80"
                        />
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Time Limit (Minutes)</span>
                        <input 
                          type="number"
                          value={quizFormEx.timeLimit}
                          onChange={e => setQuizFormEx({ ...quizFormEx, timeLimit: e.target.value })}
                          className="w-full bg-black border border-neutral-800 p-2.5 rounded text-white font-mono"
                          placeholder="15"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3">
                      <button 
                        type="button" 
                        onClick={() => setQuizModalOpen(false)}
                        className="flex-1 py-12s border border-neutral-800 hover:text-white py-2 text-gray-400 rounded uppercase font-bold"
                      >
                        Cancel
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          if (!quizFormEx.title.trim()) { alert("Please specify quiz title."); return; }
                          const newQuizItem = {
                            id: `quiz-${Date.now()}`,
                            type: 'quiz',
                            title: quizFormEx.title,
                            timeLimit: quizFormEx.timeLimit || '15',
                            attempts: '3',
                            totalMark: '100',
                            passMark: quizFormEx.passMark || '80',
                            questions: []
                          };
                          // Append to target chapter items array
                          const curChaps = courseChapters.map(ch => {
                            if (ch.id === activeChapterId) {
                              let newItemsList = ch.items ? [...ch.items] : [];
                              newItemsList.push(newQuizItem);
                              return { ...ch, items: newItemsList };
                            }
                            return ch;
                          });
                          setCourseChapters(curChaps);
                          setQuizModalOpen(false);
                          notify("Assessment Quiz registered to staging chapter!");
                        }}
                        className="flex-1 py-2 bg-amber-500 hover:bg-white text-black rounded uppercase font-black"
                      >
                        ✔ Append Quiz Module
                      </button>
                    </div>

                  </div>
                </div>
              </div>
            )}

            {questionModalOpen && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                <div className="bg-[#111111] border border-neutral-800 rounded-3xl w-full max-w-md p-6 md:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-neutral-900 pb-3">
                    <h4 className="text-sm font-black text-emerald-400 uppercase tracking-widest font-display">
                      {editingQuestionIdInChap ? "Edit Quiz Question" : "Add Quiz Question"}
                    </h4>
                    <button type="button" onClick={() => setQuestionModalOpen(false)} className="text-gray-500 hover:text-white">✕</button>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Question Text Query</span>
                      <input 
                        type="text"
                        value={questionFormEx.questionText}
                        onChange={e => setQuestionFormEx({ ...questionFormEx, questionText: e.target.value })}
                        className="w-full bg-black border border-neutral-800 p-2.5 rounded text-white"
                        placeholder="e.g. Which keyword defines an interface in TypeScript?"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Question Weight Grade (e.g. Marks)</span>
                      <input 
                        type="number"
                        value={questionFormEx.grade}
                        onChange={e => setQuestionFormEx({ ...questionFormEx, grade: e.target.value })}
                        className="w-full bg-black border border-neutral-800 p-2.5 rounded text-white font-mono text-center w-24"
                        placeholder="10"
                      />
                    </div>

                    <div className="space-y-2 border-t border-neutral-900 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Multiple Choices Answers</span>
                        <button 
                          type="button"
                          onClick={() => setQuestionFormEx({
                            ...questionFormEx,
                            answers: [...questionFormEx.answers, { text: '', isCorrect: false }]
                          })}
                          className="px-2 py-0.5 border border-neutral-800 text-emerald-400 rounded text-[9px] hover:bg-neutral-800"
                        >
                          + Add Choice
                        </button>
                      </div>

                      {questionFormEx.answers.map((ans, ansIdx) => (
                        <div key={ansIdx} className="flex gap-2 items-center">
                          <input 
                            type="checkbox"
                            checked={ans.isCorrect}
                            onChange={e => {
                              const updatedAnswers = questionFormEx.answers.map((a, i) => i === ansIdx ? { ...a, isCorrect: e.target.checked } : a);
                              setQuestionFormEx({ ...questionFormEx, answers: updatedAnswers });
                            }}
                            className="accent-emerald-500"
                            title="Flag as correct option answer"
                          />
                          <input 
                            type="text"
                            value={ans.text}
                            onChange={e => {
                              const updatedAnswers = questionFormEx.answers.map((a, i) => i === ansIdx ? { ...a, text: e.target.value } : a);
                              setQuestionFormEx({ ...questionFormEx, answers: updatedAnswers });
                            }}
                            placeholder={`Choice Answer Option #${ansIdx + 1}`}
                            className="flex-grow bg-black border border-neutral-900 text-xs p-2 rounded text-white"
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              const filtered = questionFormEx.answers.filter((_, i) => i !== ansIdx);
                              setQuestionFormEx({ ...questionFormEx, answers: filtered });
                            }}
                            className="p-2 text-red-500 hover:text-white"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-neutral-900">
                      <button 
                        type="button" 
                        onClick={() => setQuestionModalOpen(false)}
                        className="flex-1 py-2 border border-neutral-800 hover:text-white text-gray-400 rounded uppercase font-bold animate"
                      >
                        Cancel
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          if (!questionFormEx.questionText.trim()) { alert("Please specify question text query."); return; }
                          if (questionFormEx.answers.length === 0) { alert("Please stage at least one answer choice option."); return; }
                          
                          const newQuestionObj = {
                            id: editingQuestionIdInChap || `ques-${Date.now()}`,
                            questionText: questionFormEx.questionText,
                            grade: Number(questionFormEx.grade) || 10,
                            answers: questionFormEx.answers
                          };

                          // Find active Quiz and register this question under its staging questions list tree
                          const updatedChapters = courseChapters.map(ch => {
                            const updatedChapItems = ch.items ? ch.items.map((item: any) => {
                              if (item.id === activeQuizIdInChap) {
                                let listQ = item.questions ? [...item.questions] : [];
                                if (editingQuestionIdInChap) {
                                  // Update the existing question
                                  const eqId = editingQuestionIdInChap;
                                  const qIdx = listQ.findIndex((q: any, idx: number) => (q.id || `q-${idx}`) === eqId);
                                  if (qIdx !== -1) {
                                    listQ[qIdx] = newQuestionObj;
                                  } else {
                                    listQ.push(newQuestionObj);
                                  }
                                } else {
                                  listQ.push(newQuestionObj);
                                }
                                return { ...item, questions: listQ };
                              }
                              return item;
                            }) : [];
                            return { ...ch, items: updatedChapItems };
                          });

                          setCourseChapters(updatedChapters);
                          setQuestionModalOpen(false);
                          notify(editingQuestionIdInChap ? "Quiz Question updated successfully in layout!" : "Quiz Question registered successfully under this assessing module!");
                        }}
                        className="flex-1 py-2 bg-emerald-500 hover:bg-white text-black py-2 rounded text-xs uppercase font-black"
                      >
                        {editingQuestionIdInChap ? "✔ Update Question" : "✔ Append Question"}
                      </button>
                    </div>

                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* 2C. COURSE CATEGORIES TAB */}
        {activeTab === 'courses-categories' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 bg-[#111111] border border-[#222222] p-6 rounded-2xl space-y-4">
              <h3 className="font-display font-bold text-xs uppercase tracking-wide text-[#F89A15]">Add Course Category</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!categoryForm.name) return;
                const newCat = {
                  id: `cat-${Date.now()}`,
                  name: categoryForm.name,
                  description: categoryForm.description
                };
                const updated = [...categories, newCat];
                setCategories(updated);
                void setPlatformValue('skillfort_categories', updated);
                notify(`Category '${categoryForm.name}' incorporated!`);
                setCategoryForm({ name: '', description: '' });
              }} className="space-y-4 text-xs">
                <div className="space-y-1.5 block">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Category Name</span>
                  <input 
                    type="text" required
                    value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
                    placeholder="e.g. Cyber Security Mastery"
                  />
                </div>
                <div className="space-y-1.5 block">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Brief Description</span>
                  <textarea 
                    rows={3}
                    value={categoryForm.description} onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white resize-none"
                    placeholder="Syllabus group focus areas..."
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-[#F89A15] hover:bg-white text-black rounded-lg transition-all uppercase font-bold">
                  Publish Category Node
                </button>
              </form>
            </div>

            <div className="lg:col-span-8 bg-[#111111] border border-[#222222] p-6 rounded-2xl space-y-4">
              <h3 className="font-display font-medium text-sm text-white">Course Categories ({categories.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map(cat => {
                  const itemsCount = courses.filter(c => c.category?.toLowerCase() === cat.name.toLowerCase() || c.category?.toLowerCase().includes(cat.name.toLowerCase().slice(0, 5))).length;
                  return (
                    <div key={cat.id} className="p-4 bg-black/40 border border-[#222222] rounded-xl flex justify-between items-center">
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-bold text-white font-display uppercase tracking-wider">{cat.name}</h4>
                        <p className="text-[10px] text-gray-400 font-sans leading-relaxed">{cat.description}</p>
                        <span className="inline-block text-[9px] uppercase font-mono bg-amber-400/10 text-[#F89A15] px-2 py-0.5 rounded font-black">
                          {itemsCount} Mapped Syllabus Items
                        </span>
                      </div>
                      <button 
                        onClick={() => {
                          const updated = categories.filter(c => c.id !== cat.id);
                          setCategories(updated);
                          void setPlatformValue('skillfort_categories', updated);
                          notify("Category successfully deleted");
                        }}
                        className="p-1 px-2.5 bg-red-400/10 hover:bg-red-500 hover:text-white rounded text-[10px] text-red-400 transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 2D. COURSE REVIEWS FEEDBACK BOARD */}
        {activeTab === 'courses-reviews' && (
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-sm text-white">Student Course Reviews</h3>
                <p className="text-[10px] text-gray-400 leading-relaxed font-sans mt-1">
                  Approve reviews to publish them on course pages and update course ratings.
                </p>
              </div>
              <div className="flex bg-black p-1 border border-[#222222] rounded-xl self-start">
                <button
                  type="button"
                  onClick={() => setReviewFilter('pending')}
                  className={`px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded-lg transition-all ${
                    reviewFilter === 'pending' ? 'bg-[#F89A15] text-black' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Pending ({reviews.filter((entry) => entry.status === 'pending').length})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('all')}
                  className={`px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded-lg transition-all ${
                    reviewFilter === 'all' ? 'bg-[#F89A15] text-black' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  All ({reviews.length})
                </button>
              </div>
            </div>

            {reviewsLoading ? (
              <p className="text-xs text-gray-500">Loading reviews…</p>
            ) : (
              <div className="space-y-4">
                {(reviewFilter === 'pending'
                  ? reviews.filter((entry) => entry.status === 'pending')
                  : reviews
                ).map((rev) => (
                  <div key={rev.id} className="p-4 rounded-xl border border-[#222222] bg-black/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-2 max-w-xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white text-xs">{rev.studentName}</span>
                        <span className="text-[9px] text-gray-500 font-mono">
                          {new Date(rev.createdAt).toLocaleDateString()}
                        </span>
                        <span className="text-[#F89A15] text-[10px] font-mono font-bold">
                          {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                        </span>
                        <span
                          className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                            rev.status === 'approved'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : rev.status === 'rejected'
                                ? 'bg-red-500/15 text-red-400'
                                : 'bg-yellow-500/15 text-yellow-400'
                          }`}
                        >
                          {rev.status}
                        </span>
                        {rev.isPinned && rev.status === 'approved' && (
                          <span className="text-[9px] uppercase font-bold text-[#F89A15]">Pinned</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-300 leading-relaxed font-sans font-medium">
                        &ldquo;{rev.comment}&rdquo;
                      </p>
                      <span className="inline-block text-[9px] uppercase tracking-wider text-[#F89A15] bg-[#F89A15]/10 font-black p-1 px-2.5 rounded">
                        Course: {rev.courseTitle}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {rev.status !== 'approved' && (
                        <button
                          type="button"
                          onClick={() => void handleApproveReview(rev.id)}
                          className="px-3.5 py-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[10px] rounded hover:bg-emerald-500 hover:text-black font-bold transition-all uppercase"
                        >
                          Approve
                        </button>
                      )}
                      {rev.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => void handleRejectReview(rev.id)}
                          className="px-3 py-1.5 bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 text-[10px] rounded hover:bg-yellow-500 hover:text-black font-bold transition-all uppercase"
                        >
                          Reject
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDeleteReview(rev.id)}
                        className="px-3 py-1.5 bg-red-500/15 text-red-400 border border-red-500/20 text-[10px] rounded hover:bg-red-500 hover:text-white font-bold transition-all uppercase"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}

                {(reviewFilter === 'pending'
                  ? reviews.filter((entry) => entry.status === 'pending')
                  : reviews
                ).length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-8">
                    {reviewFilter === 'pending'
                      ? 'No pending reviews. Completed students can submit reviews from My Courses.'
                      : 'No reviews yet.'}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

                  {/* 3A. ALL LESSONS & CURRICULUM SETUP */}
        {activeTab === 'lessons-all' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 bg-[#111111] border border-[#222222] p-6 rounded-2xl space-y-4">
              <h3 className="font-display font-bold text-[#F89A15] text-xs uppercase tracking-wide">Syllabus Segment Module Setup</h3>
              <p className="text-[10px] text-gray-400 font-sans">Before laying lesson nodes, organize curriculum chapters/modules here.</p>
              
              <form onSubmit={handleSaveModule} className="space-y-4 text-xs">
                <label className="space-y-1.5 block">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Target Course Parent</span>
                  <select 
                    value={moduleForm.courseId} onChange={e => setModuleForm({ ...moduleForm, courseId: e.target.value })}
                    className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
                  >
                    <option value="">-- Choose target --</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </label>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-gray-400 block">Module Heading Name</label>
                  <input 
                    type="text" required
                    value={moduleForm.title} onChange={e => setModuleForm({ ...moduleForm, title: e.target.value })}
                    className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-semibold"
                    placeholder="e.g. Module 01: Setup"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-gray-400 block">Description Objectives</label>
                  <textarea 
                    rows={3}
                    value={moduleForm.description} onChange={e => setModuleForm({ ...moduleForm, description: e.target.value })}
                    className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
                    placeholder="e.g. Setting up JDK 21 and compiler targets"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-gray-400 block">Display Order Sequence Position</label>
                  <input 
                    type="number"
                    value={moduleForm.order} onChange={e => setModuleForm({ ...moduleForm, order: e.target.value })}
                    className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
                    placeholder="1"
                  />
                </div>

                <div className="flex gap-2">
                  {editingModuleId && (
                    <button 
                      type="button" onClick={() => { setEditingModuleId(null); setModuleForm({ courseId: '', title: '', description: '', order: '' }); }}
                      className="px-4 py-3 border border-[#222222] rounded-xl text-xs text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  )}
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-[#F89A15] hover:bg-white text-black transition-colors font-bold uppercase rounded-lg"
                  >
                    Save Module Chapter
                  </button>
                </div>
              </form>
            </div>

            <div className="lg:col-span-7 bg-[#111111] border border-[#222222] p-6 rounded-2xl space-y-4">
              <h3 className="font-display font-medium text-sm text-white">Active Curriculum Module Chapters and Lessons</h3>
              
              <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
                {courses.map(course => {
                  const courseMods = modules.filter(m => m.courseId === course.id);
                  return (
                    <div key={course.id} className="space-y-3 bg-black/20 p-4 rounded-xl border border-[#222222]/40">
                      <h4 className="text-xs font-black text-[#F89A15] border-b border-[#222222]/50 pb-1.5 uppercase font-display tracking-widest">{course.title}</h4>
                      {courseMods.length > 0 ? (
                        <div className="space-y-4">
                          {courseMods.map(m => {
                            const modLessons = lessons.filter(l => l.moduleId === m.id);
                            return (
                              <div key={m.id} className="space-y-2 p-3 bg-black/40 border border-[#222222] rounded-xl text-xs">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <span className="font-bold text-white font-display block">#{m.order}. {m.title}</span>
                                    {m.description && <span className="text-[10px] text-gray-400 block">{m.description}</span>}
                                  </div>
                                  <div className="flex gap-1">
                                    <button 
                                      onClick={() => { setEditingModuleId(m.id); setModuleForm({ courseId: m.courseId, title: m.title, description: m.description, order: m.order.toString() }); }}
                                      className="p-1 px-2 text-slate-800 dark:text-gray-300 border border-slate-350 dark:border-[#222222] hover:bg-[#F89A15] hover:text-black hover:border-[#F89A15] rounded text-[9px] transition-colors bg-slate-100/50 dark:bg-black/30"
                                    >
                                      Edit
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteModule(m.id)}
                                      className="p-1 px-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded text-[9px] transition-colors"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>

                                <div className="pl-4 space-y-1 pt-1.5 border-t border-[#222222]/30">
                                  {modLessons.length > 0 ? (
                                    modLessons.map(l => (
                                      <div key={l.id} className="p-1.5 bg-neutral-900/60 border border-[#222222]/40 rounded flex justify-between items-center text-[10px]">
                                        <span className="text-gray-300 font-medium">#{l.order} [{l.type}] {l.title}</span>
                                        <div className="flex gap-1">
                                          <button 
                                            onClick={() => { 
                                              setEditingLessonId(l.id); 
                                              setLessonForm({ moduleId: l.moduleId, title: l.title, type: l.type, vimeoUrl: l.vimeoUrl || '', vimeoId: l.vimeoId || '', thumbnail: l.thumbnail || '', fileUrl: l.fileUrl || '', fileName: l.fileName || '', fileSize: l.fileSize || '', duration: l.duration || '', order: l.order.toString() }); 
                                              goToTab('lessons-add');
                                            }}
                                            className="p-1 text-slate-600 dark:text-gray-400 hover:text-[#F89A15] transition-colors text-[9px]"
                                          >
                                            Edit
                                          </button>
                                          <button 
                                            onClick={() => handleDeleteLesson(l.id)}
                                            className="p-1 text-red-400 hover:text-white rounded text-[9px]"
                                          >
                                            Trash
                                          </button>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <span className="text-[9px] italic text-gray-500">No lessons pinned to this module segment yet.</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[10px] italic text-gray-600 pl-4">No academic submodules mapped. Create one on the left desk.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 3B. ADD NEW LESSON ELEMENT NODE */}
        {activeTab === 'lessons-add' && (
          <div className="max-w-xl bg-[#111111] border border-[#222222] p-8 rounded-3xl space-y-6">
            <h3 className="font-display font-medium text-xs text-[#F89A15] uppercase tracking-wider">{editingLessonId ? "Modify Lesson Parameter Node" : "Publish Lesson Element Node"}</h3>

            <form onSubmit={async (e) => {
              await handleSaveLesson(e);
              goToTab('lessons-all');
            }} className="space-y-4 text-xs">
              <label className="space-y-1.5 block">
                <span className="text-[10px] uppercase font-bold text-gray-400">Parent Submodule Chapter Select</span>
                <select 
                  value={lessonForm.moduleId} onChange={e => setLessonForm({ ...lessonForm, moduleId: e.target.value })}
                  className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
                >
                  <option value="">-- Choose module --</option>
                  {modules.map(m => {
                    const cName = courses.find(cr => cr.id === m.courseId)?.title || 'No Course';
                    return <option key={m.id} value={m.id}>{cName.slice(0, 15)}... / {m.title}</option>;
                  })}
                </select>
              </label>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400 block">Lesson Element Title Headline</label>
                <input 
                  type="text" required
                  value={lessonForm.title} onChange={e => setLessonForm({ ...lessonForm, title: e.target.value })}
                  className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-medium outline-none"
                  placeholder="e.g. Master reactive hooks architecture"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-1.5 block">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Lesson Type Segment</span>
                  <select 
                    value={lessonForm.type} onChange={e => setLessonForm({ ...lessonForm, type: e.target.value })}
                    className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
                  >
                    <option value="video">Vimeo Stream Video</option>
                    <option value="pdf">Syllabus PDF Document</option>
                    <option value="download">Downloadable Resource ZIP</option>
                  </select>
                </label>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-gray-400 block">Order Sequence Rank</label>
                  <input 
                    type="number" required
                    value={lessonForm.order} onChange={e => setLessonForm({ ...lessonForm, order: e.target.value })}
                    className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
                  />
                </div>
              </div>

              {lessonForm.type === 'video' ? (
                <div className="space-y-4 pt-2 border-t border-[#222222]/50">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-400 block">Vimeo Video ID</label>
                      <input 
                        type="text" required={lessonForm.type === 'video'}
                        value={lessonForm.vimeoId} onChange={e => setLessonForm({ ...lessonForm, vimeoId: e.target.value, vimeoUrl: `https://vimeo.com/${e.target.value}` })}
                        className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
                        placeholder="76979871"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-400 block">Length Duration</label>
                      <input 
                        type="text"
                        value={lessonForm.duration} onChange={e => setLessonForm({ ...lessonForm, duration: e.target.value })}
                        className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
                        placeholder="15:45"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-1 border-t border-[#222222]/40">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-gray-400 block">Static Resource Web link</label>
                    <input 
                      type="url" required
                      value={lessonForm.fileUrl} onChange={e => setLessonForm({ ...lessonForm, fileUrl: e.target.value })}
                      className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
                      placeholder="e.g. https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-400 block">Display Name</label>
                      <input 
                        type="text" required
                        value={instructorForm.name ? lessonForm.fileName : "Syllabus Notes.pdf"} onChange={e => setLessonForm({ ...lessonForm, fileName: e.target.value })}
                        className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
                        placeholder="Syllabus Notes.pdf"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-400 block">File size estimation</label>
                      <input 
                        type="text" required
                        value={lessonForm.fileSize || "4.5 MB"} onChange={e => setLessonForm({ ...lessonForm, fileSize: e.target.value })}
                        className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setEditingLessonId(null);
                    setLessonForm({ moduleId: '', title: '', type: 'video', vimeoUrl: '', vimeoId: '', thumbnail: '', fileUrl: '', fileName: '', fileSize: '', duration: '', order: '' });
                    goToTab('lessons-all');
                  }}
                  className="px-6 py-3 border border-[#222222] text-gray-400 hover:text-white rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-[#F89A15] text-black hover:bg-white font-bold uppercase rounded-xl transition-all"
                >
                  Commit Lesson Node
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 4. ACADEMIC QUIZZES SUB-DESK */}
        {activeTab.startsWith('quiz-') && (
          <QuizAdmin 
            courses={courses}
            quizzes={quizzes}
            setQuizzes={setQuizzes}
            quizQuestions={quizQuestions}
            setQuizQuestions={setQuizQuestions}
            notify={notify}
          />
        )}

        {/* 5. SALES & ORDERS MASTER LEDGER */}
        {activeTab === 'orders-all' && (() => {
          const now = Date.now();
          const dateCutoffMs: Record<string, number> = {
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000,
            '90d': 90 * 24 * 60 * 60 * 1000,
          };

          const filteredPayments = payments.filter((p) => {
            const q = orderSearch.trim().toLowerCase();
            const matchesSearch =
              !q ||
              p.userName.toLowerCase().includes(q) ||
              p.userEmail.toLowerCase().includes(q) ||
              p.invoiceId.toLowerCase().includes(q) ||
              p.courseTitle.toLowerCase().includes(q) ||
              (p.couponApplied && p.couponApplied.toLowerCase().includes(q));

            const matchesStatus =
              orderFilterStatus === 'All' || p.status === orderFilterStatus;

            const matchesCoupon =
              orderFilterCoupon === 'All' ||
              (orderFilterCoupon === 'With coupon' && Boolean(p.couponApplied)) ||
              (orderFilterCoupon === 'No coupon' && !p.couponApplied);

            const matchesDate =
              orderFilterDate === 'All' ||
              (orderFilterDate in dateCutoffMs &&
                now - new Date(p.createdAt).getTime() <= dateCutoffMs[orderFilterDate]);

            return matchesSearch && matchesStatus && matchesCoupon && matchesDate;
          });

          const hasActiveFilters =
            orderSearch.trim() !== '' ||
            orderFilterStatus !== 'All' ||
            orderFilterCoupon !== 'All' ||
            orderFilterDate !== 'All';

          return (
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="font-display font-medium text-sm">
                Direct Checkout & Subscription ledger reports ({filteredPayments.length})
              </h3>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setOrderSearch('');
                    setOrderFilterStatus('All');
                    setOrderFilterCoupon('All');
                    setOrderFilterDate('All');
                  }}
                  className="text-[10px] font-bold uppercase text-[#F89A15] hover:text-white"
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="bg-black/40 border border-[#222222] p-5 rounded-2xl">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-bold text-gray-500">Search</span>
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Name, email, invoice, course…"
                    className="w-full bg-black border border-[#222222] text-xs p-2.5 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-bold text-gray-500">Payment status</span>
                  <select
                    value={orderFilterStatus}
                    onChange={(e) => setOrderFilterStatus(e.target.value)}
                    className="w-full bg-black border border-[#222222] text-xs p-2.5 rounded-lg text-white"
                  >
                    <option value="All">All statuses</option>
                    <option value="captured">Captured</option>
                    <option value="refunded">Refunded</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-bold text-gray-500">Coupon</span>
                  <select
                    value={orderFilterCoupon}
                    onChange={(e) => setOrderFilterCoupon(e.target.value)}
                    className="w-full bg-black border border-[#222222] text-xs p-2.5 rounded-lg text-white"
                  >
                    <option value="All">All orders</option>
                    <option value="With coupon">With coupon</option>
                    <option value="No coupon">No coupon</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-bold text-gray-500">Date range</span>
                  <select
                    value={orderFilterDate}
                    onChange={(e) => setOrderFilterDate(e.target.value)}
                    className="w-full bg-black border border-[#222222] text-xs p-2.5 rounded-lg text-white"
                  >
                    <option value="All">All time</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto rounded-xl border border-[#222222]">
              <table className="w-full text-left text-xs border-collapse text-gray-300">
                <thead>
                  <tr className="bg-black border-b border-[#222222] text-gray-400 uppercase">
                    <th className="p-4">Billing Client details</th>
                    <th className="p-4 text-center">Invoice ID Code</th>
                    <th className="p-4 text-center">Course</th>
                    <th className="p-4 text-center">Discount Vouchers</th>
                    <th className="p-4 text-right">INR Paid Amount</th>
                    <th className="p-4 text-center">Inclusive GST Tax (18%)</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-500">
                        No orders matched your filters.
                      </td>
                    </tr>
                  ) : (
                  filteredPayments.map(p => (
                    <tr key={p.id} className="border-b border-[#222222]/60 hover:bg-black/20">
                      <td className="p-4">
                        <span className="font-bold text-white block">{p.userName}</span>
                        <span className="text-[10px] text-gray-500 font-mono block">{p.userEmail}</span>
                      </td>
                      <td className="p-4 text-center font-mono text-gray-400">{p.invoiceId}</td>
                      <td className="p-4 text-center text-gray-300 max-w-[160px] truncate" title={p.courseTitle}>
                        {p.courseTitle}
                      </td>
                      <td className="p-4 text-center text-emerald-400 font-bold">{p.couponApplied || 'None (Base)'}</td>
                      <td className="p-4 text-right font-mono text-white text-sm">₹{p.amountPaid}</td>
                      <td className="p-4 text-center text-gray-400 font-mono">₹{Math.round(p.amountPaid * (settings.gstRate / 118))}</td>
                      <td className="p-4 text-center">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          p.status === 'refunded'
                            ? 'bg-red-500/20 text-red-400'
                            : p.status === 'failed'
                              ? 'bg-orange-500/20 text-orange-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-4 text-center space-x-2">
                        <button 
                          onClick={() => onViewInvoice(p)}
                          className="px-3.5 py-1.5 bg-[#222222] hover:bg-[#F89A15] hover:text-black rounded transition-all font-semibold"
                        >
                          Invoice details
                        </button>
                        {p.status === 'captured' && (
                          <button
                            onClick={() => void handleRefundPayment(p)}
                            className="px-3.5 py-1.5 bg-red-900/40 hover:bg-red-600 text-red-200 hover:text-white rounded transition-all font-semibold"
                          >
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          );
        })()}

        {/* 6. PEOPLE MANAGEMENT DIRECTORIES (STUDENTS, TEACHERS) */}
        {(activeTab.startsWith('students-') || activeTab.startsWith('instructors-')) && (
          <PeopleAdmin 
            activeTab={activeTab}
            onNavigate={goToTab}
            students={students}
            onRefreshData={onRefreshData}
            instructors={instructors}
            setInstructors={setInstructors}
            notify={notify}
          />
        )}

        {(activeTab.startsWith('admins-')) && (
          <AdminsAdmin
            activeTab={activeTab}
            onNavigate={goToTab}
            admins={admins}
            currentUserId={currentUser.id}
            onRefreshData={onRefreshData}
            onAdminCreated={onAdminCreated}
            onAdminDeleted={onAdminDeleted}
            notify={notify}
          />
        )}

        {/* Certificate Builder desk */}
        {activeTab === 'courses-cert-template' && (
          <CertificateBuilder notify={notify} />
        )}

        {activeTab === 'landing-banner' && <LandingBannerAdmin notify={notify} />}

        {activeTab === 'wall-of-success' && <WallOfSuccessAdmin notify={notify} />}

        {/* 7. SYSTEM SETTINGS HUB */}
        {activeTab === 'settings' && (
          <div className="max-w-md bg-[#111111] border border-[#222222] p-8 rounded-2xl space-y-6">
            <h3 className="font-display font-bold text-sm text-[#F89A15] uppercase tracking-wide">Configure ERP Dynamic System Parameters</h3>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400 block">SaaS Platform Title name</label>
                <input 
                  type="text" required
                  value={settingsForm.systemName} onChange={e => setSettingsForm({ ...settingsForm, systemName: e.target.value })}
                  className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400 block">Corporate Support Help Desk</label>
                <input 
                  type="email" required
                  value={settingsForm.supportEmail} onChange={e => setSettingsForm({ ...settingsForm, supportEmail: e.target.value })}
                  className="w-full bg-[#000000] border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-gray-400 block">GST percentage (%)</label>
                  <input 
                    type="number" required
                    value={settingsForm.gstRate} onChange={e => setSettingsForm({ ...settingsForm, gstRate: Number(e.target.value) })}
                    className="w-full bg-[#000000] border border-[#222222] text-xs p-3 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-gray-400 block">Dynamic hex accent</label>
                  <input 
                    type="text" required
                    value={settingsForm.themeColor} onChange={e => setSettingsForm({ ...settingsForm, themeColor: e.target.value })}
                    className="w-full bg-[#000000] border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400 block">Razorpay Merchant API key ID</label>
                <input 
                  type="text" required
                  value={settingsForm.razorpayKeyId} onChange={e => setSettingsForm({ ...settingsForm, razorpayKeyId: e.target.value })}
                  className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400 block">Razorpay key secret (live payments)</label>
                <input 
                  type="password"
                  placeholder="Leave blank to keep current"
                  value={settingsForm.razorpayKeySecret ?? ''} onChange={e => setSettingsForm({ ...settingsForm, razorpayKeySecret: e.target.value })}
                  className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
                />
                <p className="text-[9px] text-gray-500">Or set RAZORPAY_KEY_SECRET in .env. Without a secret, checkout runs in simulator mode.</p>
              </div>

              <button 
                type="submit"
                className="w-full py-3 bg-[#F89A15] hover:bg-white text-black transition-colors text-xs font-bold uppercase rounded-xl"
              >
                Apply ERP Platform custom configuration
              </button>
            </form>
          </div>
        )}

        {/* 8. EMAIL / SMTP CONFIGURATION */}
        {activeTab === 'mail_sandbox' && (
          <MailSettings settings={settings} onRefreshData={onRefreshData} notify={notify} />
        )}

      </main>
    </div>
  );
}
