import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import type { RegisterRequest } from '../types/database';

interface LoginProps {
  selectedRole: 'student' | 'supervisor';
  onBackToRoleSelection: () => void;
}

const inputBase = 'w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all duration-200 placeholder:text-slate-400';

function AuthHeader({ onBackToRoleSelection }: { onBackToRoleSelection: () => void }) {
  return (
    <header className="bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100 sticky top-0 z-50">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Supervise360" className="h-9 w-auto object-contain rounded-xl" />
            <span className="text-lg font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
              SUPERVISE360
            </span>
          </div>
          <button
            onClick={onBackToRoleSelection}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-accent hover:bg-slate-100 rounded-lg transition-all duration-200 font-medium"
          >
            <ArrowLeft size={18} />
            Back to Home
          </button>
        </div>
      </div>
    </header>
  );
}

function RoleBadge({ title, subtitle, selectedRole }: { title: string; subtitle: string; selectedRole: 'student' | 'supervisor' }) {
  return (
    <div className="text-center mb-8 animate-fade-up opacity-0" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-primary shadow-lg shadow-blue-900/25 mb-5 p-2">
        <img src="/logo.png" alt="Supervise360" className="w-full h-full object-contain rounded-xl" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">{title}</h1>
      <p className="text-slate-500">{subtitle}</p>
    </div>
  );
}

export function Login({ selectedRole, onBackToRoleSelection }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [department, setDepartment] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [signUpMessage, setSignUpMessage] = useState('');
  
  const { signIn, signUp } = useAuth();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      setLoading(false);
      return;
    }
    const result = await signIn(email, password, selectedRole);
    if (!result.success) setError(result.error || 'Login failed. Please try again.');
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSignUpMessage('');
    setLoading(true);
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required');
      setLoading(false);
      return;
    }
    if (!email.trim()) {
      setError('Email is required');
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }
    if (selectedRole === 'student' && !matricNumber.trim()) {
      setError('Matric number is required for student accounts');
      setLoading(false);
      return;
    }
    if (!department.trim()) {
      setError('Department selection is required');
      setLoading(false);
      return;
    }
    const userData: RegisterRequest = {
      first_name: firstName,
      last_name: lastName,
      email,
      password,
      role: selectedRole,
      department,
      ...(selectedRole === 'student' && { matric_number: matricNumber }),
    };
    const result = await signUp(userData);
    if (!result.success) setError(result.error || 'Failed to create account. Please try again.');
    else setSignUpMessage('Account created successfully! You are now logged in.');
    setLoading(false);
  };

  const hasAnimatedForView = useRef<'login' | 'signup' | null>(null);
  useEffect(() => {
    hasAnimatedForView.current = isSignUp ? 'signup' : 'login';
  }, [isSignUp]);

  const shouldAnimate = (view: 'login' | 'signup') => hasAnimatedForView.current !== view;

  if (isSignUp) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
        <AuthHeader onBackToRoleSelection={onBackToRoleSelection} />
        <div className="flex items-center justify-center py-12 px-4 min-h-[calc(100vh-140px)]">
          <div className={`w-full max-w-xl ${shouldAnimate('signup') ? 'animate-slide-up opacity-0' : ''}`} style={shouldAnimate('signup') ? { animationFillMode: 'forwards' } : {}}>
            <RoleBadge title={`${selectedRole === 'student' ? 'Student' : 'Supervisor'} Registration`} subtitle="Create your account to get started" selectedRole={selectedRole} />
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-10">
              <form onSubmit={handleSignUp} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">First Name</label>
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" required className={inputBase} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name</label>
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" required className={inputBase} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required className={inputBase} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password (min 6 characters)"
                      required
                      className={`${inputBase} pr-12`}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-accent transition-colors">
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Department</label>
                  <select value={department} onChange={(e) => setDepartment(e.target.value)} required className={inputBase}>
                    <option value="">Select your department</option>
                    <option value="Computer Science">Computer Science</option>
                    <option value="Software Engineering">Software Engineering</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Computer Technology">Computer Technology</option>
                    <option value="Computer Information Systems">Computer Information Systems</option>
                  </select>
                </div>
                {selectedRole === 'student' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Matric Number</label>
                    <input type="text" value={matricNumber} onChange={(e) => setMatricNumber(e.target.value)} placeholder="Enter your matric number" required className={inputBase} />
                  </div>
                )}
                {error && (
                  <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm animate-fade-in">
                    {error}
                  </div>
                )}
                {signUpMessage && (
                  <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-xl text-sm animate-fade-in">
                    {signUpMessage}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl font-semibold text-white bg-accent hover:bg-accent-hover hover:shadow-lg hover:shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(false); setError(''); setSignUpMessage(''); }}
                    className="text-accent text-sm font-medium hover:underline"
                  >
                    Already have an account? Sign In
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <AuthHeader onBackToRoleSelection={onBackToRoleSelection} />
      <div className="flex items-center justify-center py-12 px-4 min-h-[calc(100vh-140px)]">
        <div className={`w-full max-w-xl ${shouldAnimate('login') ? 'animate-slide-up opacity-0' : ''}`} style={shouldAnimate('login') ? { animationFillMode: 'forwards' } : {}}>
          <RoleBadge title={`${selectedRole === 'student' ? 'Student' : 'Supervisor'} Login`} subtitle="Sign in to your account" selectedRole={selectedRole} />
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-10">
            <form onSubmit={handleSignIn} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required className={inputBase} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className={`${inputBase} pr-12`}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-accent transition-colors">
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm animate-fade-in">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-semibold text-white bg-accent hover:bg-accent-hover hover:shadow-lg hover:shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
              <div className="text-center space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsSignUp(true); setError(''); }}
                  className="block w-full text-accent text-sm font-medium hover:underline"
                >
                  Don't have an account? Sign Up
                </button>
                <button type="button" className="text-slate-500 text-sm hover:text-accent hover:underline">
                  Forgot Password?
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
