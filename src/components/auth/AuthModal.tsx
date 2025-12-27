'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth-store';
import { checkUsernameAvailable } from '@/lib/supabase/auth';
import {
  Music,
  Mail,
  Lock,
  User,
  ArrowRight,
  Chrome,
  Loader2,
  AlertCircle,
  Check,
  X,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'signup';
}

export function AuthModal({ isOpen, onClose, defaultTab = 'login' }: AuthModalProps) {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'signup'>(defaultTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signIn, signUp, signInWithGoogle, signInWithDiscord } = useAuthStore();

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync tab state when modal opens or defaultTab changes
  useEffect(() => {
    if (isOpen) {
      setTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  const handleUsernameChange = useCallback((value: string) => {
    // Only allow valid username characters
    const sanitized = value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
    setUsername(sanitized);

    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (sanitized.length >= 3) {
      setCheckingUsername(true);
      // Debounce the API call by 400ms
      debounceRef.current = setTimeout(async () => {
        try {
          const available = await checkUsernameAvailable(sanitized);
          setUsernameAvailable(available);
        } catch {
          setUsernameAvailable(null);
        } finally {
          setCheckingUsername(false);
        }
      }, 400);
    } else {
      setUsernameAvailable(null);
      setCheckingUsername(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowVerificationMessage(false);
    setIsSubmitting(true);

    try {
      if (tab === 'login') {
        await signIn(email, password);
        onClose();
        router.push('/rooms');
      } else {
        if (!usernameAvailable) {
          setError('Please choose an available username');
          setIsSubmitting(false);
          return;
        }
        await signUp(email, password, username, displayName || username);
        onClose();
        router.push('/rooms');
      }
    } catch (err) {
      const message = (err as Error).message;
      // Show verification message as a success state, not an error
      if (message.includes('check your email') || message.includes('confirm your account')) {
        setShowVerificationMessage(true);
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError((err as Error).message);
      setIsSubmitting(false);
    }
  };

  const handleDiscordSignIn = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await signInWithDiscord();
    } catch (err) {
      setError((err as Error).message);
      setIsSubmitting(false);
    }
  };

  const isFormValid = tab === 'login'
    ? email && password
    : email && password && username.length >= 3 && usernameAvailable;

  return (
    <Modal isOpen={isOpen} onClose={onClose} showCloseButton={false} variant="dark">
      <div className="w-full max-w-md mx-auto relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4">
            <Music className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            {tab === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-gray-400 mt-2">
            {tab === 'login'
              ? 'Sign in to continue to OpenStudio'
              : 'Join the community of musicians'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-gray-800 rounded-lg p-1 mb-6">
          <button
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              tab === 'login'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setTab('login')}
          >
            Log In
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              tab === 'signup'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setTab('signup')}
          >
            Sign Up
          </button>
        </div>

        {/* Verification Message */}
        {showVerificationMessage && (
          <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-lg mb-6 text-center">
            <div className="w-12 h-12 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Check your email</h3>
            <p className="text-sm text-gray-400 mb-4">
              We&apos;ve sent a verification link to <span className="text-white font-medium">{email}</span>.
              Please verify your email before signing in.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowVerificationMessage(false);
                setTab('login');
              }}
            >
              Back to Log In
            </Button>
          </div>
        )}

        {/* Error Message */}
        {error && !showVerificationMessage && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg mb-6">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {!showVerificationMessage && (
          <>
            {/* OAuth Buttons */}
            <div className="space-y-3 mb-6">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
              >
                <Chrome className="w-5 h-5 mr-2" />
                Continue with Google
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleDiscordSignIn}
                disabled={isSubmitting}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                Continue with Discord
              </Button>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-900 text-gray-500">or</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {tab === 'signup' && (
                <>
                  <div className="relative">
                    <Input
                      label="Username"
                      value={username}
                      onChange={(e) => handleUsernameChange(e.target.value)}
                      placeholder="your_username"
                      disabled={isSubmitting}
                      className="pr-10"
                    />
                    {username.length >= 3 && (
                      <div className="absolute right-3 top-9">
                        {checkingUsername ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        ) : usernameAvailable ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <X className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    )}
                    {username.length >= 3 && !checkingUsername && (
                      <p className={`text-xs mt-1 ${usernameAvailable ? 'text-green-500' : 'text-red-500'}`}>
                        {usernameAvailable ? 'Username available!' : 'Username taken'}
                      </p>
                    )}
                  </div>
                  <Input
                    label="Display Name (optional)"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How you want to be called"
                    disabled={isSubmitting}
                  />
                </>
              )}
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={isSubmitting}
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isSubmitting}
              />

              {tab === 'login' && (
                <div className="text-right">
                  <button
                    type="button"
                    className="text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={!isFormValid || isSubmitting}
                loading={isSubmitting}
              >
                {tab === 'login' ? 'Log In' : 'Create Account'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>

            {/* Footer */}
            <p className="text-center text-sm text-gray-500 mt-6">
              {tab === 'login' ? (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    className="text-indigo-400 hover:text-indigo-300"
                    onClick={() => setTab('signup')}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    className="text-indigo-400 hover:text-indigo-300"
                    onClick={() => setTab('login')}
                  >
                    Log in
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
