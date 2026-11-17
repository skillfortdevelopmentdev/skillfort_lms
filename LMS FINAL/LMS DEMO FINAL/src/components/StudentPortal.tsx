import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Player from '@vimeo/player';
import { User, Course, CourseModule, Lesson, LessonProgress, Enrollment, Certificate, PaymentReport, CheckoutSession, CourseReview } from '../types';
import { SkillFortLogo } from './SkillFortLogo';
import MobileNavSheet from './ui/MobileNavSheet';
import PasswordInput from './ui/PasswordInput';
import { 
  Play, BookOpen, Clock, Star, Award, ShieldCheck, 
  Settings, User as UserIcon, LogOut, CheckCircle, ArrowLeft, 
  Video, FileText, Download, Check, AlertCircle, RefreshCw, Receipt,
  Bell, Lock, Camera, CheckSquare, HelpCircle, ShoppingCart, Trash2, Menu
} from 'lucide-react';
import { apiFetch } from '../api/client';
import { resolveMediaUrl } from '../api/config';
import { readPlatformCache, setPlatformValue, parsePlatformValue, syncPlatformCache, getPlatformValue } from '../api/platformKv';
import { parseStudentPath, studentPath, studentBrowsePath, type StudentMenu } from '../routes/studentRoutes';
import { consumePendingCheckout } from '../utils/authReturn';
import { type ContinueTarget } from '../utils/courseProgress';
import {
  enrollmentAccessLabel,
  formatValidityLabel,
  isEnrollmentExpired,
} from '../utils/courseValidity';
import { Toast, useToast } from './ui/Toast';
import CheckoutModal from './CheckoutModal';
import CompletionCelebrationModal from './CompletionCelebrationModal';
import ContentProtectionShell from './ContentProtectionShell';
import CourseReviewModal from './CourseReviewModal';
import CourseCatalog from './CourseCatalog';
import StudentDashboard from './StudentDashboard';
import PublicCourseDetailPage from '../pages/PublicCourseDetailPage';
import {
  fetchStudentCourseReviews,
  submitCourseReview as submitCourseReviewApi,
} from '../api/courseReviews';
import {
  downloadCertificateImage,
  resolveCertificateTemplate,
} from '../utils/certificateTemplate';

interface StudentPortalProps {
  currentUser: User;
  courses: Course[];
  modules: CourseModule[];
  lessons: Lesson[];
  enrollments: Enrollment[];
  payments: PaymentReport[];
  certificates: Certificate[];
  onLogout: () => void;
  onRefreshData: () => Promise<void>;
  onTriggerCheckout: (courseIds: string[], couponCode?: string) => Promise<CheckoutSession>;
  onCapturePayment: (payload: {
    userId: string;
    courseIds: string[];
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature?: string;
    couponApplied?: string | null;
    lineItems: CheckoutSession['lineItems'];
  }) => Promise<void>;
  cartItems: Course[];
  cartCount: number;
  onAddToCart: (courseId: string) => Promise<unknown>;
  onRemoveFromCart: (courseId: string) => Promise<unknown>;
  onRefreshCart: () => Promise<void>;
  onViewInvoice: (payment: PaymentReport) => void;
  onViewCertificate: (certificate: Certificate) => void;
  coupons: any[];
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function StudentPortal({
  currentUser,
  courses,
  modules,
  lessons,
  enrollments,
  payments,
  certificates,
  onLogout,
  onRefreshData,
  onTriggerCheckout,
  onCapturePayment,
  cartItems,
  cartCount,
  onAddToCart,
  onRemoveFromCart,
  onRefreshCart,
  onViewInvoice,
  onViewCertificate,
  coupons,
  isDarkMode,
  onToggleDarkMode
}: StudentPortalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast, showToast, dismissToast } = useToast();
  const [activeMenu, setActiveMenu] = useState<StudentMenu>('dashboard');
  const [browseCourseId, setBrowseCourseId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [currentCourseProgress, setCurrentCourseProgress] = useState<any[]>([]);
  // Nested Tabs States
  const [myCoursesSubTab, setMyCoursesSubTab] = useState<'enrolled' | 'completed'>('enrolled');
  const [studentReviews, setStudentReviews] = useState<CourseReview[]>([]);
  const [reviewModalCourse, setReviewModalCourse] = useState<Course | null>(null);
  const [profileSubTab, setProfileSubTab] = useState<'edit' | 'password' | 'photo'>('edit');
  const [celebrationCert, setCelebrationCert] = useState<Certificate | null>(null);
  const [continueTargets, setContinueTargets] = useState<ContinueTarget[]>([]);
  const completionFlowActiveRef = useRef(false);

  useEffect(() => {
    const parsed = parseStudentPath(location.pathname);
    setActiveMenu(parsed.menu);

    if (parsed.browseCourseId) {
      setBrowseCourseId(parsed.browseCourseId);
      setSelectedCourse(null);
      setActiveLesson(null);
      return;
    }
    setBrowseCourseId(null);

    if (parsed.courseId) {
      const course = courses.find((c) => c.id === parsed.courseId) ?? null;
      setSelectedCourse((prev) => (prev?.id === course?.id ? prev : course));
      if (parsed.lessonId) {
        const lesson = lessons.find((l) => l.id === parsed.lessonId) ?? null;
        setActiveLesson((prev) => (prev?.id === lesson?.id ? prev : lesson));
      } else {
        setActiveLesson(null);
      }
    } else {
      setSelectedCourse(null);
      setActiveLesson(null);
    }
  }, [location.pathname, courses, lessons]);

  useEffect(() => {
    if (activeMenu !== 'my-courses') return;
    void fetchStudentCourseReviews().then(setStudentReviews);
  }, [activeMenu, enrollments]);

  const getStudentReviewForCourse = (courseId: string) =>
    studentReviews.find((review) => review.courseId === courseId);

  const openCoursePlayer = (course: Course, lessonId?: string) => {
    const enrollment = enrollments.find((e) => e.courseId === course.id);
    if (enrollment && isEnrollmentExpired(enrollment)) {
      showToast('Your access to this course has expired. Contact support to renew.', 'error');
      return;
    }
    if (lessonId) {
      navigate(studentPath('my-courses', course.id, lessonId));
      setSelectedCourse(course);
      setActiveLesson(lessons.find((l) => l.id === lessonId) ?? null);
      return;
    }
    navigate(studentPath('my-courses', course.id));
    setSelectedCourse(course);
    setActiveLesson(null);
  };

  const downloadCertificateLocally = async (cert: Certificate) => {
    const template = await resolveCertificateTemplate(readPlatformCache, getPlatformValue);

    await downloadCertificateImage(
      template,
      {
        studentName: cert.userName,
        courseTitle: cert.courseTitle,
        issueDate: cert.issueDate,
      },
      `SkillFort-Certificate-${cert.certificateNumber}.png`
    );
  };

  const revealCompletionCelebration = async (
    courseId: string,
    certificateFromSave?: Certificate | null
  ) => {
    if (certificateFromSave) {
      setCelebrationCert((prev) => (prev?.id === certificateFromSave.id ? prev : certificateFromSave));
      return;
    }

    try {
      const resp = await apiFetch(`/api/certificates/${currentUser.id}`);
      if (!resp.ok) return;
      const all = (await resp.json()) as Certificate[];
      const existing = all.find((c) => c.courseId === courseId);
      if (existing) {
        setCelebrationCert((prev) => (prev?.id === existing.id ? prev : existing));
      }
    } catch (e) {
      console.error('Could not load certificate for celebration:', e);
    }
  };

  const dismissCompletionCelebration = useCallback(() => {
    completionFlowActiveRef.current = false;
    setCelebrationCert(null);
    void onRefreshData();
  }, [onRefreshData]);

  const handleCelebrationViewCertificate = useCallback(() => {
    setCelebrationCert((cert) => {
      if (!cert) return null;
      completionFlowActiveRef.current = false;
      void onRefreshData();
      navigate(studentPath('certificates'));
      onViewCertificate(cert);
      return null;
    });
  }, [navigate, onRefreshData, onViewCertificate]);

  const handleCelebrationDownload = useCallback(() => {
    setCelebrationCert((cert) => {
      if (cert) void downloadCertificateLocally(cert);
      return cert;
    });
  }, []);

  // Profile avatar photo
  const [profilePhoto, setProfilePhoto] = useState<string>(() => {
    return readPlatformCache(`skillfort_photo_${currentUser.id}`, null) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200';
  });

  const handleUpdatePhoto = (url: string) => {
    setProfilePhoto(url);
    void setPlatformValue(`skillfort_photo_${currentUser.id}`, url);
    setProfileSuccess(true);
    setTimeout(() => setProfileSuccess(false), 2000);
  };

  // Password Simulation
  const [passwordState, setPasswordState] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (passwordState.new !== passwordState.confirm) {
      setPasswordError("Confirm password does not match new password.");
      return;
    }
    if (passwordState.new.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }

    try {
      const resp = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwordState.current,
          newPassword: passwordState.new,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setPasswordError(data.error || 'Password update failed.');
        return;
      }
    } catch {
      setPasswordError('Network error while updating password.');
      return;
    }

    setProfileSuccess(true);
    
    setNotifications(prev => {
      const notif = {
        id: `pwd-notif-${Date.now()}`,
        title: `🔑 Password Security Revised`,
        message: `Your account password has been updated successfully.`,
        date: new Date().toISOString().split('T')[0],
        read: false,
        type: 'password_reset'
      };
      return [notif, ...prev];
    });

    setPasswordState({ current: '', new: '', confirm: '' });
    setTimeout(() => setProfileSuccess(false), 2000);
  };

  // Quiz Results simulation (persisted on disk)
  const [quizAttempts, setQuizAttempts] = useState<any[]>(() => {
    const defaultQuizzes = [
      { id: 'q1', courseTitle: 'Java Full Stack Academy', quizName: 'OOP Principles Master Check', score: 90, date: '2026-05-12' },
      { id: 'q2', courseTitle: 'Data Science & Visual Analytics', quizName: 'PostgreSQL Normalization Indexing', score: 80, date: '2026-05-24' }
    ];
    try {
      const saved = readPlatformCache(`skillfort_quizzes_${currentUser.id}`, null);
      return parsePlatformValue(saved, defaultQuizzes);
    } catch {
      return defaultQuizzes;
    }
  });

  const handleAddQuizResult = (courseTitle: string, quizName: string, score: number) => {
    const attempt = {
      id: `quiz-${Date.now()}`,
      courseTitle,
      quizName,
      score,
      date: new Date().toISOString().split('T')[0]
    };
    setQuizAttempts(prev => {
      const next = [attempt, ...prev];
      void setPlatformValue(`skillfort_quizzes_${currentUser.id}`, next);
      return next;
    });
  };

  // Notifications (alerts only)
  const [notifications, setNotifications] = useState<any[]>([]);

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  // Synchronize dynamic correspondence (receipts, payment status, passwords, welcomes)
  useEffect(() => {
    // 1. Compile system alerts dynamically from LMS state
    const baseAlerts = [
      { id: 'ann-1', title: 'Placement Drive Alert', message: 'TCS is hosting an off-campus enrollment interview on June 15 for Java graduates.', date: '2026-06-07', read: false, type: 'announcement' },
      { id: 'ann-2', title: 'Curriculum Enhanced', message: 'AWS Cloud Architectures modules has been upgraded to include Serverless Lambdas.', date: '2026-06-05', read: true, type: 'announcement' }
    ];

    // Welcome Alert Card
    const isNewStudent = enrollments.length === 0;
    const welcomeAlert = {
      id: 'welcome-alert',
      title: `👋 Academic Profile Generated: Welcome, ${currentUser.name}!`,
      message: `Dear student, we have successfully allocated sandbox server nodes for your email: ${currentUser.email}. Select a curriculum in the library and start parsing live modules.`,
      date: currentUser.createdAt ? currentUser.createdAt.split('T')[0] : '2026-06-10',
      read: false,
      type: 'welcome'
    };

    const finalAlerts = [...baseAlerts];
    if (isNewStudent) {
      finalAlerts.unshift(welcomeAlert);
    }

    // Dynamic Certificates Issued Alerts
    const certAlerts = certificates
      .filter(c => c.userId === currentUser.id)
      .map(c => ({
        id: `cert-alert-${c.id}`,
        title: `🏆 Verifiable Certificate Issued!`,
        message: `Spectacular work! A verifiable, audit-ready credential has been generated under verification hex: ${c.certificateNumber} for graduating from "${c.courseTitle}".`,
        date: c.issueDate || '2026-06-10',
        read: false,
        type: 'certificate'
      }));
    
    // Dynamic Course Module Unlocks
    const unlockedAlerts: any[] = [];
    enrollments.forEach(enroll => {
      const course = courses.find(c => c.id === enroll.courseId);
      if (!course) return;
      
      const courseModules = modules.filter(m => m.courseId === course.id).sort((a, b) => a.order - b.order);
      courseModules.forEach((mod, idx) => {
        if (idx === 0) {
          unlockedAlerts.push({
            id: `mod-unlock-first-${mod.id}`,
            title: `🔓 Module Unlocked - ${course.title}`,
            message: `Unit Active! Module "${mod.title}" has been successfully unlocked and is ready for study.`,
            date: enroll.enrolledAt ? enroll.enrolledAt.split('T')[0] : '2026-06-10',
            read: true,
            type: 'module_unlock'
          });
          return;
        }

        // Check if prior module is completely learned
        const priorMod = courseModules[idx - 1];
        const priorLessons = lessons.filter(l => l.moduleId === priorMod.id);
        if (priorLessons.length > 0) {
          const completedCount = priorLessons.filter(les => {
            return currentCourseProgress.some(prog => prog.lessonId === les.id && prog.isCompleted) ||
                   readPlatformCache(`skillfort_progress_${currentUser.id}_${les.id}`, null) === 'completed';
          }).length;

          if (completedCount === priorLessons.length) {
            unlockedAlerts.push({
              id: `mod-unlock-${mod.id}`,
              title: `🔓 LMS Auto-Unlock: Module Open!`,
              message: `Prior unit requirements satisfied! Module "${mod.title}" in course "${course.title}" is now active.`,
              date: new Date().toISOString().split('T')[0],
              read: false,
              type: 'module_unlock'
            });
          }
        }
      });
    });

    const mergedNotifications = [...certAlerts, ...unlockedAlerts, ...finalAlerts];
    setNotifications((prev) => {
      const readMap = new Map<string, boolean>();
      prev.forEach((p) => readMap.set(p.id, p.read));
      const next = mergedNotifications.map((n) => ({
        ...n,
        read: readMap.has(n.id) ? readMap.get(n.id)! : n.read,
      }));
      if (
        prev.length === next.length &&
        prev.every(
          (p, i) =>
            p.id === next[i].id &&
            p.read === next[i].read &&
            p.title === next[i].title &&
            p.message === next[i].message
        )
      ) {
        return prev;
      }
      return next;
    });
  }, [certificates, enrollments, lessons, modules, courses, currentUser.id, currentUser.name, currentUser.email, currentUser.createdAt, currentCourseProgress]);

  // Player state control
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayNext, setAutoplayNext] = useState(false);
  const [watchTime, setWatchTime] = useState(0); 
  const [playbackPosition, setPlaybackPosition] = useState(0); // in seconds
  const [playerDuration, setPlayerDuration] = useState(600); // 10 minutes fallback
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutItems, setCheckoutItems] = useState<Course[]>([]);

  // Open checkout when returning from public course page (?buy=courseId)
  useEffect(() => {
    const buyId = searchParams.get('buy') || consumePendingCheckout();
    if (!buyId) return;
    if (enrollments.some((e) => e.courseId === buyId)) {
      if (searchParams.get('buy')) {
        setSearchParams({}, { replace: true });
      }
      showToast('You are already enrolled in this course.', 'info');
      return;
    }
    const course = courses.find((c) => c.id === buyId);
    if (course) {
      setCheckoutItems([course]);
      setCheckoutOpen(true);
      if (searchParams.get('buy')) {
        navigate(studentPath('dashboard'), { replace: true });
      }
    }
  }, [searchParams, courses, enrollments, navigate, setSearchParams, showToast]);

  const openCheckout = (items: Course[]) => {
    if (items.length === 0) return;
    setCheckoutItems(items);
    setCheckoutOpen(true);
  };

  // Open checkout after guest cart login (?checkout=1 on cart page)
  useEffect(() => {
    if (searchParams.get('checkout') !== '1') return;
    if (cartItems.length === 0) return;
    setActiveMenu('cart');
    openCheckout(cartItems);
    setSearchParams({}, { replace: true });
  }, [searchParams, cartItems, setSearchParams]);

  const handleAddCourseToCart = async (courseId: string) => {
    try {
      await onAddToCart(courseId);
      showToast('Course added to your cart.', 'success');
    } catch (e: any) {
      showToast(e.message || 'Could not add to cart', 'error');
    }
  };

  const handleEnrollOrBuy = async (course: Course) => {
    if (course.price <= 0) {
      try {
        const resp = await apiFetch('/api/enrollments/free', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId: course.id }),
        });
        const data = await resp.json();
        if (resp.status === 409) {
          showToast('You are already enrolled in this course.', 'info');
          openCoursePlayer(course);
          return;
        }
        if (!resp.ok) {
          throw new Error(data.error || 'Enrollment failed');
        }
        showToast('Enrolled successfully! Start learning now.', 'success');
        await onRefreshData();
        openCoursePlayer(course);
      } catch (e: any) {
        showToast(e.message || 'Could not enroll', 'error');
      }
      return;
    }
    openCheckout([course]);
  };

  const handleBuyNow = (course: Course) => {
    void handleEnrollOrBuy(course);
  };

  // Profile fields
  const [profileName, setProfileName] = useState(currentUser.name);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Q&A discussion board persistent local states
  const [qaThreads, setQaThreads] = useState<any[]>([]);
  const [newQuestionTitle, setNewQuestionTitle] = useState('');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [newReplyText, setNewReplyText] = useState('');

  // Dynamic Academic Quiz states
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<{ [qId: string]: number }>({});
  const [quizTimer, setQuizTimer] = useState<number>(0);
  const activeLessonIdRef = useRef<string | null>(null);
  const quizSessionRef = useRef<
    Record<string, { started: boolean; submitted: boolean; score: number | null }>
  >({});

  // Auto-Save Interval Ref & Vimeo Player refs
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const vimeoIframeRef = useRef<HTMLIFrameElement | null>(null);
  const vimeoPlayerInstRef = useRef<Player | null>(null);
  const hasSyncedInitialSeek = useRef<string | null>(null);

  // Keep references to current state so that callback closures can access them instantly
  const playbackPositionRef = useRef(playbackPosition);
  const playerDurationRef = useRef(playerDuration);
  const activeLessonRef = useRef(activeLesson);
  const triggerAutoSaveRef = useRef<any>(null);

  useEffect(() => {
    playbackPositionRef.current = playbackPosition;
  }, [playbackPosition]);

  useEffect(() => {
    playerDurationRef.current = playerDuration;
  }, [playerDuration]);

  useEffect(() => {
    activeLessonRef.current = activeLesson;
  }, [activeLesson]);

  // Update state or trigger autosave
  useEffect(() => {
    if (activeLesson && isPlaying) {
      let tracker: NodeJS.Timeout | null = null;
      
      // Only set up manual ticking tracker if there is no real Vimeo Video ID
      if (!activeLesson.vimeoId) {
        tracker = setInterval(() => {
          setPlaybackPosition(prev => {
            const next = prev + 1;
            return next >= playerDuration ? playerDuration : next;
          });
          setWatchTime(prev => prev + 1);
        }, 1000);
      }

      // System tick save every 10 seconds
      autoSaveTimerRef.current = setInterval(() => {
        if (triggerAutoSaveRef.current) {
          triggerAutoSaveRef.current();
        }
      }, 10000);

      return () => {
        if (tracker) clearInterval(tracker);
        if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
      };
    }
  }, [activeLesson?.id, isPlaying, activeLesson?.vimeoId, playerDuration]);

  // Vimeo SDK integration with complete event sync
  useEffect(() => {
    if (activeLesson && activeLesson.type === 'video' && activeLesson.vimeoId && vimeoIframeRef.current) {
      const activeLessonIdAtInit = activeLesson.id;
      
      // Create fresh player instance
      const player = new Player(vimeoIframeRef.current);
      vimeoPlayerInstRef.current = player;

      player.getDuration().then((dur) => {
        if (activeLessonRef.current?.id === activeLessonIdAtInit) {
          setPlayerDuration(dur || 600);
          playerDurationRef.current = dur || 600;
          if (autoplayNext) {
            player.play().catch(e => console.debug("error trying auto playing:", e));
          }
        }
      }).catch(err => console.debug("error getting duration: ", err));

      player.on('play', () => {
        if (activeLessonRef.current?.id === activeLessonIdAtInit) {
          setIsPlaying(true);
          setAutoplayNext(false);
        }
      });

      player.on('pause', () => {
        if (activeLessonRef.current?.id === activeLessonIdAtInit) {
          setIsPlaying(false);
          // Persist progress immediately on pause
          if (triggerAutoSaveRef.current) {
            triggerAutoSaveRef.current(false, playbackPositionRef.current);
          }
        }
      });

      player.on('timeupdate', (data: any) => {
        if (activeLessonRef.current?.id === activeLessonIdAtInit) {
          const seconds = Math.floor(data.seconds);
          setPlaybackPosition(seconds);
          playbackPositionRef.current = seconds;
          const duration = Math.floor(data.duration || 600);
          setPlayerDuration(duration);
          playerDurationRef.current = duration;
        }
      });

      player.on('ended', () => {
        if (activeLessonRef.current?.id === activeLessonIdAtInit) {
          setIsPlaying(false);
          if (triggerAutoSaveRef.current) {
            triggerAutoSaveRef.current(true);
          }
        }
      });

      return () => {
        player.off('play');
        player.off('pause');
        player.off('timeupdate');
        player.off('ended');
        vimeoPlayerInstRef.current = null;
      };
    }
  }, [activeLesson?.id, activeLesson?.vimeoId, vimeoIframeRef.current, autoplayNext]);

  // Synchronize resume position of the fresh lesson inside vimeo (one-shot sync)
  useEffect(() => {
    if (activeLesson) {
      hasSyncedInitialSeek.current = null;
    }
  }, [activeLesson?.id]);

  useEffect(() => {
    if (
      vimeoPlayerInstRef.current && 
      activeLesson && 
      activeLesson.type === 'video' && 
      playbackPosition > 0 && 
      hasSyncedInitialSeek.current !== activeLesson.id
    ) {
      hasSyncedInitialSeek.current = activeLesson.id;
      vimeoPlayerInstRef.current.setCurrentTime(playbackPosition).catch(e => {
        console.debug("Failed seeking vimeo to default resumed position: ", e);
      });
    }
  }, [playbackPosition, activeLesson?.id]);

  // Load last watch position when switching lessons (by lesson id only — avoids reset on data refresh)
  useEffect(() => {
    if (!activeLesson) {
      activeLessonIdRef.current = null;
      return;
    }

    const lessonId = activeLesson.id;
    const lessonChanged = activeLessonIdRef.current !== lessonId;
    activeLessonIdRef.current = lessonId;

    if (lessonChanged) {
      setPlaybackPosition(0);
      playbackPositionRef.current = 0;
      setPlayerDuration(600);
      playerDurationRef.current = 600;
      setWatchTime(0);
      setIsPlaying(false);

      const savedQuiz = quizSessionRef.current[lessonId];
      const completedInProgress = currentCourseProgress.some(
        (p) => p.lessonId === lessonId && p.isCompleted
      );

      if (savedQuiz?.submitted) {
        setQuizStarted(savedQuiz.started);
        setQuizSubmitted(true);
        setQuizScore(savedQuiz.score);
        setQuizAnswers({});
      } else if (activeLesson.type === 'quiz' && completedInProgress) {
        setQuizStarted(true);
        setQuizSubmitted(true);
        setQuizScore(100);
        setQuizAnswers({});
      } else {
        setQuizStarted(false);
        setQuizSubmitted(false);
        setQuizScore(null);
        setQuizAnswers({});
      }
      setQuizTimer(0);
    }

    const currentCourseId = modules.find((m) => m.id === activeLesson.moduleId)?.courseId;
    if (currentCourseId && activeLesson.type === 'video') {
      apiFetch(`/api/progress/${currentUser.id}/${currentCourseId}`)
        .then((res) => res.json())
        .then((data) => {
          const match = data.find((p: any) => p.lessonId === lessonId);
          if (activeLessonRef.current?.id !== lessonId) return;
          if (match) {
            setPlaybackPosition(match.currentTimestamp || 0);
            playbackPositionRef.current = match.currentTimestamp || 0;
          } else {
            setPlaybackPosition(0);
            playbackPositionRef.current = 0;
          }
        })
        .catch(() => {
          if (activeLessonRef.current?.id === lessonId) {
            setPlaybackPosition(0);
            playbackPositionRef.current = 0;
          }
        });
    }
  }, [activeLesson?.id, activeLesson?.type, activeLesson?.moduleId, currentUser.id, modules]);

  // Keep quiz results visible after progress sync (e.g. post-completion refresh)
  useEffect(() => {
    if (!activeLesson || activeLesson.type !== 'quiz') return;
    const completed = currentCourseProgress.some(
      (p) => p.lessonId === activeLesson.id && p.isCompleted
    );
    if (!completed) return;

    const saved = quizSessionRef.current[activeLesson.id];
    if (!quizSubmitted) {
      setQuizSubmitted(true);
      setQuizStarted(true);
      setQuizScore(saved?.score ?? 100);
    }
  }, [currentCourseProgress, activeLesson?.id, activeLesson?.type, quizSubmitted]);

  // Load and sync course Q&A board discussion threads
  useEffect(() => {
    if (selectedCourse) {
      // Sync dynamic lesson progress stats matching this student
      apiFetch(`/api/progress/${currentUser.id}/${selectedCourse.id}`)
        .then(res => res.json())
        .then(data => setCurrentCourseProgress(data || []))
        .catch(err => console.error("Progress fetch error: ", err));

      try {
        const key = `skillfort_qa_threads_${selectedCourse.id}`;
        const saved = readPlatformCache(key, null);
        if (saved) {
          setQaThreads(parsePlatformValue(saved, []));
        } else {
          // default placeholder questions to enrich classroom testing
          const defaultThreads = [
            {
              id: `qa-1-${selectedCourse.id}`,
              title: "Recommendation on external playground environments?",
              text: "Hi support and classmates, do we need to install PostgreSQL locally for the database normalization lab, or is the browser client terminal sufficient?",
              authorName: "Ananya Misra",
              authorRole: "student",
              timestamp: "2026-06-06 14:15",
              replies: [
                {
                  id: "rep-1",
                  text: "You can absolutely use our browser terminal sandbox! All configurations are pre-wired. Installing pgAdmin locally is optional but useful for backup.",
                  authorName: "Prof. Rajesh Kumar",
                  authorRole: "instructor",
                  timestamp: "2026-06-06 15:30"
                }
              ]
            },
            {
              id: `qa-2-${selectedCourse.id}`,
              title: "Stuck on the week 2 quiz assessment",
              text: "Are we going to receive retry credits if we miss the passing mark code of 80% on standard assessments? Please advise on placement rules.",
              authorName: "Karthik Raja",
              authorRole: "student",
              timestamp: "2026-06-05 09:12",
              replies: [
                {
                  id: "rep-2",
                  text: "Yes Karthik! Students can re-attempt quizzes as many times as needed to reinforce concepts before placement alignment audits.",
                  authorName: "Ms. Sunita Sharma",
                  authorRole: "instructor",
                  timestamp: "2026-06-05 10:45"
                }
              ]
            }
          ];
          setQaThreads(defaultThreads);
          void setPlatformValue(key, defaultThreads);
        }
      } catch (e) {
        setQaThreads([]);
      }
    } else {
      setQaThreads([]);
    }
    setSelectedThreadId(null);
  }, [selectedCourse]);

  const pauseProtectedContent = () => {
    setIsPlaying(false);
    vimeoPlayerInstRef.current?.pause().catch(() => undefined);
  };

  const isContentProtectionActive = Boolean(
    selectedCourse &&
      activeLesson &&
      (activeLesson.type === 'video' || activeLesson.type === 'quiz')
  );

  const contentWatermark = `${currentUser.name} • ${currentUser.email}`;

  useEffect(() => {
    if (!checkoutOpen) {
      setCheckoutItems([]);
    }
  }, [checkoutOpen]);

  // Profile fields duplicate removed - keep Q&A below

  // Auto-select first lesson when a course is loaded and has lessons
  useEffect(() => {
    if (selectedCourse && !activeLesson) {
      const courseModules = modules.filter(m => m.courseId === selectedCourse.id).sort((a, b) => a.order - b.order);
      if (courseModules.length > 0) {
        const firstModuleLessons = lessons.filter(l => l.moduleId === courseModules[0].id).sort((a, b) => a.order - b.order);
        if (firstModuleLessons.length > 0) {
          setActiveLesson(firstModuleLessons[0]);
        }
      }
    }
  }, [selectedCourse, modules, lessons]);

  const handleCreateQaThread = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !newQuestionTitle.trim() || !newQuestionText.trim()) return;

    const newThread = {
      id: `qa-${Date.now()}`,
      title: newQuestionTitle.trim(),
      text: newQuestionText.trim(),
      authorName: currentUser.name,
      authorRole: currentUser.role,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      replies: []
    };

    const updated = [newThread, ...qaThreads];
    setQaThreads(updated);
    void setPlatformValue(`skillfort_qa_threads_${selectedCourse.id}`, updated);
    setNewQuestionTitle('');
    setNewQuestionText('');
    showToast('Your question was posted to the course forum.', 'success');
  };

  const handleCreateReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !selectedThreadId || !newReplyText.trim()) return;

    const newReply = {
      id: `rep-${Date.now()}`,
      text: newReplyText.trim(),
      authorName: currentUser.name,
      authorRole: currentUser.role,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    const updated = qaThreads.map(thread => {
      if (thread.id === selectedThreadId) {
        return {
          ...thread,
          replies: [...thread.replies, newReply]
        };
      }
      return thread;
    });

    setQaThreads(updated);
    void setPlatformValue(`skillfort_qa_threads_${selectedCourse.id}`, updated);
    setNewReplyText('');
  };

  const triggerAutoSave = async (
    forceCompleted = false,
    overridePosition?: number
  ): Promise<Certificate | null> => {
    const curLesson = activeLessonRef.current || activeLesson;
    if (!curLesson) return null;
    setSavingStatus('saving');
    
    const currentCourseId = modules.find(m => m.id === curLesson.moduleId)?.courseId;
    if (!currentCourseId) return null;

    const pos = overridePosition !== undefined ? overridePosition : playbackPositionRef.current;
    const dur = playerDurationRef.current || playerDuration;

    // Double-safe completion check client-side
    const alreadyCompleted = currentCourseProgress.some(p => p.lessonId === curLesson.id && p.isCompleted);
    const isThisLessonVideo = curLesson.type === 'video';
    const isThisLessonCompletedNow = alreadyCompleted || forceCompleted || (
      isThisLessonVideo 
        ? (pos >= dur - 10 && dur > 15 && pos > 15) 
        : (pos >= dur - 10)
    );

    try {
      const resp = await apiFetch('/api/progress/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          courseId: currentCourseId,
          lessonId: curLesson.id,
          currentTimestamp: pos,
          watchDuration: 10, // simulated increase
          isCompleted: isThisLessonCompletedNow
        })
      });
      const resData = await resp.json();
      
      setSavingStatus('saved');
      setTimeout(() => setSavingStatus('idle'), 2000);

      const issuedCert = (resData.certificateCreated as Certificate | null) ?? null;
      const deferParentRefresh = forceCompleted && curLesson.type === 'quiz';

      // Update progress without triggering a full parent refresh during quiz completion flow
      const progResp = await apiFetch(`/api/progress/${currentUser.id}/${currentCourseId}`);
      let updatedProgressList: LessonProgress[] = [];
      if (progResp.ok) {
        const progData = await progResp.json();
        updatedProgressList = progData || [];
        setCurrentCourseProgress(updatedProgressList);
      }

      if (!deferParentRefresh) {
        await onRefreshData();
      }

      // Automatically move to the next lesson or direct to quiz
      if (isThisLessonVideo && isThisLessonCompletedNow) {
        // Resolve all lessons of the current course in unified order sequence
        const courseModules = modules.filter(m => m.courseId === currentCourseId).sort((a, b) => a.order - b.order);
        const mIds = courseModules.map(m => m.id);
        const courseLessons = lessons.filter(l => mIds.includes(l.moduleId)).sort((a, b) => {
          const m1 = courseModules.find(m => m.id === a.moduleId);
          const m2 = courseModules.find(m => m.id === b.moduleId);
          if (!m1 || !m2) return 0;
          if (m1.order !== m2.order) {
            return m1.order - m2.order;
          }
          return a.order - b.order;
        });

        const curLessonIdx = courseLessons.findIndex(l => l.id === curLesson.id);
        const videoLessonsInCourse = courseLessons.filter(l => l.type === 'video');

        // Check if all videos are completed
        const completedLessonIds = new Set<string>();
        updatedProgressList.forEach(p => {
          if (p.isCompleted) {
            completedLessonIds.add(p.lessonId);
          }
        });
        if (isThisLessonCompletedNow) {
          completedLessonIds.add(curLesson.id);
        }

        const allVideosCompleted = videoLessonsInCourse.every(vl => completedLessonIds.has(vl.id));
        const quizLesson = courseLessons.find(l => l.type === 'quiz');

        if (allVideosCompleted && quizLesson) {
          // Direct student immediately to the unified final quiz lesson
          if (activeLesson?.id !== quizLesson.id) {
            setActiveLesson(quizLesson);
            showToast('All video lessons complete. Opening the final quiz assessment.', 'info');
          }
        } else if (curLessonIdx !== -1 && curLessonIdx < courseLessons.length - 1) {
          // Progress directly to the next lesson in sequence
          const nextLesson = courseLessons[curLessonIdx + 1];
          setAutoplayNext(true); // Enable automatic play for the next video!
          setActiveLesson(nextLesson);
        }
      }

      return issuedCert;
    } catch (e) {
      console.error("Auto-Save error:", e);
      setSavingStatus('idle');
      return null;
    }
  };

  useEffect(() => {
    triggerAutoSaveRef.current = triggerAutoSave;
  }, [triggerAutoSave]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(false);
    try {
      const resp = await apiFetch(`/api/auth/profile-update/${currentUser.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileName })
      });
      if (resp.ok) {
        setProfileSuccess(true);
        setTimeout(() => setProfileSuccess(false), 3000);
        await onRefreshData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Syllabus compilation helpers
  const getQuizQuestions = (les: Lesson) => {
    return les.questions && les.questions.length > 0 ? les.questions : [];
  };

  const handleQuizSubmit = async (questionsList: any[], passMarkNum: number) => {
    let correctCount = 0;
    
    questionsList.forEach((q) => {
      const selectedAnsIdx = quizAnswers[q.id];
      if (selectedAnsIdx !== undefined) {
        const options = q.answers && q.answers.length > 0 ? q.answers : [
          { text: q.optA || "Option A", isCorrect: q.correct === 'A' },
          { text: q.optB || "Option B", isCorrect: q.correct === 'B' },
          { text: q.optC || "Option C", isCorrect: q.correct === 'C' },
          { text: q.optD || "Option D", isCorrect: q.correct === 'D' }
        ];
        const ans = options[selectedAnsIdx];
        if (ans && ans.isCorrect) {
          correctCount++;
        }
      }
    });

    const score = questionsList.length > 0 ? Math.round((correctCount / questionsList.length) * 100) : 100;
    setQuizScore(score);
    setQuizSubmitted(true);
    setQuizStarted(true);

    if (activeLesson) {
      quizSessionRef.current[activeLesson.id] = {
        started: true,
        submitted: true,
        score,
      };
    }

    if (score >= passMarkNum && selectedCourse) {
      completionFlowActiveRef.current = true;
      handleAddQuizResult(selectedCourse.title, activeLesson?.title || 'Academic Assessment', score);
      const courseId = modules.find((m) => m.id === activeLesson?.moduleId)?.courseId;
      const issuedCert = await triggerAutoSave(true);
      if (courseId) {
        await revealCompletionCelebration(courseId, issuedCert);
      }
    }
  };

  const renderQuizPlayer = () => {
    if (!activeLesson) return null;
    const questionsList = getQuizQuestions(activeLesson);
    const passMarkNum = Number(activeLesson.passMark) || 80;
    const limitMins = activeLesson.timeLimit || '15';

    if (questionsList.length === 0) {
      return (
        <div className="w-full flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0a0a0a] min-h-[400px]">
          <AlertCircle size={40} className="text-[#F89A15] mb-4" />
          <h3 className="font-display font-black text-lg text-white uppercase">Quiz not configured</h3>
          <p className="text-xs text-gray-400 max-w-sm mt-2">
            This assessment has no questions yet. Please contact your instructor or check back later.
          </p>
        </div>
      );
    }

    if (quizSubmitted) {
      const isPassed = (quizScore ?? 0) >= passMarkNum;
      return (
        <div className="w-full flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0a0a0a] min-h-[400px]">
          <div className="max-w-md w-full space-y-6">
            <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${isPassed ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/30 text-rose-400 animate-pulse'}`}>
              {isPassed ? <Award size={48} className="text-emerald-400 animate-bounce" /> : <AlertCircle size={48} className="text-rose-400" />}
            </div>
            
            <div className="space-y-2">
              <h3 className="font-display font-black text-xl text-white uppercase tracking-wider">
                {isPassed ? 'Exceeded Academic Merit!' : 'Re-evaluation Required'}
              </h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                {isPassed 
                  ? 'Congratulations! You have demonstrated absolute clarity of concepts in this academic milestone.' 
                  : 'You did not acquire the target passing grade. Re-assess the curriculum lectures and challenge again.'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-black/55 border border-[#222222] font-mono space-y-2 max-w-xs mx-auto">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Pass Threshold:</span>
                <span className="text-neutral-900 dark:text-white font-bold">{passMarkNum}%</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Acquired Score:</span>
                <span className={`font-black ${isPassed ? 'text-emerald-400' : 'text-rose-400'}`}>{quizScore}%</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Status:</span>
                <span className={`font-bold ${isPassed ? 'text-emerald-400' : 'text-rose-400'}`}>{isPassed ? 'PASSED & COMPLETED' : 'FAILED'}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 w-full">
              {isPassed ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const resp = await apiFetch(`/api/certificates/${currentUser.id}`);
                        if (resp.ok) {
                          const all = (await resp.json()) as Certificate[];
                          const finalCert = all.find((c) => c.courseId === selectedCourse.id);
                          if (finalCert) {
                            downloadCertificateLocally(finalCert);
                            return;
                          }
                        }
                        showToast(
                          'Certificate not found yet. Complete all lessons and pass the quiz, then try again.',
                          'info'
                        );
                      } catch {
                        showToast('Could not load your certificate. Try again from the Certificates tab.', 'error');
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-[12px] uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md"
                  >
                    <Download size={14} /> Download Certificate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRefreshData();
                    }}
                    className="px-5 py-2.5 bg-[#F89A15] hover:bg-white text-black font-extrabold text-[12px] uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md"
                  >
                    Close & Sync ✓
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (activeLesson) {
                      delete quizSessionRef.current[activeLesson.id];
                    }
                    setQuizStarted(true);
                    setQuizSubmitted(false);
                    setQuizAnswers({});
                    setQuizScore(null);
                  }}
                  className="px-6 py-2.5 bg-rose-500 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl hover:bg-rose-400 transition-all cursor-pointer shadow-md"
                >
                  🔄 Retry Assessment Exam
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (!quizStarted) {
      return (
        <div className="w-full flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0a0a0a] min-h-[400px]">
          <div className="max-w-md w-full space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-[#F89A15]/10 border border-[#F89A15]/20 flex items-center justify-center text-[#F89A15] mx-auto animate-pulse">
              <BookOpen size={32} />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-widest text-[#F89A15] block">Section Milestone Assessment</span>
              <h3 className="font-display font-black text-lg text-white uppercase">{activeLesson.title}</h3>
              <p className="text-[11px] text-gray-500 max-w-xs mx-auto">Solve the questions accurately to verify understanding & auto-generate verified compliance credentials.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto text-left font-mono text-[10px] text-gray-400 bg-black/45 p-4 rounded-xl border border-[#222222]">
              <div>
                <span className="block text-gray-500 text-[8px] uppercase">Pass Barrier</span>
                <span className="text-neutral-900 dark:text-white font-bold">{passMarkNum}% correct answers</span>
              </div>
              <div>
                <span className="block text-gray-500 text-[8px] uppercase">Question Pool</span>
                <span className="text-neutral-900 dark:text-white font-bold">{questionsList.length} assessment items</span>
              </div>
              <div className="col-span-2 pt-2 border-t border-[#222222]/50">
                <span className="block text-gray-500 text-[8px] uppercase">Estimated Limit</span>
                <span className="text-neutral-900 dark:text-white font-bold">{limitMins} mins academic duration</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setQuizStarted(true);
                setQuizAnswers({});
              }}
              className="px-8 py-3 bg-[#F89A15] text-black font-extrabold text-xs uppercase tracking-widest rounded-xl hover:bg-neutral-800 hover:text-white transition-all cursor-pointer shadow-lg shadow-[#F89A15]/10"
            >
              Start Academic Assessment Challenge ⚡
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full flex-1 flex flex-col justify-between bg-[#111111] p-6 space-y-6 overflow-y-auto max-h-[500px]">
        {/* Header HUD with general timer */}
        <div className="flex justify-between items-center bg-[#111111] border-b border-[#222222] pb-3 -mx-6 px-6 -mt-6 pt-4 sticky top-0 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <HelpCircle size={14} className="text-[#F89A15]" />
            <span className="font-display text-xs font-black uppercase text-white tracking-wider truncate max-w-[200px]">{activeLesson.title}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-gray-400 shrink-0">
            <Clock size={12} className="text-[#F89A15]" />
            <span>Pass Threshold: {passMarkNum}%</span>
          </div>
        </div>

        {/* Question cards stack list representation or list */}
        <div className="flex-1 space-y-6">
          {questionsList.map((q, qIdx) => {
            const hasAnswersList = q.answers && q.answers.length > 0;
            const optionsToRender = hasAnswersList ? q.answers : [
              { text: (q as any).optA || "Option A", isCorrect: (q as any).correct === 'A' },
              { text: (q as any).optB || "Option B", isCorrect: (q as any).correct === 'B' },
              { text: (q as any).optC || "Option C", isCorrect: (q as any).correct === 'C' },
              { text: (q as any).optD || "Option D", isCorrect: (q as any).correct === 'D' }
            ].filter(opt => opt.text !== "Optional");

            return (
              <div key={q.id} className="p-5 bg-[#111111] border border-[#222222] rounded-2xl space-y-3 shadow-xs text-left">
                <div className="flex gap-2.5 items-start">
                  <span className="px-2 py-0.5 rounded bg-[#F89A15]/10 text-[#F89A15] border border-[#F89A15]/20 font-mono text-[9px] font-bold">ITEM {qIdx + 1}</span>
                  <p className="text-xs font-bold text-white leading-relaxed">{q.questionText}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                  {optionsToRender.map((ans, aIdx) => {
                    const isSelected = quizAnswers[q.id] === aIdx;
                    return (
                      <button
                        key={aIdx}
                        type="button"
                        onClick={() => {
                          setQuizAnswers(prev => ({ ...prev, [q.id]: aIdx }));
                        }}
                        className={`p-3 text-left rounded-xl border text-xs transition-all flex items-center justify-between cursor-pointer ${
                          isSelected 
                            ? 'bg-[#F89A15]/10 border-[#F89A15] text-[#F89A15] font-extrabold focus:ring-1 focus:ring-[#F89A15]' 
                            : 'bg-[#0a0a0a]/60 border-neutral-800 hover:border-[#F89A15]/40 text-gray-300'
                        }`}
                      >
                        <span className="line-clamp-2 max-w-[90%]">{ans.text}</span>
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-[#F89A15] bg-[#F89A15]' : 'border-neutral-700'}`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black"></div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer controls */}
        <div className="bg-[#111111] border-t border-[#222222] pt-4 -mx-6 px-6 pb-2 sticky bottom-0 backdrop-blur-md">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-gray-500 font-mono">
              Answered: {Object.keys(quizAnswers).length} / {questionsList.length} items
            </span>
            <button
              type="button"
              disabled={Object.keys(quizAnswers).length === 0}
              onClick={() => handleQuizSubmit(questionsList, passMarkNum)}
              className="px-6 py-2 bg-emerald-500 text-black font-extrabold text-[11px] uppercase tracking-wider rounded-lg hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Submit Academic Assessment ✓
            </button>
          </div>
        </div>
      </div>
    );
  };

  const getCourseModules = (courseId: string) => modules.filter(m => m.courseId === courseId).sort((a,b) => a.order - b.order);
  const getModuleLessons = (mId: string) => lessons.filter(l => l.moduleId === mId).sort((a,b) => a.order - b.order);

  const handleMenuClick = (menu: StudentMenu) => {
    if (activeLessonRef.current) {
      triggerAutoSave(false, playbackPositionRef.current);
    }
    navigate(studentPath(menu));
    setMobileNavOpen(false);
  };

  // Active student stats calculation
  const getCourseLessonStats = (courseId: string) => {
    const courseModules = modules.filter((m) => m.courseId === courseId);
    const moduleIds = courseModules.map((m) => m.id);
    const total = lessons.filter((l) => moduleIds.includes(l.moduleId)).length;
    const enrollment = enrollments.find((e) => e.courseId === courseId);
    const percent = enrollment?.progressPercentage || 0;
    const completed = total > 0 ? Math.round((percent / 100) * total) : 0;
    return {
      total,
      completed,
      remaining: Math.max(0, total - completed),
      percent,
      isComplete: percent >= 100,
    };
  };

  const enrolledCourses = courses.filter(c => enrollments.some(e => e.courseId === c.id));
  const selectedEnrollment = selectedCourse
    ? enrollments.find((e) => e.courseId === selectedCourse.id)
    : undefined;
  const isSelectedCourseExpired = selectedEnrollment
    ? isEnrollmentExpired(selectedEnrollment)
    : false;

  useEffect(() => {
    if (enrolledCourses.length === 0) {
      setContinueTargets([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const resp = await apiFetch(`/api/students/continue/${currentUser.id}`);
        if (!resp.ok || cancelled) return;
        const data = (await resp.json()) as ContinueTarget[];
        if (!cancelled) setContinueTargets(data);
      } catch {
        // ignore offline failures on dashboard widget
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser.id, enrollments, enrolledCourses.length]);

  const sideNavBtn = (menu: StudentMenu) =>
    `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[11px] font-bold tracking-wider transition-all uppercase ${
      activeMenu === menu
        ? isDarkMode
          ? 'bg-[#111111] text-[#F89A15] border border-[#222222]'
          : 'bg-amber-50 text-[#F89A15] border border-amber-200'
        : isDarkMode
          ? 'text-gray-400 hover:text-white'
          : 'text-slate-500 hover:text-slate-900'
    }`;

  return (
    <div className={`min-h-screen font-sans flex overflow-hidden ${isDarkMode ? 'bg-black text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* SIDEBAR NAVIGATION CONFIG */}
      <aside className={`w-64 border-r hidden lg:flex flex-col shrink-0 ${isDarkMode ? 'border-[#222222] bg-[#0A0A0A]' : 'border-slate-200 bg-white'}`}>
        <div className={`h-20 border-b flex items-center gap-3 px-4 shrink-0 overflow-hidden ${isDarkMode ? 'border-[#222222]' : 'border-slate-200'}`}>
          <SkillFortLogo className="scale-90 origin-left" />
        </div>

        <nav className="p-4 flex-1 space-y-1 overflow-y-auto">
          <button onClick={() => handleMenuClick('dashboard')} className={sideNavBtn('dashboard')}>
            <Settings size={14} /> Dashboard
          </button>

          <button onClick={() => handleMenuClick('courses')} className={sideNavBtn('courses')}>
            <BookOpen size={14} /> Our Courses
          </button>
          
          <button onClick={() => handleMenuClick('my-courses')} className={sideNavBtn('my-courses')}>
            <BookOpen size={14} /> My Courses
          </button>

          <button onClick={() => handleMenuClick('cart')} className={sideNavBtn('cart')}>
            <ShoppingCart size={14} /> Cart
            {cartCount > 0 && (
              <span className="ml-auto bg-[#F89A15] text-black font-mono text-[9px] px-1.5 py-0.5 rounded-full font-black">
                {cartCount}
              </span>
            )}
          </button>

          <button onClick={() => handleMenuClick('orders')} className={sideNavBtn('orders')}>
            <Receipt size={14} /> My Orders
          </button>

          <button onClick={() => handleMenuClick('profile')} className={sideNavBtn('profile')}>
            <UserIcon size={14} /> My Profile
          </button>

          <button onClick={() => handleMenuClick('certificates')} className={sideNavBtn('certificates')}>
            <Award size={14} /> Certificates
          </button>

          <button onClick={() => handleMenuClick('quiz-results')} className={sideNavBtn('quiz-results')}>
            <CheckSquare size={14} /> Quiz Results
          </button>

          <button onClick={() => handleMenuClick('notifications')} className={sideNavBtn('notifications')}>
            <Bell size={14} /> Alerts
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="ml-auto bg-red-500 text-white font-mono text-[9px] px-1.5 py-0.5 rounded-full font-black">
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </button>
        </nav>

        <div className={`p-4 border-t space-y-3 ${isDarkMode ? 'border-[#222222] bg-[#0A0A0A]/50' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center gap-2.5">
            <img 
              src={profilePhoto} 
              className={`w-8 h-8 rounded-full border object-cover shrink-0 ${isDarkMode ? 'border-[#222222]' : 'border-slate-200'}`}
              alt="Avatar" 
            />
            <div className="min-w-0">
              <p className={`text-[11px] font-bold truncate max-w-[130px] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{currentUser.name}</p>
              <p className="text-[9px] text-[#F89A15] font-mono leading-none">#{currentUser.role.toUpperCase()}</p>
            </div>
          </div>
          
          <button 
            onClick={onToggleDarkMode}
            className="w-full py-1.5 border border-gray-200 dark:border-[#222222] hover:border-[#F89A15]/40 rounded-lg text-[9px] uppercase tracking-wider font-bold text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-[#F89A15] transition-all bg-gray-100 dark:bg-black/40 flex items-center justify-center gap-1.5 font-mono cursor-pointer"
          >
            {isDarkMode ? '☀️ Switch Light' : '🌙 Switch Dark'}
          </button>

          <button 
            onClick={onLogout}
            className={`w-full flex items-center justify-center gap-2 py-1.5 border rounded-lg text-[9px] uppercase tracking-wider font-bold transition-all cursor-pointer ${
              isDarkMode
                ? 'border-[#222222] text-gray-400 hover:border-red-500 hover:text-red-400'
                : 'border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-500'
            }`}
          >
            <LogOut size={10} /> Logout
          </button>
        </div>
      </aside>

      {/* PORTAL MAIN CONTENT SCROLLER VIEW */}
      <main className={`flex-1 min-w-0 overflow-y-auto p-4 md:p-12 space-y-8 flex flex-col justify-between ${isDarkMode ? 'bg-black' : 'bg-slate-50'}`}>
        
        {/* Mobile header */}
        <div className={`flex lg:hidden sticky top-0 z-30 -mx-4 px-4 py-3 mb-2 items-center justify-between gap-3 border-b backdrop-blur-sm ${isDarkMode ? 'border-[#222222] bg-black/95' : 'border-slate-200 bg-white/95'}`}>
          <SkillFortLogo />
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileNavOpen(true)}
            className={`rounded-lg border p-2.5 transition-colors ${isDarkMode ? 'border-[#222222] bg-[#111111] text-white hover:text-[#F89A15]' : 'border-slate-200 bg-white text-slate-800 hover:text-[#F89A15]'}`}
          >
            <Menu size={18} />
          </button>
        </div>

        <MobileNavSheet open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} title="Student Menu" isDarkMode={isDarkMode}>
          <div className="space-y-1">
            {([
              ['dashboard', 'Dashboard', Settings],
              ['courses', 'Our Courses', BookOpen],
              ['my-courses', 'My Courses', BookOpen],
              ['cart', 'Cart', ShoppingCart],
              ['orders', 'My Orders', Receipt],
              ['profile', 'My Profile', UserIcon],
              ['certificates', 'Certificates', Award],
              ['quiz-results', 'Quiz Results', CheckSquare],
              ['notifications', 'Alerts', Bell],
            ] as const).map(([menu, label, Icon]) => (
              <button
                key={menu}
                type="button"
                onClick={() => handleMenuClick(menu)}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold ${
                  activeMenu === menu
                    ? 'bg-[#F89A15]/15 text-[#F89A15] border border-[#F89A15]/40'
                    : isDarkMode ? 'text-gray-200 hover:bg-white/5' : 'text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Icon size={16} /> {label}
                {menu === 'cart' && cartCount > 0 && (
                  <span className="ml-auto rounded-full bg-[#F89A15] px-2 py-0.5 text-[10px] font-black text-black">{cartCount}</span>
                )}
                {menu === 'notifications' && notifications.filter(n => !n.read).length > 0 && (
                  <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
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
            <button type="button" onClick={() => { setMobileNavOpen(false); onLogout(); }} className="w-full rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-500">
              Logout
            </button>
          </div>
        </MobileNavSheet>

        <div>
          {/* COURSE PLAYER CORE MODULE */}
          {selectedCourse ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Back CTA Indicator */}
              <div className="lg:col-span-12">
                <button 
                  onClick={() => {
                    if (activeLessonRef.current || activeLesson) {
                      triggerAutoSave(false, playbackPositionRef.current);
                    }
                    navigate(studentPath('my-courses'));
                  }}
                  className="flex items-center gap-2 text-xs font-bold text-[#F89A15] hover:text-white transition-colors"
                >
                  <ArrowLeft size={14} /> Back to dashboard inventory
                </button>
              </div>

              {/* Streaming Video Panel Frame */}
              <div className="lg:col-span-8 space-y-6">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">CONTINUOUS LEARNING PORTAL</span>
                  <h1 className="text-2xl font-display font-black text-white">{selectedCourse.title}</h1>
                  {selectedEnrollment && (
                    <p className={`text-[10px] font-mono mt-1 ${isSelectedCourseExpired ? 'text-red-400' : 'text-gray-500'}`}>
                      <Clock size={10} className="inline mr-1 -mt-0.5" />
                      {enrollmentAccessLabel(selectedEnrollment)}
                    </p>
                  )}
                </div>

                {isSelectedCourseExpired ? (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center space-y-3">
                    <AlertCircle className="mx-auto text-red-400" size={32} />
                    <h2 className="font-display font-bold text-lg text-red-200">Course access expired</h2>
                    <p className="text-sm text-red-300/80">
                      Your enrollment period for this course has ended. Contact support if you need access renewed.
                    </p>
                  </div>
                ) : (
                <ContentProtectionShell
                  enabled={isContentProtectionActive}
                  watermarkText={contentWatermark}
                  onShield={pauseProtectedContent}
                  className={`relative w-full bg-[#111111] keep-dark-scheme rounded-2xl overflow-hidden border border-[#222222] shadow-2xl flex flex-col justify-between ${activeLesson?.type === 'quiz' ? 'min-h-[500px]' : 'aspect-video'}`}
                >
                  
                  {activeLesson ? (
                    <>
                      {/* Top Header info */}
                      <div className="p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center z-10">
                        <span className="text-[10px] font-mono text-[#F89A15] tracking-wider uppercase bg-[#F89A15]/10 border border-[#F89A15]/25 px-2 py-0.5 rounded">
                          {activeLesson.type === 'video' ? `Vimeo HD Media (ID: ${activeLesson.vimeoId})` : activeLesson.type === 'quiz' ? 'Academic Quiz Assessment' : 'Digital Resource Module'}
                        </span>
                        <div className="flex items-center gap-2">
                          {isContentProtectionActive && (
                            <span className="text-[9px] font-mono text-amber-400 flex items-center gap-1 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded">
                              <Lock size={10} /> Protected
                            </span>
                          )}
                          {savingStatus === 'saving' && <span className="text-[9px] font-mono text-blue-400 flex items-center gap-1"><RefreshCw size={10} className="animate-spin" /> Saving...</span>}
                          {savingStatus === 'saved' && <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1"><Check size={10} /> Saved to system disk</span>}
                          <span className="bg-black/80 px-2 py-1 rounded text-white-always text-[9px] uppercase tracking-wider border border-white/10">{activeLesson.title}</span>
                        </div>
                      </div>

                      {/* Display player UI custom placeholder vs generic frame */}
                      <div className="flex-1 flex items-center justify-center relative">
                        {activeLesson.type === 'video' ? (
                          <>
                            {activeLesson.vimeoId ? (
                              <iframe
                                ref={vimeoIframeRef}
                                src={`https://player.vimeo.com/video/${activeLesson.vimeoId}?autoplay=0&loop=0&autopause=1&pip=0&controls=1&dnt=1`}
                                className="absolute inset-0 w-full h-full pointer-events-auto"
                                frameBorder="0"
                                allow="autoplay; fullscreen"
                                allowFullScreen
                                title={activeLesson.title}
                              ></iframe>
                            ) : (
                              <>
                                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                                  <Play size={44} className="text-[#F89A15] opacity-50" />
                                  <span className="text-xs text-gray-500">Video system playback placeholder</span>
                                </div>
                                {!isPlaying && (
                                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3 z-[5]">
                                    <button 
                                      onClick={() => setIsPlaying(true)}
                                      className="w-14 h-14 rounded-full bg-[#F89A15] text-black flex items-center justify-center pl-1 hover:scale-105 active:scale-95 transition-all shadow-xl"
                                    >
                                      <Play fill="black" size={20} />
                                    </button>
                                    <span className="text-[10px] font-mono text-gray-300">Resume at {Math.floor(playbackPosition / 60)}:{(playbackPosition % 60).toString().padStart(2, '0')}</span>
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        ) : activeLesson.type === 'quiz' ? (
                          renderQuizPlayer()
                        ) : (
                          <div className="p-8 text-center space-y-4 max-w-sm">
                            <div className="w-16 h-16 rounded-2xl bg-[#F89A15]/10 border border-[#F89A15]/20 flex items-center justify-center text-[#F89A15] mx-auto">
                              <FileText size={32} />
                            </div>
                            <div className="space-y-1">
                              <h3 className="font-display font-bold text-sm text-white">{activeLesson.fileName || activeLesson.title}</h3>
                              <p className="text-[10px] text-gray-500">{activeLesson.fileSize || 'No Size bounds'} • Accessible for download</p>
                            </div>
                            <a 
                              href={activeLesson.fileUrl || "#"}
                              onClick={async (e) => {
                                e.preventDefault();
                                if (triggerAutoSaveRef.current) {
                                  await triggerAutoSaveRef.current(true);
                                }
                                showToast('Resource acquired and lesson marked complete.', 'success');
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-[#F89A15] text-black text-xs font-bold rounded-xl hover:bg-white transition-colors"
                            >
                              <Download size={12} /> Acquire Downloadable Resource
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Custom controls only for placeholder videos without Vimeo embed */}
                      {activeLesson.type === 'video' && !activeLesson.vimeoId && (
                        <div className="p-4 bg-gradient-to-t from-black to-black/50 space-y-2 z-10">
                          <div className="flex items-center justify-between text-[10px] font-mono text-gray-400">
                            <button 
                              onClick={() => setIsPlaying(!isPlaying)}
                              className="text-white hover:text-[#F89A15] font-bold"
                            >
                              {isPlaying ? 'PAUSE' : 'PLAY'}
                            </button>
                            <span>{Math.floor(playbackPosition / 60)}:{(playbackPosition % 60).toString().padStart(2,'0')} / {Math.floor(playerDuration / 60)}:00</span>
                          </div>
                          <div className="relative h-1.5 w-full bg-white/10 rounded-full overflow-hidden cursor-pointer">
                            <div 
                              className="h-full bg-[#F89A15]" 
                              style={{ width: `${(playbackPosition / playerDuration) * 100}%` }}
                            ></div>
                            <input 
                              type="range"
                              min="0"
                              max={playerDuration}
                              value={playbackPosition}
                              onChange={(e) => setPlaybackPosition(Number(e.target.value))}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full"
                            />
                          </div>
                          <p className="text-[10px] text-gray-500 pt-1">
                            Progress saves automatically as you watch.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-4">
                      <Video size={48} className="text-gray-600" />
                      <div>
                        <h3 className="font-display font-medium text-sm">No lesson selected</h3>
                        <p className="text-xs text-gray-400 mt-1 max-w-xs">Select any curriculum video or PDF document from the right sidebar index to configure active playback tools.</p>
                      </div>
                    </div>
                  )}

                </ContentProtectionShell>
                )}

                {/* Syllabus Modules details */}
                <div className="space-y-4 bg-[#111111] border border-[#222222] rounded-2xl p-6">
                  <h3 className="font-display font-bold text-sm text-[#F89A15] uppercase tracking-wide">Course Objectives & Takeaways</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{selectedCourse.description}</p>
                </div>

                {/* Interactive Q&A Discussion Board */}
                <div className="space-y-6 bg-[#111111] border border-[#222222] rounded-2xl p-6 text-left">
                  <div className="flex border-b border-[#222222] pb-4 items-center justify-between">
                    <div>
                      <h3 className="font-display font-bold text-base text-white">Classroom Q&A Forum</h3>
                      <p className="text-[10px] text-gray-500 font-mono tracking-tight">Active peer threads & instructor reviews synchronized</p>
                    </div>
                    <span className="text-[10px] bg-[#F89A15]/10 border border-[#F89A15]/20 text-[#F89A15] px-2.5 py-0.5 rounded font-mono font-bold">
                      {qaThreads.length} Discussions
                    </span>
                  </div>

                  {/* Ask a Question Form collapsing option */}
                  <form onSubmit={handleCreateQaThread} className="space-y-3 p-4 bg-black/40 border border-[#222222]/80 rounded-xl">
                    <h4 className="text-xs font-bold text-[#F89A15] uppercase tracking-wide">Submit Public Question Node</h4>
                    <div className="space-y-2">
                      <input 
                        type="text" 
                        required
                        placeholder="Subject domain (e.g. Help with normalization checklist)" 
                        value={newQuestionTitle}
                        onChange={(e) => setNewQuestionTitle(e.target.value)}
                        className="w-full bg-black border border-[#222222] p-2.5 text-xs text-white rounded-lg focus:border-[#F89A15] outline-none font-medium"
                      />
                      <textarea 
                        required
                        placeholder="Detail your conceptual query or snippet bounds..."
                        value={newQuestionText}
                        onChange={(e) => setNewQuestionText(e.target.value)}
                        className="w-full h-20 bg-black border border-[#222222] p-2.5 text-xs text-white rounded-lg focus:border-[#F89A15] outline-none leading-relaxed resize-none"
                      ></textarea>
                    </div>
                    <button 
                      type="submit"
                      className="px-4 py-2 bg-[#F89A15] text-black text-[10px] font-bold uppercase rounded-lg hover:bg-white transition-all cursor-pointer"
                    >
                      Post Question Node
                    </button>
                  </form>

                  {/* Threads List */}
                  <div className="space-y-4">
                    {qaThreads.map(thread => {
                      const isExpanded = selectedThreadId === thread.id;
                      return (
                        <div key={thread.id} className="border border-[#222222] rounded-xl overflow-hidden bg-black/20 hover:border-gray-800 transition-all">
                          {/* Thread Title Header */}
                          <div 
                            onClick={() => setSelectedThreadId(isExpanded ? null : thread.id)}
                            className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 cursor-pointer hover:bg-white/5 transition-colors"
                          >
                            <div className="space-y-1">
                              <h4 className="text-xs font-bold text-white hover:text-[#F89A15] transition-colors">{thread.title}</h4>
                              <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">{thread.text}</p>
                              <div className="flex items-center gap-2 text-[9px] text-gray-500 pt-1">
                                <span className={`font-semibold ${thread.authorRole === 'instructor' ? 'text-[#F89A15]' : 'text-gray-400'}`}>
                                  {thread.authorName} ({thread.authorRole.toUpperCase()})
                                </span>
                                <span>•</span>
                                <span className="font-mono">{thread.timestamp}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[9px] bg-white/5 border border-white/10 text-gray-400 px-2 py-0.5 rounded font-mono">
                                {thread.replies?.length || 0} replies
                              </span>
                              <span className="text-[10px] text-[#F89A15] font-bold">
                                {isExpanded ? 'Collapse ▲' : 'Open ▼'}
                              </span>
                            </div>
                          </div>

                          {/* Expanded thread replies and respond option */}
                          {isExpanded && (
                            <div className="border-t border-[#222222] bg-[#0A0A0A] p-4 space-y-4">
                              {/* Parent Text Complete */}
                              <div className="p-3 bg-white/5 rounded-lg border border-white/5 text-xs text-gray-300 leading-relaxed">
                                {thread.text}
                              </div>

                              {/* Replies lists */}
                              <div className="space-y-3.5 pl-4 border-l-2 border-[#222222]">
                                {thread.replies && thread.replies.length > 0 ? (
                                  thread.replies.map((reply: any) => (
                                    <div key={reply.id} className="space-y-1 bg-black/40 p-3 rounded-lg border border-[#222222]/60">
                                      <p className="text-xs text-gray-300 leading-relaxed">{reply.text}</p>
                                      <div className="flex items-center gap-2 text-[9px] text-gray-500 font-mono">
                                        <span className={`font-bold uppercase ${reply.authorRole === 'instructor' ? 'text-[#F89A15]' : 'text-gray-400'}`}>
                                          {reply.authorName} ({reply.authorRole})
                                        </span>
                                        <span>•</span>
                                        <span>{reply.timestamp}</span>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-[10px] italic text-gray-600">No responses cataloged. Be the first to reply!</p>
                                )}
                              </div>

                              {/* Save reply form */}
                              <form onSubmit={handleCreateReply} className="flex gap-2 pt-2">
                                <input 
                                  type="text"
                                  required
                                  placeholder="Post a helpful classroom answer..."
                                  value={newReplyText}
                                  onChange={(e) => setNewReplyText(e.target.value)}
                                  className="flex-1 bg-black border border-[#222222] px-3 py-1.5 text-xs text-white rounded-lg focus:border-[#F89A15] outline-none"
                                />
                                <button 
                                  type="submit"
                                  className="px-3 bg-neutral-900 border border-[#222222] hover:bg-[#F89A15] hover:text-black hover:border-[#F89A15] text-[10px] text-[#F89A15] font-bold uppercase rounded-lg transition-all cursor-pointer whitespace-nowrap"
                                >
                                  Submit Answer
                                </button>
                              </form>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Course Right Curriculum Menu list */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
                  <h3 className="font-display font-black text-xs uppercase tracking-widest text-gray-400">Curriculum Syllabus Directory</h3>

                  <div className="space-y-4">
                    {getCourseModules(selectedCourse.id).length === 0 ? (
                      <div className="p-4 border border-dashed border-[#333333] rounded-xl text-center space-y-3">
                        <AlertCircle className="w-8 h-8 text-[#F89A15] mx-auto" />
                        <div>
                          <p className="text-xs font-bold text-white uppercase tracking-wide">Syllabus Not Available Yet</p>
                          <p className="text-[10px] text-gray-400 mt-1">This course curriculum is being prepared. Please check back later or contact support.</p>
                        </div>
                      </div>
                    ) : (
                      getCourseModules(selectedCourse.id).map(mod => {
                        const modLessons = getModuleLessons(mod.id);
                        return (
                          <div key={mod.id} className="space-y-2">
                            <div className="p-2 border-b border-[#222222]">
                              <p className="text-xs font-bold text-white font-display uppercase tracking-wide">{mod.title}</p>
                              <p className="text-[10px] text-gray-500 line-clamp-1">{mod.description}</p>
                            </div>
                            
                            <div className="space-y-1">
                              {modLessons.map(les => {
                                const prog = enrollments.find(e => e.courseId === selectedCourse.id);
                                // Lookup if lesson completed dynamically
                                const isCompleted = currentCourseProgress.some(p => p.lessonId === les.id && p.isCompleted);

                                return (
                                  <button 
                                    key={les.id}
                                    onClick={async () => {
                                      if (activeLessonRef.current || activeLesson) {
                                        await triggerAutoSave(false, playbackPositionRef.current);
                                      }
                                      setAutoplayNext(false);
                                      setActiveLesson(les);
                                      if (selectedCourse) {
                                        navigate(
                                          studentPath('my-courses', selectedCourse.id, les.id)
                                        );
                                      }
                                    }}
                                    className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-all ${activeLesson?.id === les.id ? 'bg-black text-[#F89A15] border border-[#222222]' : 'hover:bg-black/50 text-gray-300'}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[8px] transition-colors ${isCompleted ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 font-bold' : 'border-neutral-700 bg-black text-gray-400'}`}>
                                        {isCompleted ? '✓' : (les.type === 'video' ? '▶' : les.type === 'quiz' ? '❓' : '📄')}
                                      </div>
                                      <span className="text-[11px] font-medium truncate max-w-[170px]">{les.title}</span>
                                    </div>
                                    <span className="text-[9px] font-mono text-gray-500">{les.duration || les.fileSize || 'Doc'}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

            </div>
          ) : (
            // REGULAR PORTAL MENU TABS CONTAINER
            <div className="space-y-8">
              
              {/* STUDENT HQ DASHBOARD */}
              {activeMenu === 'dashboard' && (
                <StudentDashboard
                  currentUser={currentUser}
                  courses={courses}
                  modules={modules}
                  lessons={lessons}
                  enrollments={enrollments}
                  certificates={certificates}
                  continueTargets={continueTargets}
                  quizAttempts={quizAttempts}
                  unreadAlerts={notifications.filter((n) => !n.read).length}
                  isDarkMode={isDarkMode}
                  onContinueCourse={(course, lessonId) => openCoursePlayer(course, lessonId)}
                  onBrowseCourses={() => handleMenuClick('courses')}
                  onViewCertificates={() => handleMenuClick('certificates')}
                  onViewQuizResults={() => handleMenuClick('quiz-results')}
                  onViewAlerts={() => handleMenuClick('notifications')}
                  onAddToCart={(courseId) => void handleAddCourseToCart(courseId)}
                  onBuyNow={handleBuyNow}
                />
              )}

              {/* EXPLORE ALL COURSES MENU */}
              {activeMenu === 'courses' && (
                browseCourseId ? (() => {
                  const browseCourse = courses.find((c) => c.id === browseCourseId);
                  if (!browseCourse) {
                    return (
                      <div className="text-center py-12 text-gray-500 text-sm">
                        Course not found.{' '}
                        <button
                          type="button"
                          onClick={() => navigate(studentPath('courses'))}
                          className="text-[#F89A15] font-bold hover:underline"
                        >
                          Back to courses
                        </button>
                      </div>
                    );
                  }
                  const isEnrolled = enrollments.some((e) => e.courseId === browseCourse.id);
                  const enrollment = enrollments.find((e) => e.courseId === browseCourse.id) ?? null;
                  return (
                    <PublicCourseDetailPage
                      embedded
                      course={browseCourse}
                      modules={modules}
                      lessons={lessons}
                      isDarkMode={isDarkMode}
                      onToggleDarkMode={onToggleDarkMode}
                      currentUser={currentUser}
                      isEnrolled={isEnrolled}
                      enrollment={enrollment}
                      cartCount={cartCount}
                      onBack={() => navigate(studentPath('courses'))}
                      onPurchase={() => void handleEnrollOrBuy(browseCourse)}
                      onAddToCart={() => handleAddCourseToCart(browseCourse.id)}
                      onContinueLearning={() => openCoursePlayer(browseCourse)}
                    />
                  );
                })() : (
                  <CourseCatalog
                    courses={courses}
                    isDarkMode={isDarkMode}
                    enrolledCourseIds={enrollments.map((entry) => entry.courseId)}
                    onViewCourse={(courseId) => navigate(studentBrowsePath(courseId))}
                    onContinueCourse={(course) => openCoursePlayer(course)}
                    onAddToCart={handleAddCourseToCart}
                    onEnrollFree={(course) => void handleEnrollOrBuy(course)}
                  />
                )
              )}

              {/* MY ENROLLED COURSES TABS */}
              {activeMenu === 'my-courses' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#222222]">
                    <div className="space-y-1">
                      <h2 className="text-xl font-display font-black">My Certified Library</h2>
                      <p className="text-xs text-gray-500 font-sans">Access course files, dynamic lessons, and curriculum assignments.</p>
                    </div>

                    {/* Sub-tabs switch */}
                    <div className="flex bg-[#111111] p-1 border border-[#222222] rounded-xl self-start sm:self-auto">
                      <button 
                        onClick={() => setMyCoursesSubTab('enrolled')}
                        className={`px-4 py-2 text-[10px] uppercase font-bold tracking-wider rounded-lg transition-all ${myCoursesSubTab === 'enrolled' ? 'bg-[#F89A15] text-black' : 'text-gray-400 hover:text-white'}`}
                      >
                        Enrolled Courses ({enrolledCourses.filter(c => (enrollments.find(e => e.courseId === c.id)?.progressPercentage || 0) < 100).length})
                      </button>
                      <button 
                        onClick={() => setMyCoursesSubTab('completed')}
                        className={`px-4 py-2 text-[10px] uppercase font-bold tracking-wider rounded-lg transition-all ${myCoursesSubTab === 'completed' ? 'bg-[#F89A15] text-black' : 'text-gray-400 hover:text-white'}`}
                      >
                        Completed Courses ({enrolledCourses.filter(c => (enrollments.find(e => e.courseId === c.id)?.progressPercentage || 0) === 100).length})
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const filtered = enrolledCourses.filter(c => {
                      const percentage = enrollments.find(e => e.courseId === c.id)?.progressPercentage || 0;
                      return myCoursesSubTab === 'completed' ? percentage === 100 : percentage < 100;
                    });

                    return filtered.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filtered.map(course => {
                          const enr = enrollments.find(e => e.courseId === course.id);
                          const expired = enr ? isEnrollmentExpired(enr) : false;
                          const accessLabel = enr
                            ? enrollmentAccessLabel(enr)
                            : formatValidityLabel(course.validityDays);
                          const existingReview = getStudentReviewForCourse(course.id);
                          const isCompleted = (enr?.progressPercentage || 0) === 100;
                          return (
                            <div key={course.id} className="bg-[#111111] border border-[#222222] p-6 rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                              <div className="md:col-span-4 aspect-video rounded-xl overflow-hidden border border-[#222222]">
                                <img src={resolveMediaUrl(course.coverImage)} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                              </div>
                              <div className="md:col-span-8 space-y-4">
                                <div>
                                  <span className="text-[9px] uppercase tracking-wider text-[#F89A15] font-bold">{course.category}</span>
                                  <h3 className="font-display font-bold text-sm text-white line-clamp-1">{course.title}</h3>
                                  <p className={`text-[10px] font-mono ${expired ? 'text-red-400' : 'text-gray-500'}`}>
                                    <Clock size={10} className="inline mr-1 -mt-0.5" />
                                    {accessLabel}
                                  </p>
                                </div>

                                <div className="space-y-1.5">
                                  <div className="flex justify-between text-[10px] text-gray-400">
                                    <span>Academic Semester Progress</span>
                                    <span>{enr?.progressPercentage || 0}%</span>
                                  </div>
                                  <div className="h-1 bg-black rounded-full overflow-hidden">
                                    <div className="h-full bg-[#F89A15]" style={{ width: `${enr?.progressPercentage || 0}%` }}></div>
                                  </div>
                                </div>

                                <button 
                                  onClick={() => openCoursePlayer(course)}
                                  disabled={expired}
                                  className={`px-4 py-2 transition-all font-bold text-[10px] tracking-wider uppercase rounded-lg cursor-pointer ${
                                    expired
                                      ? 'bg-red-500/10 text-red-300 border border-red-500/30 cursor-not-allowed'
                                      : 'bg-[#F89A15] hover:bg-white text-black'
                                  }`}
                                >
                                  {expired
                                    ? 'Access expired'
                                    : myCoursesSubTab === 'completed'
                                      ? 'Review Lectures'
                                      : 'Launch Course Player'}
                                </button>

                                {isCompleted && !expired && (
                                  <div className="space-y-2">
                                    {existingReview ? (
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span
                                          className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${
                                            existingReview.status === 'approved'
                                              ? 'bg-emerald-500/15 text-emerald-400'
                                              : existingReview.status === 'rejected'
                                                ? 'bg-red-500/15 text-red-400'
                                                : 'bg-yellow-500/15 text-yellow-400'
                                          }`}
                                        >
                                          Review {existingReview.status}
                                        </span>
                                        {existingReview.status !== 'approved' && (
                                          <button
                                            type="button"
                                            onClick={() => setReviewModalCourse(course)}
                                            className="text-[10px] font-bold uppercase tracking-wider text-[#F89A15] hover:text-white transition-colors"
                                          >
                                            {existingReview.status === 'rejected' ? 'Submit again' : 'Edit review'}
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setReviewModalCourse(course)}
                                        className="w-full py-2 border border-[#222222] hover:border-[#F89A15]/40 text-gray-300 hover:text-white font-bold text-[10px] tracking-wider uppercase rounded-lg transition-all flex items-center justify-center gap-2"
                                      >
                                        <Star size={12} className="text-[#F89A15]" />
                                        Leave a review
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center bg-[#111111] border border-[#222222] p-12 rounded-2xl max-w-md mx-auto space-y-3">
                        <AlertCircle className="mx-auto text-gray-600 animate-pulse" size={32} />
                        <h4 className="font-display font-bold text-sm">No courses matching this tier</h4>
                        <p className="text-xs text-gray-400">
                          {myCoursesSubTab === 'completed' 
                            ? 'Complete all lectures inside your course player module to certify and populate this panel.' 
                            : 'All clear! You have fully completed all enrolled curricula.'}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* SHOPPING CART */}
              {activeMenu === 'cart' && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <span className="text-[10px] text-[#F89A15] tracking-widest uppercase font-bold font-mono">
                      Commerce cart
                    </span>
                    <h2 className="text-xl font-display font-black">My Cart</h2>
                    <p className="text-xs text-gray-500 font-sans">
                      Review selected courses, apply a coupon, and checkout in one payment.
                    </p>
                  </div>

                  {cartItems.length === 0 ? (
                    <div className="text-center bg-[#111111] border border-[#222222] p-12 rounded-2xl max-w-md mx-auto space-y-3">
                      <ShoppingCart className="mx-auto text-gray-600" size={32} />
                      <h4 className="font-display font-bold">Your cart is empty</h4>
                      <p className="text-xs text-gray-400">
                        Browse the dashboard catalog or public course pages to add programs.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleMenuClick('dashboard')}
                        className="px-4 py-2 bg-[#F89A15] text-black text-xs font-bold rounded-lg uppercase tracking-wider"
                      >
                        Browse courses
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {cartItems.map((course) => (
                          <div
                            key={course.id}
                            className="bg-[#111111] border border-[#222222] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="space-y-1 min-w-0">
                              <span className="text-[9px] text-[#F89A15] font-mono uppercase">
                                {course.category}
                              </span>
                              <h4 className="font-display font-bold text-sm text-white">{course.title}</h4>
                              <p className="text-[11px] text-gray-500 line-clamp-2">{course.description}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-mono text-sm text-white font-bold">₹{course.price}</span>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await onRemoveFromCart(course.id);
                                    showToast('Removed from cart.', 'info');
                                  } catch (e: any) {
                                    showToast(e.message || 'Could not remove item', 'error');
                                  }
                                }}
                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                                title="Remove"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-4 border-t border-[#222222]">
                        <div className="text-sm font-mono text-white">
                          Subtotal:{' '}
                          <span className="text-[#F89A15] font-bold">
                            ₹{cartItems.reduce((s, c) => s + c.price, 0)}
                          </span>
                          <span className="text-[10px] text-gray-500 block">Inclusive 18% GST</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => openCheckout(cartItems)}
                          className="px-6 py-3 bg-[#F89A15] hover:bg-white text-black font-black text-xs uppercase tracking-widest rounded-lg"
                        >
                          Checkout ({cartItems.length})
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* MY ORDERS / PURCHASE HISTORY */}
              {activeMenu === 'orders' && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <span className="text-[10px] text-[#F89A15] tracking-widest uppercase font-bold font-mono">Verified Checkout Register</span>
                    <h2 className="text-xl font-display font-black">My Orders & Invoice Ledger</h2>
                    <p className="text-xs text-gray-500 font-sans">Dynamic GST compliant invoices registered with tax structures compute index of 18%.</p>
                  </div>

                  {payments.length > 0 ? (
                    <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-black/40 text-gray-400 border-b border-[#222222]">
                            <th className="p-4 uppercase font-semibold">Course Item Name</th>
                            <th className="p-4 uppercase font-semibold">Invoice Serial ID</th>
                            <th className="p-4 uppercase font-semibold text-right">Amount Paid</th>
                            <th className="p-4 uppercase font-semibold text-center">Receipt Documents</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map(pmt => (
                            <tr key={pmt.id} className="border-b border-[#222222] text-gray-300">
                              <td className="p-4 font-medium text-white">{pmt.courseTitle}</td>
                              <td className="p-4 text-gray-400 font-mono">{pmt.invoiceId}</td>
                              <td className="p-4 text-right text-white font-mono font-medium">₹{pmt.amountPaid}</td>
                              <td className="p-4 text-center">
                                <button 
                                  onClick={() => onViewInvoice(pmt)}
                                  className="px-3 py-1 bg-[#222222] hover:bg-[#F89A15] hover:text-black text-gray-300 transition-all font-semibold rounded cursor-pointer"
                                >
                                  GST Tax Receipt
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center bg-[#111111] border border-[#222222] p-12 rounded-2xl max-w-md mx-auto space-y-3">
                      <Receipt className="mx-auto text-gray-600" size={32} />
                      <h4 className="font-display font-bold">No payments found</h4>
                      <p className="text-xs text-gray-400">Please enroll or purchase class memberships to populate your invoice timeline ledger.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ACCOUNT SETTINGS PORTAL (NESTED SUB-TABS) */}
              {activeMenu === 'profile' && (
                <div className="space-y-6 max-w-xl">
                  <div className="space-y-1">
                    <span className="text-[10px] text-[#F89A15] tracking-widest uppercase font-bold font-mono">Workspace Identity Setup</span>
                    <h2 className="text-xl font-display font-black">My Personal Profile</h2>
                    <p className="text-xs text-gray-500 font-sans">Manage your personal details, secure change login key codes, and manage profile avatar settings.</p>
                  </div>

                  {/* Profile sub-tabs */}
                  <div className="flex border-b border-[#222222] gap-6 text-xs pb-1">
                    <button 
                      onClick={() => setProfileSubTab('edit')}
                      className={`pb-3 font-bold uppercase tracking-wider transition-all relative ${profileSubTab === 'edit' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                    >
                      Edit Profile
                      {profileSubTab === 'edit' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F89A15]"></span>}
                    </button>
                    <button 
                      onClick={() => setProfileSubTab('password')}
                      className={`pb-3 font-bold uppercase tracking-wider transition-all relative ${profileSubTab === 'password' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                    >
                      Change Password
                      {profileSubTab === 'password' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F89A15]"></span>}
                    </button>
                    <button 
                      onClick={() => setProfileSubTab('photo')}
                      className={`pb-3 font-bold uppercase tracking-wider transition-all relative ${profileSubTab === 'photo' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                    >
                      Profile Photo
                      {profileSubTab === 'photo' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F89A15]"></span>}
                    </button>
                  </div>

                  {profileSuccess && (
                     <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-xs flex items-center gap-2">
                       <CheckCircle size={14} /> Profile parameters committed and successfully saved.
                     </div>
                  )}

                  {/* TAB 1: Edit Profile */}
                  {profileSubTab === 'edit' && (
                    <div className="bg-[#111111] border border-[#222222] p-6 rounded-2xl">
                      <form onSubmit={handleProfileUpdate} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-400 uppercase font-mono font-medium">Full Registered Name</label>
                          <input 
                            type="text"
                            required
                            value={profileName}
                            onChange={e => setProfileName(e.target.value)}
                            className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-medium outline-none focus:border-[#F89A15]"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-400 uppercase font-mono font-medium">Email Address (Protected)</label>
                          <input 
                            type="text"
                            disabled
                            value={currentUser.email}
                            className="w-full bg-black/60 border border-[#222222] text-xs p-3 rounded-lg text-gray-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-400 uppercase font-mono font-medium">System privilege rank</label>
                          <div className="bg-black/60 border border-[#222222] text-xs p-3 rounded-lg text-gray-400 capitalize">
                            Authenticated {currentUser.role} Account Status
                          </div>
                        </div>

                        <button 
                          type="submit"
                          className="w-full py-3 bg-[#F89A15] hover:bg-white text-black transition-colors font-bold text-xs uppercase rounded-xl cursor-pointer"
                        >
                          Process Core Name Update
                        </button>
                      </form>
                    </div>
                  )}

                  {/* TAB 2: Change Password */}
                  {profileSubTab === 'password' && (
                    <div className="bg-[#111111] border border-[#222222] p-6 rounded-2xl">
                      <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        {passwordError && (
                          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2 text-xs rounded-lg">
                            {passwordError}
                          </div>
                        )}
                        
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-400 uppercase font-mono font-medium">Current Password code</label>
                          <PasswordInput
                            required
                            value={passwordState.current}
                            onChange={(e) => setPasswordState({ ...passwordState, current: e.target.value })}
                            placeholder="••••••••"
                            className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-medium outline-none focus:border-[#F89A15]"
                            autoComplete="current-password"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-400 uppercase font-mono font-medium">New Password Key (min 8 chars)</label>
                          <PasswordInput
                            required
                            value={passwordState.new}
                            onChange={(e) => setPasswordState({ ...passwordState, new: e.target.value })}
                            placeholder="New Code combination"
                            className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-medium outline-none focus:border-[#F89A15]"
                            autoComplete="new-password"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-400 uppercase font-mono font-medium">Confirm New Password Key</label>
                          <PasswordInput
                            required
                            value={passwordState.confirm}
                            onChange={(e) => setPasswordState({ ...passwordState, confirm: e.target.value })}
                            placeholder="Repeat repeat combination"
                            className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-medium outline-none focus:border-[#F89A15]"
                            autoComplete="new-password"
                          />
                        </div>

                        <button 
                          type="submit"
                          className="w-full py-3 bg-[#F89A15] hover:bg-white text-black transition-colors font-bold text-xs uppercase rounded-xl cursor-pointer"
                        >
                          Modify System Password
                        </button>
                      </form>
                    </div>
                  )}

                  {/* TAB 3: Profile Photo */}
                  {profileSubTab === 'photo' && (
                    <div className="bg-[#111111] border border-[#222222] p-6 rounded-2xl space-y-6">
                      <div className="flex items-center gap-6 pb-4 border-b border-[#222222]/60">
                        <img 
                          src={profilePhoto} 
                          className="w-20 h-20 rounded-full border-2 border-[#F89A15] object-cover bg-black" 
                          alt="Current avatar photo" 
                        />
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-white">Active Avatar Image</h4>
                          <p className="text-[10px] text-gray-400">Select another candidate avatar below or synchronize customizable URL references.</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] text-gray-400 uppercase font-mono font-medium">Option A: Predefined Designer Avatars Selection</label>
                        <div className="grid grid-cols-4 gap-4">
                          {[
                            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150',
                            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150',
                            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150',
                            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150'
                          ].map((url, i) => (
                            <button 
                              key={i}
                              type="button"
                              onClick={() => handleUpdatePhoto(url)}
                              className={`aspect-square rounded-xl overflow-hidden border-2 transition-all relative ${profilePhoto === url ? 'border-[#F89A15] scale-95' : 'border-[#222222] hover:border-white'}`}
                            >
                              <img src={url} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                              {profilePhoto === url && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                  <Check className="text-[#F89A15]" size={16} />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-400 uppercase font-mono font-medium">Option B: Custom Picture URL Coordinate</label>
                        <div className="flex gap-2">
                          <input 
                            type="url"
                            placeholder="https://example.com/avatar.jpg"
                            value={profilePhoto.startsWith('https://images.unsplash.com') && profilePhoto.length < 100 ? '' : profilePhoto}
                            onChange={e => handleUpdatePhoto(e.target.value)}
                            className="bg-black border border-[#222222] rounded-lg text-xs p-3 text-white outline-none focus:border-[#F89A15] flex-1 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CERTIFICATE CABINET */}
              {activeMenu === 'certificates' && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <span className="text-[10px] text-[#F89A15] tracking-widest uppercase font-bold font-mono">Academic Achievement Cabinet</span>
                    <h2 className="text-xl font-display font-black">My Personal Credentials Directory</h2>
                    <p className="text-xs text-gray-500 font-sans">Review tamper-proof certification logs complete with printed serial validation links.</p>
                  </div>

                  {certificates.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {certificates.map(cert => (
                        <div key={cert.id} className="bg-[#111111] border border-[#222222] p-6 rounded-2xl flex justify-between items-center gap-4">
                          <div className="space-y-3">
                            <div className="w-10 h-10 bg-[#F89A15]/10 rounded-xl flex items-center justify-center text-[#F89A15]">
                              <Award size={20} />
                            </div>
                            <div>
                              <h3 className="font-display font-bold text-sm text-white">{cert.courseTitle}</h3>
                              <p className="text-[10px] text-gray-500 font-mono mt-0.5">SERIAL: {cert.certificateNumber}</p>
                            </div>
                          </div>

                          <button 
                            onClick={() => onViewCertificate(cert)}
                            className="px-4 py-2 bg-[#F89A15] hover:bg-white transition-colors text-black text-[10px] uppercase font-bold rounded-lg cursor-pointer shrink-0"
                          >
                            Generate Credentials PDF
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center bg-[#111111] border border-[#222222] p-12 rounded-2xl max-w-md mx-auto space-y-3">
                      <Award className="mx-auto text-gray-600" size={32} />
                      <h4 className="font-display font-bold">No certificates generated yet</h4>
                      <p className="text-xs text-gray-400">Complete 100% of all syllabus lessons and video streams to automatically trigger compliance credential generation.</p>
                    </div>
                  )}
                </div>
              )}

              {/* QUIZ RESULTS SECTION */}
              {activeMenu === 'quiz-results' && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <span className="text-[10px] text-[#F89A15] tracking-widest uppercase font-bold font-mono">Continuous Performance Tracker</span>
                    <h2 className="text-xl font-display font-black">Academic Quiz Performance History</h2>
                    <p className="text-xs text-gray-500 font-sans">See detailed report cards from quizzes attempted during active study semesters.</p>
                  </div>

                  {quizAttempts.length > 0 ? (
                    <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-black/40 text-gray-400 border-b border-[#222222]">
                            <th className="p-4 uppercase font-semibold">Course Context</th>
                            <th className="p-4 uppercase font-semibold">Quiz Blueprint Topic</th>
                            <th className="p-4 uppercase font-semibold text-center">Score Result</th>
                            <th className="p-4 uppercase font-semibold text-center">Semester Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quizAttempts.map(attempt => (
                            <tr key={attempt.id} className="border-b border-[#222222] text-gray-300">
                              <td className="p-4 font-bold text-white">{attempt.courseTitle}</td>
                              <td className="p-4 text-gray-400 font-sans">{attempt.quizName}</td>
                              <td className="p-4 text-center">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${attempt.score >= 80 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-[#F89A15]/10 text-[#F89A15] border border-[#F89A15]/20'}`}>
                                  {attempt.score}% Completed
                                </span>
                              </td>
                              <td className="p-4 text-center font-mono text-gray-500">{attempt.date}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center bg-[#111111] border border-[#222222] p-12 rounded-2xl max-w-md mx-auto space-y-3">
                      <CheckSquare className="mx-auto text-gray-600" size={32} />
                      <h4 className="font-display font-bold">No quizzes attempted yet</h4>
                      <p className="text-xs text-gray-400">Launch any course lesson module, attend lessons regularly and prepare for integrated challenges.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ALERTS SECTION */}
              {activeMenu === 'notifications' && (
                <div className="space-y-6">
                  <div className="border-b border-[#222222] pb-6 space-y-1 text-left">
                    <span className="text-[10px] text-[#F89A15] tracking-widest uppercase font-bold font-mono">Student notifications</span>
                    <h2 className="text-2xl font-display font-black text-white">Alerts</h2>
                    <p className="text-xs text-gray-400 font-sans">
                      Course progress, certificates, security updates, and platform announcements.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#222222] bg-[#111111] p-4 text-left max-w-3xl">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3 font-mono">Alert types you receive</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-gray-400">
                      <li><span className="text-[#F89A15] font-bold">Welcome</span> — when your account is ready</li>
                      <li><span className="text-[#34d399] font-bold">Module unlock</span> — when course units open</li>
                      <li><span className="text-amber-400 font-bold">Certificate</span> — when you earn a credential</li>
                      <li><span className="text-red-400 font-bold">Password</span> — when you change your password</li>
                      <li><span className="text-[#F89A15] font-bold">Announcement</span> — placement drives and curriculum updates</li>
                    </ul>
                  </div>

                  <div className="max-w-3xl space-y-4 text-left">
                    <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider font-mono">
                      Your alerts ({notifications.filter(n => !n.read).length} unread)
                    </h3>

                    {notifications.length === 0 ? (
                      <div className="text-center bg-[#111111] border border-[#222222] p-12 rounded-2xl space-y-3">
                        <Bell className="mx-auto text-gray-600" size={32} />
                        <h4 className="font-display font-bold text-white text-xs uppercase tracking-widest">No alerts yet</h4>
                        <p className="text-xs text-gray-400 font-sans">
                          Enroll in a course or complete lessons to receive progress alerts here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {notifications.map(notif => (
                          <div
                            key={notif.id}
                            onClick={() => markNotificationRead(notif.id)}
                            className={`p-5 rounded-xl border transition-all flex justify-between items-start gap-4 cursor-pointer ${
                              notif.read
                                ? 'bg-black/25 border-[#222222] opacity-70'
                                : 'bg-[#111111] border-[#F89A15]/40 shadow-xs shadow-[#F89A15]/5 hover:border-[#F89A15]/75'
                            }`}
                          >
                            <div className="space-y-1.5 text-left">
                              <div className="flex items-center gap-2 flex-wrap">
                                {!notif.read && <span className="w-1.5 h-1.5 rounded-full bg-[#F89A15] animate-pulse"></span>}
                                <span className={`text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded-md ${
                                  notif.type === 'certificate'
                                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                    : notif.type === 'module_unlock'
                                      ? 'bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/20'
                                      : notif.type === 'password_reset'
                                        ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                                        : notif.type === 'welcome'
                                          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                                          : 'bg-[#F89A15]/15 text-[#F89A15] border border-[#F89A15]/20'
                                }`}>
                                  {notif.type ? notif.type.replace(/_/g, ' ') : 'alert'}
                                </span>
                                <h4 className="text-xs font-bold text-white">{notif.title}</h4>
                              </div>
                              <p className="text-[11px] text-gray-400 font-sans leading-relaxed">{notif.message}</p>
                              <span className="block font-mono text-[9px] text-gray-600">{notif.date}</span>
                            </div>

                            <button
                              className="text-[9px] font-mono text-gray-500 hover:text-white uppercase transition-colors shrink-0 pt-0.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNotifications(prev => prev.filter(n => n.id !== notif.id));
                              }}
                            >
                              Dismiss
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        <CheckoutModal
          open={checkoutOpen}
          items={checkoutItems}
          onClose={() => setCheckoutOpen(false)}
          onTriggerCheckout={onTriggerCheckout}
          onCapturePayment={onCapturePayment}
          onRefreshData={async () => {
            await onRefreshData();
            await onRefreshCart();
            await syncPlatformCache();
          }}
          onSuccessNavigate={(items) => {
            if (items.length === 1) {
              navigate(studentPath('my-courses', items[0].id));
              openCoursePlayer(items[0]);
            } else {
              navigate(studentPath('my-courses'));
            }
          }}
          userId={currentUser.id}
          showToast={showToast}
        />

      </main>
      {celebrationCert && (
        <CompletionCelebrationModal
          certificate={celebrationCert}
          onViewCertificate={handleCelebrationViewCertificate}
          onDownloadCertificate={handleCelebrationDownload}
          onClose={dismissCompletionCelebration}
        />
      )}
      {reviewModalCourse && (
        <CourseReviewModal
          course={reviewModalCourse}
          initialRating={getStudentReviewForCourse(reviewModalCourse.id)?.rating ?? 5}
          initialComment={getStudentReviewForCourse(reviewModalCourse.id)?.comment ?? ''}
          isResubmit={Boolean(getStudentReviewForCourse(reviewModalCourse.id))}
          onClose={() => setReviewModalCourse(null)}
          onSubmit={async ({ rating, comment }) => {
            const result = await submitCourseReviewApi(reviewModalCourse.id, { rating, comment });
            if (result.ok === false) {
              throw new Error(result.error);
            }
            setStudentReviews((prev) => {
              const others = prev.filter((entry) => entry.courseId !== reviewModalCourse.id);
              return [result.review, ...others];
            });
            showToast(
              result.review.status === 'pending'
                ? 'Review submitted for admin approval.'
                : 'Review updated.',
              'success'
            );
          }}
        />
      )}
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
