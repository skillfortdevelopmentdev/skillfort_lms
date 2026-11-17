import { Navigate, useNavigate } from 'react-router-dom';
import RegistrationSuccessPage from '../pages/RegistrationSuccessPage';
import type { User } from '../types';
import { resolvePostAuthDestination } from '../utils/authReturn';

interface RegistrationSuccessRouteProps {
  currentUser: User | null;
  systemName: string;
}

export default function RegistrationSuccessRoute({
  currentUser,
  systemName,
}: RegistrationSuccessRouteProps) {
  const navigate = useNavigate();

  if (!currentUser || currentUser.role !== 'student') {
    return <Navigate to="/register" replace />;
  }

  return (
    <RegistrationSuccessPage
      userName={currentUser.name}
      userEmail={currentUser.email}
      systemName={systemName}
      onGoToDashboard={() =>
        navigate(resolvePostAuthDestination('student', '/student/dashboard'))
      }
    />
  );
}
