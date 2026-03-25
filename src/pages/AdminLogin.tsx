import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

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
    const result = await signIn(email, password, 'admin');
    if (!result.success) setError(result.error || 'Login failed. Please try again.');
    setLoading(false);
  };

  const inputBase = 'w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all duration-200 placeholder:text-slate-400';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100 sticky top-0 z-50">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Supervise360" className="h-9 w-auto object-contain rounded-xl" />
              <span className="text-lg font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                SUPERVISE360
              </span>
            </div>
            <span className="text-sm font-medium text-slate-500">Administrator Portal</span>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-center py-12 px-4 min-h-[calc(100vh-140px)]">
        <div className="w-full max-w-xl animate-slide-up opacity-0" style={{ animationFillMode: 'forwards' }}>
          <div className="text-center mb-8 animate-fade-up opacity-0" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-slate-900/25 mb-5 p-2">
              <img src="/logo.png" alt="Supervise360" className="w-full h-full object-contain rounded-xl" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">Administrator Login</h1>
            <p className="text-slate-500">Access the admin dashboard</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-10">
            <form onSubmit={handleSignIn} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your admin email" required className={inputBase} />
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
                {loading ? 'Signing In...' : 'Sign In as Administrator'}
              </button>
              <div className="text-center pt-2">
                <a href="/" className="text-slate-500 text-sm font-medium hover:text-accent hover:underline transition-colors">
                  ← Back to Main Portal
                </a>
              </div>
            </form>
          </div>

          <div className="mt-6 p-4 bg-amber-50/80 border border-amber-100 rounded-xl text-center text-sm text-amber-800 animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
            <p className="font-medium">Administrator access</p>
            <p className="text-amber-700/90 mt-0.5">Direct login for authorized administrators.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
