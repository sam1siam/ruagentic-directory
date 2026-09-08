'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Mail, LoaderCircle } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';
import { safeNext } from '@/lib/listing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export default function AuthForm({
  next = '/dashboard',
  reset = false,
  available = true,
}: {
  next?: string;
  reset?: boolean;
  available?: boolean;
}) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const client = browserClient();
      if (reset) {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        setMessage('Password updated. You can continue to your dashboard.');
        return;
      }
      if (mode === 'login') {
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error)
          throw new Error(
            'Unable to sign in. Check your details and confirm your email address.',
          );
        window.location.assign(safeNext(next));
      } else if (mode === 'register') {
        const { error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo:
              window.location.origin +
              '/auth/callback?next=' +
              encodeURIComponent(safeNext(next)),
          },
        });
        if (error) throw error;
        setMessage(
          'Check your inbox for the confirmation link. If you already have an account, sign in or reset your password.',
        );
      } else {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo:
            window.location.origin + '/auth/callback?next=/reset-password',
        });
        if (error) throw error;
        setMessage(
          'If this address has an account, a password reset link will arrive shortly.',
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-card">
      <span className="eyebrow">YOUR RUAGENTIC ACCOUNT</span>
      <h1>
        {reset
          ? 'Choose a new password'
          : mode === 'register'
            ? 'Create your account'
            : mode === 'forgot'
              ? 'Reset your password'
              : 'Welcome back'}
      </h1>
      <p>
        {reset
          ? 'Use at least 12 characters.'
          : mode === 'register'
            ? 'Save tools, submit a project, and manage your listings.'
            : 'Sign in to save tools and manage your projects.'}
      </p>
      {!available && (
        <div className="notice warning">
          Account setup is still being completed. Please return shortly.
        </div>
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </label>
        )}
        {(reset || mode !== 'forgot') && (
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {(reset || mode === 'register') && (
              <small>At least 12 characters.</small>
            )}
          </label>
        )}
        {mode === 'register' && !reset && (
          <label className="check-label">
            <input type="checkbox" required />{' '}
            <span>
              I agree to the <Link href="/terms">Terms</Link> and have read the{' '}
              <Link href="/privacy">Privacy Policy</Link>.
            </span>
          </label>
        )}
        {error && (
          <div role="alert" className="notice error">
            {error}
          </div>
        )}
        {message && (
          <output className="notice success">
            <Mail size={18} />
            {message}
          </output>
        )}
        <Button type="submit" disabled={busy || !available}>
          {busy ? <LoaderCircle className="spin" /> : null}
          {reset
            ? 'Update password'
            : mode === 'register'
              ? 'Create account'
              : mode === 'forgot'
                ? 'Send reset link'
                : 'Sign in'}
          <ArrowRight size={16} />
        </Button>
      </form>
      {reset ? (
        <Link href="/dashboard" className="text-link">
          Go to your dashboard
        </Link>
      ) : (
        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              <button
                onClick={() => {
                  setMode('register');
                  setError('');
                  setMessage('');
                }}
              >
                Create an account
              </button>
              <button
                onClick={() => {
                  setMode('forgot');
                  setError('');
                  setMessage('');
                }}
              >
                Forgot password?
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setMode('login');
                setError('');
                setMessage('');
              }}
            >
              Back to sign in
            </button>
          )}
        </div>
      )}
    </div>
  );
}
