import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { GroupsProvider } from './contexts/GroupsContext';
import { DepartmentProvider } from './contexts/DepartmentContext';
import { testDatabaseConnection } from './lib/database-test';
import { AuthFlow } from './components/AuthFlow';
import { LoadingPage } from './components/LoadingPage';
import { AdminLogin } from './pages/AdminLogin';

// Dashboard Pages
import { StudentDashboard } from './pages/StudentDashboard';
import { SupervisorDashboard } from './pages/SupervisorDashboard';
import { AdminDashboard } from './pages/AdminDashboard';

// Student Pages
import { MyGroup } from './pages/student/MyGroup';
import { Reports } from './pages/student/Reports';
import { Messages } from './pages/student/Messages';
import { Profile } from './pages/student/Profile';
import { DefenseEvaluation } from './pages/student/DefenseEvaluation';

// Supervisor Pages
import { MyGroups } from './pages/supervisor/MyGroups';
import { Evaluations } from './pages/supervisor/Evaluations';
import { SupervisorMessages } from './pages/supervisor/SupervisorMessages';
import { SupervisorProfile } from './pages/supervisor/SupervisorProfile';
import { ReportReviews } from './pages/supervisor/ReportReviews';

// Admin Pages
import { Users } from './pages/admin/Users';
import { Groups } from './pages/admin/Groups';
import { SupervisorAssignment } from './pages/admin/SupervisorAssignment';
import { Settings } from './pages/admin/Settings';
import { AdminProfile } from './pages/admin/AdminProfile';
import { DefenseScheduling } from './pages/admin/DefenseScheduling';
import { ReportsAnalytics } from './pages/admin/ReportsAnalytics';
import { Departments } from './pages/admin/Departments';

function App() {
  const { user, loading } = useAuth();
  const [dbStatus, setDbStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [testingDb, setTestingDb] = useState(true);

  // Test database connection on app start
  useEffect(() => {
    const testDb = async () => {
      try {
        const result = await testDatabaseConnection();
        setDbStatus(result);
      } catch (error) {
        setDbStatus({
          success: false,
          message: 'Failed to test database connection'
        });
      } finally {
        setTestingDb(false);
      }
    };

    testDb();
  }, []);

  // Show database connection status
  if (testingDb) {
    return <LoadingPage message="Connecting to server..." />;
  }

  // Show backend connection error (with option to continue - Railway cold start can take time)
  if (dbStatus && !dbStatus.success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#c41e3a] via-[#e63950] to-[#c41e3a]" />
        <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/50 max-w-md w-full mx-4 border border-slate-100">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Backend Connection Failed</h2>
            <p className="text-slate-600 text-sm mb-4">{dbStatus.message}</p>
            <div className="text-xs text-slate-500 text-left bg-slate-50 rounded-xl p-4 mb-6">
              <p className="font-medium text-slate-600 mb-2">Please check:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Backend is deployed and running</li>
                <li>VITE_API_URL is set in frontend variables</li>
                <li>Backend URL is correct</li>
              </ul>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-gradient-to-r from-brand-600 to-brand-800 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-brand-900/20"
              >
                Retry
              </button>
              <button
                onClick={() => setDbStatus({ success: true, message: '' })}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                Continue anyway
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return <LoadingPage message="Loading your dashboard..." />;
  }

  // Show login if not authenticated
  if (!user) {
    return (
      <Router>
        <Routes>
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="*" element={<AuthFlow />} />
        </Routes>
      </Router>
    );
  }

  // Route to appropriate dashboard based on user role
  return (
    <DepartmentProvider>
      <GroupsProvider>
        <Router>
          <Routes>
            {user.role === 'student' && (
              <>
                <Route path="/dashboard" element={<StudentDashboard />} />
                <Route path="/my-group" element={<MyGroup />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/defense-evaluation" element={<DefenseEvaluation />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </>
            )}
            
            {(user.role === 'supervisor' || user.role === 'external_supervisor') && (
              <>
                <Route path="/dashboard" element={<SupervisorDashboard />} />
                <Route path="/my-groups" element={<MyGroups />} />
                <Route path="/evaluations" element={<Evaluations />} />
                <Route path="/report-reviews" element={<ReportReviews />} />
                <Route path="/messages" element={<SupervisorMessages />} />
                <Route path="/profile" element={<SupervisorProfile />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </>
            )}
            
            {user.role === 'admin' && (
              <>
                <Route path="/dashboard" element={<AdminDashboard />} />
                <Route path="/departments" element={<Departments />} />
                <Route path="/users" element={<Users />} />
                <Route path="/groups" element={<Groups />} />
                <Route path="/supervisor-assignment" element={<SupervisorAssignment />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<AdminProfile />} />
                <Route path="/defense-scheduling" element={<DefenseScheduling />} />
                <Route path="/reports-analytics" element={<ReportsAnalytics />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </>
            )}
            
            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </GroupsProvider>
    </DepartmentProvider>
  );
}

export default App;