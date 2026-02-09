import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Shield, Eye, EyeOff } from 'lucide-react';

export function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const { signIn } = useAuth();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      setLoading(false);
      return;
    }

    console.log('AdminLogin: Attempting login for:', email);
    const result = await signIn(email, password);
    console.log('AdminLogin: Login result:', result);

    if (!result.success) {
      console.error('AdminLogin: Login failed:', result.error);
      setError(result.error || 'Login failed. Please try again.');
    } else {
      console.log('AdminLogin: Login successful, should redirect now');
    }

    setLoading(false);
  };

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
            <div className="text-sm text-[#666666]">
              Administrator Portal
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          {/* Admin Indicator */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1e4d8b] rounded-2xl mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#333333] mb-2">
              Administrator Login
            </h1>
            <p className="text-[#666666]">Access the admin dashboard</p>
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
                  placeholder="Enter your admin email"
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
                {loading ? 'Signing In...' : 'Sign In as Administrator'}
              </button>

              <div className="text-center">
                <a
                  href="/"
                  className="text-[#666666] text-sm hover:text-[#1e4d8b] hover:underline"
                >
                  ← Back to Main Portal
                </a>
              </div>
            </form>
          </div>

          {/* Development Note */}
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="text-center text-sm text-yellow-800">
              <p className="font-medium mb-1">🔧 Development Access</p>
              <p>This is a direct admin login for testing purposes.</p>
              <p className="text-xs mt-2">Access: /admin-login</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}