import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { apiClient } from '../lib/api';

export const DEPARTMENTS = [
  'Computer Science',
  'Software Engineering',
  'Computer Technology',
  'Information Technology',
  'Computer Information Systems',
] as const;

export type Department = typeof DEPARTMENTS[number];

interface DepartmentContextType {
  userDepartment: Department;
  /** Admin only: departments this admin manages. null = all (super admin) */
  adminDepartments: string[] | null;
  isSystemAdmin: boolean;
  managesAllDepartments: boolean;
  canAccessDepartment: (department: string) => boolean;
  filterByDepartment: <T extends { department?: string }>(items: T[]) => T[];
  refreshAdminDepartments: () => Promise<void>;
}

const DepartmentContext = createContext<DepartmentContextType | undefined>(undefined);

export function DepartmentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [adminDepartments, setAdminDepartments] = useState<string[] | null>(null);
  const [managesAll, setManagesAll] = useState(true);

  const refreshAdminDepartments = async () => {
    if (user?.role !== 'admin') return;
    try {
      const res = await apiClient.getAdminDepartments();
      if (res.success && res.data) {
        const d = res.data as { names: string[] | null; managesAll: boolean };
        setAdminDepartments(d.names);
        setManagesAll(d.managesAll ?? true);
      }
    } catch {
      setAdminDepartments(null);
      setManagesAll(true);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      refreshAdminDepartments();
    } else {
      setAdminDepartments(null);
      setManagesAll(true);
    }
  }, [user?.id, user?.role]);

  const getUserDepartment = (): Department => {
    if (!user?.email) return 'Software Engineering';
    if (user.role === 'admin' || user.role === 'system_admin') {
      return (user as any).department || 'Software Engineering';
    }
    return (user as any).department || 'Software Engineering';
  };

  const userDepartment = getUserDepartment();
  const isSystemAdmin = managesAll || (adminDepartments !== null && adminDepartments.length === 0);

  const canAccessDepartment = (department: string): boolean => {
    if (user?.role === 'admin') {
      if (managesAll || !adminDepartments || adminDepartments.length === 0) return true;
      return adminDepartments.includes(department);
    }
    return department === userDepartment;
  };

  const filterByDepartment = <T extends { department?: string }>(items: T[]): T[] => {
    if (user?.role === 'admin' && (managesAll || !adminDepartments || adminDepartments.length === 0)) {
      return items;
    }
    if (user?.role === 'admin' && adminDepartments && adminDepartments.length > 0) {
      return items.filter((item) => !item.department || adminDepartments.includes(item.department));
    }
    return items.filter((item) => !item.department || item.department === userDepartment);
  };

  return (
    <DepartmentContext.Provider
      value={{
        userDepartment,
        adminDepartments,
        isSystemAdmin: managesAll,
        managesAllDepartments: managesAll,
        canAccessDepartment,
        filterByDepartment,
        refreshAdminDepartments,
      }}
    >
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