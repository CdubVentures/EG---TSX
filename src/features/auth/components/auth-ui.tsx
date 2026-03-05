/**
 * auth-ui.tsx — Shared auth form primitives.
 *
 * WHY: authButton, inputClass, labelClass, and PasswordInput were
 * copy-pasted across 4 view components. Single source now.
 */

import { useState } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@shared/lib/cn';
import BrandLogo from './BrandLogo';

// ─── Style Constants ─────────────────────────────────────────────────────────

export const authButton = cva(
  'w-full flex items-center justify-center gap-3 font-semibold transition-[background] duration-150 no-underline cursor-pointer',
  {
    variants: {
      intent: {
        provider:
          'border border-[var(--auth-button-border)] bg-[var(--auth-button-bg)] text-[var(--auth-button-text)] hover:bg-[var(--auth-button-hover)] py-5 rounded-[5px] text-[length:var(--font-size-15px)]',
        submit:
          'bg-gradient-to-r from-[var(--site-start-color)] to-[var(--site-end-color)] text-white hover:to-[var(--site-start-color)] py-5 px-[2rem] border-none rounded-[6px] text-[15px] box-border',
      },
    },
    defaultVariants: { intent: 'submit' },
  }
);

export const inputClass =
  'bg-[var(--auth-input-bg)] border border-[var(--auth-input-border)] text-[var(--auth-input-text)] rounded-[5px] px-4 py-3 w-full' +
  ' focus:border-[var(--site-start-color)] focus:outline-none transition-colors' +
  ' text-[length:var(--font-size-14px)] disabled:opacity-50 disabled:cursor-not-allowed';

export const labelClass =
  'text-[length:var(--font-size-13px)] text-[var(--auth-label-text)] font-semibold mb-2 block';

// ─── Spinner (loading indicator for buttons) ────────────────────────────────

interface SpinnerProps {
  className?: string;
  size?: number;
}

export function Spinner({ className, size = 16 }: SpinnerProps) {
  return (
    <svg
      className={cn('animate-spin', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Eye SVG (cross-platform, replaces emoji) ───────────────────────────────

function EyeOpen() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeClosed() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    </svg>
  );
}

// ─── PasswordInput ───────────────────────────────────────────────────────────

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoComplete?: string;
  label: string;
}

export function PasswordInput({ id, value, onChange, disabled, autoComplete = 'current-password', label }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputClass, 'pr-12')}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--auth-label-text)] hover:text-[var(--auth-input-text)] bg-transparent border-none cursor-pointer p-0"
          aria-label={show ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {show ? <EyeOpen /> : <EyeClosed />}
        </button>
      </div>
    </div>
  );
}

// ─── AuthBrandingPanel (left column) ─────────────────────────────────────────

interface BrandingPanelProps {
  heading: React.ReactNode;
  subtitle?: string;
  bullets: string[];
}

export function AuthBrandingPanel({ heading, subtitle, bullets }: BrandingPanelProps) {
  return (
    <div
      className={cn(
        'flex-1 bg-[var(--auth-branding-bg)] flex flex-col justify-center items-start',
        'h-full overflow-hidden',
        'py-[clamp(24px,15.2727px+1.4545vw,32px)] px-[clamp(20px,-1.8182px+3.6364vw,40px)]',
        'max-[825px]:py-[clamp(24px,8px+4vw,32px)] max-[825px]:px-[clamp(22px,6px+4vw,30px)]',
        'max-[500px]:hidden'
      )}
    >
      <div className="text-[length:var(--ft-40-31)] mb-6 max-[825px]:mb-8">
        <BrandLogo />
      </div>
      <h2
        className={cn(
          '[font-weight:700] [font-size:var(--ft-28-20)] [font-family:var(--identity-font)]',
          'm-0 mb-4 text-[var(--auth-heading-text)]'
        )}
      >
        {heading}
      </h2>
      {subtitle && (
        <p className="text-[length:var(--font-size-15px)] text-[var(--auth-label-text)] m-0 mb-4">
          {subtitle}
        </p>
      )}
      <ul className="list-none m-0 p-0">
        {bullets.map((text) => (
          <li
            key={text}
            className="flex items-start gap-4 my-4 text-[length:var(--font-size-14px)] text-[var(--auth-heading-text)]"
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
  );
}

// ─── Shared form chrome ──────────────────────────────────────────────────────

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="text-[var(--auth-error)] text-[length:var(--font-size-13px)] mt-3 text-center">
      {message}
    </p>
  );
}

export function FormSuccess({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="text-[color:var(--success-color)] text-[length:var(--font-size-13px)] mb-4 text-center w-full">
      {message}
    </p>
  );
}

export function AuthLegal() {
  return (
    <p className="text-[length:var(--font-size-12px)] text-[var(--auth-legal-text)] mt-3 mb-0 leading-[1.45]">
      By continuing, you agree to the EGs&nbsp;
      <a href="/terms" target="_blank" className="text-[var(--auth-legal-link)] underline font-normal">
        Terms&nbsp;of&nbsp;Service
      </a>
      . You can also review the EGs&nbsp;
      <a href="/privacy" target="_blank" className="text-[var(--auth-legal-link)] underline font-normal">
        Privacy&nbsp;Policy
      </a>
      .
    </p>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center w-full gap-3 my-5">
      <span className="flex-1 h-px bg-[var(--auth-divider)]" />
      <span className="text-[length:var(--font-size-13px)] text-[var(--auth-label-text)] font-semibold">or</span>
      <span className="flex-1 h-px bg-[var(--auth-divider)]" />
    </div>
  );
}
