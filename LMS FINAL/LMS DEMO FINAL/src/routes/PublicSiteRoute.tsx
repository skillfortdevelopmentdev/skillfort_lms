import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PublicWebsite from '../components/PublicWebsite';
import type { Course, CourseModule, Enrollment, Lesson, User } from '../types';
import { setAuthReturn, setPendingCartCheckout, setPendingCheckout } from '../utils/authReturn';
import { studentBrowsePath, studentPath } from './studentRoutes';

export interface PublicSiteRouteProps {
  courses: Course[];
  modules: CourseModule[];
  lessons: Lesson[];
  currentUser: User | null;
  isDarkMode: boolean;
  cartCount: number;
  cartItems: Course[];
  myEnrollments: Enrollment[];
  onToggleDarkMode: () => void;
  onLogout: () => void;
  onPublicCoursePurchase: (course: Course) => void | Promise<void>;
  onPublicCourseContinue: (course: Course) => void | Promise<void>;
  onPublicCourseCheckout: (course: Course) => void | Promise<void>;
  onAddToCart: (courseId: string) => Promise<void>;
  onRemoveFromCart: (courseId: string) => Promise<void>;
}

/** Stable route shell — must not be defined inside AppContent or it remounts on every parent render. */
export default function PublicSiteRoute({
  courses,
  modules,
  lessons,
  currentUser,
  isDarkMode,
  cartCount,
  cartItems,
  myEnrollments,
  onToggleDarkMode,
  onLogout,
  onPublicCoursePurchase,
  onPublicCourseContinue,
  onPublicCourseCheckout,
  onAddToCart,
  onRemoveFromCart,
}: PublicSiteRouteProps) {
  const { courseId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabQuery = searchParams.get('tab');
  const course = courseId ? courses.find((c) => c.id === courseId) : undefined;

  if (courseId && !course) {
    return <Navigate to="/courses" replace />;
  }
  if (courseId && currentUser?.role === 'student') {
    return <Navigate to={studentBrowsePath(courseId)} replace />;
  }

  let initialTab: 'home' | 'about' | 'courses' | 'contact' = 'home';
  if (location.pathname.startsWith('/courses')) {
    initialTab = 'courses';
  } else if (tabQuery === 'about' || tabQuery === 'contact') {
    initialTab = tabQuery;
  }

  return (
    <PublicWebsite
      courses={courses}
      modules={modules}
      lessons={lessons}
      browseCourseId={courseId ?? null}
      initialTab={initialTab}
      onNavigateToTab={(tab) => {
        if (tab === 'home') {
          navigate('/');
          return;
        }
        if (tab === 'courses') {
          navigate('/courses');
          return;
        }
        navigate(`/?tab=${tab}`);
      }}
      onCloseCourseBrowse={() => navigate('/courses')}
      onSelectCourse={(id) => {
        if (currentUser?.role === 'student') {
          navigate(studentBrowsePath(id));
          return;
        }
        navigate(`/courses/${id}`);
      }}
      onCoursePurchase={onPublicCoursePurchase}
      onCourseContinue={onPublicCourseContinue}
      onCourseCheckout={onPublicCourseCheckout}
      onCourseSignIn={(course) => {
        setAuthReturn(`/courses/${course.id}`);
        setPendingCheckout(course.id);
        navigate('/login');
      }}
      onCourseRegister={(course) => {
        setAuthReturn(`/courses/${course.id}`);
        setPendingCheckout(course.id);
        navigate('/register');
      }}
      onNavigateToAuth={(view) => navigate(view === 'login' ? '/login' : '/register')}
      currentUser={currentUser}
      onLogout={onLogout}
      onEnterPortal={() =>
        navigate(currentUser?.role === 'admin' ? '/admin/dashboard' : '/student/dashboard')
      }
      isDarkMode={isDarkMode}
      onToggleDarkMode={onToggleDarkMode}
      cartCount={cartCount}
      cartItems={cartItems}
      enrolledCourseIds={myEnrollments.map((e) => e.courseId)}
      enrollments={myEnrollments}
      onAddToCart={onAddToCart}
      onRemoveFromCart={onRemoveFromCart}
      onCheckout={() => {
        if (currentUser?.role === 'student') {
          navigate(`${studentPath('cart')}?checkout=1`);
          return;
        }
        setPendingCartCheckout();
        setAuthReturn('/');
        navigate('/login');
      }}
    />
  );
}
