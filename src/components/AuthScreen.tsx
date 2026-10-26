import { useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';
import { Loader2, Mail, Lock, User, AtSign } from 'lucide-react';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === 'signup') {
      if (username.trim().length < 3) {
        setError('Username must be at least 3 characters.');
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setError('Username can only contain letters, numbers, and underscores.');
        return;
      }
      if (displayName.trim().length < 1) {
        setError('Please enter a display name.');
        return;
      }
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) setError(error);
      } else {
        const { error } = await signUp(email, password, username.trim(), displayName.trim());
        if (error) setError(error);
        else setError(null);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-base flex flex-col lg:flex-row">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950 relative overflow-hidden items-center justify-center p-12">
        {/* Decorative bubbles */}
        <div className="absolute top-20 left-20 w-32 h-32 rounded-full bg-sky-500/10 blur-2xl" />
        <div className="absolute bottom-32 right-16 w-48 h-48 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute top-1/3 right-20 w-20 h-20 rounded-full bg-bubble-400/10 blur-xl" />

        <div className="relative z-10 max-w-md text-center">
          <Logo size={56} className="justify-center mb-8 [&_span]:text-white" />
          <h1 className="text-3xl font-bold text-white mb-4 leading-tight">
            Where conversations come alive
          </h1>
          <p className="text-navy-200 text-lg leading-relaxed">
            BLOOP brings people together in communities that feel like home.
            Create, chat, and connect in spaces designed for real conversations.
          </p>
          <div className="mt-12 flex items-center justify-center gap-6 text-navy-300 text-sm">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse-soft" /> Real-time messaging
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse-soft" /> Private & secure
            </span>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo size={40} />
          </div>

          <h2 className="text-2xl font-bold text-main mb-2">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-sub mb-8">
            {mode === 'signin'
              ? 'Sign in to continue to BLOOP.'
              : 'Join BLOOP and start building your community.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-sub mb-1.5">
                    Username
                  </label>
                  <div className="relative">
                    <AtSign size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      id="username"
                      type="text"
                      className="input pl-11"
                      placeholder="your_username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium text-sub mb-1.5">
                    Display name
                  </label>
                  <div className="relative">
                    <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      id="displayName"
                      type="text"
                      className="input pl-11"
                      placeholder="What should we call you?"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      autoComplete="name"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-sub mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  id="email"
                  type="email"
                  className="input pl-11"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-sub mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  id="password"
                  type="password"
                  className="input pl-11"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500 dark:text-red-400 animate-slide-up">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? <Loader2 size={20} className="animate-spin" /> : null}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-sub">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
              className="text-sky-500 hover:text-sky-600 font-medium transition-colors"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
