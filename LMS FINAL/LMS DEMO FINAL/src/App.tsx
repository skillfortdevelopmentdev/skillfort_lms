import React, { useState, useEffect, useRef, useCallback, startTransition } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { User, Course, CourseModule, Lesson, Enrollment, Certificate, PaymentReport, Coupon, SystemSettings, CheckoutSession, StudentRegistrationProfile } from './types';
import {
  HIGHEST_QUALIFICATIONS,
  PASSOUT_YEARS,
  REGISTRATION_BRANCHES,
  REGISTRATION_SOURCES,
  REQUIRED_COURSES,
} from './constants/registrationForm';
import { apiFetch, clearAuthSession } from './api/client';
import { apiUrl } from './api/config';
import { readPlatformCache, setPlatformValue, migrateLocalStorageToServer, syncPlatformCache, parsePlatformValue } from './api/platformKv';
import { loadUserPreferences, saveUserPreferences } from './api/userPreferences';
import { fetchAdminUsers } from './api/adminUsers';
import { consumeAuthReturn, setAuthReturn, setPendingCheckout, setPendingCartCheckout, resolvePostAuthDestination } from './utils/authReturn';
import { studentPath } from './routes/studentRoutes';
import { useCart } from './hooks/useCart';
import StudentPortal from './features/student/StudentPortal';
import AdminSiteRoute from './routes/AdminSiteRoute';
import InvoiceModal from './components/InvoiceModal';
import CertificateModal from './components/CertificateModal';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyCertificatePage from './pages/VerifyCertificatePage';
import ProtectedRoute from './routes/ProtectedRoute';
import PublicSiteRoute from './routes/PublicSiteRoute';
import RegistrationSuccessRoute from './routes/RegistrationSuccessRoute';
import { 
  Key, Mail, Lock, User as UserIcon, LogIn, AlertCircle, Sparkles, CheckCircle, X, Phone, Eye, EyeOff,
  Check, Shield, ShieldCheck
} from 'lucide-react';

const emptyRegistrationProfile = (): Record<keyof StudentRegistrationProfile, string> => ({
  branch: '',
  dateOfBirth: '',
  highestQualification: '',
  stream: '',
  collegeName: '',
  yearOfPassout: '',
  knownTechnologies: '',
  requiredCourse: '',
  placementRequired: '',
  preferredCallbackTime: '',
  hasWorkExperience: '',
  address: '',
  panNo: '',
  aadharNo: '',
  source: '',
});

interface PasswordStrengthInfo {
  score: number;
  label: string;
  color: string;
  width: string;
  text: string;
  criteria: {
    length: boolean;
    upper: boolean;
    lower: boolean;
    number: boolean;
    special: boolean;
  };
}

const getPasswordStrength = (pwd: string): PasswordStrengthInfo => {
  const criteria = {
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    number: /[0-9]/.test(pwd),
    special: /[^A-Za-z0-9]/.test(pwd),
  };
  
  let score = 0;
  if (pwd) {
    if (criteria.length) score++;
    if (criteria.upper) score++;
    if (criteria.lower) score++;
    if (criteria.number) score++;
    if (criteria.special) score++;
  }
  
  let label = 'Not Entered';
  let color = 'bg-neutral-800';
  let width = 'w-0';
  let text = 'text-gray-500';
  
  if (pwd) {
    if (score <= 1) {
      label = 'Very Weak';
      color = 'bg-red-500';
      width = 'w-1/5';
      text = 'text-red-500';
    } else if (score === 2) {
      label = 'Weak';
      color = 'bg-amber-600';
      width = 'w-2/5';
      text = 'text-amber-500';
    } else if (score === 3) {
      label = 'Moderate';
      color = 'bg-yellow-500';
      width = 'w-3/5';
      text = 'text-yellow-400';
    } else if (score === 4) {
      label = 'Strong';
      color = 'bg-green-500';
      width = 'w-4/5';
      text = 'text-green-500';
    } else if (score === 5) {
      label = 'Very Strong';
      color = 'bg-emerald-500';
      width = 'w-full';
      text = 'text-emerald-400';
    }
  }
  
  return { score, label, color, width, text, criteria };
};

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  // Global Platform Data States
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [payments, setPayments] = useState<PaymentReport[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  // Theme: logged-in users persist in DB; anonymous visitors use session-only preference
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return sessionStorage.getItem('skillfort_public_dark_mode') === 'true';
  });

  // Authentication State management
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const authView =
    location.pathname === '/login'
      ? 'login'
      : location.pathname === '/register'
        ? 'register'
        : 'none';
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');

  // Extended registration fields
  const [authFirstName, setAuthFirstName] = useState('');
  const [authLastName, setAuthLastName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [registrationProfile, setRegistrationProfile] = useState(emptyRegistrationProfile);

  const setRegField = (field: keyof StudentRegistrationProfile, value: string) => {
    setRegistrationProfile((prev) => ({ ...prev, [field]: value }));
  };

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Custom Detail Viewing (Global Overlays for high-fidelity printing)
  const [activeInvoice, setActiveInvoice] = useState<PaymentReport | null>(null);
  const [activeCertificate, setActiveCertificate] = useState<Certificate | null>(null);

  // Auth must finish before routes mount (prevents /admin → /login → /admin bounce loops)
  const [authHydrated, setAuthHydrated] = useState(false);
  const [platformReady, setPlatformReady] = useState(false);
  const platformSyncRef = useRef(0);
  const lastPlatformUserRef = useRef<string | undefined>(undefined);
  const platformLoadInFlightRef = useRef<Promise<void> | null>(null);
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    if (!currentUser) {
      sessionStorage.setItem('skillfort_public_dark_mode', String(isDarkMode));
    }
  }, [isDarkMode, currentUser]);

  useEffect(() => {
    if (!currentUser || !platformReady) return;
    loadUserPreferences(currentUser.id).then((prefs) => {
      setIsDarkMode((prev) => (prev === prefs.darkMode ? prev : prefs.darkMode));
    });
  }, [currentUser?.id, platformReady]);

  const handleToggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    if (currentUser) {
      void saveUserPreferences(currentUser.id, { darkMode: next });
    }
  };

  const loadCourseSyllabus = async (coursesData: Course[]) => {
    const moduleArr: CourseModule[] = [];
    const lessonArr: Lesson[] = [];

    for (const c of coursesData) {
      try {
        const detailResp = await apiFetch(`/api/courses/${c.id}`);
        if (detailResp.ok) {
          const detailData = await detailResp.json();
          if (detailData.modules) moduleArr.push(...detailData.modules);
          if (detailData.lessons) lessonArr.push(...detailData.lessons);
        }
      } catch (err) {
        console.error(`Failed to fetch database syllabus for course ${c.id}:`, err);
      }

      const localSaved = readPlatformCache(`skillfort_course_metadata_${c.id}`, null);
      if (localSaved) {
        try {
          const parsed = parsePlatformValue(localSaved, null as any);
          if (parsed.modules && Array.isArray(parsed.modules)) {
            parsed.modules.forEach((pm: any) => {
              if (!moduleArr.some((m) => m.id === pm.id)) {
                moduleArr.push(pm);
              }
            });
          }
          if (parsed.lessons && Array.isArray(parsed.lessons)) {
            parsed.lessons.forEach((pl: any) => {
              if (!lessonArr.some((l) => l.id === pl.id)) {
                lessonArr.push(pl);
              }
            });
          }
        } catch (e) {
          console.warn('Parse error for custom course metadata mapping:', e);
        }
      }
    }

    return { moduleArr, lessonArr };
  };

  // Load platform state from express JSON backend
  const loadPlatformData = useCallback(async () => {
    if (platformLoadInFlightRef.current) {
      return platformLoadInFlightRef.current;
    }

    const run = async () => {
      const user = currentUserRef.current;
      try {
        const settingsResp = await apiFetch('/api/settings');
        const settingsData = await settingsResp.json();
        setSettings(settingsData.settings);
        setCoupons(settingsData.coupons);

        const coursesResp = await apiFetch('/api/courses');
        const coursesData = await coursesResp.json();
        setCourses(coursesData);

        if (user?.role === 'admin') {
          const [studentResp, pmtsResp, certsResp] = await Promise.all([
            apiFetch('/api/admin/students'),
            apiFetch('/api/admin/payments'),
            apiFetch('/api/admin/certificates'),
          ]);
          const [studentData, pmtsData, certsData] = await Promise.all([
            studentResp.json(),
            pmtsResp.json(),
            certsResp.json(),
          ]);
          setStudents(studentData);
          setAdmins(await fetchAdminUsers(user));
          setPayments(pmtsData);
          setCertificates(certsData);

          try {
            const enrollmentsResp = await apiFetch('/api/admin/enrollments');
            if (enrollmentsResp.ok) {
              const enrollmentsData = await enrollmentsResp.json();
              setEnrollments(Array.isArray(enrollmentsData) ? enrollmentsData : []);
            } else {
              setEnrollments([]);
            }
          } catch (enrollmentErr) {
            console.error('Failed to load admin enrollments:', enrollmentErr);
            setEnrollments([]);
          }
        } else if (user?.role === 'student') {
          const syncCertResp = await apiFetch(`/api/certificates/${user.id}`);
          const certsArr = await syncCertResp.json();
          setCertificates(certsArr);
        }

        const { moduleArr, lessonArr } = await loadCourseSyllabus(coursesData);
        startTransition(() => {
          setModules(moduleArr);
          setLessons(lessonArr);
        });
      } catch (e) {
        console.error('Failed to load platform data:', e);
      }
    };

    const promise = run();
    platformLoadInFlightRef.current = promise;
    try {
      await promise;
    } finally {
      if (platformLoadInFlightRef.current === promise) {
        platformLoadInFlightRef.current = null;
      }
    }
  }, []);

  // Resolve saved session once before any protected route renders
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const savedToken = localStorage.getItem('skillfort_token');
      if (savedToken?.startsWith('mock-jwt-token-for-')) {
        clearAuthSession();
        if (!cancelled) setAuthHydrated(true);
        return;
      }
      if (!savedToken) {
        localStorage.removeItem('skillfort_user');
        if (!cancelled) setAuthHydrated(true);
        return;
      }

      try {
        const resp = await apiFetch('/api/auth/me');
        if (resp.ok) {
          if (!cancelled) setCurrentUser(await resp.json());
        } else {
          clearAuthSession();
        }
      } catch {
        clearAuthSession();
      } finally {
        if (!cancelled) setAuthHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Platform sync after auth is known — runs once per user session, never unmounts routes mid-sync
  useEffect(() => {
    if (!authHydrated) return;

    const userKey = currentUser?.id ?? '__anonymous__';
    if (lastPlatformUserRef.current === userKey) return;

    const syncId = ++platformSyncRef.current;
    void (async () => {
      if (currentUser?.id) {
        await migrateLocalStorageToServer(currentUser.id);
        await syncPlatformCache();
      }
      if (platformSyncRef.current !== syncId) return;

      lastPlatformUserRef.current = userKey;
      await loadPlatformData();
      if (platformSyncRef.current !== syncId) return;
      setPlatformReady(true);
    })();
  }, [authHydrated, currentUser?.id, loadPlatformData]);

  // Sign out when the same student logs in on another browser
  useEffect(() => {
    const onSessionReplaced = (event: Event) => {
      const message =
        (event as CustomEvent<string>).detail ||
        'Your account was signed in on another browser. You have been logged out here.';
      setCurrentUser(null);
      setAuthError(message);
      navigate('/');
    };
    window.addEventListener('skillfort:session-replaced', onSessionReplaced);
    return () => window.removeEventListener('skillfort:session-replaced', onSessionReplaced);
  }, [navigate]);

  // Poll session for students so the old browser logs out quickly
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'student') return;

    const interval = setInterval(async () => {
      if (!localStorage.getItem('skillfort_token')) return;
      await apiFetch('/api/auth/me');
    }, 15000);

    return () => clearInterval(interval);
  }, [currentUser?.id, currentUser?.role]);

  const resetAuthForm = () => {
    setAuthEmail('');
    setAuthPassword('');
    setAuthName('');
    setAuthFirstName('');
    setAuthLastName('');
    setAuthPhone('');
    setAuthConfirmPassword('');
    setRegistrationProfile(emptyRegistrationProfile());
    setShowPassword(false);
    setShowConfirmPassword(false);
    setAuthError('');
  };

  useEffect(() => {
    if (authView === 'login' || authView === 'register') {
      resetAuthForm();
    }
  }, [authView]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const resp = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await resp.json();
      if (resp.ok) {
        lastPlatformUserRef.current = undefined;
        setCurrentUser(data.user);
        localStorage.setItem('skillfort_token', data.token);
        localStorage.removeItem('skillfort_user');
        setAuthEmail('');
        setAuthPassword('');
        const defaultDest =
          data.user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard';
        navigate(resolvePostAuthDestination(data.user.role, defaultDest));
      } else {
        setAuthError(data.error || "Login parameters invalid");
      }
    } catch (err) {
      setAuthError("Network server configuration anomaly");
    }
  };

  const generateStrongPassword = () => {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const special = "!@#$%^&*()_+~=";
    
    // Pick at least one from each to guarantee meeting the criteria
    const uPart = uppercase[Math.floor(Math.random() * uppercase.length)];
    const lPart = lowercase[Math.floor(Math.random() * lowercase.length)];
    const nPart = numbers[Math.floor(Math.random() * numbers.length)];
    const sPart = special[Math.floor(Math.random() * special.length)];
    
    const pool = uppercase + lowercase + numbers + special;
    let extra = "";
    for (let i = 0; i < 10; i++) {
      extra += pool[Math.floor(Math.random() * pool.length)];
    }
    
    // Shuffle the combined string
    const combined = (uPart + lPart + nPart + sPart + extra)
      .split('')
      .sort(() => 0.5 - Math.random())
      .join('');
      
    setAuthPassword(combined);
    setAuthConfirmPassword(combined);
    setShowPassword(true);
    setShowConfirmPassword(true);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (authPassword !== authConfirmPassword) {
      setAuthError("Passwords do not match! Please verify your password entry.");
      return;
    }

    const { score, criteria } = getPasswordStrength(authPassword);
    
    // Explicit Validation Rules Check
    if (!criteria.length) {
      setAuthError("Validation Error: Password must be at least 8 characters long.");
      return;
    }
    if (!criteria.upper) {
      setAuthError("Validation Error: Password must contain at least one uppercase letter (A-Z).");
      return;
    }
    if (!criteria.lower) {
      setAuthError("Validation Error: Password must contain at least one lowercase letter (a-z).");
      return;
    }
    if (!criteria.number) {
      setAuthError("Validation Error: Password must contain at least one numeric digit (0-9).");
      return;
    }
    if (!criteria.special) {
      setAuthError("Validation Error: Password must contain at least one special character (e.g., !@#$%^&*).");
      return;
    }

    // Phone number simple format validation
    const cleanPhone = authPhone.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      setAuthError("Validation Error: Please enter a valid phone number with at least 8 digits.");
      return;
    }

    const requiredRegFields: Array<[keyof StudentRegistrationProfile, string]> = [
      ['branch', registrationProfile.branch],
      ['dateOfBirth', registrationProfile.dateOfBirth],
      ['highestQualification', registrationProfile.highestQualification],
      ['stream', registrationProfile.stream],
      ['collegeName', registrationProfile.collegeName],
      ['yearOfPassout', registrationProfile.yearOfPassout],
      ['requiredCourse', registrationProfile.requiredCourse],
      ['placementRequired', registrationProfile.placementRequired],
      ['hasWorkExperience', registrationProfile.hasWorkExperience],
      ['address', registrationProfile.address],
      ['source', registrationProfile.source],
    ];

    for (const [, value] of requiredRegFields) {
      if (!value.trim()) {
        setAuthError('Validation Error: Please complete all required registration fields.');
        return;
      }
    }

    const calculatedName = `${authFirstName} ${authLastName}`.trim() || authEmail.split('@')[0];

    try {
      const resp = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: authEmail, 
          password: authPassword, 
          name: calculatedName,
          firstName: authFirstName,
          lastName: authLastName,
          phone: authPhone,
          registrationProfile: {
            branch: registrationProfile.branch.trim(),
            dateOfBirth: registrationProfile.dateOfBirth,
            highestQualification: registrationProfile.highestQualification.trim(),
            stream: registrationProfile.stream.trim(),
            collegeName: registrationProfile.collegeName.trim(),
            yearOfPassout: registrationProfile.yearOfPassout.trim(),
            knownTechnologies: registrationProfile.knownTechnologies.trim() || undefined,
            requiredCourse: registrationProfile.requiredCourse.trim(),
            placementRequired: registrationProfile.placementRequired as 'yes' | 'no',
            preferredCallbackTime: registrationProfile.preferredCallbackTime.trim() || undefined,
            hasWorkExperience: registrationProfile.hasWorkExperience as 'yes' | 'no',
            address: registrationProfile.address.trim(),
            panNo: registrationProfile.panNo.trim() || undefined,
            aadharNo: registrationProfile.aadharNo.trim() || undefined,
            source: registrationProfile.source.trim(),
          },
        })
      });
      const data = await resp.json();
      if (resp.ok) {
        lastPlatformUserRef.current = undefined;
        setCurrentUser(data.user);
        localStorage.setItem('skillfort_token', data.token);
        localStorage.removeItem('skillfort_user');
        setAuthEmail('');
        setAuthPassword('');
        setAuthName('');
        setAuthFirstName('');
        setAuthLastName('');
        setAuthPhone('');
        setAuthConfirmPassword('');
        setRegistrationProfile(emptyRegistrationProfile());
        navigate('/register/success', { replace: true });
      } else {
        setAuthError(data.error || "Registration validation error");
      }
    } catch (err) {
      setAuthError("Platform registration error");
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // still clear local session if server is unreachable
    }
    platformSyncRef.current += 1;
    lastPlatformUserRef.current = undefined;
    setCurrentUser(null);
    clearAuthSession();
    navigate('/');
  };

  // Student checkout & cart (guest cart uses localStorage until checkout login)
  const cart = useCart({
    isAuthenticatedStudent: currentUser?.role === 'student',
    courses,
  });

  const triggerCheckout = async (
    courseIds: string[],
    couponCode?: string
  ): Promise<CheckoutSession> => {
    if (!currentUser) throw new Error('Not logged in');
    const resp = await apiFetch('/api/payments/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, courseIds, couponCode }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'Checkout could not be started');
    }
    return data as CheckoutSession;
  };

  const capturePayment = async (payload: Record<string, unknown>): Promise<void> => {
    const resp = await apiFetch('/api/payments/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'Payment capture failed');
    }
    await cart.refresh();
  };

  // Legacy single-course helpers (tests / admin simulators)
  const triggerRazorpayCheckoutSimulate = async (courseId: string, couponCode?: string) =>
    triggerCheckout([courseId], couponCode);

  const capturePaymentSimulate = async (payload: Record<string, unknown>) => {
    await capturePayment(payload);
    await loadPlatformData();
  };

  // Student specific enrollment list check
  const [myEnrollments, setMyEnrollments] = useState<Enrollment[]>([]);
  const [myPayments, setMyPayments] = useState<PaymentReport[]>([]);

  const fetchStudentPrivateData = async () => {
    if (currentUser && currentUser.role === 'student') {
      try {
        const enrolsResp = await apiFetch(`/api/students/enrollments/${currentUser.id}`);
        const enrols = await enrolsResp.json();
        setMyEnrollments(enrols);

        // Filter and compile payment reports for student
        const pmtsResp = await apiFetch('/api/payments/me');
        const pmts = await pmtsResp.json();
        setMyPayments(pmts.filter((p: any) => p.userId === currentUser.id));
      } catch (e) {
        console.error(e);
      }
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'student') {
      fetchStudentPrivateData();
    }
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    if (!currentUser) return;
    const redirectFromPublicPaths = ['/', '/login', '/register'];
    if (redirectFromPublicPaths.includes(location.pathname)) {
      navigate(
        currentUser.role === 'admin' ? '/admin/dashboard' : '/student/dashboard',
        { replace: true }
      );
    }
  }, [currentUser?.id, currentUser?.role, location.pathname, navigate]);

  const isAuthRecoveryPath = ['/forgot-password', '/reset-password'].includes(location.pathname);

  const handlePublicCoursePurchase = async (course: Course) => {
    const coursePath = `/courses/${course.id}`;
    if (course.price <= 0) {
      if (!currentUser) {
        setAuthReturn(coursePath);
        navigate('/login');
        return;
      }
      try {
        const resp = await apiFetch('/api/enrollments/free', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId: course.id }),
        });
        if (resp.status === 409) {
          await fetchStudentPrivateData();
          navigate(studentPath('my-courses', course.id));
          return;
        }
        if (!resp.ok) {
          const data = await resp.json();
          throw new Error(data.error || 'Enrollment failed');
        }
        await fetchStudentPrivateData();
        navigate(studentPath('my-courses', course.id));
      } catch (e) {
        console.error(e);
      }
      return;
    }
    setPendingCheckout(course.id);
    if (currentUser?.role === 'student') {
      navigate(`/student/dashboard?buy=${course.id}`);
      return;
    }
    setAuthReturn(coursePath);
    navigate('/login');
  };

  const handlePublicCourseContinue = async (course: Course) => {
    if (!currentUser) {
      navigate(studentPath('my-courses', course.id));
      return;
    }
    try {
      const resp = await apiFetch(`/api/students/continue/${currentUser.id}`);
      if (resp.ok) {
        const targets = (await resp.json()) as Array<{ courseId: string; lessonId?: string }>;
        const target = targets.find((t) => t.courseId === course.id);
        if (target?.lessonId) {
          navigate(studentPath('my-courses', course.id, target.lessonId));
          return;
        }
      }
    } catch {
      // fall through to course root
    }
    navigate(studentPath('my-courses', course.id));
  };

  const handlePublicCourseCheckout = async (course: Course) => {
    const coursePath = `/courses/${course.id}`;
    if (!cart.courseIds.includes(course.id) && course.price > 0) {
      try {
        await cart.addToCart(course.id);
      } catch (e) {
        console.error(e);
      }
    }
    if (currentUser?.role === 'student') {
      navigate(`${studentPath('cart')}?checkout=1`);
      return;
    }
    setPendingCartCheckout();
    setAuthReturn(coursePath);
    navigate('/login');
  };

  const publicSiteElement = (
    <PublicSiteRoute
      courses={courses}
      modules={modules}
      lessons={lessons}
      currentUser={currentUser}
      isDarkMode={isDarkMode}
      cartCount={cart.cartCount}
      cartItems={cart.cartItems}
      myEnrollments={myEnrollments}
      onToggleDarkMode={handleToggleDarkMode}
      onLogout={handleLogout}
      onPublicCoursePurchase={handlePublicCoursePurchase}
      onPublicCourseContinue={handlePublicCourseContinue}
      onPublicCourseCheckout={handlePublicCourseCheckout}
      onAddToCart={cart.addToCart}
      onRemoveFromCart={cart.removeFromCart}
    />
  );

  const appShellReady =
    authHydrated &&
    platformReady &&
    !isAuthRecoveryPath &&
    location.pathname !== '/register/success';

  const adminSettings =
    settings || {
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

  return (
    <div className="min-h-screen bg-black text-white font-sans antialiased relative">
      
      {/* Background glow effects strictly adhering to Sophisticated Dark */}
      <div className="absolute top-0 left-0 right-0 h-[450px] bg-gradient-to-b from-[#F89A15]/5 to-transparent pointer-events-none"></div>

      {!appShellReady ? (
        <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
          <div className="h-10 w-10 border-4 border-t-[#F89A15] border-gray-800 rounded-full animate-spin"></div>
          <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">Compiling active syllabus streams...</span>
        </div>
      ) : (
        <>
          <Routes>
            <Route path="/verify/:certNo" element={<VerifyCertificatePage />} />

            <Route path="/courses/:courseId" element={publicSiteElement} />
            <Route path="/courses" element={publicSiteElement} />

            <Route path="/" element={publicSiteElement} />
            <Route path="/login" element={publicSiteElement} />
            <Route path="/register" element={publicSiteElement} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route
              path="/register/success"
              element={
                <RegistrationSuccessRoute
                  currentUser={currentUser}
                  systemName={settings?.systemName ?? 'SkillFort LMS'}
                />
              }
            />

            <Route
              path="/admin/*"
              element={
                <ProtectedRoute user={currentUser} requiredRole="admin">
                  <AdminSiteRoute
                    currentUser={currentUser!}
                    courses={courses}
                    modules={modules}
                    lessons={lessons}
                    students={students}
                    admins={admins}
                    enrollments={enrollments}
                    coupons={coupons}
                    payments={payments}
                    certificates={certificates}
                    settings={adminSettings}
                    onLogout={handleLogout}
                    onRefreshData={loadPlatformData}
                    onAdminCreated={(admin) =>
                      setAdmins((prev) => {
                        if (prev.some((entry) => entry.id === admin.id)) return prev;
                        return [admin, ...prev];
                      })
                    }
                    onAdminDeleted={(adminId) =>
                      setAdmins((prev) => prev.filter((entry) => entry.id !== adminId))
                    }
                    onViewInvoice={(invoice) => setActiveInvoice(invoice)}
                    isDarkMode={isDarkMode}
                    onToggleDarkMode={handleToggleDarkMode}
                  />
                </ProtectedRoute>
              }
            />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

            <Route
              path="/student/*"
              element={
                <ProtectedRoute user={currentUser} requiredRole="student">
                  <StudentPortal
                    currentUser={currentUser!}
                    courses={courses}
                    modules={modules}
                    lessons={lessons}
                    enrollments={myEnrollments}
                    payments={myPayments}
                    certificates={certificates}
                    onLogout={handleLogout}
                    onRefreshData={async () => {
                      await loadPlatformData();
                      await fetchStudentPrivateData();
                      await cart.refresh();
                    }}
                    onTriggerCheckout={triggerCheckout}
                    onCapturePayment={capturePayment}
                    cartItems={cart.cartItems}
                    cartCount={cart.cartCount}
                    onAddToCart={cart.addToCart}
                    onRemoveFromCart={cart.removeFromCart}
                    onRefreshCart={cart.refresh}
                    onViewInvoice={(inv) => setActiveInvoice(inv)}
                    onViewCertificate={(cert) => setActiveCertificate(cert)}
                    coupons={coupons}
                    isDarkMode={isDarkMode}
                    onToggleDarkMode={handleToggleDarkMode}
                  />
                </ProtectedRoute>
              }
            />
            <Route path="/student" element={<Navigate to="/student/dashboard" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* MOCK AUTH POPUP PANEL OVERLAYS */}
          {authView !== 'none' && (
            <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className={`bg-[#0A0A0A] border border-[#222222] rounded-2xl w-full ${authView === 'register' ? 'max-w-3xl' : 'max-w-sm'} overflow-hidden p-8 space-y-6 transition-all duration-300 max-h-[90vh] overflow-y-auto`}>
                
                {/* Header authentication trigger */}
                <div className="flex justify-between items-center pb-4 border-b border-[#222222]">
                  <h3 className="font-display font-black text-lg text-white">
                    {authView === 'login' ? 'Proceed with Login' : 'Enroll with Registration'}
                  </h3>
                  <button 
                    onClick={() => { navigate('/'); resetAuthForm(); }}
                    className="p-1 hover:bg-[#111111] rounded text-gray-400 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>

                {authError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs flex items-center gap-2">
                    <AlertCircle size={14} /> <span>{authError}</span>
                  </div>
                )}

                <form
                  onSubmit={authView === 'login' ? handleLoginSubmit : handleRegisterSubmit}
                  className="space-y-4 text-left"
                  autoComplete="off"
                >
                  {authView === 'register' ? (
                    <div className="space-y-4">
                      {/* SECTION 1: PERSONAL INFORMATION */}
                      <div>
                        <h4 className="text-xs font-bold text-[#F89A15] uppercase tracking-wider mb-2 font-mono">Personal Profile Details</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-400 uppercase font-mono block">First Name *</label>
                            <div className="relative">
                              <UserIcon className="absolute left-3 top-3 text-gray-600" size={14} />
                              <input
                                type="text"
                                required
                                value={authFirstName}
                                onChange={(e) => setAuthFirstName(e.target.value)}
                                className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 pl-10 rounded-lg font-medium"
                                placeholder="Enter your first name"
                                autoComplete="off"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-400 uppercase font-mono block">Last Name *</label>
                            <div className="relative">
                              <UserIcon className="absolute left-3 top-3 text-gray-600" size={14} />
                              <input
                                type="text"
                                required
                                value={authLastName}
                                onChange={(e) => setAuthLastName(e.target.value)}
                                className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 pl-10 rounded-lg font-medium"
                                placeholder="Enter your last name"
                                autoComplete="off"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* SECTION 2: CONTACT */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-400 uppercase font-mono block">Email Address *</label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 text-gray-600" size={14} />
                            <input
                              type="email"
                              required
                              value={authEmail}
                              onChange={(e) => setAuthEmail(e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 pl-10 rounded-lg font-medium"
                              placeholder="Enter your email address"
                              autoComplete="off"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-400 uppercase font-mono block">Phone Number *</label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-3 text-gray-600" size={14} />
                            <input
                              type="tel"
                              required
                              value={authPhone}
                              onChange={(e) => setAuthPhone(e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 pl-10 rounded-lg font-medium"
                              placeholder="Enter your phone number"
                              autoComplete="off"
                            />
                          </div>
                        </div>
                      </div>

                      {/* SECTION 3: ENROLLMENT DETAILS */}
                      <div>
                        <h4 className="text-xs font-bold text-[#F89A15] uppercase tracking-wider mb-2 font-mono mt-2">Enrollment Details</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-400 uppercase font-mono block">Select Branch *</label>
                            <select
                              required
                              value={registrationProfile.branch}
                              onChange={(e) => setRegField('branch', e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 rounded-lg font-medium appearance-none"
                            >
                              <option value="">Select branch</option>
                              {REGISTRATION_BRANCHES.map((branch) => (
                                <option key={branch} value={branch}>{branch}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-400 uppercase font-mono block">Date of Birth *</label>
                            <div className="relative">
                              <input
                                type="date"
                                required
                                value={registrationProfile.dateOfBirth}
                                onChange={(e) => setRegField('dateOfBirth', e.target.value)}
                                onClick={(e) => {
                                  const input = e.currentTarget;
                                  if (typeof input.showPicker === 'function') {
                                    try {
                                      input.showPicker();
                                    } catch {
                                      input.focus();
                                    }
                                  }
                                }}
                                className="date-picker-full w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 rounded-lg font-medium cursor-pointer"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-400 uppercase font-mono block">Highest Educational Qualification *</label>
                            <select
                              required
                              value={registrationProfile.highestQualification}
                              onChange={(e) => setRegField('highestQualification', e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 rounded-lg font-medium appearance-none"
                            >
                              <option value="">Select qualification</option>
                              {HIGHEST_QUALIFICATIONS.map((item) => (
                                <option key={item} value={item}>{item}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-400 uppercase font-mono block">Stream *</label>
                            <input
                              type="text"
                              required
                              value={registrationProfile.stream}
                              onChange={(e) => setRegField('stream', e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 rounded-lg font-medium"
                              placeholder="Enter your stream (ARTS/ENGINEER & DEPARTMENT)"
                              autoComplete="off"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-400 uppercase font-mono block">College Name *</label>
                            <input
                              type="text"
                              required
                              value={registrationProfile.collegeName}
                              onChange={(e) => setRegField('collegeName', e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 rounded-lg font-medium"
                              placeholder="Enter your college name"
                              autoComplete="off"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-400 uppercase font-mono block">Year of Passed Out *</label>
                            <select
                              required
                              value={registrationProfile.yearOfPassout}
                              onChange={(e) => setRegField('yearOfPassout', e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 rounded-lg font-medium appearance-none"
                            >
                              <option value="">Select year</option>
                              {PASSOUT_YEARS.map((year) => (
                                <option key={year} value={year}>{year}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[10px] text-gray-400 uppercase font-mono block">Known Technologies (optional)</label>
                            <textarea
                              rows={2}
                              value={registrationProfile.knownTechnologies}
                              onChange={(e) => setRegField('knownTechnologies', e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 rounded-lg font-medium resize-none min-h-[42px]"
                              placeholder="Enter technologies you know (e.g. HTML, SQL, Java)"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-400 uppercase font-mono block">Required Course *</label>
                            <select
                              required
                              value={registrationProfile.requiredCourse}
                              onChange={(e) => setRegField('requiredCourse', e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 rounded-lg font-medium appearance-none"
                            >
                              <option value="">Select required course</option>
                              {REQUIRED_COURSES.map((course) => (
                                <option key={course} value={course}>{course}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-400 uppercase font-mono block">Preferred Callback Time (optional)</label>
                            <input
                              type="text"
                              value={registrationProfile.preferredCallbackTime}
                              onChange={(e) => setRegField('preferredCallbackTime', e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 rounded-lg font-medium"
                              placeholder="Enter preferred callback time"
                              autoComplete="off"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-400 uppercase font-mono block">Placement Required *</label>
                            <div className="flex gap-4 pt-2">
                              {(['yes', 'no'] as const).map((value) => (
                                <label key={value} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="placementRequired"
                                    required
                                    checked={registrationProfile.placementRequired === value}
                                    onChange={() => setRegField('placementRequired', value)}
                                    className="accent-[#F89A15]"
                                  />
                                  {value === 'yes' ? 'Yes' : 'No'}
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-400 uppercase font-mono block">Do You Have Any Work Experience? *</label>
                            <div className="flex gap-4 pt-2">
                              {(['yes', 'no'] as const).map((value) => (
                                <label key={value} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="hasWorkExperience"
                                    required
                                    checked={registrationProfile.hasWorkExperience === value}
                                    onChange={() => setRegField('hasWorkExperience', value)}
                                    className="accent-[#F89A15]"
                                  />
                                  {value === 'yes' ? 'Yes' : 'No'}
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[10px] text-gray-400 uppercase font-mono block">Address *</label>
                            <textarea
                              required
                              rows={2}
                              value={registrationProfile.address}
                              onChange={(e) => setRegField('address', e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 rounded-lg font-medium resize-none"
                              placeholder="Enter your full address"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-400 uppercase font-mono block">PAN No (optional)</label>
                            <input
                              type="text"
                              value={registrationProfile.panNo}
                              onChange={(e) => setRegField('panNo', e.target.value.toUpperCase())}
                              className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 rounded-lg font-medium uppercase"
                              placeholder="Enter PAN number"
                              autoComplete="off"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-400 uppercase font-mono block">Aadhar No (optional)</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={registrationProfile.aadharNo}
                              onChange={(e) => setRegField('aadharNo', e.target.value.replace(/\D/g, ''))}
                              className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 rounded-lg font-medium"
                              placeholder="Enter Aadhar number"
                              autoComplete="off"
                            />
                          </div>

                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[10px] text-gray-400 uppercase font-mono block">Source *</label>
                            <select
                              required
                              value={registrationProfile.source}
                              onChange={(e) => setRegField('source', e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 rounded-lg font-medium appearance-none"
                            >
                              <option value="">How did you hear about us?</option>
                              {REGISTRATION_SOURCES.map((source) => (
                                <option key={source} value={source}>{source}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* SECTION 4: SECURITY PASSWORD GATE */}
                      <div>
                        <div className="flex justify-between items-center mb-2 mt-2">
                          <h4 className="text-xs font-bold text-[#F89A15] uppercase tracking-wider font-mono">Account Password Settings</h4>
                          <button 
                            type="button" 
                            onClick={generateStrongPassword}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 font-mono font-bold bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded transition-all border border-emerald-500/20 flex items-center gap-1 cursor-pointer"
                          >
                            ✨ Suggest Strong Password
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-400 uppercase font-mono block">Set Password</label>
                            <div className="relative">
                              <Lock className="absolute left-3 top-3 text-gray-600" size={14} />
                              <input 
                                type={showPassword ? 'text' : 'password'} required
                                value={authPassword} onChange={e => setAuthPassword(e.target.value)}
                                className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 pl-10 pr-10 rounded-lg font-medium"
                                placeholder="Create a secure password"
                                autoComplete="new-password"
                              />
                              <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-3 text-gray-500 hover:text-white transition-colors bg-transparent border-0 p-0 cursor-pointer"
                                title={showPassword ? "Hide password" : "Show password"}
                              >
                                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>

                            {/* Dynamic line indicator directly below the password input bottom edge */}
                            {authPassword && (
                              <div className="space-y-1 mt-1">
                                <div className="h-1 w-full bg-neutral-900 rounded-full overflow-hidden flex gap-0.5">
                                  {[1, 2, 3, 4, 5].map((index) => {
                                    const pStrength = getPasswordStrength(authPassword);
                                    const isActive = index <= pStrength.score;
                                    return (
                                      <div 
                                        key={index} 
                                        className={`h-full flex-1 transition-all duration-300 ${
                                          isActive ? pStrength.color : 'bg-neutral-800'
                                        }`}
                                      />
                                    );
                                  })}
                                </div>
                                <div className="flex items-center justify-between text-[9px] font-mono text-gray-500 select-none">
                                  <span>Strength Level:</span>
                                  <span className={`font-bold uppercase ${getPasswordStrength(authPassword).text}`}>
                                    {getPasswordStrength(authPassword).label}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-400 uppercase font-mono block">Confirm Password</label>
                            <div className="relative">
                              <Lock className="absolute left-3 top-3 text-gray-600" size={14} />
                              <input 
                                type={showConfirmPassword ? 'text' : 'password'} required
                                value={authConfirmPassword} onChange={e => setAuthConfirmPassword(e.target.value)}
                                className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 pl-10 pr-10 rounded-lg font-medium"
                                placeholder="Re-enter your password"
                                autoComplete="new-password"
                              />
                              <button 
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-3 text-gray-500 hover:text-white transition-colors bg-transparent border-0 p-0 cursor-pointer"
                                title={showConfirmPassword ? "Hide password" : "Show password"}
                              >
                                {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Checklist and smart guidance below the inputs without containers */}
                        <div className="mt-3.5 space-y-2.5">
                          {authPassword && (() => {
                            const pStrength = getPasswordStrength(authPassword);
                            let smartSuggestion = "";
                            if (!pStrength.criteria.length) {
                              smartSuggestion = "💡 Tip: Passwords must be at least 8 characters long.";
                            } else if (!pStrength.criteria.upper) {
                              smartSuggestion = "💡 Tip: Mix in at least one CAPITAL letter (A-Z).";
                            } else if (!pStrength.criteria.lower) {
                              smartSuggestion = "💡 Tip: Add at least one small letter (a-z).";
                            } else if (!pStrength.criteria.number) {
                              smartSuggestion = "💡 Tip: Use numerical digits (0-9) to secure your student file.";
                            } else if (!pStrength.criteria.special) {
                              smartSuggestion = "💡 Tip: Insert a special symbol (!@#$%^&*()_+~=) for heavy-duty safety.";
                            }
                            return smartSuggestion ? (
                              <p className="text-[10px] text-[#F89A15] italic font-medium ml-1">
                                {smartSuggestion}
                              </p>
                            ) : null;
                          })()}

                          {(() => {
                            const pStrength = getPasswordStrength(authPassword);
                            return (
                              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] pl-1 font-mono select-none">
                                <div className="flex items-center gap-2">
                                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] border transition-all ${
                                    pStrength.criteria.length 
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold' 
                                      : 'bg-neutral-900 text-gray-600 border-[#222222]'
                                  }`}>
                                    {pStrength.criteria.length ? '✓' : '•'}
                                  </span>
                                  <span className={pStrength.criteria.length ? 'text-gray-300 font-medium' : 'text-gray-500'}>
                                    Min 8 Characters
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] border transition-all ${
                                    pStrength.criteria.upper 
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold' 
                                      : 'bg-neutral-900 text-gray-600 border-[#222222]'
                                  }`}>
                                    {pStrength.criteria.upper ? '✓' : '•'}
                                  </span>
                                  <span className={pStrength.criteria.upper ? 'text-gray-300 font-medium' : 'text-gray-500'}>
                                    Uppercase (A-Z)
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] border transition-all ${
                                    pStrength.criteria.lower 
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold' 
                                      : 'bg-neutral-900 text-gray-600 border-[#222222]'
                                  }`}>
                                    {pStrength.criteria.lower ? '✓' : '•'}
                                  </span>
                                  <span className={pStrength.criteria.lower ? 'text-gray-300 font-medium' : 'text-gray-500'}>
                                    Lowercase (a-z)
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] border transition-all ${
                                    pStrength.criteria.number 
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold' 
                                      : 'bg-neutral-900 text-gray-600 border-[#222222]'
                                  }`}>
                                    {pStrength.criteria.number ? '✓' : '•'}
                                  </span>
                                  <span className={pStrength.criteria.number ? 'text-gray-300 font-medium' : 'text-gray-500'}>
                                    Digit (0-9)
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 col-span-2">
                                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] border transition-all ${
                                    pStrength.criteria.special 
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold' 
                                      : 'bg-neutral-900 text-gray-600 border-[#222222]'
                                  }`}>
                                    {pStrength.criteria.special ? '✓' : '•'}
                                  </span>
                                  <span className={pStrength.criteria.special ? 'text-gray-300 font-medium' : 'text-gray-500'}>
                                    Special Character (!@#$%^&*()_+~=)
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                    </div>
                  ) : (
                    // LOGIN VIEW
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-gray-400 uppercase font-mono block">Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 text-gray-600" size={14} />
                          <input 
                            type="email" required
                            value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                            className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 pl-10 rounded-lg font-medium"
                            placeholder="Enter your email address"
                            autoComplete="off"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-gray-400 uppercase font-mono block">Secret Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 text-gray-600" size={14} />
                          <input 
                            type={showPassword ? 'text' : 'password'} required
                            value={authPassword} onChange={e => setAuthPassword(e.target.value)}
                            className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 pl-10 pr-10 rounded-lg font-medium"
                            placeholder="Enter your password"
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-3 text-gray-500 hover:text-white transition-colors bg-transparent border-0 p-0 cursor-pointer"
                            title={showPassword ? 'Hide password' : 'Show password'}
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                        <div className="text-right pt-1">
                          <button
                            type="button"
                            onClick={() => navigate('/forgot-password')}
                            className="text-[10px] text-[#F89A15] font-semibold hover:underline bg-transparent border-0 cursor-pointer"
                          >
                            Forgot password?
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <button 
                    type="submit"
                    className="w-full py-3 bg-[#F89A15] text-black hover:bg-white disabled:opacity-60 text-xs font-bold uppercase rounded-xl transition-all shadow-md mt-4 cursor-pointer"
                  >
                    {authView === 'login' ? 'Sign In Securely' : 'Complete Registration Setup'}
                  </button>
                </form>

                <div className="text-center text-[11px] text-gray-500 pt-2 selection:bg-none">
                  {authView === 'login' ? (
                    <p>New to SkillFort LMS? <button onClick={() => { navigate('/register'); resetAuthForm(); }} className="text-[#F89A15] font-semibold hover:underline bg-transparent border-0 cursor-pointer">Create registered student file</button></p>
                  ) : (
                    <p>Already registered account? <button onClick={() => { navigate('/login'); resetAuthForm(); }} className="text-[#F89A15] font-semibold hover:underline bg-transparent border-0 cursor-pointer">Proceed with Login</button></p>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TRANSACTION INVOICES DIALOG OVERLAY */}
          {activeInvoice && (
            <InvoiceModal 
              payment={activeInvoice}
              onClose={() => setActiveInvoice(null)}
            />
          )}

          {/* GENERAL SYSTEM VERIFIED CERTIFICATE DYNAMIC VIEW OVERLAYS */}
          {activeCertificate && (
            <CertificateModal 
              certificate={activeCertificate}
              onClose={() => setActiveCertificate(null)}
            />
          )}

        </>
      )}

    </div>
  );
}
