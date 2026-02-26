import { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '../lib/api';
import type { User, Student, Supervisor, RegisterRequest } from '../types/database';

interface AuthContextType {
  user: User | null;
  student: Student | null;
  supervisor: Supervisor | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (userData: RegisterRequest) => Promise<{ success: boolean; error?: string }>;
  signOut: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [supervisor, setSupervisor] = useState<Supervisor | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const token = localStorage.getItem('supervise360_token');
        if (token) {
          apiClient.setToken(token);
          const response = await apiClient.getCurrentUser();
          
          if (response.success && response.data) {
            setUser(response.data.user);
            setStudent(response.data.student || null);
            setSupervisor(response.data.supervisor || null);
          } else {
            // Invalid session, clear it
            localStorage.removeItem('supervise360_token');
            apiClient.setToken(null);
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
        localStorage.removeItem('supervise360_token');
        apiClient.setToken(null);
      } finally {
        setLoading(false);
      }
    };

    checkExistingSession();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await apiClient.login({ email, password });

      if (response.success && response.data) {
        setUser(response.data.user);
        setStudent(response.data.student || null);
        setSupervisor(response.data.supervisor || null);
        return { success: true };
      } else {
        const errMsg = response.message || response.error || 'Invalid email or password. Please try again.';
        return { success: false, error: errMsg };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Network error. Please check your connection.';
      return { success: false, error: msg };
    }
  };

  const signUp = async (userData: RegisterRequest): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await apiClient.register(userData);

      if (response.success && response.data) {
        setUser(response.data.user);
        setStudent(response.data.student || null);
        setSupervisor(response.data.supervisor || null);
        return { success: true };
      } else {
        const errMsg = response.message || response.error || 'Registration failed. Please try again.';
        return { success: false, error: errMsg };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Network error. Please check your connection.';
      return { success: false, error: msg };
    }
  };

  const signOut = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setStudent(null);
      setSupervisor(null);
      apiClient.setToken(null);
    }
  };

  const isAuthenticated = user !== null;

  return (
    <AuthContext.Provider
      value={{
        user,
        student,
        supervisor,
        loading,
        signIn,
        signUp,
        signOut,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}