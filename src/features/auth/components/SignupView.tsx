/**
 * SignupView.tsx — Signup panel content (left + right columns).
 * Matches HBS #signupPopup markup exactly.
 */

import { cva } from 'class-variance-authority';
import { cn } from '@shared/lib/cn';
import { switchView } from '../store';
import { openHostedUI } from '../hosted-ui';
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

export default function SignupView() {
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
          Join free&mdash;build your setup
          <br />
          and dominate PC gaming
        </h2>
        <p className="text-[length:var(--font-size-15px)] text-[#9ba2ab] m-0 mb-4">
          Save your gear, compare up to 8 items, and never miss a top deal.
        </p>
        <ul className="list-none m-0 p-0">
          {[
            'Comment on products, blogs, and community posts.',
            'Compare up to 8 items side-by-side.',
            'Save your builds and track the best deals.',
            'Customize layouts to browse gaming gear faster.',
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
          className={cn(authButton({ intent: 'provider' }), 'mb-5')}
          onClick={(e) => {
            e.preventDefault();
            openHostedUI('/login/google');
          }}
        >
          <GoogleIcon />
          Continue with Google
        </a>

        {/* Email button */}
        <a
          href="/login?screen_hint=signup"
          className={authButton({ intent: 'submit' })}
          onClick={(e) => {
            e.preventDefault();
            openHostedUI('/login?screen_hint=signup');
          }}
        >
          Create account with e-mail
        </a>

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

        {/* Switch to login */}
        <p className="text-[length:var(--font-size-14px)] mt-12 text-[#9ba2ab]">
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
