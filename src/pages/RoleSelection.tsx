import { useState } from 'react';
import { Button } from '../components/UI/Button';
import { ArrowRight, Target, Shield, Users } from 'lucide-react';

interface RoleSelectionProps {
  onRoleSelect: (role: 'student' | 'supervisor') => void;
}

export function RoleSelection({ onRoleSelect }: RoleSelectionProps) {
  const [selectedRole, setSelectedRole] = useState<'student' | 'supervisor' | null>(null);

  const handleContinue = () => {
    if (selectedRole) {
      onRoleSelect(selectedRole);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src="/logo.png" alt="Supervise360" className="h-8 w-auto object-contain rounded-xl" />
              <span className="text-xl font-semibold text-[#333333]">Supervise360</span>
            </div>
            <div className="text-sm text-[#666666]">
              Student Project Management System
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6">
        {/* Hero Section */}
        <section className="py-20 text-center">
          <h1 className="text-5xl font-bold text-[#333333] mb-6 leading-tight">
            Welcome to<br />
            <span className="text-accent">Supervise360</span>
          </h1>
          <p className="text-xl text-[#666666] mb-12 max-w-2xl mx-auto leading-relaxed">
            A comprehensive platform for managing student projects, facilitating collaboration between students and supervisors, and tracking academic progress.
          </p>
        </section>

        {/* Role Selection Section */}
        <section className="pb-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#333333] mb-4">Choose Your Role</h2>
            <p className="text-lg text-[#666666]">Select how you'll be using the platform</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Student Card */}
            <div
              onClick={() => setSelectedRole('student')}
              className={`
                group relative p-8 border-2 rounded-2xl cursor-pointer transition-all duration-300 hover:shadow-xl bg-white
                ${selectedRole === 'student' 
                  ? 'border-accent shadow-lg ring-2 ring-accent/25' 
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <div className="text-center">
                <div className={`
                  w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center p-2 transition-colors overflow-hidden
                  ${selectedRole === 'student' ? 'bg-accent' : 'bg-gray-100 group-hover:bg-accent-soft'}
                `}>
                  <img src="/logo.png" alt="" className="w-full h-full object-contain rounded-xl" />
                </div>
                
                <h3 className="text-2xl font-bold text-[#333333] mb-4">Student</h3>
                <p className="text-[#666666] mb-8 leading-relaxed">
                  Manage your academic projects, collaborate with team members, and stay connected with your supervisors.
                </p>

                <div className="space-y-3 text-left">
                  <div className="flex items-center text-sm text-[#666666]">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full mr-3"></div>
                    View and manage group projects
                  </div>
                  <div className="flex items-center text-sm text-[#666666]">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full mr-3"></div>
                    Submit reports and documentation
                  </div>
                  <div className="flex items-center text-sm text-[#666666]">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full mr-3"></div>
                    Communicate with supervisors
                  </div>
                  <div className="flex items-center text-sm text-[#666666]">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full mr-3"></div>
                    Track project milestones
                  </div>
                </div>
              </div>

              {selectedRole === 'student' && (
                <div className="absolute top-4 right-4">
                  <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
              )}
            </div>

            {/* Supervisor Card */}
            <div
              onClick={() => setSelectedRole('supervisor')}
              className={`
                group relative p-8 border-2 rounded-2xl cursor-pointer transition-all duration-300 hover:shadow-xl bg-white
                ${selectedRole === 'supervisor' 
                  ? 'border-accent shadow-lg ring-2 ring-accent/25' 
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <div className="text-center">
                <div className={`
                  w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center p-2 transition-colors overflow-hidden
                  ${selectedRole === 'supervisor' ? 'bg-accent' : 'bg-gray-100 group-hover:bg-accent-soft'}
                `}>
                  <img src="/logo.png" alt="" className="w-full h-full object-contain rounded-xl" />
                </div>
                
                <h3 className="text-2xl font-bold text-[#333333] mb-4">Supervisor</h3>
                <p className="text-[#666666] mb-8 leading-relaxed">
                  Guide student projects, provide feedback, and monitor academic progress across multiple groups.
                </p>

                <div className="space-y-3 text-left">
                  <div className="flex items-center text-sm text-[#666666]">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full mr-3"></div>
                    Oversee multiple student groups
                  </div>
                  <div className="flex items-center text-sm text-[#666666]">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full mr-3"></div>
                    Review and evaluate projects
                  </div>
                  <div className="flex items-center text-sm text-[#666666]">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full mr-3"></div>
                    Provide guidance and feedback
                  </div>
                  <div className="flex items-center text-sm text-[#666666]">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full mr-3"></div>
                    Monitor project progress
                  </div>
                </div>
              </div>

              {selectedRole === 'supervisor' && (
                <div className="absolute top-4 right-4">
                  <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Continue Button */}
          <div className="text-center mt-12">
            <Button
              onClick={handleContinue}
              disabled={!selectedRole}
              className="px-8 py-4 text-lg bg-accent hover:bg-accent-hover disabled:bg-gray-300 disabled:cursor-not-allowed text-white"
            >
              Continue
              <ArrowRight className="ml-2" size={20} />
            </Button>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 border-t border-gray-200">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#333333] mb-4">Platform Features</h2>
            <p className="text-lg text-[#666666]">Everything you need for successful project management</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center bg-white p-6 rounded-xl border border-gray-200">
              <div className="w-12 h-12 bg-accent-soft rounded-xl flex items-center justify-center mx-auto mb-4">
                <Target className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-[#333333] mb-2">Project Tracking</h3>
              <p className="text-[#666666]">Monitor progress, set milestones, and track deliverables throughout the project lifecycle.</p>
            </div>

            <div className="text-center bg-white p-6 rounded-xl border border-gray-200">
              <div className="w-12 h-12 bg-accent-soft rounded-xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-[#333333] mb-2">Team Collaboration</h3>
              <p className="text-[#666666]">Facilitate seamless communication between students and supervisors with built-in messaging.</p>
            </div>

            <div className="text-center bg-white p-6 rounded-xl border border-gray-200">
              <div className="w-12 h-12 bg-accent-soft rounded-xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-[#333333] mb-2">Secure & Reliable</h3>
              <p className="text-[#666666]">Enterprise-grade security with reliable data management and user authentication.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center text-sm text-[#666666]">
            <p>&copy; 2024 Supervise360. Built for academic excellence.</p>
            <div className="mt-2">
              <a
                href="/admin-login"
                className="text-accent hover:underline text-xs"
              >
                Administrator Access
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}