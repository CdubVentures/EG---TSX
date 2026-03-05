/**
 * ConfirmSignupView.tsx — Email verification code entry.
 * Single-column centered layout (no branding panel — short intermediate step).
 */

import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { cn } from '@shared/lib/cn';
import {
  switchView, setFormError, setFormSuccess, $authForm,
} from '../store';
import {
  authButton, inputClass, labelClass, FormError, FormSuccess, Spinner,
} from './auth-ui';

export default function ConfirmSignupView() {
  const form = useStore($authForm);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setFormError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setFormError(null);

    try {
      const res = await fetch('/api/auth/confirm-sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, code: trimmedCode }),
      });

      const json = await res.json();

      if (!res.ok) {
        setFormError(json.error?.message ?? 'Verification failed');
        return;
      }

      setFormSuccess('Email verified! Sign in to continue.');
      switchView('login');
    } catch {
      setFormError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resending) return;

    setResending(true);
    setFormError(null);

    try {
      const res = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      });

      const json = await res.json();

      if (!res.ok) {
        setFormError(json.error?.message ?? 'Could not resend code');
        return;
      }

      setFormSuccess('New code sent! Check your email.');
    } catch {
      setFormError('Network error — please try again');
    } finally {
      setResending(false);
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
        Verify your email
      </h3>

      <p className="text-[length:var(--font-size-14px)] text-[#9ba2ab] m-0 mb-6 text-center">
        We sent a 6-digit code to
        <br />
        <span className="text-[#e5e7eb] font-semibold">{form.email}</span>
      </p>

      <FormSuccess message={form.successMessage} />

      <form onSubmit={handleSubmit} className="w-full max-w-[360px]">
        <div className="mb-5">
          <label htmlFor="confirm-code" className={labelClass}>Verification Code</label>
          <input
            id="confirm-code"
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

        <button
          type="submit"
          disabled={loading}
          className={cn(authButton({ intent: 'submit' }), loading && 'opacity-60 cursor-not-allowed')}
        >
          {loading && <Spinner />}
          {loading ? 'Verifying\u2026' : 'Verify'}
        </button>

        <FormError message={form.error} />
      </form>

      {/* Resend code */}
      <p className="text-[length:var(--font-size-13px)] text-[#9ba2ab] mt-6 text-center">
        Didn&apos;t get the code?{' '}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            handleResend();
          }}
          className={cn(
            'text-[color:var(--site-start-color)] no-underline font-semibold hover:underline',
            resending && 'opacity-60 pointer-events-none'
          )}
        >
          {resending && <Spinner size={12} className="inline-block align-[-2px] mr-1" />}
          {resending ? 'Sending\u2026' : 'Resend code'}
        </a>
      </p>
    </div>
  );
}
