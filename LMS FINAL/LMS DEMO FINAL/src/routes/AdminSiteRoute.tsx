import AdminPanel from '../features/admin/AdminPanel';
import type {
  Certificate,
  Coupon,
  Course,
  CourseModule,
  Enrollment,
  Lesson,
  PaymentReport,
  SystemSettings,
  User,
} from '../types';

export interface AdminSiteRouteProps {
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
  isDarkMode: boolean;
  onLogout: () => void;
  onRefreshData: () => Promise<void>;
  onAdminCreated: (admin: User) => void;
  onAdminDeleted: (adminId: string) => void;
  onViewInvoice: (invoice: PaymentReport) => void;
  onToggleDarkMode: () => void;
}

/** Stable route shell — must not be defined inside AppContent or it remounts on every parent render. */
export default function AdminSiteRoute({
  currentUser,
  ...rest
}: AdminSiteRouteProps) {
  return <AdminPanel currentUser={currentUser} {...rest} />;
}
