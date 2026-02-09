import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, GraduationCap, Users, BookOpen, Eye, EyeOff } from 'lucide-react';
import type { RegisterRequest } from '../types/database';

interface LoginProps {
  selectedRole: 'student' | 'supervisor';
  onBackToRoleSelection: () => void;
}

export function Login({ selectedRole, onBackToRoleSelection }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Sign up form fields
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

    const result = await signIn(email, password);

    if (!result.success) {
      setError(result.error || 'Login failed. Please try again.');
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSignUpMessage('');
    setLoading(true);

    // Validation
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

    if (selectedRole === 'student') {
      if (!matricNumber.trim()) {
        setError('Matric number is required for student accounts');
        setLoading(false);
        return;
      }
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
      ...(selectedRole === 'student' && {
        matric_number: matricNumber
      })
    };

    const result = await signUp(userData);

    if (!result.success) {
      setError(result.error || 'Failed to create account. Please try again.');
    } else {
      setSignUpMessage('Account created successfully! You are now logged in.');
    }

    setLoading(false);
  };

  if (isSignUp) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-[#1e4d8b] rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-semibold text-[#333333]">Supervise360</span>
              </div>
              <button
                onClick={onBackToRoleSelection}
                className="flex items-center text-[#666666] hover:text-[#1e4d8b] transition-colors"
              >
                <ArrowLeft size={20} className="mr-2" />
                Back to Role Selection
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex items-center justify-center py-12 px-4">
          <div className="w-full max-w-md">
            {/* Role Indicator */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1e4d8b] rounded-2xl mb-4">
                {selectedRole === 'student' ? (
                  <GraduationCap className="w-8 h-8 text-white" />
                ) : (
                  <Users className="w-8 h-8 text-white" />
                )}
              </div>
              <h1 className="text-2xl font-bold text-[#333333] mb-2">
                {selectedRole === 'student' ? 'Student' : 'Supervisor'} Registration
              </h1>
              <p className="text-[#666666]">Create your account to get started</p>
            </div>

            {/* Registration Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <form onSubmit={handleSignUp} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#333333] mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e4d8b] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#333333] mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e4d8b] focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#333333] mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e4d8b] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#333333] mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password (min 6 characters)"
                      required
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e4d8b] focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#666666] hover:text-[#1e4d8b]"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#333333] mb-2">
                    Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e4d8b] focus:border-transparent"
                    required
                  >
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
                    <label className="block text-sm font-medium text-[#333333] mb-2">
                      Matric Number
                    </label>
                    <input
                      type="text"
                      value={matricNumber}
                      onChange={(e) => setMatricNumber(e.target.value)}
                      placeholder="Enter your matric number"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e4d8b] focus:border-transparent"
                    />
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {signUpMessage && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                    {signUpMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#1e4d8b] hover:bg-[#1a4178] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(false);
                      setError('');
                      setSignUpMessage('');
                    }}
                    className="text-[#1e4d8b] text-sm hover:underline"
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-[#1e4d8b] rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-[#333333]">Supervise360</span>
            </div>
            <button
              onClick={onBackToRoleSelection}
              className="flex items-center text-[#666666] hover:text-[#1e4d8b] transition-colors"
            >
              <ArrowLeft size={20} className="mr-2" />
              Back to Role Selection
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          {/* Role Indicator */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1e4d8b] rounded-2xl mb-4">
              {selectedRole === 'student' ? (
                <GraduationCap className="w-8 h-8 text-white" />
              ) : (
                <Users className="w-8 h-8 text-white" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-[#333333] mb-2">
              {selectedRole === 'student' ? 'Student' : 'Supervisor'} Login
            </h1>
            <p className="text-[#666666]">Sign in to your account</p>
          </div>

          {/* Login Form */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <form onSubmit={handleSignIn} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[#333333] mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e4d8b] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#333333] mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e4d8b] focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#666666] hover:text-[#1e4d8b]"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1e4d8b] hover:bg-[#1a4178] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>

              <div className="text-center space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setError('');
                  }}
                  className="text-[#1e4d8b] text-sm hover:underline"
                >
                  Don't have an account? Sign Up
                </button>
                <div>
                  <button
                    type="button"
                    className="text-[#666666] text-sm hover:text-[#1e4d8b] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}