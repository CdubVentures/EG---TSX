/**
 * ForgotPasswordView.tsx — Two-step password reset flow.
 * Step 1: Enter email → request code.
 * Step 2: Enter code + new password → reset.
 */

import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { cva } from 'class-variance-authority';
import { cn } from '@shared/lib/cn';
import {
  switchView, setFormEmail, setFormError, setFormSuccess, $authForm,
} from '../store';

const submitButton = cva(
  'w-full flex items-center justify-center gap-3 font-semibold transition-[background] duration-150 no-underline cursor-pointer bg-gradient-to-r from-[var(--site-start-color)] to-[var(--site-end-color)] text-white hover:to-[var(--site-start-color)] py-5 px-[2rem] border-none rounded-[6px] text-[15px] box-border',
);

const inputClass = 'bg-[#111118] border border-[#38404b] text-[#e5e7eb] rounded-[5px] px-4 py-3 w-full focus:border-[var(--site-start-color)] focus:outline-none transition-colors text-[length:var(--font-size-14px)]';
const labelClass = 'text-[length:var(--font-size-13px)] text-[#9ba2ab] font-semibold mb-2 block';

export default function ForgotPasswordView() {
  const form = useStore($authForm);
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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

      // Success → switch to login with success banner
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
          'm-0 mb-3 text-[#e5e7eb] text-center'
        )}
      >
        Reset your password
      </h3>

      {step === 2 && (
        <p className="text-[length:var(--font-size-14px)] text-[#9ba2ab] m-0 mb-4 text-center">
          Code sent to
          <br />
          <span className="text-[#e5e7eb] font-semibold">{form.email}</span>
        </p>
      )}

      {step === 1 ? (
        /* Step 1 — Request code */
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
            className={cn(submitButton(), loading && 'opacity-60 cursor-not-allowed')}
          >
            {loading ? 'Sending code\u2026' : 'Send reset code'}
          </button>

          {form.error && (
            <p className="text-[#f87171] text-[length:var(--font-size-13px)] mt-3 text-center">
              {form.error}
            </p>
          )}
        </form>
      ) : (
        /* Step 2 — Enter code + new password */
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
            <label htmlFor="reset-password" className={labelClass}>New Password</label>
            <div className="relative">
              <input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={cn(inputClass, 'pr-12')}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ba2ab] hover:text-[#e5e7eb] bg-transparent border-none cursor-pointer p-0 text-[length:var(--font-size-14px)]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? '\u{1F441}' : '\u{1F441}\u{200D}\u{1F5E8}'}
              </button>
            </div>
          </div>

          <div className="mb-5">
            <label htmlFor="reset-confirm" className={labelClass}>Confirm Password</label>
            <div className="relative">
              <input
                id="reset-confirm"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={cn(inputClass, 'pr-12')}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ba2ab] hover:text-[#e5e7eb] bg-transparent border-none cursor-pointer p-0 text-[length:var(--font-size-14px)]"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showConfirm ? '\u{1F441}' : '\u{1F441}\u{200D}\u{1F5E8}'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={cn(submitButton(), loading && 'opacity-60 cursor-not-allowed')}
          >
            {loading ? 'Resetting\u2026' : 'Reset password'}
          </button>

          {form.error && (
            <p className="text-[#f87171] text-[length:var(--font-size-13px)] mt-3 text-center">
              {form.error}
            </p>
          )}
        </form>
      )}

      {/* Back to login */}
      <p className="text-[length:var(--font-size-13px)] text-[#9ba2ab] mt-6 text-center">
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
