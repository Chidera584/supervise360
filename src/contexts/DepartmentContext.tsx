import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export const DEPARTMENTS = [
  'Computer Science',
  'Information Systems', 
  'Software Engineering',
  'Data Science',
  'Cybersecurity'
] as const;

export type Department = typeof DEPARTMENTS[number];

interface DepartmentContextType {
  userDepartment: Department;
  isSystemAdmin: boolean;
  canAccessDepartment: (department: string) => boolean;
  filterByDepartment: <T extends { department?: string }>(items: T[]) => T[];
}

const DepartmentContext = createContext<DepartmentContextType | undefined>(undefined);

export function DepartmentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  // For now, we'll determine department from user email or set a default
  // In a real system, this would come from the user's profile
  const getUserDepartment = (): Department => {
    if (!user?.email) return 'Software Engineering';
    
    // Admin users default to Software Engineering
    if (user.email === 'admin@supervise360.com' || user.role === 'admin' || user.role === 'system_admin') {
      return 'Software Engineering';
    }
    
    // Simple logic to assign departments based on email or other criteria
    const email = user.email.toLowerCase();
    if (email.includes('cs') || email.includes('computer')) return 'Computer Science';
    if (email.includes('se') || email.includes('software')) return 'Software Engineering';
    if (email.includes('ds') || email.includes('data')) return 'Data Science';
    if (email.includes('cyber') || email.includes('security')) return 'Cybersecurity';
    if (email.includes('is') || email.includes('information')) return 'Information Systems';
    
    // Default department - Software Engineering
    return 'Software Engineering';
  };

  const userDepartment = getUserDepartment();
  
  // System admin can access all departments (for super admin functionality)
  const isSystemAdmin = user?.email === 'admin@supervise360.com' || user?.role === 'system_admin';
  
  const canAccessDepartment = (department: string): boolean => {
    if (isSystemAdmin) return true;
    return department === userDepartment;
  };

  const filterByDepartment = <T extends { department?: string }>(items: T[]): T[] => {
    if (isSystemAdmin) return items;
    return items.filter(item => 
      !item.department || item.department === userDepartment
    );
  };

  return (
    <DepartmentContext.Provider value={{
      userDepartment,
      isSystemAdmin,
      canAccessDepartment,
      filterByDepartment
    }}>
      {children}
    </DepartmentContext.Provider>
  );
}

export function useDepartment() {
  const context = useContext(DepartmentContext);
  if (context === undefined) {
    throw new Error('useDepartment must be used within a DepartmentProvider');
  }
  return context;
}