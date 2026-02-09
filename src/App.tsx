import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { GroupsProvider } from './contexts/GroupsContext';
import { DepartmentProvider } from './contexts/DepartmentContext';
import { testDatabaseConnection } from './lib/database-test';
import { AuthFlow } from './components/AuthFlow';
import { AdminLogin } from './pages/AdminLogin';

// Dashboard Pages
import { StudentDashboard } from './pages/StudentDashboard';
import { SupervisorDashboard } from './pages/SupervisorDashboard';
import { AdminDashboard } from './pages/AdminDashboard';

// Student Pages
import { MyGroup } from './pages/student/MyGroup';
import { Project } from './pages/student/Project';
import { Reports } from './pages/student/Reports';
import { Messages } from './pages/student/Messages';
import { Profile } from './pages/student/Profile';

// Supervisor Pages
import { MyGroups } from './pages/supervisor/MyGroups';
import { Evaluations } from './pages/supervisor/Evaluations';
import { SupervisorMessages } from './pages/supervisor/SupervisorMessages';
import { SupervisorProfile } from './pages/supervisor/SupervisorProfile';

// Admin Pages
import { Users } from './pages/admin/Users';
import { Groups } from './pages/admin/Groups';
import { SupervisorAssignment } from './pages/admin/SupervisorAssignment';
import { Projects } from './pages/admin/Projects';
import { Settings } from './pages/admin/Settings';

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
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 mb-2">Testing database connection...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Show database connection error
  if (dbStatus && !dbStatus.success) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-600 text-xl mb-4">⚠️ Database Connection Failed</div>
            <p className="text-gray-600 mb-4">{dbStatus.message}</p>
            <div className="text-sm text-gray-500">
              <p className="mb-2">Please check:</p>
              <ul className="text-left list-disc list-inside space-y-1">
                <li>MySQL server is running</li>
                <li>Database credentials in .env file</li>
                <li>Database 'supervise360' exists</li>
                <li>Tables have been created</li>
              </ul>
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 mb-2">Loading...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
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
                <Route path="/project" element={<Project />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </>
            )}
            
            {(user.role === 'supervisor' || user.role === 'external_supervisor') && (
              <>
                <Route path="/dashboard" element={<SupervisorDashboard />} />
                <Route path="/my-groups" element={<MyGroups />} />
                <Route path="/evaluations" element={<Evaluations />} />
                <Route path="/messages" element={<SupervisorMessages />} />
                <Route path="/profile" element={<SupervisorProfile />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </>
            )}
            
            {user.role === 'admin' && (
              <>
                <Route path="/dashboard" element={<AdminDashboard />} />
                <Route path="/users" element={<Users />} />
                <Route path="/groups" element={<Groups />} />
                <Route path="/supervisor-assignment" element={<SupervisorAssignment />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/settings" element={<Settings />} />
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