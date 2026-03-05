/**
 * ForgotPasswordView.tsx — Two-step password reset flow.
 * Step 1: Enter email → request code.
 * Step 2: Enter code + new password → reset.
 */

import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { cn } from '@shared/lib/cn';
import {
  switchView, setFormEmail, setFormError, setFormSuccess, $authForm,
} from '../store';
import {
  authButton, inputClass, labelClass,
  PasswordInput, FormError, Spinner,
} from './auth-ui';

export default function ForgotPasswordView() {
  const form = useStore($authForm);
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const email = form.email.trim();
    if (!email) {
      setFormError('Please enter your email');
      return;
    }

    setLoading(true);
    setFormError(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const json = await res.json();

      if (!res.ok) {
        setFormError(json.error?.message ?? 'Could not send reset code');
        return;
      }

      setStep(2);
    } catch {
      setFormError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const trimmedCode = code.trim();
    if (!trimmedCode || !newPassword) {
      setFormError('Please fill in all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setFormError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setFormError(null);

    try {
      const res = await fetch('/api/auth/confirm-forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, code: trimmedCode, newPassword }),
      });

      const json = await res.json();

      if (!res.ok) {
        setFormError(json.error?.message ?? 'Password reset failed');
        return;
      }

      setFormSuccess('Password reset! Sign in with your new password.');
      switchView('login');
    } catch {
      setFormError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center px-[clamp(24px,4vw,48px)] py-[clamp(32px,5vw,48px)] min-h-[350px]">
      <h3
        className={cn(
          '[font-weight:700] [font-size:var(--ft-28-20)] [font-family:var(--identity-font)]',
          'm-0 mb-3 text-[var(--auth-heading-text)] text-center'
        )}
      >
        Reset your password
      </h3>

      {step === 2 && (
        <p className="text-[length:var(--font-size-14px)] text-[var(--auth-subtitle-text)] m-0 mb-4 text-center">
          Code sent to
          <br />
          <span className="text-[var(--auth-heading-text)] font-semibold">{form.email}</span>
        </p>
      )}

      {step === 1 ? (
        <form onSubmit={handleRequestCode} className="w-full max-w-[360px]">
          <div className="mb-5">
            <label htmlFor="forgot-email" className={labelClass}>Email</label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setFormEmail(e.target.value)}
              className={inputClass}
              disabled={loading}
              placeholder="email@example.com"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={cn(authButton({ intent: 'submit' }), loading && 'opacity-60 cursor-not-allowed')}
          >
            {loading && <Spinner />}
            {loading ? 'Sending code\u2026' : 'Send reset code'}
          </button>

          <FormError message={form.error} />
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="w-full max-w-[360px]">
          <div className="mb-4">
            <label htmlFor="reset-code" className={labelClass}>Verification Code</label>
            <input
              id="reset-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className={cn(inputClass, 'text-center tracking-[0.3em]')}
              disabled={loading}
              placeholder="123456"
              autoFocus
            />
          </div>

          <div className="mb-4">
            <PasswordInput
              id="reset-password"
              label="New Password"
              value={newPassword}
              onChange={setNewPassword}
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          <div className="mb-5">
            <PasswordInput
              id="reset-confirm"
              label="Confirm Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={cn(authButton({ intent: 'submit' }), loading && 'opacity-60 cursor-not-allowed')}
          >
            {loading && <Spinner />}
            {loading ? 'Resetting\u2026' : 'Reset password'}
          </button>

          <FormError message={form.error} />
        </form>
      )}

      {/* Back to login */}
      <p className="text-[length:var(--font-size-13px)] text-[var(--auth-subtitle-text)] mt-6 text-center">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            switchView('login');
          }}
          className="text-[color:var(--site-start-color)] no-underline hover:underline"
        >
          &larr; Back to login
        </a>
      </p>
    </div>
  );
}
