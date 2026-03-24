import { useState } from 'react';
import { Wallet2, CheckCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const FEATURES = [
  'Unlimited groups & expenses — always free',
  'AI-powered smart splitting from natural language',
  'Smart debt simplification (minimize transactions)',
  'Real-time updates across all your devices',
  'Spending analytics & budget tracking',
  'Receipt scanning & multi-currency support',
];

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'login'
        ? authApi.login(email, password)
        : authApi.register(name, email, password),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      toast.success(mode === 'login' ? 'Welcome back!' : 'Account created!');
      navigate('/');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || (mode === 'login' ? 'Login failed' : 'Registration failed'));
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'register') {
      if (!name.trim()) { toast.error('Please enter your name'); return; }
      if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
      if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    }
    mutation.mutate();
  }

  return (
    <div className="min-h-screen flex">
      {/* Left - Hero */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary-600 to-primary-800 text-white p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Wallet2 className="w-6 h-6" />
          </div>
          <span className="text-2xl font-bold">SplitSmart</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            The smarter way to split expenses
          </h1>
          <p className="text-lg text-primary-200 mb-8">
            Everything Splitwise should have been — free, powerful, and actually smart.
          </p>
          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                <span className="text-primary-100">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-primary-300">
          Free forever. No credit card required. No artificial limits.
        </p>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white dark:bg-gray-950">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <Wallet2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">SplitSmart</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
            {mode === 'login' ? 'Enter your credentials to continue' : 'Start splitting smarter today'}
          </p>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div>
                <label className="label">Full Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            )}

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus={mode === 'login'}
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                placeholder={mode === 'register' ? 'Min. 6 characters' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="label">Confirm Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full py-2.5"
              disabled={mutation.isPending}
            >
              {mutation.isPending
                ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
                : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              className="text-primary-600 dark:text-primary-400 font-medium hover:underline"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
