/**
 * SettingsPanel.tsx — Settings content: Appearance + Hub Settings sections.
 *
 * - Appearance: Theme toggle (always interactive, everyone can use it)
 * - Hub Settings: Toggle + radio groups (disabled for guests with lock badge + inline CTA)
 */

import { useStore } from '@nanostores/react';
import { $auth, openSignup, openLogin } from '@features/auth';
import { $userPrefs, $theme, setPref, setTheme } from '../store';
import { cn } from '@shared/lib/cn';
import ToggleSwitch from './ToggleSwitch';
import RadioGroup from './RadioGroup';
import type { ThemeMode } from '../types';

const DISPLAY_OPTIONS = [
  { value: 'grid', label: 'Grid' },
  { value: 'brandRows', label: 'Brand Rows' },
];

/* ── Sun / Moon SVG icons ─── */

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/* ── Theme Segmented Control ─── */

function ThemeToggle({ theme, onSelect }: { theme: ThemeMode; onSelect: (m: ThemeMode) => void }) {
  const options: { mode: ThemeMode; label: string; Icon: typeof SunIcon }[] = [
    { mode: 'light', label: 'Light', Icon: SunIcon },
    { mode: 'dark', label: 'Dark', Icon: MoonIcon },
  ];

  return (
    <div className="flex rounded-[6px] bg-[var(--auth-settings-track)] p-[3px] gap-[2px]">
      {options.map(({ mode, label, Icon }) => {
        const isActive = theme === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onSelect(mode)}
            className={cn(
              'flex items-center gap-[6px] px-4 py-[6px] rounded-[4px]',
              'text-[length:var(--ft-14-13)] font-medium',
              'transition-all duration-200 border-none cursor-pointer',
              "[font-family:'Open_Sans',_sans-serif]",
              isActive
                ? 'bg-[image:var(--site-background-gradient)] text-[var(--auth-check-text,_#fff)] shadow-[0_1px_3px_rgba(0,0,0,0.3)]'
                : 'bg-transparent text-[var(--auth-subtitle-text)] hover:text-[var(--auth-heading-text)]'
            )}
          >
            <Icon className="shrink-0" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Section Card wrapper ─── */

function SectionCard({ title, badge, children }: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'bg-[var(--auth-branding-bg)] border border-[var(--auth-divider)] rounded-[6px]',
        'shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)]',
        'p-[1.75rem]'
      )}
    >
      <div className="flex items-center gap-3 mb-6">
        <h4
          className={cn(
            "[font-family:'Futura',_sans-serif] font-semibold text-[length:var(--ft-24-21)]",
            'text-[var(--auth-heading-text)]',
            'uppercase tracking-[0.5px]',
            'm-0'
          )}
        >
          {title}
        </h4>
        {badge}
      </div>
      {children}
    </div>
  );
}

/* ── Inline upgrade CTA for guests ─── */

function GuestCTA({ onClose }: { onClose: (afterClose?: () => void) => void }) {
  const handleSignup = () => {
    onClose(() => openSignup());
  };

  const handleLogin = (e: React.MouseEvent) => {
    e.preventDefault();
    onClose(() => openLogin());
  };

  return (
    <div
      className={cn(
        'mt-6 rounded-[6px] p-4',
        'border border-[var(--auth-guest-border)]',
        'bg-[var(--auth-guest-bg)]',
        'text-center'
      )}
    >
      <p
        className={cn(
          'text-[length:var(--ft-14-13)] text-[var(--auth-label-text)] m-0 mb-3',
          "[font-family:'Open_Sans',_sans-serif]"
        )}
      >
        Create a free account to personalize your hub experience.
      </p>
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={handleSignup}
          className={cn(
            'px-5 py-[6px] rounded-[5px] border-none cursor-pointer',
            'bg-[image:var(--site-background-gradient)]',
            'text-[var(--color-text-on-accent)] font-semibold',
            'text-[length:var(--ft-14-13)]',
            "[font-family:'Open_Sans',_sans-serif]",
            'transition-[filter] duration-200 hover:brightness-[1.15]'
          )}
        >
          Sign up
        </button>
        <a
          href="#"
          onClick={handleLogin}
          className={cn(
            'text-[color:var(--site-start-color)] no-underline font-semibold',
            'text-[length:var(--ft-14-13)]',
            "[font-family:'Open_Sans',_sans-serif]",
            'hover:underline'
          )}
        >
          Log in
        </a>
      </div>
    </div>
  );
}

/* ── Main Panel ─── */

interface SettingsPanelProps {
  onClose: (afterClose?: () => void) => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const auth = useStore($auth);
  const prefs = useStore($userPrefs);
  const theme = useStore($theme);
  const isGuest = auth.status !== 'authenticated';

  return (
    <div
      className={cn(
        'flex flex-col items-stretch relative',
        'py-[clamp(24px,-2.1818px+4.3636vw,48px)] px-[clamp(20px,-1.8182px+3.6364vw,40px)]',
        'max-[600px]:py-[clamp(24px,8px+4vw,32px)] max-[600px]:px-[clamp(22px,6px+4vw,30px)]'
      )}
    >
      {/* Close button */}
      <button
        className={cn(
          'absolute top-[8px] right-[9px]',
          'text-[26px] leading-[26px] text-[var(--auth-close-color)]',
          'appearance-none bg-transparent border-none cursor-pointer p-0',
          'z-[110]',
          'hover:text-[var(--auth-close-hover)]'
        )}
        onClick={() => onClose()}
        aria-label="Close Settings"
      >
        &times;
      </button>

      {/* Heading */}
      <h3
        className={cn(
          '[font-weight:700] [font-size:var(--ft-30-24)] [font-family:var(--identity-font)]',
          'm-0 mb-8 text-[var(--auth-heading-text)] text-center'
        )}
      >
        Settings
      </h3>

      {/* Settings body */}
      <div className="w-full flex flex-col gap-5">

        {/* ── Appearance Section ─── */}
        <SectionCard title="Appearance">
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "font-medium [font-family:'Futura',_sans-serif]",
                'text-[length:var(--ft-17-16)]',
                'text-[var(--auth-heading-text)]'
              )}
            >
              Theme
            </span>
            <ThemeToggle theme={theme} onSelect={setTheme} />
          </div>
        </SectionCard>

        {/* ── Hub Settings Section ─── */}
        <SectionCard
          title="Hub Settings"
          badge={isGuest ? (
            <span
              className={cn(
                'inline-flex items-center gap-[5px] px-[10px] py-[2px] rounded-full',
                'bg-[var(--auth-badge-bg)] text-[var(--auth-subtitle-text)]',
                'text-[length:var(--ft-12-11)]',
                "[font-family:'Open_Sans',_sans-serif] font-medium"
              )}
            >
              Sign in to unlock
            </span>
          ) : undefined}
        >
          <div className={isGuest ? 'opacity-50' : undefined}>
            {/* Item 1: Toggle — usePopupSnapshot */}
            <div className="flex flex-wrap items-center gap-[1.35rem] pb-4">
              <ToggleSwitch
                id="usePopupSnapshot"
                checked={prefs.usePopupSnapshot}
                onChange={(v) => setPref('usePopupSnapshot', v)}
                disabled={isGuest}
              />
              <div className="flex flex-col text-left [font-family:'Open_Sans',_sans-serif] font-normal">
                <span
                  className={cn(
                    "font-medium [font-family:'Futura',_sans-serif]",
                    'text-[length:var(--ft-19-18)] max-[600px]:text-[length:var(--fm-18-17)]',
                    'text-[var(--auth-heading-text)] mb-[0.2rem] min-w-[11rem]'
                  )}
                >
                  Use Pop&#x2011;up For Snapshot Reviews
                </span>
                <span
                  className={cn(
                    "font-light [font-family:'Open_Sans',_sans-serif]",
                    'text-[length:var(--ft-14-13)] max-[600px]:text-[length:var(--fm-13-12)]',
                    'text-[var(--auth-label-text)] leading-[1.2] text-left'
                  )}
                >
                  Snapshot reviews open in a pop&#x2011;up if enabled, or a dedicated page if disabled.
                </span>
              </div>
            </div>

            {/* Item 2: Radio — Display Results */}
            <div className="flex flex-wrap items-center gap-[1.35rem] mt-4 pb-4">
              <div
                className={cn(
                  "font-medium [font-family:'Futura',_sans-serif]",
                  'text-[length:var(--ft-19-18)] max-[600px]:text-[length:var(--fm-18-17)]',
                  'text-[var(--auth-heading-text)] min-w-[11rem]'
                )}
              >
                Display Results
              </div>
              <RadioGroup
                name="displayHubResults"
                options={DISPLAY_OPTIONS}
                value={prefs.displayHubResults}
                onChange={(v) => setPref('displayHubResults', v as 'grid' | 'brandRows')}
                disabled={isGuest}
              />
            </div>

            {/* Item 3: Radio — Default Display */}
            <div className="flex flex-wrap items-center gap-[1.35rem] mt-4">
              <div
                className={cn(
                  "font-medium [font-family:'Futura',_sans-serif]",
                  'text-[length:var(--ft-19-18)] max-[600px]:text-[length:var(--fm-18-17)]',
                  'text-[var(--auth-heading-text)] min-w-[11rem]'
                )}
              >
                Default Display
              </div>
              <RadioGroup
                name="defaultHubDisplay"
                options={DISPLAY_OPTIONS}
                value={prefs.defaultHubDisplay}
                onChange={(v) => setPref('defaultHubDisplay', v as 'grid' | 'brandRows')}
                disabled={isGuest}
              />
            </div>
          </div>

          {/* Inline CTA for guests */}
          {isGuest && <GuestCTA onClose={onClose} />}
        </SectionCard>
      </div>
    </div>
  );
}
