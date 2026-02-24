import { Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { LandingPage } from '../pages/LandingPage';
import { Login } from '../pages/Login';

function LoginWithRole() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get('role');
  const selectedRole = roleParam === 'supervisor' ? 'supervisor' : 'student';

  return (
    <Login
      selectedRole={selectedRole}
      onBackToRoleSelection={() => navigate('/')}
    />
  );
}

export function AuthFlow() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginWithRole />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
