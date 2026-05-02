import { createPortal } from 'react-dom';

import {
  createContext,
  useContext,
  useEffect,
  type CSSProperties,
  type ReactNode,
} from 'react';

interface ToggleProps {
  checked: boolean;
  label: string;
  onChange: (nextValue: boolean) => void;
}

interface IconProps {
  title?: string;
  className?: string;
}

interface CategoryPreviewIconProps {
  categoryId: string;
  className?: string;
}

export type IconThemeId = 'legacy-clone' | 'arcade-neon' | 'pip-boy' | 'phantom' | 'cloux' | 'deus-ex' | 'overwatch' | 'warcraft';

type IconName = 'pin' | 'lock' | 'auto' | 'close' | 'star';
type CategoryIconName =
  | 'mouse'
  | 'keyboard'
  | 'monitor'
  | 'headset'
  | 'mousepad'
  | 'controller'
  | 'hardware'
  | 'game'
  | 'gpu'
  | 'ai'
  | 'unknown';

export const IconThemeContext = createContext<IconThemeId>('legacy-clone');

const ICON_SVG_PROPS = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 'var(--inline-icon-stroke-width)',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': 'true',
};

const CATEGORY_ICON_SVG_PROPS = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 'var(--category-preview-icon-stroke-width)',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': 'true',
};

const ICON_PATHS: Record<IconThemeId, Record<IconName, ReactNode>> = {
  'legacy-clone': {
    pin: (
      <>
        <path d="M7 3h6l-1 5 3 2H5l3-2-1-5Z" />
        <line x1="10" y1="10" x2="10" y2="17" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="9" width="10" height="8" />
        <path d="M7.5 9V6.5a2.5 2.5 0 0 1 5 0V9" />
      </>
    ),
    auto: (
      <>
        <rect x="3" y="4" width="14" height="12" />
        <line x1="3" y1="8" x2="17" y2="8" />
        <line x1="7" y1="4" x2="7" y2="16" />
      </>
    ),
    close: (
      <>
        <line x1="5" y1="5" x2="15" y2="15" />
        <line x1="15" y1="5" x2="5" y2="15" />
      </>
    ),
    star: <path d="M10 2.8 12.3 7l4.7.7-3.4 3.3.8 4.6-4.4-2.3-4.4 2.3.8-4.6L3 7.7 7.7 7Z" />,
  },
  'arcade-neon': {
    pin: (
      <>
        <path d="M6 3h8v3l2 2.5H4L6 6V3Z" />
        <line x1="10" y1="8.5" x2="10" y2="17" />
        <line x1="7.5" y1="12.5" x2="12.5" y2="12.5" />
      </>
    ),
    lock: (
      <>
        <rect x="4.5" y="9" width="11" height="8" />
        <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
        <circle cx="10" cy="13" r="1.1" />
      </>
    ),
    auto: (
      <>
        <rect x="3" y="4" width="14" height="12" />
        <line x1="3" y1="8" x2="17" y2="8" />
        <line x1="3" y1="12" x2="17" y2="12" />
        <line x1="8" y1="4" x2="8" y2="16" />
      </>
    ),
    close: (
      <>
        <line x1="4.5" y1="4.5" x2="15.5" y2="15.5" />
        <line x1="15.5" y1="4.5" x2="4.5" y2="15.5" />
        <circle cx="10" cy="10" r="7" />
      </>
    ),
    star: <path d="M10 2.5 12.1 6.7l4.6.7-3.4 3.2.8 4.9-4.1-2.2-4.1 2.2.8-4.9L3.3 7.4l4.6-.7Z" />,
  },
  'pip-boy': {
    pin: (
      <>
        <path d="M7 3h6l-1 5 3 2H5l3-2-1-5Z" />
        <line x1="10" y1="10" x2="10" y2="17" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="9" width="10" height="8" />
        <path d="M7.5 9V6.5a2.5 2.5 0 0 1 5 0V9" />
      </>
    ),
    auto: (
      <>
        <rect x="3" y="4" width="14" height="12" />
        <line x1="3" y1="8" x2="17" y2="8" />
        <line x1="7" y1="4" x2="7" y2="16" />
      </>
    ),
    close: (
      <>
        <line x1="5" y1="5" x2="15" y2="15" />
        <line x1="15" y1="5" x2="5" y2="15" />
      </>
    ),
    star: <path d="M10 2.8 12.3 7l4.7.7-3.4 3.3.8 4.6-4.4-2.3-4.4 2.3.8-4.6L3 7.7 7.7 7Z" />,
  },
  'phantom': {
    pin: (
      <>
        <polygon points="7,2 13,2 12,8 16,10 4,10 8,8" />
        <line x1="10" y1="10" x2="10" y2="18" />
        <line x1="7" y1="18" x2="13" y2="18" />
      </>
    ),
    lock: (
      <>
        <polygon points="4,9 16,9 16,18 4,18" />
        <polyline points="7,9 7,5 10,3 13,5 13,9" />
        <line x1="10" y1="12" x2="10" y2="15" />
      </>
    ),
    auto: (
      <>
        <polygon points="2,3 18,3 18,17 2,17" />
        <line x1="2" y1="7" x2="18" y2="7" />
        <line x1="2" y1="12" x2="18" y2="12" />
        <line x1="7" y1="3" x2="7" y2="17" />
        <line x1="13" y1="3" x2="13" y2="17" />
      </>
    ),
    close: (
      <>
        <line x1="4" y1="4" x2="16" y2="16" />
        <line x1="16" y1="4" x2="4" y2="16" />
        <polygon points="10,2 18,10 10,18 2,10" fill="none" />
      </>
    ),
    star: <polygon points="10,1 12.5,7 19,7.5 14,12 15.5,19 10,15.5 4.5,19 6,12 1,7.5 7.5,7" />,
  },
  'cloux': {
    pin: (
      <>
        <circle cx="10" cy="7" r="4" />
        <path d="M10 11v6" />
        <circle cx="10" cy="17" r="0.8" fill="currentColor" stroke="none" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="9" width="10" height="8" rx="2" />
        <path d="M7.5 9V6.5a2.5 2.5 0 0 1 5 0V9" />
        <circle cx="10" cy="13.5" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    auto: (
      <>
        <rect x="3" y="4" width="14" height="12" rx="2" />
        <line x1="3" y1="8" x2="17" y2="8" />
        <line x1="7" y1="8" x2="7" y2="16" />
      </>
    ),
    close: (
      <>
        <circle cx="10" cy="10" r="7" />
        <line x1="7" y1="7" x2="13" y2="13" />
        <line x1="13" y1="7" x2="7" y2="13" />
      </>
    ),
    star: <path d="M10 2.8 12.3 7l4.7.7-3.4 3.3.8 4.6-4.4-2.3-4.4 2.3.8-4.6L3 7.7 7.7 7Z" />,
  },
  'deus-ex': {
    pin: (
      <>
        <polygon points="7,2 13,2 11,8 15,10 5,10 9,8" />
        <line x1="10" y1="10" x2="10" y2="17" />
        <polygon points="8,17 12,17 10,19" fill="currentColor" stroke="none" />
      </>
    ),
    lock: (
      <>
        <polygon points="4,9 16,9 15,18 5,18" />
        <path d="M7 9V6a3 3 0 0 1 6 0v3" />
        <polygon points="9,12 11,12 10,15" fill="currentColor" stroke="none" />
      </>
    ),
    auto: (
      <>
        <polygon points="3,4 17,4 16,16 4,16" />
        <line x1="3" y1="8" x2="17" y2="8" />
        <line x1="3" y1="12" x2="17" y2="12" />
        <line x1="7" y1="4" x2="7" y2="16" />
        <line x1="13" y1="4" x2="13" y2="16" />
      </>
    ),
    close: (
      <>
        <polygon points="10,3 17,10 10,17 3,10" />
        <line x1="7" y1="7" x2="13" y2="13" />
        <line x1="13" y1="7" x2="7" y2="13" />
      </>
    ),
    star: <polygon points="10,1 12,6.5 18,7 13.5,11.5 15,18 10,14.5 5,18 6.5,11.5 2,7 8,6.5" />,
  },
  'overwatch': {
    pin: (
      <>
        <circle cx="10" cy="6" r="4.5" fill="currentColor" stroke="none" />
        <path d="M10 10.5v5.5" strokeWidth="2.5" />
        <circle cx="10" cy="17.5" r="1.2" fill="currentColor" stroke="none" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="9" width="12" height="9" rx="2.5" fill="currentColor" stroke="none" />
        <path d="M7 9V6.5a3 3 0 0 1 6 0V9" strokeWidth="2" />
        <circle cx="10" cy="13.5" r="1.5" stroke="var(--color-mantle)" fill="var(--color-mantle)" />
      </>
    ),
    auto: (
      <>
        <rect x="2" y="3" width="16" height="14" rx="3" />
        <line x1="2" y1="8" x2="18" y2="8" />
        <line x1="7" y1="8" x2="7" y2="17" />
        <circle cx="12.5" cy="12.5" r="1.5" fill="currentColor" stroke="none" />
      </>
    ),
    close: (
      <>
        <circle cx="10" cy="10" r="8" />
        <line x1="6.5" y1="6.5" x2="13.5" y2="13.5" strokeWidth="2" />
        <line x1="13.5" y1="6.5" x2="6.5" y2="13.5" strokeWidth="2" />
      </>
    ),
    star: (
      <>
        <path d="M10 2.5 12.3 7l4.7.7-3.4 3.3.8 4.6-4.4-2.3-4.4 2.3.8-4.6L3 7.7 7.7 7Z" fill="currentColor" stroke="none" />
      </>
    ),
  },
  'warcraft': {
    pin: (
      <>
        <path d="M10 2L7 4v5l-3 2h12l-3-2V4z" fill="currentColor" stroke="none" />
        <line x1="10" y1="11" x2="10" y2="17" strokeWidth="2" />
        <path d="M7 17h6" strokeWidth="1.5" />
      </>
    ),
    lock: (
      <>
        <path d="M5 9h10v8a1 1 0 01-1 1H6a1 1 0 01-1-1V9z" fill="currentColor" stroke="none" />
        <path d="M7.5 9V6a2.5 2.5 0 015 0v3" strokeWidth="2" />
        <path d="M10 12v3" strokeWidth="1.5" />
      </>
    ),
    auto: (
      <>
        <path d="M3 4h14a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1z" />
        <line x1="2" y1="8" x2="18" y2="8" />
        <line x1="7" y1="4" x2="7" y2="16" />
        <path d="M10 11l2 2 3-4" strokeWidth="1.5" />
      </>
    ),
    close: (
      <>
        <path d="M10 2L17 6v8l-7 4-7-4V6z" />
        <line x1="7" y1="7" x2="13" y2="13" strokeWidth="1.5" />
        <line x1="13" y1="7" x2="7" y2="13" strokeWidth="1.5" />
      </>
    ),
    star: (
      <>
        <path d="M10 2l2.5 5 5.5.8-4 3.8 1 5.4-5-2.6-5 2.6 1-5.4-4-3.8 5.5-.8z" fill="currentColor" stroke="none" />
        <path d="M10 2l2.5 5 5.5.8-4 3.8 1 5.4-5-2.6-5 2.6 1-5.4-4-3.8 5.5-.8z" fill="none" />
      </>
    ),
  },
};

const LEGACY_CATEGORY_PREVIEW_PATHS: Record<CategoryIconName, ReactNode> = {
  mouse: (
    <>
      <ellipse cx="10" cy="10" rx="6" ry="9" />
      <line x1="10" y1="1" x2="10" y2="9" />
      <ellipse cx="10" cy="6.5" rx="1.5" ry="1.5" />
    </>
  ),
  keyboard: (
    <>
      <rect x="1" y="4" width="18" height="12" />
      <rect x="4" y="6" width="1.5" height="1.5" className="category-preview-icon__fill" />
      <rect x="7" y="6" width="1.5" height="1.5" className="category-preview-icon__fill" />
      <rect x="10" y="6" width="1.5" height="1.5" className="category-preview-icon__fill" />
      <rect x="13" y="6" width="1.5" height="1.5" className="category-preview-icon__fill" />
      <rect x="15" y="6" width="1.5" height="1.5" className="category-preview-icon__fill" />
      <rect x="4" y="9" width="1.5" height="1.5" className="category-preview-icon__fill" />
      <rect x="7" y="9" width="1.5" height="1.5" className="category-preview-icon__fill" />
      <rect x="10" y="9" width="1.5" height="1.5" className="category-preview-icon__fill" />
      <rect x="13" y="9" width="1.5" height="1.5" className="category-preview-icon__fill" />
      <rect x="15" y="9" width="1.5" height="1.5" className="category-preview-icon__fill" />
      <line x1="7" y1="13" x2="14" y2="13" />
    </>
  ),
  monitor: (
    <>
      <rect x="1" y="2" width="18" height="11" />
      <line x1="10" y1="13" x2="10" y2="17" />
      <line x1="6" y1="17" x2="14" y2="17" />
    </>
  ),
  headset: (
    <>
      <path d="M3 11a7 7 0 0 1 14 0" />
      <rect x="2" y="11" width="4" height="7" />
      <rect x="14" y="11" width="4" height="7" />
    </>
  ),
  mousepad: (
    <>
      <rect x="1" y="5" width="18" height="12" />
      <line x1="4" y1="14" x2="16" y2="14" className="category-preview-icon__dash" />
    </>
  ),
  controller: (
    <>
      <ellipse cx="10" cy="10" rx="8" ry="6" />
      <line x1="6" y1="10" x2="10" y2="10" />
      <line x1="8" y1="8" x2="8" y2="12" />
      <circle cx="13.75" cy="8.75" r="0.75" className="category-preview-icon__fill" />
      <circle cx="12.25" cy="11.25" r="0.75" className="category-preview-icon__fill" />
    </>
  ),
  hardware: (
    <>
      <rect x="4" y="4" width="12" height="12" />
      <rect x="7" y="7" width="6" height="6" />
      <line x1="7" y1="1" x2="7" y2="4" />
      <line x1="13" y1="1" x2="13" y2="4" />
      <line x1="7" y1="16" x2="7" y2="19" />
      <line x1="13" y1="16" x2="13" y2="19" />
      <line x1="1" y1="7" x2="4" y2="7" />
      <line x1="16" y1="7" x2="19" y2="7" />
      <line x1="1" y1="13" x2="4" y2="13" />
      <line x1="16" y1="13" x2="19" y2="13" />
    </>
  ),
  game: (
    <>
      <circle cx="10" cy="10" r="8" />
      <circle cx="10" cy="10" r="3" />
      <line x1="10" y1="1" x2="10" y2="5" />
      <line x1="10" y1="15" x2="10" y2="19" />
      <line x1="1" y1="10" x2="5" y2="10" />
      <line x1="15" y1="10" x2="19" y2="10" />
    </>
  ),
  gpu: (
    <>
      <rect x="1" y="4" width="18" height="13" />
      <circle cx="10" cy="12" r="5" />
      <circle cx="10" cy="12" r="2" />
      <line x1="5" y1="4" x2="5" y2="1" />
      <line x1="9" y1="4" x2="9" y2="1" />
    </>
  ),
  ai: (
    <>
      <path d="M10 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />
      <path d="M17 1l.5 3 2 .5-2 .5-.5 2-.5-2-2-.5 2-.5.5-3Z" />
    </>
  ),
  unknown: (
    <>
      <circle cx="10" cy="10" r="5" />
      <text x="10" y="12" textAnchor="middle" className="category-preview-icon__text">
        ?
      </text>
    </>
  ),
};

const ARCADE_NEON_CATEGORY_PREVIEW_PATHS: Record<CategoryIconName, ReactNode> = {
  ...LEGACY_CATEGORY_PREVIEW_PATHS,
  keyboard: (
    <>
      <rect x="1" y="4" width="18" height="12" />
      <rect x="4" y="6" width="1.5" height="1.5" className="category-preview-icon__fill" />
      <rect x="7" y="6" width="1.5" height="1.5" className="category-preview-icon__fill" />
      <rect x="10" y="6" width="1.5" height="1.5" className="category-preview-icon__fill" />
      <rect x="13" y="6" width="1.5" height="1.5" className="category-preview-icon__fill" />
      <rect x="15" y="6" width="1.5" height="1.5" className="category-preview-icon__fill" />
      <rect x="4" y="9" width="1.5" height="1.5" className="category-preview-icon__fill" />
      <rect x="7" y="9" width="1.5" height="1.5" className="category-preview-icon__fill" />
      <rect x="10" y="9" width="1.5" height="1.5" className="category-preview-icon__fill" />
      <rect x="13" y="9" width="1.5" height="1.5" className="category-preview-icon__fill" />
      <rect x="15" y="9" width="1.5" height="1.5" className="category-preview-icon__fill" />
      <line x1="6" y1="13" x2="14.5" y2="13" />
      <line x1="2.5" y1="4" x2="17.5" y2="4" />
    </>
  ),
  controller: (
    <>
      <ellipse cx="10" cy="10" rx="8" ry="6" />
      <line x1="6" y1="10" x2="10" y2="10" />
      <line x1="8" y1="8" x2="8" y2="12" />
      <circle cx="13.75" cy="8.75" r="0.85" className="category-preview-icon__fill" />
      <circle cx="12.25" cy="11.25" r="0.85" className="category-preview-icon__fill" />
      <circle cx="15.2" cy="10" r="0.7" className="category-preview-icon__fill" />
    </>
  ),
  gpu: (
    <>
      <rect x="1" y="4" width="18" height="13" />
      <circle cx="10" cy="12" r="5" />
      <circle cx="10" cy="12" r="2" />
      <line x1="5" y1="4" x2="5" y2="1" />
      <line x1="9" y1="4" x2="9" y2="1" />
      <line x1="13" y1="4" x2="13" y2="1" />
    </>
  ),
  unknown: (
    <>
      <circle cx="10" cy="10" r="6" />
      <text x="10" y="12" textAnchor="middle" className="category-preview-icon__text">
        !
      </text>
    </>
  ),
};

const PHANTOM_CATEGORY_PREVIEW_PATHS: Record<CategoryIconName, ReactNode> = {
  mouse: (
    <>
      <polygon points="10,1 16,7 16,18 4,18 4,7" />
      <line x1="10" y1="1" x2="10" y2="10" />
      <polygon points="8.5,5 11.5,5 11.5,8 8.5,8" />
    </>
  ),
  keyboard: (
    <>
      <polygon points="1,4 19,4 19,16 1,16" />
      <line x1="4" y1="7" x2="6" y2="7" />
      <line x1="8" y1="7" x2="10" y2="7" />
      <line x1="12" y1="7" x2="14" y2="7" />
      <line x1="4" y1="10" x2="6" y2="10" />
      <line x1="8" y1="10" x2="10" y2="10" />
      <line x1="12" y1="10" x2="14" y2="10" />
      <line x1="7" y1="13" x2="13" y2="13" />
    </>
  ),
  monitor: (
    <>
      <polygon points="1,2 19,2 19,13 1,13" />
      <line x1="7" y1="13" x2="7" y2="17" />
      <line x1="13" y1="13" x2="13" y2="17" />
      <line x1="5" y1="17" x2="15" y2="17" />
    </>
  ),
  headset: (
    <>
      <polyline points="3,12 3,8 6,4 14,4 17,8 17,12" />
      <polygon points="1,11 5,11 5,18 1,18" />
      <polygon points="15,11 19,11 19,18 15,18" />
    </>
  ),
  mousepad: (
    <>
      <polygon points="1,5 19,5 19,17 1,17" />
      <line x1="4" y1="14" x2="16" y2="14" />
    </>
  ),
  controller: (
    <>
      <polygon points="4,5 16,5 19,12 16,17 4,17 1,12" />
      <line x1="6" y1="10" x2="10" y2="10" />
      <line x1="8" y1="8" x2="8" y2="12" />
      <polygon points="13,8 15,8 15,10 13,10" fill="currentColor" stroke="none" />
      <polygon points="12,11 14,11 14,13 12,13" fill="currentColor" stroke="none" />
    </>
  ),
  hardware: (
    <>
      <polygon points="4,4 16,4 16,16 4,16" />
      <polygon points="7,7 13,7 13,13 7,13" />
      <line x1="7" y1="1" x2="7" y2="4" />
      <line x1="13" y1="1" x2="13" y2="4" />
      <line x1="7" y1="16" x2="7" y2="19" />
      <line x1="13" y1="16" x2="13" y2="19" />
      <line x1="1" y1="7" x2="4" y2="7" />
      <line x1="16" y1="7" x2="19" y2="7" />
      <line x1="1" y1="13" x2="4" y2="13" />
      <line x1="16" y1="13" x2="19" y2="13" />
    </>
  ),
  game: (
    <>
      <polygon points="10,1 19,10 10,19 1,10" />
      <polygon points="10,5 15,10 10,15 5,10" />
    </>
  ),
  gpu: (
    <>
      <polygon points="1,4 19,4 19,17 1,17" />
      <polygon points="7,8 13,8 13,14 7,14" />
      <line x1="5" y1="4" x2="5" y2="1" />
      <line x1="9" y1="4" x2="9" y2="1" />
      <line x1="13" y1="4" x2="13" y2="1" />
    </>
  ),
  ai: (
    <>
      <polygon points="10,1 13,7 19,7 14,12 16,19 10,15 4,19 6,12 1,7 7,7" />
    </>
  ),
  unknown: (
    <>
      <polygon points="10,2 18,10 10,18 2,10" />
      <text x="10" y="12.5" textAnchor="middle" className="category-preview-icon__text">?</text>
    </>
  ),
};

const CATEGORY_PREVIEW_PATHS: Record<IconThemeId, Record<CategoryIconName, ReactNode>> = {
  'legacy-clone': LEGACY_CATEGORY_PREVIEW_PATHS,
  'arcade-neon': ARCADE_NEON_CATEGORY_PREVIEW_PATHS,
  'pip-boy': LEGACY_CATEGORY_PREVIEW_PATHS,
  'phantom': PHANTOM_CATEGORY_PREVIEW_PATHS,
  'cloux': CLOUX_CATEGORY_PREVIEW_PATHS,
  'deus-ex': DEUS_EX_CATEGORY_PREVIEW_PATHS,
  'overwatch': OVERWATCH_CATEGORY_PREVIEW_PATHS,
  'warcraft': WARCRAFT_CATEGORY_PREVIEW_PATHS,
};

const WARCRAFT_CATEGORY_PREVIEW_PATHS: Record<CategoryIconName, ReactNode> = {
  mouse: (
    <>
      <path d="M10 1C7 1 5 3 5 6v8c0 3 2 5 5 5s5-2 5-5V6c0-3-2-5-5-5z" />
      <line x1="10" y1="1" x2="10" y2="9" />
      <circle cx="10" cy="5.5" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  keyboard: (
    <>
      <path d="M2 5a1 1 0 011-1h14a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V5z" />
      <rect x="4" y="6.5" width="1.5" height="1.5" fill="currentColor" stroke="none" />
      <rect x="7" y="6.5" width="1.5" height="1.5" fill="currentColor" stroke="none" />
      <rect x="10" y="6.5" width="1.5" height="1.5" fill="currentColor" stroke="none" />
      <rect x="13" y="6.5" width="1.5" height="1.5" fill="currentColor" stroke="none" />
      <rect x="4" y="9.5" width="1.5" height="1.5" fill="currentColor" stroke="none" />
      <rect x="7" y="9.5" width="1.5" height="1.5" fill="currentColor" stroke="none" />
      <rect x="10" y="9.5" width="1.5" height="1.5" fill="currentColor" stroke="none" />
      <rect x="13" y="9.5" width="1.5" height="1.5" fill="currentColor" stroke="none" />
      <rect x="7" y="12.5" width="7" height="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  monitor: (
    <>
      <path d="M2 3a1 1 0 011-1h14a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3z" />
      <path d="M8 13v3H6l4 2 4-2h-2v-3" />
    </>
  ),
  headset: (
    <>
      <path d="M3 12a7 7 0 0114 0" strokeWidth="2" />
      <path d="M2 11v7a1 1 0 001 1h2a1 1 0 001-1v-5a1 1 0 00-1-1H2z" fill="currentColor" stroke="none" />
      <path d="M18 11v7a1 1 0 01-1 1h-2a1 1 0 01-1-1v-5a1 1 0 011-1h3z" fill="currentColor" stroke="none" />
    </>
  ),
  mousepad: (
    <>
      <path d="M2 6a1 1 0 011-1h14a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V6z" />
      <line x1="4" y1="14" x2="16" y2="14" strokeDasharray="2 2" />
    </>
  ),
  controller: (
    <>
      <path d="M4 5h12l3 7-3 5H4L1 12z" />
      <line x1="6" y1="10" x2="10" y2="10" />
      <line x1="8" y1="8" x2="8" y2="12" />
      <circle cx="14" cy="9" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="11.5" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  hardware: (
    <>
      <path d="M5 4a1 1 0 011-1h8a1 1 0 011 1v12a1 1 0 01-1 1H6a1 1 0 01-1-1V4z" />
      <rect x="7" y="7" width="6" height="6" />
      <line x1="7" y1="1" x2="7" y2="3" />
      <line x1="13" y1="1" x2="13" y2="3" />
      <line x1="7" y1="17" x2="7" y2="19" />
      <line x1="13" y1="17" x2="13" y2="19" />
      <line x1="1" y1="7" x2="5" y2="7" />
      <line x1="15" y1="7" x2="19" y2="7" />
      <line x1="1" y1="13" x2="5" y2="13" />
      <line x1="15" y1="13" x2="19" y2="13" />
    </>
  ),
  game: (
    <>
      <path d="M10 1l9 9-9 9-9-9z" />
      <path d="M10 5l5 5-5 5-5-5z" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  gpu: (
    <>
      <path d="M2 5a1 1 0 011-1h14a1 1 0 011 1v11a1 1 0 01-1 1H3a1 1 0 01-1-1V5z" />
      <circle cx="10" cy="12" r="4" />
      <circle cx="10" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <line x1="5" y1="4" x2="5" y2="1" />
      <line x1="9" y1="4" x2="9" y2="1" />
    </>
  ),
  ai: (
    <>
      <path d="M10 2l8 6v4l-8 6-8-6V8z" />
      <circle cx="10" cy="10" r="3" />
      <circle cx="10" cy="10" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  unknown: (
    <>
      <path d="M10 2l8 6v4l-8 6-8-6V8z" />
      <text x="10" y="12.5" textAnchor="middle" className="category-preview-icon__text">?</text>
    </>
  ),
};

const OVERWATCH_CATEGORY_PREVIEW_PATHS: Record<CategoryIconName, ReactNode> = {
  mouse: (
    <>
      <ellipse cx="10" cy="10" rx="5" ry="8" fill="currentColor" stroke="none" />
      <line x1="10" y1="2" x2="10" y2="8" stroke="var(--color-mantle)" strokeWidth="2" />
      <circle cx="10" cy="5.5" r="1.8" fill="var(--color-mantle)" stroke="none" />
    </>
  ),
  keyboard: (
    <>
      <rect x="1" y="4" width="18" height="12" rx="2.5" fill="currentColor" stroke="none" />
      <rect x="4" y="6.5" width="2" height="2" rx="0.5" fill="var(--color-mantle)" stroke="none" />
      <rect x="7.5" y="6.5" width="2" height="2" rx="0.5" fill="var(--color-mantle)" stroke="none" />
      <rect x="11" y="6.5" width="2" height="2" rx="0.5" fill="var(--color-mantle)" stroke="none" />
      <rect x="14.5" y="6.5" width="2" height="2" rx="0.5" fill="var(--color-mantle)" stroke="none" />
      <rect x="4" y="10" width="2" height="2" rx="0.5" fill="var(--color-mantle)" stroke="none" />
      <rect x="7.5" y="10" width="2" height="2" rx="0.5" fill="var(--color-mantle)" stroke="none" />
      <rect x="11" y="10" width="2" height="2" rx="0.5" fill="var(--color-mantle)" stroke="none" />
      <rect x="14.5" y="10" width="2" height="2" rx="0.5" fill="var(--color-mantle)" stroke="none" />
    </>
  ),
  monitor: (
    <>
      <rect x="1" y="2" width="18" height="11" rx="2" fill="currentColor" stroke="none" />
      <rect x="7" y="14" width="6" height="2" rx="1" fill="currentColor" stroke="none" />
      <rect x="5" y="17" width="10" height="1.5" rx="0.75" fill="currentColor" stroke="none" />
    </>
  ),
  headset: (
    <>
      <path d="M3 12a7 7 0 0 1 14 0" strokeWidth="2.5" />
      <rect x="1" y="11" width="5" height="7" rx="2" fill="currentColor" stroke="none" />
      <rect x="14" y="11" width="5" height="7" rx="2" fill="currentColor" stroke="none" />
    </>
  ),
  mousepad: (
    <>
      <rect x="1" y="5" width="18" height="12" rx="2.5" fill="currentColor" stroke="none" />
      <line x1="4" y1="14" x2="16" y2="14" stroke="var(--color-mantle)" strokeWidth="1.5" />
    </>
  ),
  controller: (
    <>
      <ellipse cx="10" cy="10" rx="8" ry="6.5" fill="currentColor" stroke="none" />
      <line x1="5.5" y1="10" x2="9" y2="10" stroke="var(--color-mantle)" strokeWidth="1.5" />
      <line x1="7.25" y1="8" x2="7.25" y2="12" stroke="var(--color-mantle)" strokeWidth="1.5" />
      <circle cx="13.5" cy="8.5" r="1" fill="var(--color-mantle)" stroke="none" />
      <circle cx="12" cy="11" r="1" fill="var(--color-mantle)" stroke="none" />
    </>
  ),
  hardware: (
    <>
      <rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
      <rect x="7" y="7" width="6" height="6" rx="1" fill="var(--color-mantle)" stroke="none" />
      <line x1="7" y1="1" x2="7" y2="4" strokeWidth="1.5" />
      <line x1="13" y1="1" x2="13" y2="4" strokeWidth="1.5" />
      <line x1="7" y1="16" x2="7" y2="19" strokeWidth="1.5" />
      <line x1="13" y1="16" x2="13" y2="19" strokeWidth="1.5" />
      <line x1="1" y1="7" x2="4" y2="7" strokeWidth="1.5" />
      <line x1="16" y1="7" x2="19" y2="7" strokeWidth="1.5" />
      <line x1="1" y1="13" x2="4" y2="13" strokeWidth="1.5" />
      <line x1="16" y1="13" x2="19" y2="13" strokeWidth="1.5" />
    </>
  ),
  game: (
    <>
      <circle cx="10" cy="10" r="8" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="4" fill="var(--color-mantle)" stroke="none" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  gpu: (
    <>
      <rect x="1" y="4" width="18" height="13" rx="2" fill="currentColor" stroke="none" />
      <circle cx="10" cy="12" r="4" fill="var(--color-mantle)" stroke="none" />
      <circle cx="10" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <rect x="4" y="1" width="2" height="3" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="8" y="1" width="2" height="3" rx="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  ai: (
    <>
      <circle cx="10" cy="10" r="7.5" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="3" fill="var(--color-mantle)" stroke="none" />
      <circle cx="10" cy="3" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="7" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="10" cy="17" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="7" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  unknown: (
    <>
      <circle cx="10" cy="10" r="7" fill="currentColor" stroke="none" />
      <text x="10" y="13" textAnchor="middle" fill="var(--color-mantle)" fontSize="10" fontWeight="700" stroke="none">?</text>
    </>
  ),
};

const DEUS_EX_CATEGORY_PREVIEW_PATHS: Record<CategoryIconName, ReactNode> = {
  mouse: (
    <>
      <polygon points="10,1 15,5 15,18 5,18 5,5" />
      <line x1="10" y1="1" x2="10" y2="9" />
      <polygon points="8,5 12,5 12,8 8,8" />
    </>
  ),
  keyboard: (
    <>
      <polygon points="1,4 19,4 18,16 2,16" />
      <line x1="4" y1="7" x2="6" y2="7" />
      <line x1="8" y1="7" x2="10" y2="7" />
      <line x1="12" y1="7" x2="14" y2="7" />
      <line x1="4" y1="10" x2="6" y2="10" />
      <line x1="8" y1="10" x2="10" y2="10" />
      <line x1="12" y1="10" x2="14" y2="10" />
      <line x1="6" y1="13" x2="14" y2="13" />
    </>
  ),
  monitor: (
    <>
      <polygon points="1,2 19,2 18,13 2,13" />
      <polygon points="7,13 13,13 14,17 6,17" />
    </>
  ),
  headset: (
    <>
      <polyline points="3,12 3,7 6,3 14,3 17,7 17,12" />
      <polygon points="1,11 5,11 5,18 2,18" />
      <polygon points="15,11 19,11 18,18 15,18" />
    </>
  ),
  mousepad: (
    <>
      <polygon points="1,5 19,5 18,17 2,17" />
      <line x1="4" y1="14" x2="16" y2="14" />
    </>
  ),
  controller: (
    <>
      <polygon points="4,5 16,5 19,11 16,17 4,17 1,11" />
      <line x1="6" y1="10" x2="10" y2="10" />
      <line x1="8" y1="8" x2="8" y2="12" />
      <polygon points="13,8 15,8 15,10 13,10" fill="currentColor" stroke="none" />
      <polygon points="12,11 14,11 14,13 12,13" fill="currentColor" stroke="none" />
    </>
  ),
  hardware: (
    <>
      <polygon points="5,4 15,4 16,16 4,16" />
      <polygon points="7,7 13,7 13,13 7,13" />
      <line x1="7" y1="1" x2="7" y2="4" />
      <line x1="13" y1="1" x2="13" y2="4" />
      <line x1="7" y1="16" x2="7" y2="19" />
      <line x1="13" y1="16" x2="13" y2="19" />
      <line x1="1" y1="7" x2="4" y2="7" />
      <line x1="16" y1="7" x2="19" y2="7" />
      <line x1="1" y1="13" x2="4" y2="13" />
      <line x1="16" y1="13" x2="19" y2="13" />
    </>
  ),
  game: (
    <>
      <polygon points="10,1 19,10 10,19 1,10" />
      <polygon points="10,5 15,10 10,15 5,10" />
      <polygon points="10,8 12,10 10,12 8,10" fill="currentColor" stroke="none" />
    </>
  ),
  gpu: (
    <>
      <polygon points="1,4 19,4 18,17 2,17" />
      <polygon points="7,8 13,8 12,14 8,14" />
      <line x1="5" y1="4" x2="5" y2="1" />
      <line x1="9" y1="4" x2="9" y2="1" />
      <line x1="13" y1="4" x2="13" y2="1" />
    </>
  ),
  ai: (
    <>
      <polygon points="10,1 13,7 19,7 14,12 16,19 10,15 4,19 6,12 1,7 7,7" />
      <polygon points="10,6 12,9 10,12 8,9" fill="currentColor" stroke="none" />
    </>
  ),
  unknown: (
    <>
      <polygon points="10,2 18,10 10,18 2,10" />
      <text x="10" y="12.5" textAnchor="middle" className="category-preview-icon__text">?</text>
    </>
  ),
};

const CLOUX_CATEGORY_PREVIEW_PATHS: Record<CategoryIconName, ReactNode> = {
  mouse: (
    <>
      <ellipse cx="10" cy="10" rx="5.5" ry="8.5" />
      <line x1="10" y1="1.5" x2="10" y2="8" />
      <circle cx="10" cy="5.5" r="1.5" />
    </>
  ),
  keyboard: (
    <>
      <rect x="1" y="4" width="18" height="12" rx="2" />
      <rect x="4" y="6.5" width="1.5" height="1.5" rx="0.4" className="category-preview-icon__fill" />
      <rect x="7" y="6.5" width="1.5" height="1.5" rx="0.4" className="category-preview-icon__fill" />
      <rect x="10" y="6.5" width="1.5" height="1.5" rx="0.4" className="category-preview-icon__fill" />
      <rect x="13" y="6.5" width="1.5" height="1.5" rx="0.4" className="category-preview-icon__fill" />
      <rect x="15" y="6.5" width="1.5" height="1.5" rx="0.4" className="category-preview-icon__fill" />
      <rect x="4" y="9.5" width="1.5" height="1.5" rx="0.4" className="category-preview-icon__fill" />
      <rect x="7" y="9.5" width="1.5" height="1.5" rx="0.4" className="category-preview-icon__fill" />
      <rect x="10" y="9.5" width="1.5" height="1.5" rx="0.4" className="category-preview-icon__fill" />
      <rect x="13" y="9.5" width="1.5" height="1.5" rx="0.4" className="category-preview-icon__fill" />
      <rect x="15" y="9.5" width="1.5" height="1.5" rx="0.4" className="category-preview-icon__fill" />
      <rect x="7" y="12.5" width="7" height="1" rx="0.5" />
    </>
  ),
  monitor: (
    <>
      <rect x="1" y="2" width="18" height="11" rx="1.5" />
      <path d="M8 13c0 2-1 4-2 4h8c-1 0-2-2-2-4" />
    </>
  ),
  headset: (
    <>
      <path d="M3 11a7 7 0 0 1 14 0" />
      <rect x="2" y="11" width="4" height="6" rx="1.5" />
      <rect x="14" y="11" width="4" height="6" rx="1.5" />
    </>
  ),
  mousepad: (
    <>
      <rect x="1" y="5" width="18" height="12" rx="2" />
      <line x1="4" y1="14" x2="16" y2="14" className="category-preview-icon__dash" />
    </>
  ),
  controller: (
    <>
      <ellipse cx="10" cy="10" rx="8" ry="6" />
      <line x1="6" y1="10" x2="10" y2="10" />
      <line x1="8" y1="8" x2="8" y2="12" />
      <circle cx="13.75" cy="8.75" r="0.9" className="category-preview-icon__fill" />
      <circle cx="12.25" cy="11.25" r="0.9" className="category-preview-icon__fill" />
    </>
  ),
  hardware: (
    <>
      <rect x="4" y="4" width="12" height="12" rx="1.5" />
      <rect x="7" y="7" width="6" height="6" rx="1" />
      <line x1="7" y1="1" x2="7" y2="4" />
      <line x1="13" y1="1" x2="13" y2="4" />
      <line x1="7" y1="16" x2="7" y2="19" />
      <line x1="13" y1="16" x2="13" y2="19" />
      <line x1="1" y1="7" x2="4" y2="7" />
      <line x1="16" y1="7" x2="19" y2="7" />
      <line x1="1" y1="13" x2="4" y2="13" />
      <line x1="16" y1="13" x2="19" y2="13" />
    </>
  ),
  game: (
    <>
      <circle cx="10" cy="10" r="8" />
      <circle cx="10" cy="10" r="3" />
      <circle cx="10" cy="2" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="10" cy="18" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="2" cy="10" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="18" cy="10" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  gpu: (
    <>
      <rect x="1" y="4" width="18" height="13" rx="1.5" />
      <circle cx="10" cy="12" r="4.5" />
      <circle cx="10" cy="12" r="1.8" />
      <line x1="5" y1="4" x2="5" y2="1" />
      <line x1="9" y1="4" x2="9" y2="1" />
    </>
  ),
  ai: (
    <>
      <circle cx="10" cy="10" r="3" />
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="3" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="15.9" cy="6.5" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="15.9" cy="13.5" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="10" cy="17" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="4.1" cy="13.5" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="4.1" cy="6.5" r="0.7" fill="currentColor" stroke="none" />
    </>
  ),
  unknown: (
    <>
      <circle cx="10" cy="10" r="6" />
      <text x="10" y="12" textAnchor="middle" className="category-preview-icon__text">?</text>
    </>
  ),
};

function toCategoryIconName(categoryId: string): CategoryIconName {
  switch (categoryId) {
    case 'mouse':
    case 'keyboard':
    case 'monitor':
    case 'headset':
    case 'mousepad':
    case 'controller':
    case 'hardware':
    case 'game':
    case 'gpu':
    case 'ai':
      return categoryId;
    default:
      return 'unknown';
  }
}

function IconShell({
  title,
  className,
  iconName,
}: IconProps & { iconName: IconName }) {
  const iconTheme = useContext(IconThemeContext);
  const themedPaths = ICON_PATHS[iconTheme] ?? ICON_PATHS['legacy-clone'];

  return (
    <span className={`inline-icon${className ? ` ${className}` : ''}`} title={title}>
      <svg {...ICON_SVG_PROPS}>{themedPaths[iconName]}</svg>
    </span>
  );
}

export function CategoryPreviewIcon({ categoryId, className }: CategoryPreviewIconProps) {
  const iconTheme = useContext(IconThemeContext);
  const themedPaths = CATEGORY_PREVIEW_PATHS[iconTheme] ?? CATEGORY_PREVIEW_PATHS['legacy-clone'];
  const iconName = toCategoryIconName(categoryId);

  return (
    <svg
      className={`category-preview-icon${className ? ` ${className}` : ''}`}
      {...CATEGORY_ICON_SVG_PROPS}
    >
      {themedPaths[iconName]}
    </svg>
  );
}

export function Toggle({ checked, label, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      className="toggle"
      data-state={checked ? 'on' : 'off'}
      aria-pressed={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__track">
        <span className="toggle__thumb" />
      </span>
    </button>
  );
}

export function PinIcon({ title, className }: IconProps) {
  return <IconShell title={title} className={className} iconName="pin" />;
}

export function LockIcon({ title, className }: IconProps) {
  return <IconShell title={title} className={className} iconName="lock" />;
}

export function AutoIcon({ title, className }: IconProps) {
  return <IconShell title={title} className={className} iconName="auto" />;
}

export function CloseIcon({ title, className }: IconProps) {
  return <IconShell title={title} className={className} iconName="close" />;
}

export function StarIcon({ title, className }: IconProps) {
  return <IconShell title={title} className={className} iconName="star" />;
}

/* ─────────────────────────────────────────────────────────────────
 * useEscapeDismiss — shared hook for dialog Escape key handling
 * ────────────────────────────────────────────────────────────────── */

export function useEscapeDismiss(onDismiss: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);
}

/* ─────────────────────────────────────────────────────────────────
 * DialogOverlay — portal wrapper for modal dialogs
 * ────────────────────────────────────────────────────────────────── */

interface DialogOverlayProps {
  onDismiss: () => void;
  children: ReactNode;
}

export function DialogOverlay({ onDismiss, children }: DialogOverlayProps) {
  useEscapeDismiss(onDismiss);
  return createPortal(
    <div className="svg-editor-overlay" onClick={onDismiss}>
      <div onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ─────────────────────────────────────────────────────────────────
 * LabeledField — label + text input atom
 * ────────────────────────────────────────────────────────────────── */

interface LabeledFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
  mono?: boolean;
}

export function LabeledField({
  label,
  value,
  onChange,
  className = 'field',
  inputClassName,
  mono,
}: LabeledFieldProps) {
  const inputClass = inputClassName
    ?? (mono ? 'field__input field__input--mono' : 'field__input');
  return (
    <label className={className}>
      <span className="field__label">{label}</span>
      <input
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * ToggleRow — label text + Toggle pair
 * ────────────────────────────────────────────────────────────────── */

interface ToggleRowProps {
  label: string;
  checked: boolean;
  ariaLabel: string;
  onChange: (value: boolean) => void;
  className?: string;
}

export function ToggleRow({
  label,
  checked,
  ariaLabel,
  onChange,
  className = 'toggle-pair',
}: ToggleRowProps) {
  return (
    <div className={className}>
      <span className="toggle-pair__label">{label}</span>
      <Toggle checked={checked} label={ariaLabel} onChange={onChange} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * PillBar — tab / pill button list with data-active highlighting
 * ────────────────────────────────────────────────────────────────── */

export type VariableStyle = CSSProperties & Record<string, string>;

interface PillBarItem<T extends string> {
  key: T;
  label: string;
  style?: VariableStyle;
}

interface PillBarProps<T extends string> {
  items: PillBarItem<T>[];
  activeKey: T;
  onSelect: (key: T) => void;
  className?: string;
  pillClassName?: string;
}

export function PillBar<T extends string>({
  items,
  activeKey,
  onSelect,
  className,
  pillClassName,
}: PillBarProps<T>) {
  return (
    <div className={className}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={pillClassName}
          data-active={item.key === activeKey ? 'true' : 'false'}
          style={item.style}
          onClick={() => onSelect(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
