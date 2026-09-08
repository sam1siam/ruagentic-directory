'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, GitBranch, Mail, LoaderCircle } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';
import { safeNext } from '@/lib/listing';
import { authRedirect } from '@/lib/auth-navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
type Mode = 'magic' | 'login' | 'register' | 'forgot' | 'confirm';
export default function AuthForm({
  next = '/dashboard',
  reset = false,
  available = true,
}: {
  next?: string;
  reset?: boolean;
  available?: boolean;
}) {
  const [mode, setMode] = useState<Mode>('magic'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    const restore = () => {
      lock.current = false;
      setBusy('');
    };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);
  function change(value: Mode) {
    setMode(value);
    setError('');
    setMessage('');
    setPassword('');
  }
  async function github() {
    if (lock.current || !available) return;
    lock.current = true;
    setBusy('github');
    setError('');
    setMessage('');
    try {
      const { data, error } = await browserClient().auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: authRedirect(window.location.origin, next, 'github'),
        },
      });
      if (error || !data.url)
        throw (
          error ??
          new Error('GitHub sign-in could not start. Please try again.')
        );
    } catch (e) {
      setError((e as Error).message);
      setBusy('');
      lock.current = false;
    }
  }
  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current || !available) return;
    lock.current = true;
    setBusy('email');
    setError('');
    setMessage('');
    try {
      const client = browserClient(),
        address = email.trim(),
        emailRedirectTo = authRedirect(window.location.origin, next, 'email');
      if (reset) {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        setPassword('');
        setMessage('Password updated. Continue to your dashboard.');
      } else if (mode === 'magic') {
        const { error } = await client.auth.signInWithOtp({
          email: address,
          options: { shouldCreateUser: true, emailRedirectTo },
        });
        if (error) throw error;
        setMessage(
          'Check your inbox for your sign-in link. Open it and select Continue to RUAGENTIC. Check spam if it does not arrive; wait a minute before requesting another.',
        );
      } else if (mode === 'login') {
        const { error } = await client.auth.signInWithPassword({
          email: address,
          password,
        });
        if (error)
          throw new Error(
            'Unable to sign in. Check your password and confirm your email, or use a magic link.',
          );
        window.location.assign(safeNext(next));
      } else if (mode === 'register') {
        const { error } = await client.auth.signUp({
          email: address,
          password,
          options: { emailRedirectTo },
        });
        if (error) throw error;
        setMessage(
          'Check your inbox to confirm your account. If you already have an account, use a magic link or sign in.',
        );
      } else if (mode === 'confirm') {
        const { error } = await client.auth.resend({
          type: 'signup',
          email: address,
          options: { emailRedirectTo },
        });
        if (error) throw error;
        setMessage(
          'If this account is awaiting confirmation, a new link will arrive shortly.',
        );
      } else {
        const { error } = await client.auth.resetPasswordForEmail(address, {
          redirectTo: window.location.origin + '/reset-password',
        });
        if (error) throw error;
        setMessage(
          'If this address has an account, a password reset link will arrive shortly.',
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
      lock.current = false;
    }
  }
  const title = reset
    ? 'Choose a new password'
    : mode === 'register'
      ? 'Create your account'
      : mode === 'forgot'
        ? 'Reset your password'
        : mode === 'confirm'
          ? 'Confirm your email'
          : 'Your next connection starts here.';
  return (
    <div className="auth-card glass-panel">
      <h1>{title}</h1>
      <p>
        {reset
          ? 'Use at least 12 characters.'
          : mode === 'forgot' || mode === 'confirm'
            ? 'We’ll send a secure link to your email address.'
            : 'Save tools, publish your project, and manage your place in the agentic ecosystem.'}
      </p>
      {!available && (
        <div className="notice warning" role="alert">
          Sign-in is temporarily unavailable. Please try again shortly.
        </div>
      )}
      {!reset && (
        <>
          <Button
            className="auth-provider"
            variant="outline"
            disabled={Boolean(busy) || !available}
            onClick={github}
          >
            {busy === 'github' ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <GitBranch size={18} />
            )}
            Continue with GitHub
            <ArrowRight size={15} />
          </Button>
          <div className="auth-divider">OR CONTINUE WITH EMAIL</div>
        </>
      )}
      <form onSubmit={submit} className="stack-form">
        {!reset && (
          <label htmlFor="auth-email">
            Email address
            <Input
              required
              type="email"
              id="auth-email"
              autoComplete="email"
              maxLength={254}
              disabled={Boolean(busy)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </label>
        )}
        {(reset || mode === 'login' || mode === 'register') && (
          <label>
            Password
            <Input
              required
              type="password"
              minLength={mode === 'register' || reset ? 12 : 1}
              maxLength={128}
              autoComplete={
                !reset && mode === 'login' ? 'current-password' : 'new-password'
              }
              disabled={Boolean(busy)}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {(reset || mode === 'register') && (
              <small>At least 12 characters.</small>
            )}
          </label>
        )}
        {error && (
          <div role="alert" className="notice error">
            {error}
          </div>
        )}
        {message && (
          <output className="notice success" aria-live="polite">
            <Mail size={18} />
            {message}
          </output>
        )}
        <Button type="submit" disabled={Boolean(busy) || !available}>
          {busy === 'email' && <LoaderCircle className="spin" />}
          {reset
            ? 'Update password'
            : mode === 'magic'
              ? 'Send me a magic link'
              : mode === 'login'
                ? 'Sign in with password'
                : mode === 'register'
                  ? 'Create account'
                  : mode === 'forgot'
                    ? 'Send reset link'
                    : 'Resend confirmation'}
          <ArrowRight size={16} />
        </Button>
      </form>
      {!reset && (
        <p className="auth-terms">
          GitHub and magic links support both new and existing accounts. By
          continuing, you agree to the <Link href="/terms">Terms</Link> and{' '}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      )}
      {reset ? (
        <Link href="/dashboard" className="text-link">
          Go to your dashboard →
        </Link>
      ) : (
        <div className="auth-switch">
          {mode !== 'magic' && (
            <button disabled={Boolean(busy)} onClick={() => change('magic')}>
              Use a magic link
            </button>
          )}
          {mode !== 'login' && (
            <button disabled={Boolean(busy)} onClick={() => change('login')}>
              Use a password
            </button>
          )}
          {mode === 'login' && (
            <>
              <button
                disabled={Boolean(busy)}
                onClick={() => change('register')}
              >
                Create an account
              </button>
              <button disabled={Boolean(busy)} onClick={() => change('forgot')}>
                Forgot password?
              </button>
            </>
          )}
          {mode === 'register' && (
            <button disabled={Boolean(busy)} onClick={() => change('confirm')}>
              Resend confirmation
            </button>
          )}
        </div>
      )}
    </div>
  );
}
