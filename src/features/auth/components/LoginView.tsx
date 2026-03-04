/**
 * LoginView.tsx — Login panel with inline email/password form.
 * Right column: Google OAuth + email/password form (replaces Hosted UI redirect).
 */

import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { cva } from 'class-variance-authority';
import { cn } from '@shared/lib/cn';
import {
  switchView, setAuthenticated, setFormEmail, setFormError,
  $authForm,
} from '../store';
import { openOAuthPopup } from '../oauth-popup';
import BrandLogo from './BrandLogo';
import GoogleIcon from './GoogleIcon';

const authButton = cva(
  'w-full flex items-center justify-center gap-3 font-semibold transition-[background] duration-150 no-underline cursor-pointer',
  {
    variants: {
      intent: {
        provider:
          'border border-[#38404b] bg-[#1d2021] text-[#e5e7eb] hover:bg-[#2e343b] py-5 rounded-[5px] text-[length:var(--font-size-15px)]',
        submit:
          'bg-gradient-to-r from-[var(--site-start-color)] to-[var(--site-end-color)] text-white hover:to-[var(--site-start-color)] py-5 px-[2rem] border-none rounded-[6px] text-[15px] box-border',
      },
    },
    defaultVariants: { intent: 'submit' },
  }
);

const inputClass = 'bg-[#111118] border border-[#38404b] text-[#e5e7eb] rounded-[5px] px-4 py-3 w-full focus:border-[var(--site-start-color)] focus:outline-none transition-colors text-[length:var(--font-size-14px)]';
const labelClass = 'text-[length:var(--font-size-13px)] text-[#9ba2ab] font-semibold mb-2 block';

export default function LoginView() {
  const form = useStore($authForm);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const email = form.email.trim();
    if (!email || !password) {
      setFormError('Please enter your email and password');
      return;
    }

    setLoading(true);
    setFormError(null);

    try {
      const res = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        // WHY: UserNotConfirmedException → switch to confirm-signup flow
        if (json.error?.code === 'UserNotConfirmedException') {
          setFormEmail(email);
          switchView('confirm-signup');
          return;
        }
        setFormError(json.error?.message ?? 'Sign-in failed');
        return;
      }

      // Success — set authenticated state (dialog auto-closes via AuthDialog effect)
      setAuthenticated(json.uid, json.email, json.username);
    } catch {
      setFormError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-row items-center overflow-hidden max-[600px]:flex-col-reverse max-[600px]:items-stretch">
      {/* Left column — branding */}
      <div
        className={cn(
          'flex-1 bg-[#25292a] flex flex-col justify-center items-start',
          'h-full overflow-hidden',
          'py-[clamp(24px,15.2727px+1.4545vw,32px)] px-[clamp(20px,-1.8182px+3.6364vw,40px)]',
          'max-[600px]:min-w-[270px] max-[600px]:py-[clamp(24px,8px+4vw,32px)] max-[600px]:px-[clamp(22px,6px+4vw,30px)]'
        )}
      >
        <div className="text-[length:var(--ft-40-31)] mb-6 max-[600px]:mb-8">
          <BrandLogo />
        </div>
        <h2
          className={cn(
            '[font-weight:700] [font-size:var(--ft-28-20)] [font-family:var(--identity-font)]',
            'm-0 mb-4 text-[#e5e7eb]'
          )}
        >
          Welcome back&mdash;find the best gear &amp; stay ahead in PC gaming
        </h2>
        <ul className="list-none m-0 p-0">
          {[
            'Access your saved builds and comparisons.',
            'See real-time price drops and top deals.',
            'Join discussions\u2014comment, vote, and connect.',
            'Compare up to 8 products instantly.',
          ].map((text) => (
            <li
              key={text}
              className="flex items-start gap-4 my-4 text-[length:var(--font-size-14px)] text-[#e5e7eb]"
            >
              <span
                className="text-[color:var(--site-start-color)] text-[length:var(--font-size-18px)] leading-none"
                aria-hidden="true"
              >
                &#9733;
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      {/* Right column — form */}
      <div
        className={cn(
          'flex-1 relative flex flex-col justify-center items-center',
          'h-full overflow-hidden',
          'py-[clamp(24px,15.2727px+1.4545vw,32px)] px-[clamp(20px,-1.8182px+3.6364vw,40px)]',
          'max-[600px]:min-w-[270px] max-[600px]:py-[clamp(24px,8px+4vw,32px)] max-[600px]:px-[clamp(22px,6px+4vw,30px)]'
        )}
      >
        <h3
          className={cn(
            '[font-weight:700] [font-size:var(--ft-30-24)] [font-family:var(--identity-font)]',
            'm-0 mb-2 text-[#e5e7eb]'
          )}
        >
          Welcome back!
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
          className={cn(authButton({ intent: 'provider' }), 'mb-5')}
          onClick={(e) => {
            e.preventDefault();
            openOAuthPopup('/login/google');
          }}
        >
          <GoogleIcon />
          Continue with Google
        </a>

        {/* Divider */}
        <div className="flex items-center w-full gap-3 my-5">
          <span className="flex-1 h-px bg-[#38404b]" />
          <span className="text-[length:var(--font-size-13px)] text-[#9ba2ab] font-semibold">or</span>
          <span className="flex-1 h-px bg-[#38404b]" />
        </div>

        {/* Success message */}
        {form.successMessage && (
          <p className="text-[color:var(--success-color)] text-[length:var(--font-size-13px)] mb-4 text-center w-full">
            {form.successMessage}
          </p>
        )}

        {/* Email/password form */}
        <form onSubmit={handleSubmit} className="w-full">
          <div className="mb-4">
            <label htmlFor="login-email" className={labelClass}>Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setFormEmail(e.target.value)}
              className={inputClass}
              disabled={loading}
              placeholder="email@example.com"
            />
          </div>

          <div className="mb-3">
            <label htmlFor="login-password" className={labelClass}>Password</label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          {/* Forgot password link */}
          <div className="text-right mb-5">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setFormEmail(form.email);
                switchView('forgot-password');
              }}
              className="text-[color:var(--site-start-color)] text-[length:var(--font-size-13px)] no-underline hover:underline"
            >
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={cn(authButton({ intent: 'submit' }), loading && 'opacity-60 cursor-not-allowed')}
          >
            {loading ? 'Signing in\u2026' : 'Sign in'}
          </button>

          {/* Error message */}
          {form.error && (
            <p className="text-[#f87171] text-[length:var(--font-size-13px)] mt-3 text-center">
              {form.error}
            </p>
          )}
        </form>

        {/* Legal */}
        <p className="text-[length:var(--font-size-12px)] text-[#9ba2ab] mt-3 mb-0 leading-[1.45]">
          By continuing, you agree to the EGs&nbsp;
          <a href="/terms" target="_blank" className="text-[#9ba2ab] underline font-normal">
            Terms&nbsp;of&nbsp;Service
          </a>
          . You can also review the EGs&nbsp;
          <a href="/privacy" target="_blank" className="text-[#9ba2ab] underline font-normal">
            Privacy&nbsp;Policy
          </a>
          .
        </p>

        {/* Switch to signup */}
        <p className="text-[length:var(--font-size-14px)] mt-8 text-[#9ba2ab]">
          Don&apos;t have an account?{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              switchView('signup');
            }}
            className="text-[color:var(--site-start-color)] no-underline font-semibold hover:underline"
          >
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
