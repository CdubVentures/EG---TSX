/**
 * SignupView.tsx — Signup panel with inline email/password form.
 * Right column: Google OAuth + email/password/confirm form.
 */

import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { cn } from '@shared/lib/cn';
import {
  switchView, setFormEmail, setFormError, $authForm,
} from '../store';
import { openOAuthPopup } from '../oauth-popup';
import GoogleIcon from './GoogleIcon';
import {
  authButton, inputClass, labelClass,
  PasswordInput, AuthBrandingPanel, AuthDivider,
  FormError, AuthLegal, Spinner,
} from './auth-ui';

const SIGNUP_BULLETS = [
  'Comment on products, blogs, and community posts.',
  'Compare up to 8 items side-by-side.',
  'Save your builds and track the best deals.',
  'Customize layouts to browse gaming gear faster.',
];

export default function SignupView() {
  const form = useStore($authForm);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOAuthLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const email = form.email.trim();
    if (!email || !password) {
      setFormError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setFormError(null);

    try {
      const res = await fetch('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        setFormError(json.error?.message ?? 'Sign-up failed');
        return;
      }

      setFormEmail(email);
      switchView('confirm-signup');
    } catch {
      setFormError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-row items-center overflow-hidden max-[825px]:flex-col-reverse max-[825px]:items-stretch">
      <AuthBrandingPanel
        heading={<>Join free&mdash;build your setup<br />and dominate PC gaming</>}
        subtitle="Save your gear, compare up to 8 items, and never miss a top deal."
        bullets={SIGNUP_BULLETS}
      />

      {/* Right column — form */}
      <div
        className={cn(
          'flex-1 relative flex flex-col justify-center items-center',
          'h-full overflow-hidden',
          'py-[clamp(24px,15.2727px+1.4545vw,32px)] px-[clamp(20px,-1.8182px+3.6364vw,40px)]',
          'max-[825px]:py-[clamp(24px,8px+4vw,32px)] max-[825px]:px-[clamp(22px,6px+4vw,30px)]'
        )}
      >
        <h3
          className={cn(
            '[font-weight:700] [font-size:var(--ft-30-24)] [font-family:var(--identity-font)]',
            'm-0 mb-2 text-[#e5e7eb]'
          )}
        >
          Join the community
        </h3>

        {/* Benefits row */}
        <p className="flex flex-wrap items-center justify-center gap-2 text-[length:var(--font-size-14px)] text-[#9ba2ab] m-0 mb-7 text-center">
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <span className="w-5 h-5 rounded-full bg-[var(--success-color)] inline-flex items-center justify-center shrink-0">
              <span className="text-[0.75rem] leading-none text-[#101214]">&#10004;</span>
            </span>
            Unlimited&nbsp;Access
          </span>
          &bull; All Features &bull; Full Experience!
        </p>

        {/* Google button */}
        <a
          href="/login/google"
          className={cn(
            authButton({ intent: 'provider' }),
            'mb-5',
            oauthLoading && 'opacity-60 pointer-events-none'
          )}
          onClick={(e) => {
            e.preventDefault();
            if (oauthLoading) return;
            setOAuthLoading(true);
            openOAuthPopup('/login/google');
            // WHY: Reset after brief delay — popup is now the user's focus
            setTimeout(() => setOAuthLoading(false), 3000);
          }}
        >
          {oauthLoading ? <Spinner /> : <GoogleIcon />}
          {oauthLoading ? 'Connecting\u2026' : 'Continue with Google'}
        </a>

        <AuthDivider />

        {/* Email/password form */}
        <form onSubmit={handleSubmit} className="w-full">
          <div className="mb-4">
            <label htmlFor="signup-email" className={labelClass}>Email</label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setFormEmail(e.target.value)}
              className={inputClass}
              disabled={loading}
              placeholder="email@example.com"
            />
          </div>

          <div className="mb-4">
            <PasswordInput
              id="signup-password"
              label="Password"
              value={password}
              onChange={setPassword}
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          <div className="mb-5">
            <PasswordInput
              id="signup-confirm"
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
            {loading ? 'Creating account\u2026' : 'Create account'}
          </button>

          <FormError message={form.error} />
        </form>

        <AuthLegal />

        {/* Switch to login */}
        <p className="text-[length:var(--font-size-14px)] mt-8 text-[#9ba2ab]">
          Already a member?{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              switchView('login');
            }}
            className="text-[color:var(--site-start-color)] no-underline font-semibold hover:underline"
          >
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}
