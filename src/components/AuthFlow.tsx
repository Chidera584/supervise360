import { useState } from 'react';
import { RoleSelection } from '../pages/RoleSelection';
import { Login } from '../pages/Login';

export function AuthFlow() {
  const [selectedRole, setSelectedRole] = useState<'student' | 'supervisor' | null>(null);

  const handleRoleSelect = (role: 'student' | 'supervisor') => {
    setSelectedRole(role);
  };

  const handleBackToRoleSelection = () => {
    setSelectedRole(null);
  };

  if (!selectedRole) {
    return <RoleSelection onRoleSelect={handleRoleSelect} />;
  }

  return (
    <Login 
      selectedRole={selectedRole} 
      onBackToRoleSelection={handleBackToRoleSelection} 
    />
  );
}