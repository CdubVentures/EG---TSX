import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  emptyNavbarChanges,
  getSidebarFooterText,
  snapshotCategories as snapshotCategoriesPayload,
  snapshotContent,
  snapshotHubTools,
  snapshotIndexHeroes,
  snapshotNavbar,
  snapshotSlideshow,
  snapshotImageDefaults,
  snapshotCacheCdn,
  snapshotAds,
  toImageDefaultsRequestPayload,
  toCacheCdnRequestPayload,
  toAdsRequestPayload,
  toCategoriesRequestPayload,
  toContentRequestPayload,
  toHubToolsRequestPayload,
  toIndexHeroesRequestPayload,
  toNavbarRequestPayload,
  toSlideshowRequestPayload,
  type BootstrapPayload,
  type CategoriesPanelPayload,
  type CategoryCardData,
  type CategoryCounts,
  type CollectionsState,
  type ContentCollectionFilter,
  type ContentPanelPayload as DesktopContentPanelPayload,
  type DerivedColors,
  type HubToolsIndexView,
  type HubToolsPanelPayload,
  type HubToolTypeKey,
  type IconStatus,
  type IndexHeroesPanelPayload,
  type IndexHeroTypeKey,
  type NavbarLocalChanges,
  type NavbarPanelPayload,
  type NavItem,
  type PreviewPayload,
  type SavePayload,
  type ShellPayload,
  type SiteColors,
  type SlideshowPanelPayload,
  type ImageDefaultsPanelPayload,
  type CacheCdnPanelPayload,
  type AdsPanelPayload,
  type AdsScanResult,
  type ToggleState,
  type WatchPayload,
} from './desktop-model';
import {
  assignArticleToSlot,
  moveAssignedArticle,
  removeArticleFromSlot,
  resetManualSlots,
  setArticleBadge,
  setArticleExcluded,
  setArticlePinned,
} from './content-editor';
import {
  addBrandToCategory,
  addSection,
  deleteSection,
  moveGuideToSection,
  removeBrandFromCategory,
  renameBrand,
  renameGame,
  renameGuide,
  renameSection,
  reorderSection,
  toggleAllGames,
  toggleBrandNavbar,
  toggleGame,
} from './navbar-editor';
import {
  addToQueue as slideshowAddToQueue,
  removeFromQueue as slideshowRemoveFromQueue,
  reorderQueue as slideshowReorderQueue,
  moveInQueue as slideshowMoveInQueue,
  setMaxSlides as slideshowSetMaxSlides,
  clearQueue as slideshowClearQueue,
  autoFill as slideshowAutoFill,
} from './slideshow-editor.mjs';
import {
  setFieldValue as imageDefaultsSetField,
  reorderPriority as imageDefaultsReorderPriority,
  movePriority as imageDefaultsMovePriority,
  resetPriorityToDefaults as imageDefaultsResetPriority,
  setViewMetaField as imageDefaultsSetViewMeta,
  toggleObjectFit as imageDefaultsToggleFit,
} from './image-defaults-editor.mjs';
import {
  setPolicyField as cacheCdnSetPolicyField,
  setPageTypeField as cacheCdnSetPageTypeField,
  setTargetField as cacheCdnSetTargetField,
  addTarget as cacheCdnAddTarget,
  deleteTarget as cacheCdnDeleteTarget,
} from './cache-cdn-editor.mjs';
import {
  setGlobalField as adsSetGlobalField,
  setPositionField as adsSetPositionField,
  addPosition as adsAddPosition,
  deletePosition as adsDeletePosition,
  duplicatePosition as adsDuplicatePosition,
  setInlineCollectionField as adsSetInlineCollectionField,
  setInlineDefaultsField as adsSetInlineDefaultsField,
  addCreative as adsAddCreative,
  deleteCreative as adsDeleteCreative,
  setCreativeField as adsSetCreativeField,
  normalizeWeights as adsNormalizeWeights,
} from './ads-editor.mjs';
import { buildSaveQueue } from './save-helpers';
import {
  CategoriesPanelView as CategoriesPanelExtracted,
  ContentPanelView as ContentPanelExtracted,
  HubToolsPanelView as HubToolsPanel,
  IndexHeroesPanelView as IndexHeroesPanel,
  NavbarPanelView as NavbarPanelExtracted,
  SlideshowPanelView as SlideshowPanel,
  ImageDefaultsPanelView,
  CacheCdnPanelView,
  AdsPanelView,
} from './panels';
import { CategoryPreviewIcon, IconThemeContext, type IconThemeId, type VariableStyle } from './shared-ui';

type ToastState = {
  message: string;
  variant: 'success' | 'error' | 'neutral';
};

type ColorDialogState =
  | {
      mode: 'site';
      which: 'primary' | 'secondary';
    }
  | {
      mode: 'category';
      categoryId: string;
    };

type AddCategoryDraft = {
  id: string;
  label: string;
  plural: string;
};

const DEFAULT_PLACEHOLDER_NOTE =
  'Tk source remains authoritative for this panel. React port pending.';

function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  return fetch(url, init).then(async (response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json() as Promise<T>;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hexColor: string): [number, number, number] {
  const color = hexColor.replace('#', '');
  return [
    Number.parseInt(color.slice(0, 2), 16),
    Number.parseInt(color.slice(2, 4), 16),
    Number.parseInt(color.slice(4, 6), 16),
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return [0, 0, lightness * 100];
  }

  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue = 0;
  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return [(hue / 6) * 360, saturation * 100, lightness * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = lightness - chroma / 2;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) {
    red = chroma;
    green = segment;
  } else if (hue < 120) {
    red = segment;
    green = chroma;
  } else if (hue < 180) {
    green = chroma;
    blue = segment;
  } else if (hue < 240) {
    green = segment;
    blue = chroma;
  } else if (hue < 300) {
    red = segment;
    blue = chroma;
  } else {
    red = chroma;
    blue = segment;
  }

  const toHex = (value: number) =>
    Math.round((value + match) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function deriveColors(hexColor: string): DerivedColors {
  const [r, g, b] = hexToRgb(hexColor);
  const [h, s, l] = rgbToHsl(r, g, b);
  const soft = hslToHex(h, s * 0.6, Math.min(l * 1.15, 85));

  return {
    base: hexColor,
    accent: hslToHex(h, s, l * 0.9),
    dark: hslToHex(h, s * 0.4, l * 0.35),
    hover: hslToHex(h, s, l * 0.7),
    'grad-start': hslToHex(h, s * 0.85, l * 0.5),
    soft,
    'score-end': hslToHex(h, s, l * 0.75),
  };
}

function normalizeHex(hexColor: string, fallback: string): string {
  const color = hexColor.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(color)) {
    return color;
  }
  if (/^[0-9a-f]{6}$/.test(color)) {
    return `#${color}`;
  }
  return fallback;
}

function parseRangeValue(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return clamp(parsed, min, max);
}

function readCssToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const THEME_FAMILIES: IconThemeId[] = [
  'legacy-clone', 'arcade-neon', 'pip-boy', 'phantom',
  'cloux', 'deus-ex', 'overwatch', 'warcraft',
];

type ThemeMode = 'dark' | 'light' | 'neutral';

function resolveThemeFamily(themeId: string | undefined): IconThemeId {
  if (!themeId) return 'legacy-clone';
  for (const family of THEME_FAMILIES) {
    if (themeId.startsWith(family)) return family;
  }
  return 'legacy-clone';
}

function resolveThemeMode(themeId: string | undefined): ThemeMode {
  if (!themeId) return 'dark';
  if (themeId.endsWith('-light')) return 'light';
  if (themeId.endsWith('-neutral')) return 'neutral';
  return 'dark';
}

/* WHY: kept for backward compat — returns the icon family */
function resolveThemeId(themeId: string | undefined): IconThemeId {
  return resolveThemeFamily(themeId);
}

function applyThemeVariables(siteColors: SiteColors | null, themeId: string | undefined): void {
  const root = document.documentElement;
  /* Set the full compound ID (e.g. "warcraft-dark") for CSS selectors */
  const fullId = themeId && /^(legacy-clone|arcade-neon|pip-boy|phantom|cloux|deus-ex|overwatch|warcraft)-(dark|light|neutral)$/.test(themeId)
    ? themeId
    : 'legacy-clone-dark';
  root.dataset.theme = fullId;
  const tokenPrimary = readCssToken('--theme-site-primary') || readCssToken('--color-blue');
  const primary = siteColors?.primary ?? tokenPrimary;
  const secondary = siteColors?.secondary ?? primary;
  const derived = siteColors?.derivedColors ?? deriveColors(primary);

  root.style.setProperty('--theme-site-primary', primary);
  root.style.setProperty('--theme-site-secondary', secondary);
  root.style.setProperty('--theme-site-primary-hover', derived.hover);
  root.style.setProperty('--theme-site-primary-dark', derived.dark);
  root.style.setProperty('--theme-site-gradient-start', primary);
  root.style.setProperty('--theme-site-gradient-end', secondary);
}

const THEME_ICON_SVG_PROPS = {
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '1.4',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': 'true',
};

const THEME_REGISTRY: Array<{
  id: IconThemeId;
  label: string;
  icon: JSX.Element;
  preview: {
    primary: string;
    secondary: string;
  };
}> = [
  {
    id: 'legacy-clone',
    label: 'Legacy Clone',
    icon: (
      <svg {...THEME_ICON_SVG_PROPS}>
        <rect x="2" y="2" width="12" height="12" />
        <line x1="2" y1="6" x2="14" y2="6" />
        <line x1="6" y1="6" x2="6" y2="14" />
      </svg>
    ),
    preview: {
      primary: 'var(--theme-preview-legacy-primary)',
      secondary: 'var(--theme-preview-legacy-secondary)',
    },
  },
  {
    id: 'arcade-neon',
    label: 'Arcade Neon',
    icon: (
      <svg {...THEME_ICON_SVG_PROPS}>
        <path d="M8 1L15 8L8 15L1 8Z" />
        <circle cx="8" cy="8" r="2" />
      </svg>
    ),
    preview: {
      primary: 'var(--theme-preview-arcade-primary)',
      secondary: 'var(--theme-preview-arcade-secondary)',
    },
  },
  {
    id: 'pip-boy',
    label: 'Pip-Boy',
    icon: (
      <svg {...THEME_ICON_SVG_PROPS}>
        <rect x="2" y="3" width="12" height="10" rx="1" />
        <line x1="4" y1="6" x2="12" y2="6" />
        <line x1="4" y1="8.5" x2="10" y2="8.5" />
        <line x1="4" y1="11" x2="8" y2="11" />
      </svg>
    ),
    preview: {
      primary: 'var(--theme-preview-pip-primary)',
      secondary: 'var(--theme-preview-pip-secondary)',
    },
  },
  {
    id: 'phantom',
    label: 'Phantom',
    icon: (
      <svg {...THEME_ICON_SVG_PROPS}>
        <polygon points="8,1 15,5 15,11 8,15 1,11 1,5" />
        <line x1="4" y1="7" x2="12" y2="7" />
        <line x1="6" y1="10" x2="10" y2="10" />
      </svg>
    ),
    preview: {
      primary: 'var(--theme-preview-phantom-primary)',
      secondary: 'var(--theme-preview-phantom-secondary)',
    },
  },
  {
    id: 'cloux',
    label: 'Cloux',
    icon: (
      <svg {...THEME_ICON_SVG_PROPS}>
        <circle cx="8" cy="8" r="6" />
        <path d="M5 8a3 3 0 016 0" />
      </svg>
    ),
    preview: {
      primary: 'var(--theme-preview-cloux-primary)',
      secondary: 'var(--theme-preview-cloux-secondary)',
    },
  },
  {
    id: 'deus-ex',
    label: 'Deus Ex',
    icon: (
      <svg {...THEME_ICON_SVG_PROPS}>
        <polygon points="8,1 15,4 14,12 8,15 2,12 1,4" />
        <polygon points="8,5 11,7 8,9 5,7" fill="currentColor" stroke="none" />
      </svg>
    ),
    preview: {
      primary: 'var(--theme-preview-deus-ex-primary)',
      secondary: 'var(--theme-preview-deus-ex-secondary)',
    },
  },
  {
    id: 'overwatch',
    label: 'Overwatch',
    icon: (
      <svg {...THEME_ICON_SVG_PROPS}>
        <circle cx="8" cy="8" r="6.5" fill="currentColor" stroke="none" />
        <path d="M5 8l3 3 5-5" stroke="var(--color-mantle)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    preview: {
      primary: 'var(--theme-preview-overwatch-primary)',
      secondary: 'var(--theme-preview-overwatch-secondary)',
    },
  },
  {
    id: 'warcraft',
    label: 'Warcraft',
    icon: (
      <svg {...THEME_ICON_SVG_PROPS}>
        <path d="M8 1l7 5v6l-7 4-7-4V6z" />
        <path d="M8 5l3 2v3l-3 2-3-2V7z" fill="currentColor" stroke="none" />
      </svg>
    ),
    preview: {
      primary: 'var(--theme-preview-warcraft-primary)',
      secondary: 'var(--theme-preview-warcraft-secondary)',
    },
  },
];

function defaultCollections(): CollectionsState {
  return {
    dataProducts: false,
    reviews: false,
    guides: false,
    news: false,
  };
}

function titleCaseCategory(categoryId: string): string {
  if (!categoryId) {
    return '';
  }
  return `${categoryId.charAt(0).toUpperCase()}${categoryId.slice(1)}`;
}

function generateDistinctColor(existingColors: string[], fallback: string): string {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 50 + Math.floor(Math.random() * 41);
    const lightness = 55 + Math.floor(Math.random() * 21);
    const color = hslToHex(hue, saturation, lightness);
    const [r, g, b] = hexToRgb(color);

    const distinct = existingColors.every((existing) => {
      if (!/^#[0-9a-f]{6}$/i.test(existing)) {
        return true;
      }
      const [er, eg, eb] = hexToRgb(existing);
      const distance = Math.abs(r - er) + Math.abs(g - eg) + Math.abs(b - eb);
      return distance >= 80;
    });

    if (distinct) {
      return color;
    }
  }

  return fallback;
}

function createNewCategory(
  panel: CategoriesPanelPayload,
  draft: AddCategoryDraft,
): CategoryCardData {
  const categoryId = draft.id.trim().toLowerCase();
  const label = draft.label.trim() || titleCaseCategory(categoryId);
  const plural = draft.plural.trim() || `${label}s`;
  const color = generateDistinctColor(
    panel.categories.map((category) => category.color),
    panel.siteColors.primary,
  );

  return {
    id: categoryId,
    label,
    plural,
    color,
    derivedColors: deriveColors(color),
    product: { production: false, vite: true },
    content: { production: false, vite: true },
    collections: defaultCollections(),
    counts: { products: 0, reviews: 0, guides: 0, news: 0 },
    countText: 'no data found',
    presence: { hasProducts: false, hasContent: false },
    showProductToggles: true,
    showContentToggles: true,
    iconStatus: {
      exists: false,
      label: 'MISSING ICON',
      path: `public/images/navbar/${categoryId}.svg`,
      tooltip:
        `Navbar icon: public/images/navbar/${categoryId}.svg\n` +
        'NOT FOUND - navbar will have no icon for this category.\n' +
        'Add a 24x24 SVG silhouette to this path.',
    },
  };
}

const HUB_TOOLS_URLS: Record<HubToolTypeKey, string> = {
  hub: '/hubs/{cat}',
  database: '/hubs/{cat}?view=list',
  versus: '/hubs/{cat}?compare=stats',
  radar: '/hubs/{cat}?compare=radar',
  shapes: '/hubs/{cat}?compare=shapes',
};

function createHubToolEntry(
  categoryId: string,
  toolType: HubToolTypeKey,
  label: string,
): HubToolsPanelPayload['tools'][string][number] {
  return {
    tool: toolType,
    title: label,
    description: `Explore ${categoryId} ${toolType}`,
    subtitle: `${categoryId.toUpperCase()} ${label}`,
    url: HUB_TOOLS_URLS[toolType].replace('{cat}', categoryId),
    svg: '',
    enabled: toolType === 'shapes' ? categoryId === 'mouse' : true,
    navbar: toolType === 'hub',
    hero: toolType === 'hub' ? `/images/tools/${categoryId}/${toolType}/hero-img` : '',
  };
}

function ColorDialog({
  state,
  initialColor,
  accentColor,
  categoryId,
  onClose,
}: {
  state: ColorDialogState | null;
  initialColor: string;
  accentColor: string;
  categoryId?: string;
  onClose: (nextColor: string | null) => void;
}) {
  const [draftColor, setDraftColor] = useState(initialColor);

  useEffect(() => {
    setDraftColor(initialColor);
  }, [initialColor, state]);

  if (!state) {
    return null;
  }

  const normalized = normalizeHex(draftColor, initialColor);
  const [red, green, blue] = hexToRgb(normalized);
  const [hue, saturation, lightness] = rgbToHsl(red, green, blue);
  const hueValue = Math.round(hue);
  const saturationValue = Math.round(saturation);
  const lightnessValue = Math.round(lightness);
  const derived = deriveColors(normalized);
  const dialogStyle: VariableStyle = {
    '--dialog-color': normalized,
    '--dialog-accent': accentColor,
    '--dialog-accent-hover': deriveColors(accentColor).hover,
    '--dialog-hue': `${hueValue}deg`,
    '--dialog-saturation': `${saturationValue}%`,
    '--dialog-derived-accent': derived.accent,
    '--dialog-derived-hover': derived.hover,
    '--dialog-derived-grad': derived['grad-start'],
    '--dialog-derived-dark': derived.dark,
    '--dialog-derived-soft': derived.soft,
    '--dialog-derived-score': derived['score-end'],
  };

  const title =
    state.mode === 'site'
      ? `Site ${state.which === 'primary' ? 'Primary' : 'Secondary'}`
      : `Color for ${state.categoryId}`;

  return (
    <div className="overlay" role="presentation" onClick={() => onClose(null)}>
      <div
        className="dialog color-dialog"
        style={dialogStyle}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog__body">
          <div className="dialog__header">
            <h2 className="dialog__title">{title}</h2>
          </div>
          <div className="color-dialog__content">
            <div className="color-dialog__preview-panel">
              <div className="color-dialog__preview-swatch" />
              <div className="color-dialog__preview-meta">
                <div className="color-dialog__preview-hex">{normalized}</div>
                {categoryId ? (
                  <div className="color-dialog__preview-icon">
                    <CategoryPreviewIcon categoryId={categoryId} />
                  </div>
                ) : null}
              </div>
            </div>
            <label className="field">
              <span className="field__label">Hex</span>
              <input
                className="field__input field__input--mono"
                value={normalized}
                onChange={(event) => setDraftColor(event.target.value)}
                spellCheck={false}
              />
            </label>
            <div className="color-dialog__sliders">
              <label className="color-dialog__slider">
                <span className="color-dialog__slider-label">Hue</span>
                <input
                  className="color-dialog__slider-input color-dialog__slider-input--hue"
                  type="range"
                  min="0"
                  max="360"
                  value={hueValue}
                  onChange={(event) =>
                    setDraftColor(
                      hslToHex(
                        parseRangeValue(event.target.value, 0, 360, hueValue),
                        saturationValue,
                        lightnessValue,
                      ),
                    )
                  }
                />
                <span className="color-dialog__slider-value">{hueValue}</span>
              </label>
              <label className="color-dialog__slider">
                <span className="color-dialog__slider-label">Saturation</span>
                <input
                  className="color-dialog__slider-input color-dialog__slider-input--saturation"
                  type="range"
                  min="0"
                  max="100"
                  value={saturationValue}
                  onChange={(event) =>
                    setDraftColor(
                      hslToHex(
                        hueValue,
                        parseRangeValue(event.target.value, 0, 100, saturationValue),
                        lightnessValue,
                      ),
                    )
                  }
                />
                <span className="color-dialog__slider-value">{saturationValue}%</span>
              </label>
              <label className="color-dialog__slider">
                <span className="color-dialog__slider-label">Lightness</span>
                <input
                  className="color-dialog__slider-input color-dialog__slider-input--lightness"
                  type="range"
                  min="0"
                  max="100"
                  value={lightnessValue}
                  onChange={(event) =>
                    setDraftColor(
                      hslToHex(
                        hueValue,
                        saturationValue,
                        parseRangeValue(event.target.value, 0, 100, lightnessValue),
                      ),
                    )
                  }
                />
                <span className="color-dialog__slider-value">{lightnessValue}%</span>
              </label>
            </div>
            <div className="derived-grid">
              <div className="derived-grid__item">
                <span className="derived-grid__swatch derived-grid__swatch--accent" />
                <span className="derived-grid__label">accent</span>
              </div>
              <div className="derived-grid__item">
                <span className="derived-grid__swatch derived-grid__swatch--hover" />
                <span className="derived-grid__label">hover</span>
              </div>
              <div className="derived-grid__item">
                <span className="derived-grid__swatch derived-grid__swatch--grad" />
                <span className="derived-grid__label">grad-start</span>
              </div>
              <div className="derived-grid__item">
                <span className="derived-grid__swatch derived-grid__swatch--score" />
                <span className="derived-grid__label">score-end</span>
              </div>
              <div className="derived-grid__item">
                <span className="derived-grid__swatch derived-grid__swatch--dark" />
                <span className="derived-grid__label">dark</span>
              </div>
              <div className="derived-grid__item">
                <span className="derived-grid__swatch derived-grid__swatch--soft" />
                <span className="derived-grid__label">soft</span>
              </div>
            </div>
            <input
              className="color-dialog__picker"
              type="color"
              value={normalized}
              onChange={(event) => setDraftColor(event.target.value)}
            />
          </div>
        </div>
        <div className="dialog__actions">
          <div className="dialog__actions-spacer" />
          <button
            type="button"
            className="token-button token-button--quiet"
            onClick={() => onClose(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="token-button token-button--accent"
            onClick={() => onClose(normalized)}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function AddCategoryDialog({
  isOpen,
  accentColor,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  accentColor: string;
  onClose: () => void;
  onSubmit: (draft: AddCategoryDraft) => void;
}) {
  const [draft, setDraft] = useState<AddCategoryDraft>({
    id: '',
    label: '',
    plural: '',
  });

  useEffect(() => {
    if (isOpen) {
      setDraft({
        id: '',
        label: '',
        plural: '',
      });
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const dialogStyle: VariableStyle = {
    '--dialog-accent': accentColor,
    '--dialog-accent-hover': deriveColors(accentColor).hover,
  };

  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog add-category-dialog"
        style={dialogStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Add Category"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog__body">
          <div className="dialog__header">
            <h2 className="dialog__title">Add Category</h2>
          </div>
          <div className="form-grid">
            <label className="field">
              <span className="field__label">ID (slug)</span>
              <input
                className="field__input"
                value={draft.id}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, id: event.target.value.toLowerCase() }))
                }
              />
            </label>
            <label className="field">
              <span className="field__label">Label</span>
              <input
                className="field__input"
                value={draft.label}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, label: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span className="field__label">Plural</span>
              <input
                className="field__input"
                value={draft.plural}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, plural: event.target.value }))
                }
              />
            </label>
          </div>
        </div>
        <div className="dialog__actions">
          <div className="dialog__actions-spacer" />
          <button type="button" className="token-button token-button--quiet" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="token-button token-button--accent"
            onClick={() => onSubmit(draft)}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function PlaceholderPanel({ panelName }: { panelName: string }) {
  return (
    <section className="placeholder-panel">
      <div className="placeholder-panel__body">
        <h2 className="placeholder-panel__title">{panelName}</h2>
        <p className="placeholder-panel__note">{DEFAULT_PLACEHOLDER_NOTE}</p>
      </div>
    </section>
  );
}

/* ── Sidebar Nav Icons (SVG, themable via currentColor) ──────────────── */

const SVG_PROPS = {
  width: 20,
  height: 20,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 'var(--sidebar-icon-stroke-width)',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const LEGACY_NAV_ICONS: Record<string, JSX.Element> = {
  Categories: (
    <svg {...SVG_PROPS}>
      <rect x="2" y="2" width="6.5" height="6.5" />
      <rect x="11.5" y="2" width="6.5" height="6.5" />
      <rect x="2" y="11.5" width="6.5" height="6.5" />
      <rect x="11.5" y="11.5" width="6.5" height="6.5" />
    </svg>
  ),
  Content: (
    <svg {...SVG_PROPS}>
      <path d="M5 2h7l4 4v12H5V2z" />
      <path d="M12 2v4h4" />
      <line x1="8" y1="10" x2="14" y2="10" />
      <line x1="8" y1="13" x2="12" y2="13" />
    </svg>
  ),
  'Index Heroes': (
    <svg {...SVG_PROPS}>
      <path d="M10 2l2.2 4.6 5 .7-3.6 3.5.8 5L10 13.6 5.6 15.8l.8-5-3.6-3.5 5-.7z" />
    </svg>
  ),
  'Hub Tools': (
    <svg {...SVG_PROPS}>
      <path d="M12.5 3.5a4 4 0 00-5.6 5l-3.6 3.6a1.4 1.4 0 002 2l3.6-3.6a4 4 0 005-5.6l-2.3 2.3-1.6-.4-.4-1.6z" />
    </svg>
  ),
  Navbar: (
    <svg {...SVG_PROPS}>
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="15" x2="17" y2="15" />
    </svg>
  ),
  Slideshow: (
    <svg {...SVG_PROPS}>
      <rect x="2" y="3" width="16" height="12" />
      <polygon points="8,6.5 14,9 8,11.5" fill="currentColor" stroke="none" />
      <line x1="7" y1="17" x2="13" y2="17" />
      <line x1="10" y1="15" x2="10" y2="17" />
    </svg>
  ),
  'Image Defaults': (
    <svg {...SVG_PROPS}>
      <rect x="2" y="3" width="16" height="14" />
      <circle cx="7" cy="8" r="2" />
      <path d="M2 14l4-4 3 3 4-5 5 6" />
    </svg>
  ),
  Ads: (
    <svg {...SVG_PROPS}>
      <path d="M2 13V7l8-4 8 4v6l-8 4z" />
      <line x1="10" y1="3" x2="10" y2="17" />
      <path d="M7.5 9.5a2.5 2.5 0 005 0" />
    </svg>
  ),
  'Cache / CDN': (
    <svg {...SVG_PROPS}>
      <path d="M4.5 15a4 4 0 01-.5-8 5.5 5.5 0 0111 0h.5a3 3 0 010 6h-1" />
      <path d="M5 15h10" />
    </svg>
  ),
};

const ARCADE_NEON_NAV_ICONS: Record<string, JSX.Element> = {
  Categories: (
    <svg {...SVG_PROPS}>
      <rect x="2.5" y="2.5" width="6" height="6" />
      <rect x="11.5" y="2.5" width="6" height="6" />
      <rect x="2.5" y="11.5" width="6" height="6" />
      <rect x="11.5" y="11.5" width="6" height="6" />
      <line x1="8.5" y1="5.5" x2="11.5" y2="5.5" />
      <line x1="8.5" y1="14.5" x2="11.5" y2="14.5" />
    </svg>
  ),
  Content: (
    <svg {...SVG_PROPS}>
      <rect x="4.5" y="3" width="11" height="14" />
      <line x1="7" y1="7" x2="13" y2="7" />
      <line x1="7" y1="10" x2="13" y2="10" />
      <line x1="7" y1="13" x2="11" y2="13" />
    </svg>
  ),
  'Index Heroes': (
    <svg {...SVG_PROPS}>
      <path d="M10 2.4 12.2 7l5 .7-3.6 3.4.9 5-4.5-2.4-4.5 2.4.9-5L2.8 7.7l5-.7z" />
      <circle cx="10" cy="10" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  'Hub Tools': (
    <svg {...SVG_PROPS}>
      <circle cx="7" cy="7" r="2.3" />
      <path d="M8.8 8.8 15 15" />
      <rect x="13.5" y="13.5" width="3.5" height="3.5" />
    </svg>
  ),
  Navbar: (
    <svg {...SVG_PROPS}>
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="15" x2="17" y2="15" />
      <circle cx="5" cy="5" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  ),
  Slideshow: (
    <svg {...SVG_PROPS}>
      <rect x="2.5" y="3" width="15" height="11.5" />
      <polygon points="8,6.5 13.5,8.75 8,11" fill="currentColor" stroke="none" />
      <line x1="6.5" y1="17" x2="13.5" y2="17" />
      <line x1="10" y1="14.5" x2="10" y2="17" />
    </svg>
  ),
  'Image Defaults': (
    <svg {...SVG_PROPS}>
      <rect x="2.5" y="3" width="15" height="14" />
      <circle cx="7" cy="8" r="1.8" />
      <path d="M3 14l4-3.5 2.5 2 3.5-3.8 4.5 5.3" />
    </svg>
  ),
  Ads: (
    <svg {...SVG_PROPS}>
      <path d="M2.5 12.5V7.5L10 3.5l7.5 4v5L10 16.5z" />
      <path d="M7 9.5h6" />
      <path d="M7 12h6" />
    </svg>
  ),
  'Cache / CDN': (
    <svg {...SVG_PROPS}>
      <path d="M5 15a3.8 3.8 0 01-.5-7.6 5 5 0 019.8-.4 3.1 3.1 0 011.7 5.8" />
      <path d="M4.5 15h11" />
      <line x1="10" y1="11.5" x2="10" y2="15" />
    </svg>
  ),
};

const PHANTOM_NAV_ICONS: Record<string, JSX.Element> = {
  Categories: (
    <svg {...SVG_PROPS}>
      <polygon points="2,2 9,2 9,9 2,9" />
      <polygon points="11,2 18,2 18,9 11,9" />
      <polygon points="2,11 9,11 9,18 2,18" />
      <polygon points="11,11 18,11 18,18 11,18" />
    </svg>
  ),
  Content: (
    <svg {...SVG_PROPS}>
      <polygon points="5,2 12,2 16,6 16,18 5,18" />
      <polyline points="12,2 12,6 16,6" />
      <line x1="8" y1="10" x2="14" y2="10" />
      <line x1="8" y1="13" x2="12" y2="13" />
    </svg>
  ),
  'Index Heroes': (
    <svg {...SVG_PROPS}>
      <polygon points="10,1 12.5,7 19,7.5 14,12 15.5,19 10,15 4.5,19 6,12 1,7.5 7.5,7" />
    </svg>
  ),
  'Hub Tools': (
    <svg {...SVG_PROPS}>
      <polygon points="11,3 9,3 7,5 7,7 3,11 5,13 9,9 11,9 13,7 13,5" />
      <line x1="13" y1="13" x2="17" y2="17" />
      <polygon points="15,15 18,15 18,18 15,18" />
    </svg>
  ),
  Navbar: (
    <svg {...SVG_PROPS}>
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="15" x2="17" y2="15" />
      <polygon points="4,4 6,4 6,6 4,6" fill="currentColor" stroke="none" />
      <polygon points="14,9 16,9 16,11 14,11" fill="currentColor" stroke="none" />
      <polygon points="8,14 10,14 10,16 8,16" fill="currentColor" stroke="none" />
    </svg>
  ),
  Slideshow: (
    <svg {...SVG_PROPS}>
      <polygon points="2,3 18,3 18,15 2,15" />
      <polygon points="8,6 14,9 8,12" fill="currentColor" stroke="none" />
      <line x1="7" y1="17" x2="13" y2="17" />
      <line x1="10" y1="15" x2="10" y2="17" />
    </svg>
  ),
  'Image Defaults': (
    <svg {...SVG_PROPS}>
      <polygon points="2,3 18,3 18,17 2,17" />
      <polygon points="5,6 9,6 9,10 5,10" />
      <polyline points="2,14 6,10 9,13 13,8 18,14" />
    </svg>
  ),
  Ads: (
    <svg {...SVG_PROPS}>
      <polygon points="10,3 18,7 18,13 10,17 2,13 2,7" />
      <line x1="10" y1="3" x2="10" y2="17" />
      <line x1="6" y1="10" x2="14" y2="10" />
    </svg>
  ),
  'Cache / CDN': (
    <svg {...SVG_PROPS}>
      <polygon points="4,8 8,4 16,4 18,8 18,14 4,14" />
      <line x1="4" y1="14" x2="18" y2="14" />
      <line x1="10" y1="10" x2="10" y2="14" />
      <line x1="7" y1="14" x2="7" y2="17" />
      <line x1="15" y1="14" x2="15" y2="17" />
    </svg>
  ),
};

const NAV_ICON_SETS: Record<IconThemeId, Record<string, JSX.Element>> = {
  'legacy-clone': LEGACY_NAV_ICONS,
  'arcade-neon': ARCADE_NEON_NAV_ICONS,
  'pip-boy': LEGACY_NAV_ICONS,
  'phantom': PHANTOM_NAV_ICONS,
  'cloux': CLOUX_NAV_ICONS,
  'deus-ex': DEUS_EX_NAV_ICONS,
  'overwatch': OVERWATCH_NAV_ICONS,
  'warcraft': WARCRAFT_NAV_ICONS,
};

const WARCRAFT_NAV_ICONS: Record<string, JSX.Element> = {
  Categories: (
    <svg {...SVG_PROPS}>
      <path d="M2 3h7v7H2zM11 3h7v7h-7zM2 12h7v6H2zM11 12h7v6h-7z" />
      <path d="M5.5 6.5l1-2 1 2M14.5 6.5l1-2 1 2" strokeWidth="1" />
    </svg>
  ),
  Content: (
    <svg {...SVG_PROPS}>
      <path d="M5 2h6l5 5v10a1 1 0 01-1 1H5V2z" />
      <path d="M11 2v5h5" />
      <line x1="8" y1="10" x2="14" y2="10" />
      <line x1="8" y1="13" x2="12" y2="13" />
    </svg>
  ),
  'Index Heroes': (
    <svg {...SVG_PROPS}>
      <path d="M10 1l2.5 5 5.5.8-4 3.8 1 5.4-5-2.6-5 2.6 1-5.4-4-3.8 5.5-.8z" />
      <circle cx="10" cy="9.5" r="2" />
    </svg>
  ),
  'Hub Tools': (
    <svg {...SVG_PROPS}>
      <path d="M12 3a4 4 0 00-5.6 5L3 11.5a1.5 1.5 0 002 2l3.5-3.5a4 4 0 005-5.6l-2.3 2.3-1.6-.4-.4-1.6z" />
    </svg>
  ),
  Navbar: (
    <svg {...SVG_PROPS}>
      <line x1="3" y1="5" x2="17" y2="5" strokeWidth="2" />
      <line x1="3" y1="10" x2="17" y2="10" strokeWidth="2" />
      <line x1="3" y1="15" x2="17" y2="15" strokeWidth="2" />
    </svg>
  ),
  Slideshow: (
    <svg {...SVG_PROPS}>
      <path d="M3 3a1 1 0 011-1h12a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V3z" />
      <polygon points="8,5.5 14,8.5 8,11.5" fill="currentColor" stroke="none" />
      <line x1="7" y1="17" x2="13" y2="17" strokeWidth="1.5" />
      <line x1="10" y1="15" x2="10" y2="17" />
    </svg>
  ),
  'Image Defaults': (
    <svg {...SVG_PROPS}>
      <path d="M3 3a1 1 0 011-1h12a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V3z" />
      <circle cx="7.5" cy="7.5" r="2" />
      <path d="M3 14l4-4 3 3 3.5-4.5L17 14" />
    </svg>
  ),
  Ads: (
    <svg {...SVG_PROPS}>
      <path d="M10 2l8 5v6l-8 5-8-5V7z" />
      <path d="M10 7v6M7 10h6" strokeWidth="1.5" />
    </svg>
  ),
  'Cache / CDN': (
    <svg {...SVG_PROPS}>
      <path d="M4.5 15a4 4 0 01-.5-8 5.5 5.5 0 0111 0h.5a3 3 0 010 6h-1" />
      <path d="M5 15h10" strokeWidth="1.5" />
    </svg>
  ),
};

const OVERWATCH_NAV_ICONS: Record<string, JSX.Element> = {
  Categories: (
    <svg {...SVG_PROPS}>
      <rect x="2" y="2" width="6.5" height="6.5" rx="2" fill="currentColor" stroke="none" />
      <rect x="11.5" y="2" width="6.5" height="6.5" rx="2" fill="currentColor" stroke="none" />
      <rect x="2" y="11.5" width="6.5" height="6.5" rx="2" fill="currentColor" stroke="none" />
      <rect x="11.5" y="11.5" width="6.5" height="6.5" rx="2" fill="currentColor" stroke="none" />
    </svg>
  ),
  Content: (
    <svg {...SVG_PROPS}>
      <path d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7l-5-5H6z" fill="currentColor" stroke="none" />
      <path d="M11 2v3a2 2 0 002 2h3" fill="none" />
    </svg>
  ),
  'Index Heroes': (
    <svg {...SVG_PROPS}>
      <path d="M10 2.4 12.2 7l5 .7-3.6 3.4.9 5-4.5-2.4-4.5 2.4.9-5L2.8 7.7l5-.7z" fill="currentColor" stroke="none" />
    </svg>
  ),
  'Hub Tools': (
    <svg {...SVG_PROPS}>
      <circle cx="8" cy="8" r="4" fill="currentColor" stroke="none" />
      <path d="M11.5 11.5L16.5 16.5" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  Navbar: (
    <svg {...SVG_PROPS}>
      <rect x="3" y="3.5" width="14" height="2.5" rx="1.25" fill="currentColor" stroke="none" />
      <rect x="3" y="8.75" width="14" height="2.5" rx="1.25" fill="currentColor" stroke="none" />
      <rect x="3" y="14" width="14" height="2.5" rx="1.25" fill="currentColor" stroke="none" />
    </svg>
  ),
  Slideshow: (
    <svg {...SVG_PROPS}>
      <rect x="2" y="3" width="16" height="11" rx="2" fill="currentColor" stroke="none" />
      <polygon points="8.5,6 14,9 8.5,12" fill="var(--color-mantle)" stroke="none" />
      <rect x="7" y="16" width="6" height="2" rx="1" fill="currentColor" stroke="none" />
      <rect x="9" y="14" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  'Image Defaults': (
    <svg {...SVG_PROPS}>
      <rect x="2" y="3" width="16" height="14" rx="2" fill="currentColor" stroke="none" />
      <circle cx="7" cy="8" r="2.2" fill="var(--color-mantle)" stroke="none" />
      <path d="M2 14l4-4 3 3 4-5 5 6v1a2 2 0 01-2 2H4a2 2 0 01-2-2v-1z" fill="var(--color-mantle)" stroke="none" opacity="0.5" />
    </svg>
  ),
  Ads: (
    <svg {...SVG_PROPS}>
      <path d="M2 7l8-4 8 4v6l-8 4-8-4z" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="2.5" fill="var(--color-mantle)" stroke="none" />
    </svg>
  ),
  'Cache / CDN': (
    <svg {...SVG_PROPS}>
      <path d="M5 15a4 4 0 01-.5-8 5.5 5.5 0 0111 0h.5a3 3 0 010 6H5z" fill="currentColor" stroke="none" />
    </svg>
  ),
};

const DEUS_EX_NAV_ICONS: Record<string, JSX.Element> = {
  Categories: (
    <svg {...SVG_PROPS}>
      <polygon points="2,2 9,2 8,9 3,9" />
      <polygon points="11,2 18,2 17,9 12,9" />
      <polygon points="3,11 8,11 9,18 2,18" />
      <polygon points="12,11 17,11 18,18 11,18" />
    </svg>
  ),
  Content: (
    <svg {...SVG_PROPS}>
      <polygon points="5,2 12,2 16,6 15,18 6,18" />
      <polyline points="12,2 12,6 16,6" />
      <line x1="8" y1="10" x2="14" y2="10" />
      <line x1="8" y1="13" x2="12" y2="13" />
    </svg>
  ),
  'Index Heroes': (
    <svg {...SVG_PROPS}>
      <polygon points="10,1 12.5,7 19,7.5 14,12 15.5,19 10,15 4.5,19 6,12 1,7.5 7.5,7" />
      <polygon points="10,6 12,9 10,12 8,9" fill="currentColor" stroke="none" />
    </svg>
  ),
  'Hub Tools': (
    <svg {...SVG_PROPS}>
      <polygon points="11,3 9,3 7,5 7,7 3,11 5,13 9,9 11,9 13,7 13,5" />
      <line x1="13" y1="13" x2="17" y2="17" />
      <polygon points="16,15 18,16 17,18 15,17" fill="currentColor" stroke="none" />
    </svg>
  ),
  Navbar: (
    <svg {...SVG_PROPS}>
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="15" x2="17" y2="15" />
      <polygon points="3,4 5,4 5,6 3,6" fill="currentColor" stroke="none" />
      <polygon points="3,9 5,9 5,11 3,11" fill="currentColor" stroke="none" />
      <polygon points="3,14 5,14 5,16 3,16" fill="currentColor" stroke="none" />
    </svg>
  ),
  Slideshow: (
    <svg {...SVG_PROPS}>
      <polygon points="2,3 18,3 17,15 3,15" />
      <polygon points="8,6 14,9 8,12" fill="currentColor" stroke="none" />
      <line x1="7" y1="17" x2="13" y2="17" />
      <line x1="10" y1="15" x2="10" y2="17" />
    </svg>
  ),
  'Image Defaults': (
    <svg {...SVG_PROPS}>
      <polygon points="2,3 18,3 17,17 3,17" />
      <polygon points="5,6 9,6 9,10 5,10" />
      <polyline points="3,14 6,10 9,13 13,8 17,14" />
    </svg>
  ),
  Ads: (
    <svg {...SVG_PROPS}>
      <polygon points="10,3 18,7 18,13 10,17 2,13 2,7" />
      <line x1="10" y1="3" x2="10" y2="17" />
      <polygon points="7,9 13,9 13,11 7,11" fill="currentColor" stroke="none" />
    </svg>
  ),
  'Cache / CDN': (
    <svg {...SVG_PROPS}>
      <polygon points="4,8 8,4 16,4 18,8 17,14 5,14" />
      <line x1="5" y1="14" x2="17" y2="14" />
      <polygon points="8,10 12,10 11,14 9,14" fill="currentColor" stroke="none" />
    </svg>
  ),
};

const CLOUX_NAV_ICONS: Record<string, JSX.Element> = {
  Categories: (
    <svg {...SVG_PROPS}>
      <rect x="2.5" y="2.5" width="6" height="6" rx="1.5" />
      <rect x="11.5" y="2.5" width="6" height="6" rx="1.5" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1.5" />
      <rect x="11.5" y="11.5" width="6" height="6" rx="1.5" />
    </svg>
  ),
  Content: (
    <svg {...SVG_PROPS}>
      <path d="M5 3a1 1 0 011-1h5l5 5v9a1 1 0 01-1 1H6a1 1 0 01-1-1V3z" />
      <path d="M11 2v4a1 1 0 001 1h4" />
      <line x1="8" y1="10.5" x2="14" y2="10.5" />
      <line x1="8" y1="13.5" x2="12" y2="13.5" />
    </svg>
  ),
  'Index Heroes': (
    <svg {...SVG_PROPS}>
      <path d="M10 2.4 12.2 7l5 .7-3.6 3.4.9 5-4.5-2.4-4.5 2.4.9-5L2.8 7.7l5-.7z" />
    </svg>
  ),
  'Hub Tools': (
    <svg {...SVG_PROPS}>
      <circle cx="8" cy="8" r="3.5" />
      <path d="M11 11l5.5 5.5" />
      <circle cx="16.5" cy="16.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  Navbar: (
    <svg {...SVG_PROPS}>
      <line x1="4" y1="5" x2="16" y2="5" />
      <line x1="4" y1="10" x2="16" y2="10" />
      <line x1="4" y1="15" x2="16" y2="15" />
      <circle cx="4" cy="5" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="4" cy="10" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="4" cy="15" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  ),
  Slideshow: (
    <svg {...SVG_PROPS}>
      <rect x="2" y="3" width="16" height="11.5" rx="1.5" />
      <polygon points="8,6.5 14,9 8,11.5" fill="currentColor" stroke="none" />
      <path d="M7 17h6" />
      <line x1="10" y1="14.5" x2="10" y2="17" />
    </svg>
  ),
  'Image Defaults': (
    <svg {...SVG_PROPS}>
      <rect x="2" y="3" width="16" height="14" rx="1.5" />
      <circle cx="7" cy="8" r="2" />
      <path d="M2 14l4-4 3 3 4-5 5 6" />
    </svg>
  ),
  Ads: (
    <svg {...SVG_PROPS}>
      <path d="M2 13V7l8-4 8 4v6l-8 4z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  ),
  'Cache / CDN': (
    <svg {...SVG_PROPS}>
      <path d="M4.5 15a4 4 0 01-.5-8 5.5 5.5 0 0111 0h.5a3 3 0 010 6h-1" />
      <path d="M5 15a2 2 0 004 0" />
      <path d="M11 15a2 2 0 004 0" />
    </svg>
  ),
};

function NavIcon({ panelKey, themeId }: { panelKey: string; themeId: IconThemeId }) {
  const themedIcons = NAV_ICON_SETS[themeId] ?? NAV_ICON_SETS['legacy-clone'];

  return themedIcons[panelKey] ?? (
    <svg {...SVG_PROPS}>
      <circle cx="10" cy="10" r="7" />
      <line x1="10" y1="6.5" x2="10" y2="11.25" />
      <circle cx="10" cy="14" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ConfigDesktopApp() {
  const [shell, setShell] = useState<ShellPayload | null>(null);
  const [categoriesPanel, setCategoriesPanel] = useState<CategoriesPanelPayload | null>(null);
  const [contentPanel, setContentPanel] = useState<DesktopContentPanelPayload | null>(null);
  const [indexHeroesPanel, setIndexHeroesPanel] = useState<IndexHeroesPanelPayload | null>(null);
  const [hubToolsPanel, setHubToolsPanel] = useState<HubToolsPanelPayload | null>(null);
  const [navbarPanel, setNavbarPanel] = useState<NavbarPanelPayload | null>(null);
  const [navbarChanges, setNavbarChanges] = useState<NavbarLocalChanges>(emptyNavbarChanges());
  const [slideshowPanel, setSlideshowPanel] = useState<SlideshowPanelPayload | null>(null);
  const [imageDefaultsPanel, setImageDefaultsPanel] = useState<ImageDefaultsPanelPayload | null>(null);
  const [cacheCdnPanel, setCacheCdnPanel] = useState<CacheCdnPanelPayload | null>(null);
  const [adsPanel, setAdsPanel] = useState<AdsPanelPayload | null>(null);
  const [activeHubToolsCategory, setActiveHubToolsCategory] = useState('');
  const [activeHubToolsIndexView, setActiveHubToolsIndexView] = useState<HubToolsIndexView>('all');
  const [activePanel, setActivePanel] = useState('Categories');
  const [activeContentCollection, setActiveContentCollection] =
    useState<ContentCollectionFilter>('all');
  const [statusText, setStatusText] = useState('Ready - Ctrl+S to save');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [colorDialog, setColorDialog] = useState<ColorDialogState | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const categorySnapshotRef = useRef('');
  const categoryPreviewSnapshotRef = useRef('');
  const categoryVersionRef = useRef(0);
  const contentSnapshotRef = useRef('');
  const contentPreviewSnapshotRef = useRef('');
  const contentVersionRef = useRef(0);
  const indexHeroesSnapshotRef = useRef('');
  const indexHeroesPreviewSnapshotRef = useRef('');
  const indexHeroesVersionRef = useRef(0);
  const hubToolsSnapshotRef = useRef('');
  const hubToolsPreviewSnapshotRef = useRef('');
  const hubToolsVersionRef = useRef(0);
  const navbarSnapshotRef = useRef('');
  const navbarPreviewSnapshotRef = useRef('');
  const navbarVersionRef = useRef(0);
  const categoryPreviewRequestRef = useRef(0);
  const contentPreviewRequestRef = useRef(0);
  const indexHeroesPreviewRequestRef = useRef(0);
  const hubToolsPreviewRequestRef = useRef(0);
  const navbarPreviewRequestRef = useRef(0);
  const slideshowSnapshotRef = useRef('');
  const slideshowPreviewSnapshotRef = useRef('');
  const slideshowVersionRef = useRef(0);
  const slideshowPreviewRequestRef = useRef(0);
  const imageDefaultsSnapshotRef = useRef('');
  const imageDefaultsPreviewSnapshotRef = useRef('');
  const imageDefaultsVersionRef = useRef(0);
  const imageDefaultsPreviewRequestRef = useRef(0);
  const cacheCdnSnapshotRef = useRef('');
  const cacheCdnPreviewSnapshotRef = useRef('');
  const cacheCdnVersionRef = useRef(0);
  const cacheCdnPreviewRequestRef = useRef(0);
  const adsSnapshotRef = useRef('');
  const adsPreviewSnapshotRef = useRef('');
  const adsVersionRef = useRef(0);
  const adsPreviewRequestRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (message: string, variant: ToastState['variant']) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ message, variant });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2600);
  };

  useEffect(() => {
    document.title = shell?.appTitle ?? 'EG Config Manager';
  }, [shell]);

  useEffect(() => {
    applyThemeVariables(categoriesPanel?.siteColors ?? null, shell?.theme.id);
  }, [categoriesPanel, shell?.theme.id]);

  useEffect(() => {
    if (!hubToolsPanel) {
      return;
    }
    if (hubToolsPanel.categories.some((category) => category.id === activeHubToolsCategory)) {
      return;
    }
    setActiveHubToolsCategory(hubToolsPanel.categories[0]?.id ?? '');
  }, [hubToolsPanel, activeHubToolsCategory]);

  useEffect(() => {
    if (!hubToolsPanel) {
      return;
    }
    if (
      activeHubToolsIndexView === 'all' ||
      hubToolsPanel.toolTypes.some((type) => type.key === activeHubToolsIndexView)
    ) {
      return;
    }
    setActiveHubToolsIndexView('all');
  }, [hubToolsPanel, activeHubToolsIndexView]);

  useEffect(() => {
    let isMounted = true;

    apiJson<BootstrapPayload>('/api/bootstrap')
      .then((payload) => {
        if (!isMounted) {
          return;
        }
        setShell(payload.shell);
        setCategoriesPanel(payload.panels.categories);
        setContentPanel(payload.panels.content);
        setIndexHeroesPanel(payload.panels.indexHeroes);
        setHubToolsPanel(payload.panels.hubTools);
        setNavbarPanel(payload.panels.navbar);
        setNavbarChanges(emptyNavbarChanges());
        setStatusText(payload.shell.statusText);
        categorySnapshotRef.current = snapshotCategoriesPayload(payload.panels.categories);
        categoryPreviewSnapshotRef.current = categorySnapshotRef.current;
        categoryVersionRef.current = payload.panels.categories.version;
        contentSnapshotRef.current = snapshotContent(payload.panels.content);
        contentPreviewSnapshotRef.current = contentSnapshotRef.current;
        contentVersionRef.current = payload.panels.content.version;
        indexHeroesSnapshotRef.current = snapshotIndexHeroes(payload.panels.indexHeroes);
        indexHeroesPreviewSnapshotRef.current = indexHeroesSnapshotRef.current;
        indexHeroesVersionRef.current = payload.panels.indexHeroes.version;
        hubToolsSnapshotRef.current = snapshotHubTools(payload.panels.hubTools);
        hubToolsPreviewSnapshotRef.current = hubToolsSnapshotRef.current;
        hubToolsVersionRef.current = payload.panels.hubTools.version;
        navbarSnapshotRef.current = snapshotNavbar(emptyNavbarChanges());
        navbarPreviewSnapshotRef.current = navbarSnapshotRef.current;
        navbarVersionRef.current = payload.panels.navbar.version;
        setSlideshowPanel(payload.panels.slideshow);
        slideshowSnapshotRef.current = snapshotSlideshow(payload.panels.slideshow);
        slideshowPreviewSnapshotRef.current = slideshowSnapshotRef.current;
        slideshowVersionRef.current = payload.panels.slideshow.version;
        setImageDefaultsPanel(payload.panels.imageDefaults);
        imageDefaultsSnapshotRef.current = snapshotImageDefaults(payload.panels.imageDefaults);
        imageDefaultsPreviewSnapshotRef.current = imageDefaultsSnapshotRef.current;
        imageDefaultsVersionRef.current = payload.panels.imageDefaults.version;
        if (payload.panels.cacheCdn) {
          setCacheCdnPanel(payload.panels.cacheCdn);
          cacheCdnSnapshotRef.current = snapshotCacheCdn(payload.panels.cacheCdn);
          cacheCdnPreviewSnapshotRef.current = cacheCdnSnapshotRef.current;
          cacheCdnVersionRef.current = payload.panels.cacheCdn.version;
        }
        if (payload.panels.ads) {
          setAdsPanel(payload.panels.ads);
          adsSnapshotRef.current = snapshotAds(payload.panels.ads);
          adsPreviewSnapshotRef.current = adsSnapshotRef.current;
          adsVersionRef.current = payload.panels.ads.version;
        }
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        showToast('Failed to load config shell', 'error');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const isCategoriesDirty =
    categoriesPanel !== null &&
    snapshotCategoriesPayload(categoriesPanel) !== categorySnapshotRef.current;
  const isContentDirty =
    contentPanel !== null &&
    snapshotContent(contentPanel) !== contentSnapshotRef.current;
  const isIndexHeroesDirty =
    indexHeroesPanel !== null &&
    snapshotIndexHeroes(indexHeroesPanel) !== indexHeroesSnapshotRef.current;
  const isHubToolsDirty =
    hubToolsPanel !== null &&
    snapshotHubTools(hubToolsPanel) !== hubToolsSnapshotRef.current;
  const isNavbarDirty =
    navbarPanel !== null &&
    snapshotNavbar(navbarChanges) !== navbarSnapshotRef.current;
  const isSlideshowDirty =
    slideshowPanel !== null &&
    snapshotSlideshow(slideshowPanel) !== slideshowSnapshotRef.current;
  const isImageDefaultsDirty =
    imageDefaultsPanel !== null &&
    snapshotImageDefaults(imageDefaultsPanel) !== imageDefaultsSnapshotRef.current;
  const isCacheCdnDirty =
    cacheCdnPanel !== null &&
    snapshotCacheCdn(cacheCdnPanel) !== cacheCdnSnapshotRef.current;

  const isAdsDirty =
    adsPanel !== null &&
    snapshotAds(adsPanel) !== adsSnapshotRef.current;

  const saveCategories = () => {
    if (!categoriesPanel || !isCategoriesDirty) {
      showToast('No changes to save', 'neutral');
      return;
    }

    setIsSaving(true);
    apiJson<SavePayload<CategoriesPanelPayload>>('/api/panels/categories/save', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toCategoriesRequestPayload(categoriesPanel)),
    })
      .then((payload) => {
        setShell(payload.shell);
        setCategoriesPanel(payload.panel);
        setStatusText(`Last saved at ${payload.savedAt} - Ctrl+S to save`);
        categorySnapshotRef.current = snapshotCategoriesPayload(payload.panel);
        categoryPreviewSnapshotRef.current = categorySnapshotRef.current;
        categoryVersionRef.current = payload.panel.version;
        showToast(payload.message, 'success');
      })
      .catch(() => {
        showToast('Failed to save categories', 'error');
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const saveContent = () => {
    if (!contentPanel || !isContentDirty) {
      showToast('No changes to save', 'neutral');
      return;
    }

    setIsSaving(true);
    apiJson<SavePayload<DesktopContentPanelPayload>>('/api/panels/content/save', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toContentRequestPayload(contentPanel)),
    })
      .then((payload) => {
        setShell(payload.shell);
        setContentPanel(payload.panel);
        setStatusText(`Last saved at ${payload.savedAt} - Ctrl+S to save`);
        contentSnapshotRef.current = snapshotContent(payload.panel);
        contentPreviewSnapshotRef.current = contentSnapshotRef.current;
        contentVersionRef.current = payload.panel.version;
        showToast(payload.message, 'success');
      })
      .catch(() => {
        showToast('Failed to save content', 'error');
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const saveIndexHeroes = () => {
    if (!indexHeroesPanel || !isIndexHeroesDirty) {
      showToast('No changes to save', 'neutral');
      return;
    }

    setIsSaving(true);
    apiJson<SavePayload<IndexHeroesPanelPayload>>('/api/panels/index-heroes/save', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toIndexHeroesRequestPayload(indexHeroesPanel)),
    })
      .then((payload) => {
        setShell(payload.shell);
        setIndexHeroesPanel(payload.panel);
        setStatusText(`Last saved at ${payload.savedAt} - Ctrl+S to save`);
        indexHeroesSnapshotRef.current = snapshotIndexHeroes(payload.panel);
        indexHeroesPreviewSnapshotRef.current = indexHeroesSnapshotRef.current;
        indexHeroesVersionRef.current = payload.panel.version;
        showToast(payload.message, 'success');
      })
      .catch(() => {
        showToast('Failed to save index heroes', 'error');
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const saveHubTools = () => {
    if (!hubToolsPanel || !isHubToolsDirty) {
      showToast('No changes to save', 'neutral');
      return;
    }

    setIsSaving(true);
    apiJson<SavePayload<HubToolsPanelPayload>>('/api/panels/hub-tools/save', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toHubToolsRequestPayload(hubToolsPanel)),
    })
      .then((payload) => {
        setShell(payload.shell);
        setHubToolsPanel(payload.panel);
        setStatusText(`Last saved at ${payload.savedAt} - Ctrl+S to save`);
        hubToolsSnapshotRef.current = snapshotHubTools(payload.panel);
        hubToolsPreviewSnapshotRef.current = hubToolsSnapshotRef.current;
        hubToolsVersionRef.current = payload.panel.version;
        showToast(payload.message, 'success');
      })
      .catch(() => {
        showToast('Failed to save hub tools', 'error');
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const saveNavbar = () => {
    if (!navbarPanel || !isNavbarDirty) {
      showToast('No changes to save', 'neutral');
      return;
    }

    setIsSaving(true);
    apiJson<SavePayload<NavbarPanelPayload>>('/api/panels/navbar/save', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toNavbarRequestPayload(navbarChanges)),
    })
      .then(async (payload) => {
        setShell(payload.shell);
        setNavbarPanel(payload.panel);
        setNavbarChanges(emptyNavbarChanges());
        setStatusText(`Last saved at ${payload.savedAt} - Ctrl+S to save`);
        navbarSnapshotRef.current = snapshotNavbar(emptyNavbarChanges());
        navbarPreviewSnapshotRef.current = navbarSnapshotRef.current;
        navbarVersionRef.current = payload.panel.version;

        if (!isIndexHeroesDirty) {
          const heroesPanel = await apiJson<IndexHeroesPanelPayload>(
            '/api/panels/index-heroes',
          );
          setIndexHeroesPanel(heroesPanel);
          indexHeroesSnapshotRef.current = snapshotIndexHeroes(heroesPanel);
          indexHeroesPreviewSnapshotRef.current = indexHeroesSnapshotRef.current;
          indexHeroesVersionRef.current = heroesPanel.version;
        }

        showToast(payload.message, 'success');
      })
      .catch(() => {
        showToast('Failed to save navbar', 'error');
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const saveSlideshow = () => {
    if (!slideshowPanel || !isSlideshowDirty) {
      showToast('No changes to save', 'neutral');
      return;
    }

    setIsSaving(true);
    apiJson<SavePayload<SlideshowPanelPayload>>('/api/panels/slideshow/save', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSlideshowRequestPayload(slideshowPanel)),
    })
      .then((payload) => {
        setShell(payload.shell);
        setSlideshowPanel(payload.panel);
        setStatusText(`Last saved at ${payload.savedAt} - Ctrl+S to save`);
        slideshowSnapshotRef.current = snapshotSlideshow(payload.panel);
        slideshowPreviewSnapshotRef.current = slideshowSnapshotRef.current;
        slideshowVersionRef.current = payload.panel.version;
        showToast(payload.message, 'success');
      })
      .catch(() => {
        showToast('Failed to save slideshow', 'error');
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const saveImageDefaults = () => {
    if (!imageDefaultsPanel || !isImageDefaultsDirty) {
      showToast('No changes to save', 'neutral');
      return;
    }

    setIsSaving(true);
    apiJson<SavePayload<ImageDefaultsPanelPayload>>('/api/panels/image-defaults/save', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toImageDefaultsRequestPayload(imageDefaultsPanel)),
    })
      .then((payload) => {
        setShell(payload.shell);
        setImageDefaultsPanel(payload.panel);
        setStatusText(`Last saved at ${payload.savedAt} - Ctrl+S to save`);
        imageDefaultsSnapshotRef.current = snapshotImageDefaults(payload.panel);
        imageDefaultsPreviewSnapshotRef.current = imageDefaultsSnapshotRef.current;
        imageDefaultsVersionRef.current = payload.panel.version;
        showToast(payload.message, 'success');
      })
      .catch(() => {
        showToast('Failed to save image defaults', 'error');
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const saveCacheCdn = () => {
    if (!cacheCdnPanel || !isCacheCdnDirty) {
      showToast('No changes to save', 'neutral');
      return;
    }

    setIsSaving(true);
    apiJson<SavePayload<CacheCdnPanelPayload>>('/api/panels/cache-cdn/save', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toCacheCdnRequestPayload(cacheCdnPanel)),
    })
      .then((payload) => {
        setShell(payload.shell);
        setCacheCdnPanel(payload.panel);
        setStatusText(`Last saved at ${payload.savedAt} - Ctrl+S to save`);
        cacheCdnSnapshotRef.current = snapshotCacheCdn(payload.panel);
        cacheCdnPreviewSnapshotRef.current = cacheCdnSnapshotRef.current;
        cacheCdnVersionRef.current = payload.panel.version;
        showToast(payload.message, 'success');
      })
      .catch(() => {
        showToast('Failed to save cache/CDN', 'error');
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const saveAds = () => {
    if (!adsPanel || !isAdsDirty) {
      showToast('No changes to save', 'neutral');
      return;
    }

    setIsSaving(true);
    apiJson<SavePayload<AdsPanelPayload>>('/api/panels/ads/save', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toAdsRequestPayload(adsPanel)),
    })
      .then((payload) => {
        setShell(payload.shell);
        setAdsPanel(payload.panel);
        setStatusText(`Last saved at ${payload.savedAt} - Ctrl+S to save`);
        adsSnapshotRef.current = snapshotAds(payload.panel);
        adsPreviewSnapshotRef.current = adsSnapshotRef.current;
        adsVersionRef.current = payload.panel.version;
        showToast(payload.message, 'success');
      })
      .catch(() => {
        showToast('Failed to save ads config', 'error');
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const saveAllDirtyPanels = async () => {
    if (isSaving) {
      return;
    }

    const dirtyMap: Record<string, boolean> = {
      'Categories': isCategoriesDirty,
      'Content': isContentDirty,
      'Index Heroes': isIndexHeroesDirty,
      'Hub Tools': isHubToolsDirty,
      'Navbar': isNavbarDirty,
      'Slideshow': isSlideshowDirty,
      'Image Defaults': isImageDefaultsDirty,
      'Cache / CDN': isCacheCdnDirty,
      'Ads': isAdsDirty,
    };

    const queue = buildSaveQueue(dirtyMap);
    if (queue.length === 0) {
      showToast('No changes to save', 'neutral');
      return;
    }

    setIsSaving(true);
    const saved: string[] = [];

    try {
      for (const key of queue) {
        try {
          switch (key) {
            case 'Categories': {
              if (!categoriesPanel) break;
              const p = await apiJson<SavePayload<CategoriesPanelPayload>>('/api/panels/categories/save', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(toCategoriesRequestPayload(categoriesPanel)),
              });
              setShell(p.shell);
              setCategoriesPanel(p.panel);
              categorySnapshotRef.current = snapshotCategoriesPayload(p.panel);
              categoryPreviewSnapshotRef.current = categorySnapshotRef.current;
              categoryVersionRef.current = p.panel.version;
              saved.push(key);
              break;
            }
            case 'Content': {
              if (!contentPanel) break;
              const p = await apiJson<SavePayload<DesktopContentPanelPayload>>('/api/panels/content/save', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(toContentRequestPayload(contentPanel)),
              });
              setShell(p.shell);
              setContentPanel(p.panel);
              contentSnapshotRef.current = snapshotContent(p.panel);
              contentPreviewSnapshotRef.current = contentSnapshotRef.current;
              contentVersionRef.current = p.panel.version;
              saved.push(key);
              break;
            }
            case 'Index Heroes': {
              if (!indexHeroesPanel) break;
              const p = await apiJson<SavePayload<IndexHeroesPanelPayload>>('/api/panels/index-heroes/save', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(toIndexHeroesRequestPayload(indexHeroesPanel)),
              });
              setShell(p.shell);
              setIndexHeroesPanel(p.panel);
              indexHeroesSnapshotRef.current = snapshotIndexHeroes(p.panel);
              indexHeroesPreviewSnapshotRef.current = indexHeroesSnapshotRef.current;
              indexHeroesVersionRef.current = p.panel.version;
              saved.push(key);
              break;
            }
            case 'Hub Tools': {
              if (!hubToolsPanel) break;
              const p = await apiJson<SavePayload<HubToolsPanelPayload>>('/api/panels/hub-tools/save', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(toHubToolsRequestPayload(hubToolsPanel)),
              });
              setShell(p.shell);
              setHubToolsPanel(p.panel);
              hubToolsSnapshotRef.current = snapshotHubTools(p.panel);
              hubToolsPreviewSnapshotRef.current = hubToolsSnapshotRef.current;
              hubToolsVersionRef.current = p.panel.version;
              saved.push(key);
              break;
            }
            case 'Navbar': {
              if (!navbarPanel) break;
              const p = await apiJson<SavePayload<NavbarPanelPayload>>('/api/panels/navbar/save', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(toNavbarRequestPayload(navbarChanges)),
              });
              setShell(p.shell);
              setNavbarPanel(p.panel);
              setNavbarChanges(emptyNavbarChanges());
              navbarSnapshotRef.current = snapshotNavbar(emptyNavbarChanges());
              navbarPreviewSnapshotRef.current = navbarSnapshotRef.current;
              navbarVersionRef.current = p.panel.version;
              if (!isIndexHeroesDirty) {
                const heroesPanel = await apiJson<IndexHeroesPanelPayload>(
                  '/api/panels/index-heroes',
                );
                setIndexHeroesPanel(heroesPanel);
                indexHeroesSnapshotRef.current = snapshotIndexHeroes(heroesPanel);
                indexHeroesPreviewSnapshotRef.current = indexHeroesSnapshotRef.current;
                indexHeroesVersionRef.current = heroesPanel.version;
              }
              saved.push(key);
              break;
            }
            case 'Slideshow': {
              if (!slideshowPanel) break;
              const p = await apiJson<SavePayload<SlideshowPanelPayload>>('/api/panels/slideshow/save', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(toSlideshowRequestPayload(slideshowPanel)),
              });
              setShell(p.shell);
              setSlideshowPanel(p.panel);
              slideshowSnapshotRef.current = snapshotSlideshow(p.panel);
              slideshowPreviewSnapshotRef.current = slideshowSnapshotRef.current;
              slideshowVersionRef.current = p.panel.version;
              saved.push(key);
              break;
            }
            case 'Image Defaults': {
              if (!imageDefaultsPanel) break;
              const p = await apiJson<SavePayload<ImageDefaultsPanelPayload>>('/api/panels/image-defaults/save', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(toImageDefaultsRequestPayload(imageDefaultsPanel)),
              });
              setShell(p.shell);
              setImageDefaultsPanel(p.panel);
              imageDefaultsSnapshotRef.current = snapshotImageDefaults(p.panel);
              imageDefaultsPreviewSnapshotRef.current = imageDefaultsSnapshotRef.current;
              imageDefaultsVersionRef.current = p.panel.version;
              saved.push(key);
              break;
            }
            case 'Cache / CDN': {
              if (!cacheCdnPanel) break;
              const p = await apiJson<SavePayload<CacheCdnPanelPayload>>('/api/panels/cache-cdn/save', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(toCacheCdnRequestPayload(cacheCdnPanel)),
              });
              setShell(p.shell);
              setCacheCdnPanel(p.panel);
              cacheCdnSnapshotRef.current = snapshotCacheCdn(p.panel);
              cacheCdnPreviewSnapshotRef.current = cacheCdnSnapshotRef.current;
              cacheCdnVersionRef.current = p.panel.version;
              saved.push(key);
              break;
            }
            case 'Ads': {
              if (!adsPanel) break;
              const p = await apiJson<SavePayload<AdsPanelPayload>>('/api/panels/ads/save', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(toAdsRequestPayload(adsPanel)),
              });
              setShell(p.shell);
              setAdsPanel(p.panel);
              adsSnapshotRef.current = snapshotAds(p.panel);
              adsPreviewSnapshotRef.current = adsSnapshotRef.current;
              adsVersionRef.current = p.panel.version;
              saved.push(key);
              break;
            }
          }
        } catch {
          showToast(`Failed to save ${key}`, 'error');
        }
      }

      if (saved.length > 0) {
        const time = new Date().toLocaleTimeString();
        setStatusText(`Last saved at ${time} - Ctrl+S to save`);
        showToast(`Saved ${saved.join(', ')} at ${time}`, 'success');
      }
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!shell) {
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveAllDirtyPanels();
        return;
      }

      if (event.ctrlKey && /^[1-9]$/.test(event.key)) {
        const index = Number.parseInt(event.key, 10) - 1;
        const item = shell.navItems[index];
        if (item) {
          event.preventDefault();
          setActivePanel(item.key);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    shell,
    activePanel,
    isSaving,
    isCategoriesDirty,
    isContentDirty,
    isIndexHeroesDirty,
    isHubToolsDirty,
    isNavbarDirty,
    categoriesPanel,
    contentPanel,
    indexHeroesPanel,
    hubToolsPanel,
    navbarPanel,
    navbarChanges,
    isSlideshowDirty,
    slideshowPanel,
    isImageDefaultsDirty,
    imageDefaultsPanel,
    isCacheCdnDirty,
    cacheCdnPanel,
    isAdsDirty,
    adsPanel,
  ]);

  const hasDirty = isCategoriesDirty || isContentDirty || isIndexHeroesDirty ||
    isHubToolsDirty || isNavbarDirty || isSlideshowDirty || isImageDefaultsDirty ||
    isCacheCdnDirty || isAdsDirty;

  useEffect(() => {
    if (!hasDirty) {
      return;
    }
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasDirty]);

  useEffect(() => {
    if (!categoriesPanel || !isCategoriesDirty) {
      return;
    }

    const nextSnapshot = snapshotCategoriesPayload(categoriesPanel);
    if (nextSnapshot === categoryPreviewSnapshotRef.current) {
      return;
    }

    categoryPreviewSnapshotRef.current = nextSnapshot;
    const requestId = categoryPreviewRequestRef.current + 1;
    categoryPreviewRequestRef.current = requestId;

    const timeoutId = window.setTimeout(() => {
      apiJson<PreviewPayload<CategoriesPanelPayload>>('/api/panels/categories/preview', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toCategoriesRequestPayload(categoriesPanel)),
      })
        .then(async (payload) => {
          if (requestId !== categoryPreviewRequestRef.current) {
            return;
          }
          setShell(payload.shell);
          setCategoriesPanel(payload.panel);
          categoryVersionRef.current = payload.panel.version;

          const cascadeFetches: Promise<void>[] = [];

          if (!isContentDirty) {
            cascadeFetches.push(
              apiJson<DesktopContentPanelPayload>('/api/panels/content').then((panel) => {
                if (requestId !== categoryPreviewRequestRef.current) {
                  return;
                }
                setContentPanel(panel);
                contentSnapshotRef.current = snapshotContent(panel);
                contentPreviewSnapshotRef.current = contentSnapshotRef.current;
                contentVersionRef.current = panel.version;
              }),
            );
          }

          if (!isIndexHeroesDirty) {
            cascadeFetches.push(
              apiJson<IndexHeroesPanelPayload>('/api/panels/index-heroes').then((panel) => {
                if (requestId !== categoryPreviewRequestRef.current) {
                  return;
                }
                setIndexHeroesPanel(panel);
                indexHeroesSnapshotRef.current = snapshotIndexHeroes(panel);
                indexHeroesPreviewSnapshotRef.current = indexHeroesSnapshotRef.current;
                indexHeroesVersionRef.current = panel.version;
              }),
            );
          }

          if (!isHubToolsDirty) {
            cascadeFetches.push(
              apiJson<HubToolsPanelPayload>('/api/panels/hub-tools').then((panel) => {
                if (requestId !== categoryPreviewRequestRef.current) {
                  return;
                }
                setHubToolsPanel(panel);
                hubToolsSnapshotRef.current = snapshotHubTools(panel);
                hubToolsPreviewSnapshotRef.current = hubToolsSnapshotRef.current;
                hubToolsVersionRef.current = panel.version;
              }),
            );
          }

          if (!isNavbarDirty) {
            cascadeFetches.push(
              apiJson<NavbarPanelPayload>('/api/panels/navbar').then((panel) => {
                if (requestId !== categoryPreviewRequestRef.current) {
                  return;
                }
                setNavbarPanel(panel);
                setNavbarChanges(emptyNavbarChanges());
                navbarSnapshotRef.current = snapshotNavbar(emptyNavbarChanges());
                navbarPreviewSnapshotRef.current = navbarSnapshotRef.current;
                navbarVersionRef.current = panel.version;
              }),
            );
          }

          if (!isSlideshowDirty) {
            cascadeFetches.push(
              apiJson<SlideshowPanelPayload>('/api/panels/slideshow').then((panel) => {
                if (requestId !== categoryPreviewRequestRef.current) {
                  return;
                }
                setSlideshowPanel(panel);
                slideshowSnapshotRef.current = snapshotSlideshow(panel);
                slideshowPreviewSnapshotRef.current = slideshowSnapshotRef.current;
                slideshowVersionRef.current = panel.version;
              }),
            );
          }

          if (!isImageDefaultsDirty) {
            cascadeFetches.push(
              apiJson<ImageDefaultsPanelPayload>('/api/panels/image-defaults').then((panel) => {
                if (requestId !== categoryPreviewRequestRef.current) {
                  return;
                }
                setImageDefaultsPanel(panel);
                imageDefaultsSnapshotRef.current = snapshotImageDefaults(panel);
                imageDefaultsPreviewSnapshotRef.current = imageDefaultsSnapshotRef.current;
                imageDefaultsVersionRef.current = panel.version;
              }),
            );
          }

          await Promise.all(cascadeFetches);
        })
        .catch(() => {
          showToast('Failed to preview categories', 'error');
        });
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [categoriesPanel, isCategoriesDirty, isContentDirty, isIndexHeroesDirty, isHubToolsDirty, isNavbarDirty, isSlideshowDirty, isImageDefaultsDirty]);

  useEffect(() => {
    if (!contentPanel || !isContentDirty) {
      return;
    }

    const nextSnapshot = snapshotContent(contentPanel);
    if (nextSnapshot === contentPreviewSnapshotRef.current) {
      return;
    }

    contentPreviewSnapshotRef.current = nextSnapshot;
    const requestId = contentPreviewRequestRef.current + 1;
    contentPreviewRequestRef.current = requestId;

    const timeoutId = window.setTimeout(() => {
      apiJson<PreviewPayload<DesktopContentPanelPayload>>('/api/panels/content/preview', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toContentRequestPayload(contentPanel)),
      })
        .then(async (payload) => {
          if (requestId !== contentPreviewRequestRef.current) {
            return;
          }
          setShell(payload.shell);
          setContentPanel(payload.panel);
          contentVersionRef.current = payload.panel.version;

          if (!isIndexHeroesDirty) {
            const heroesPanel = await apiJson<IndexHeroesPanelPayload>(
              '/api/panels/index-heroes',
            );
            if (requestId !== contentPreviewRequestRef.current) {
              return;
            }
            setIndexHeroesPanel(heroesPanel);
            indexHeroesSnapshotRef.current = snapshotIndexHeroes(heroesPanel);
            indexHeroesPreviewSnapshotRef.current = indexHeroesSnapshotRef.current;
            indexHeroesVersionRef.current = heroesPanel.version;
          }
        })
        .catch(() => {
          showToast('Failed to preview content', 'error');
        });
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [contentPanel, isContentDirty, isIndexHeroesDirty]);

  useEffect(() => {
    if (!indexHeroesPanel || !isIndexHeroesDirty) {
      return;
    }

    const nextSnapshot = snapshotIndexHeroes(indexHeroesPanel);
    if (nextSnapshot === indexHeroesPreviewSnapshotRef.current) {
      return;
    }

    indexHeroesPreviewSnapshotRef.current = nextSnapshot;
    const requestId = indexHeroesPreviewRequestRef.current + 1;
    indexHeroesPreviewRequestRef.current = requestId;

    const timeoutId = window.setTimeout(() => {
      apiJson<PreviewPayload<IndexHeroesPanelPayload>>('/api/panels/index-heroes/preview', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toIndexHeroesRequestPayload(indexHeroesPanel)),
      })
        .then((payload) => {
          if (requestId !== indexHeroesPreviewRequestRef.current) {
            return;
          }
          setShell(payload.shell);
          setIndexHeroesPanel(payload.panel);
          indexHeroesVersionRef.current = payload.panel.version;
        })
        .catch(() => {
          showToast('Failed to preview index heroes', 'error');
        });
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [indexHeroesPanel, isIndexHeroesDirty]);

  useEffect(() => {
    if (!hubToolsPanel || !isHubToolsDirty) {
      return;
    }

    const nextSnapshot = snapshotHubTools(hubToolsPanel);
    if (nextSnapshot === hubToolsPreviewSnapshotRef.current) {
      return;
    }

    hubToolsPreviewSnapshotRef.current = nextSnapshot;
    const requestId = hubToolsPreviewRequestRef.current + 1;
    hubToolsPreviewRequestRef.current = requestId;

    const timeoutId = window.setTimeout(() => {
      apiJson<PreviewPayload<HubToolsPanelPayload>>('/api/panels/hub-tools/preview', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toHubToolsRequestPayload(hubToolsPanel)),
      })
        .then((payload) => {
          if (requestId !== hubToolsPreviewRequestRef.current) {
            return;
          }
          setShell(payload.shell);
          setHubToolsPanel(payload.panel);
          hubToolsVersionRef.current = payload.panel.version;
        })
        .catch(() => {
          showToast('Failed to preview hub tools', 'error');
        });
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [hubToolsPanel, isHubToolsDirty]);

  useEffect(() => {
    if (!isNavbarDirty) {
      return;
    }

    // Only preview section order + brand changes (lightweight)
    const previewPayload = {
      sectionOrder: navbarChanges.sectionOrder,
      brandChanges: Object.values(navbarChanges.brandChanges),
    };
    const nextSnapshot = JSON.stringify(previewPayload);
    if (nextSnapshot === navbarPreviewSnapshotRef.current) {
      return;
    }

    navbarPreviewSnapshotRef.current = nextSnapshot;
    const requestId = navbarPreviewRequestRef.current + 1;
    navbarPreviewRequestRef.current = requestId;

    const timeoutId = window.setTimeout(() => {
      apiJson<PreviewPayload<NavbarPanelPayload>>('/api/panels/navbar/preview', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toNavbarRequestPayload(navbarChanges)),
      })
        .then(async (payload) => {
          if (requestId !== navbarPreviewRequestRef.current) {
            return;
          }
          setShell(payload.shell);
          setNavbarPanel(payload.panel);
          navbarVersionRef.current = payload.panel.version;

          if (!isIndexHeroesDirty) {
            const heroesPanel = await apiJson<IndexHeroesPanelPayload>(
              '/api/panels/index-heroes',
            );
            if (requestId !== navbarPreviewRequestRef.current) {
              return;
            }
            setIndexHeroesPanel(heroesPanel);
            indexHeroesSnapshotRef.current = snapshotIndexHeroes(heroesPanel);
            indexHeroesPreviewSnapshotRef.current = indexHeroesSnapshotRef.current;
            indexHeroesVersionRef.current = heroesPanel.version;
          }
        })
        .catch(() => {
          showToast('Failed to preview navbar', 'error');
        });
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [navbarChanges, isNavbarDirty, isIndexHeroesDirty]);

  useEffect(() => {
    if (!slideshowPanel || !isSlideshowDirty) {
      return;
    }

    const nextSnapshot = snapshotSlideshow(slideshowPanel);
    if (nextSnapshot === slideshowPreviewSnapshotRef.current) {
      return;
    }

    slideshowPreviewSnapshotRef.current = nextSnapshot;
    const requestId = slideshowPreviewRequestRef.current + 1;
    slideshowPreviewRequestRef.current = requestId;

    const timeoutId = window.setTimeout(() => {
      apiJson<PreviewPayload<SlideshowPanelPayload>>('/api/panels/slideshow/preview', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSlideshowRequestPayload(slideshowPanel)),
      })
        .then((payload) => {
          if (requestId !== slideshowPreviewRequestRef.current) {
            return;
          }
          setShell(payload.shell);
          setSlideshowPanel(payload.panel);
          slideshowVersionRef.current = payload.panel.version;
        })
        .catch(() => {
          showToast('Failed to preview slideshow', 'error');
        });
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [slideshowPanel, isSlideshowDirty]);

  useEffect(() => {
    if (!imageDefaultsPanel || !isImageDefaultsDirty) {
      return;
    }

    const nextSnapshot = snapshotImageDefaults(imageDefaultsPanel);
    if (nextSnapshot === imageDefaultsPreviewSnapshotRef.current) {
      return;
    }

    imageDefaultsPreviewSnapshotRef.current = nextSnapshot;
    const requestId = imageDefaultsPreviewRequestRef.current + 1;
    imageDefaultsPreviewRequestRef.current = requestId;

    const timeoutId = window.setTimeout(() => {
      apiJson<PreviewPayload<ImageDefaultsPanelPayload>>('/api/panels/image-defaults/preview', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toImageDefaultsRequestPayload(imageDefaultsPanel)),
      })
        .then((payload) => {
          if (requestId !== imageDefaultsPreviewRequestRef.current) {
            return;
          }
          setShell(payload.shell);
          setImageDefaultsPanel(payload.panel);
          imageDefaultsVersionRef.current = payload.panel.version;
        })
        .catch(() => {
          showToast('Failed to preview image defaults', 'error');
        });
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [imageDefaultsPanel, isImageDefaultsDirty]);

  useEffect(() => {
    if (!cacheCdnPanel || !isCacheCdnDirty) {
      return;
    }

    const nextSnapshot = snapshotCacheCdn(cacheCdnPanel);
    if (nextSnapshot === cacheCdnPreviewSnapshotRef.current) {
      return;
    }

    cacheCdnPreviewSnapshotRef.current = nextSnapshot;
    const requestId = cacheCdnPreviewRequestRef.current + 1;
    cacheCdnPreviewRequestRef.current = requestId;

    const timeoutId = window.setTimeout(() => {
      apiJson<PreviewPayload<CacheCdnPanelPayload>>('/api/panels/cache-cdn/preview', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toCacheCdnRequestPayload(cacheCdnPanel)),
      })
        .then((payload) => {
          if (requestId !== cacheCdnPreviewRequestRef.current) {
            return;
          }
          setShell(payload.shell);
          setCacheCdnPanel(payload.panel);
          cacheCdnVersionRef.current = payload.panel.version;
        })
        .catch(() => {
          showToast('Failed to preview cache/CDN', 'error');
        });
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [cacheCdnPanel, isCacheCdnDirty]);

  useEffect(() => {
    if (!adsPanel || !isAdsDirty) {
      return;
    }

    const nextSnapshot = snapshotAds(adsPanel);
    if (nextSnapshot === adsPreviewSnapshotRef.current) {
      return;
    }

    adsPreviewSnapshotRef.current = nextSnapshot;
    const requestId = adsPreviewRequestRef.current + 1;
    adsPreviewRequestRef.current = requestId;

    const timeoutId = window.setTimeout(() => {
      apiJson<PreviewPayload<AdsPanelPayload>>('/api/panels/ads/preview', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toAdsRequestPayload(adsPanel)),
      })
        .then((payload) => {
          if (requestId !== adsPreviewRequestRef.current) {
            return;
          }
          setShell(payload.shell);
          setAdsPanel(payload.panel);
          adsVersionRef.current = payload.panel.version;
        })
        .catch(() => {
          showToast('Failed to preview ads config', 'error');
        });
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [adsPanel, isAdsDirty]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      apiJson<WatchPayload>('/api/watch')
        .then((payload) => {
          const nextCategoryVersion = payload.versions.categories ?? 0;
          if (nextCategoryVersion !== categoryVersionRef.current) {
            categoryVersionRef.current = nextCategoryVersion;
            if (!isCategoriesDirty) {
              apiJson<CategoriesPanelPayload>('/api/panels/categories').then((panel) => {
                setCategoriesPanel(panel);
                categorySnapshotRef.current = snapshotCategoriesPayload(panel);
                categoryPreviewSnapshotRef.current = categorySnapshotRef.current;
                setStatusText('External categories change detected - refreshed');
                setShell((current) =>
                  current
                    ? {
                        ...current,
                        accent: panel.siteColors.primary,
                        versions: {
                          ...current.versions,
                          categories: panel.version,
                        },
                      }
                    : current,
                );

                const cascadeFetches: Promise<void>[] = [];

                if (!isContentDirty) {
                  cascadeFetches.push(
                    apiJson<DesktopContentPanelPayload>('/api/panels/content').then(
                      (contentPayload) => {
                        setContentPanel(contentPayload);
                        contentSnapshotRef.current = snapshotContent(contentPayload);
                        contentPreviewSnapshotRef.current = contentSnapshotRef.current;
                        contentVersionRef.current = contentPayload.version;
                      },
                    ),
                  );
                }

                if (!isIndexHeroesDirty) {
                  cascadeFetches.push(
                    apiJson<IndexHeroesPanelPayload>('/api/panels/index-heroes').then(
                      (heroesPayload) => {
                        setIndexHeroesPanel(heroesPayload);
                        indexHeroesSnapshotRef.current = snapshotIndexHeroes(heroesPayload);
                        indexHeroesPreviewSnapshotRef.current =
                          indexHeroesSnapshotRef.current;
                        indexHeroesVersionRef.current = heroesPayload.version;
                      },
                    ),
                  );
                }

                if (!isHubToolsDirty) {
                  cascadeFetches.push(
                    apiJson<HubToolsPanelPayload>('/api/panels/hub-tools').then(
                      (hubPayload) => {
                        setHubToolsPanel(hubPayload);
                        hubToolsSnapshotRef.current = snapshotHubTools(hubPayload);
                        hubToolsPreviewSnapshotRef.current = hubToolsSnapshotRef.current;
                        hubToolsVersionRef.current = hubPayload.version;
                      },
                    ),
                  );
                }

                if (!isNavbarDirty) {
                  cascadeFetches.push(
                    apiJson<NavbarPanelPayload>('/api/panels/navbar').then((navbarPayload) => {
                      setNavbarPanel(navbarPayload);
                      setNavbarChanges(emptyNavbarChanges());
                      navbarSnapshotRef.current = snapshotNavbar(emptyNavbarChanges());
                      navbarPreviewSnapshotRef.current = navbarSnapshotRef.current;
                      navbarVersionRef.current = navbarPayload.version;
                    }),
                  );
                }

                if (!isSlideshowDirty) {
                  cascadeFetches.push(
                    apiJson<SlideshowPanelPayload>('/api/panels/slideshow').then(
                      (slideshowPayload) => {
                        setSlideshowPanel(slideshowPayload);
                        slideshowSnapshotRef.current = snapshotSlideshow(slideshowPayload);
                        slideshowPreviewSnapshotRef.current = slideshowSnapshotRef.current;
                        slideshowVersionRef.current = slideshowPayload.version;
                      },
                    ),
                  );
                }

                if (!isImageDefaultsDirty) {
                  cascadeFetches.push(
                    apiJson<ImageDefaultsPanelPayload>('/api/panels/image-defaults').then(
                      (imageDefaultsPayload) => {
                        setImageDefaultsPanel(imageDefaultsPayload);
                        imageDefaultsSnapshotRef.current = snapshotImageDefaults(imageDefaultsPayload);
                        imageDefaultsPreviewSnapshotRef.current = imageDefaultsSnapshotRef.current;
                        imageDefaultsVersionRef.current = imageDefaultsPayload.version;
                      },
                    ),
                  );
                }

                Promise.all(cascadeFetches);
              });
            }
          }

          const nextContentVersion = payload.versions.content ?? 0;
          if (
            nextContentVersion !== contentVersionRef.current ||
            nextContentVersion !== indexHeroesVersionRef.current
          ) {
            contentVersionRef.current = nextContentVersion;
            indexHeroesVersionRef.current = nextContentVersion;
            if (!isContentDirty && !isIndexHeroesDirty) {
              Promise.all([
                apiJson<DesktopContentPanelPayload>('/api/panels/content'),
                apiJson<IndexHeroesPanelPayload>('/api/panels/index-heroes'),
              ]).then(([contentPanelPayload, indexHeroesPayload]) => {
                setContentPanel(contentPanelPayload);
                setIndexHeroesPanel(indexHeroesPayload);

                contentSnapshotRef.current = snapshotContent(contentPanelPayload);
                contentPreviewSnapshotRef.current = contentSnapshotRef.current;
                indexHeroesSnapshotRef.current = snapshotIndexHeroes(indexHeroesPayload);
                indexHeroesPreviewSnapshotRef.current = indexHeroesSnapshotRef.current;

                setStatusText('External content/index heroes change detected - refreshed');
                setShell((current) =>
                  current
                    ? {
                        ...current,
                        versions: {
                          ...current.versions,
                          content: contentPanelPayload.version,
                        },
                      }
                    : current,
                );
              });
            }
          }

          const nextHubToolsVersion = payload.versions.hub_tools ?? 0;
          if (nextHubToolsVersion !== hubToolsVersionRef.current) {
            hubToolsVersionRef.current = nextHubToolsVersion;
            if (!isHubToolsDirty) {
              apiJson<HubToolsPanelPayload>('/api/panels/hub-tools').then((panel) => {
                setHubToolsPanel(panel);
                hubToolsSnapshotRef.current = snapshotHubTools(panel);
                hubToolsPreviewSnapshotRef.current = hubToolsSnapshotRef.current;
                setStatusText('External hub tools change detected - refreshed');
                setShell((current) =>
                  current
                    ? {
                        ...current,
                        versions: {
                          ...current.versions,
                          hub_tools: panel.version,
                        },
                      }
                    : current,
                );
              });
            }
          }

          const nextNavSectionsVersion = payload.versions.nav_sections ?? 0;
          if (nextNavSectionsVersion !== navbarVersionRef.current) {
            navbarVersionRef.current = nextNavSectionsVersion;
            if (!isNavbarDirty) {
              const navbarFetches: Promise<void>[] = [
                apiJson<NavbarPanelPayload>('/api/panels/navbar').then((panel) => {
                  setNavbarPanel(panel);
                  setNavbarChanges(emptyNavbarChanges());
                  navbarSnapshotRef.current = snapshotNavbar(emptyNavbarChanges());
                  navbarPreviewSnapshotRef.current = navbarSnapshotRef.current;
                  setStatusText('External navbar change detected - refreshed');
                  setShell((current) =>
                    current
                      ? {
                          ...current,
                          versions: {
                            ...current.versions,
                            nav_sections: panel.version,
                          },
                        }
                      : current,
                  );
                }),
              ];
              if (!isIndexHeroesDirty) {
                navbarFetches.push(
                  apiJson<IndexHeroesPanelPayload>('/api/panels/index-heroes').then(
                    (heroesPayload) => {
                      setIndexHeroesPanel(heroesPayload);
                      indexHeroesSnapshotRef.current = snapshotIndexHeroes(heroesPayload);
                      indexHeroesPreviewSnapshotRef.current =
                        indexHeroesSnapshotRef.current;
                      indexHeroesVersionRef.current = heroesPayload.version;
                    },
                  ),
                );
              }
              Promise.all(navbarFetches);
            }
          }

          const nextSlideshowVersion = payload.versions.slideshow ?? 0;
          if (nextSlideshowVersion !== slideshowVersionRef.current) {
            slideshowVersionRef.current = nextSlideshowVersion;
            if (!isSlideshowDirty) {
              apiJson<SlideshowPanelPayload>('/api/panels/slideshow').then((panel) => {
                setSlideshowPanel(panel);
                slideshowSnapshotRef.current = snapshotSlideshow(panel);
                slideshowPreviewSnapshotRef.current = slideshowSnapshotRef.current;
                setStatusText('External slideshow change detected - refreshed');
                setShell((current) =>
                  current
                    ? {
                        ...current,
                        versions: {
                          ...current.versions,
                          slideshow: panel.version,
                        },
                      }
                    : current,
                );
              });
            }
          }

          const nextImageDefaultsVersion = payload.versions.image_defaults ?? 0;
          if (nextImageDefaultsVersion !== imageDefaultsVersionRef.current) {
            imageDefaultsVersionRef.current = nextImageDefaultsVersion;
            if (!isImageDefaultsDirty) {
              apiJson<ImageDefaultsPanelPayload>('/api/panels/image-defaults').then((panel) => {
                setImageDefaultsPanel(panel);
                imageDefaultsSnapshotRef.current = snapshotImageDefaults(panel);
                imageDefaultsPreviewSnapshotRef.current = imageDefaultsSnapshotRef.current;
                setStatusText('External image defaults change detected - refreshed');
                setShell((current) =>
                  current
                    ? {
                        ...current,
                        versions: {
                          ...current.versions,
                          image_defaults: panel.version,
                        },
                      }
                    : current,
                );
              });
            }
          }

          const nextCacheCdnVersion = payload.versions.cache_cdn ?? 0;
          if (nextCacheCdnVersion !== cacheCdnVersionRef.current) {
            cacheCdnVersionRef.current = nextCacheCdnVersion;
            if (!isCacheCdnDirty) {
              apiJson<CacheCdnPanelPayload>('/api/panels/cache-cdn').then((panel) => {
                setCacheCdnPanel(panel);
                cacheCdnSnapshotRef.current = snapshotCacheCdn(panel);
                cacheCdnPreviewSnapshotRef.current = cacheCdnSnapshotRef.current;
                setStatusText('External cache/CDN change detected - refreshed');
                setShell((current) =>
                  current
                    ? {
                        ...current,
                        versions: {
                          ...current.versions,
                          cache_cdn: panel.version,
                        },
                      }
                    : current,
                );
              });
            }
          }

          const nextAdsVersion = Math.max(
            payload.versions.ads_registry ?? 0,
            payload.versions.inline_ads ?? 0,
            payload.versions.sponsors ?? 0,
          );
          if (nextAdsVersion !== adsVersionRef.current) {
            adsVersionRef.current = nextAdsVersion;
            if (!isAdsDirty) {
              apiJson<AdsPanelPayload>('/api/panels/ads').then((panel) => {
                setAdsPanel(panel);
                adsSnapshotRef.current = snapshotAds(panel);
                adsPreviewSnapshotRef.current = adsSnapshotRef.current;
                setStatusText('External ads change detected - refreshed');
              });
            }
          }
        })
        .catch(() => undefined);
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [isCategoriesDirty, isContentDirty, isIndexHeroesDirty, isHubToolsDirty, isNavbarDirty, isSlideshowDirty, isImageDefaultsDirty, isCacheCdnDirty, isAdsDirty]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const updateCategories = (
    updater: (current: CategoriesPanelPayload) => CategoriesPanelPayload,
  ) => {
    setCategoriesPanel((current) => (current ? updater(current) : current));
  };

  const updateContent = (
    updater: (current: DesktopContentPanelPayload) => DesktopContentPanelPayload,
  ) => {
    setContentPanel((current) => (current ? updater(current) : current));
  };

  const updateIndexHeroes = (
    updater: (current: IndexHeroesPanelPayload) => IndexHeroesPanelPayload,
  ) => {
    setIndexHeroesPanel((current) => (current ? updater(current) : current));
  };

  const updateHubTools = (
    updater: (current: HubToolsPanelPayload) => HubToolsPanelPayload,
  ) => {
    setHubToolsPanel((current) => (current ? updater(current) : current));
  };

  const updateSlideshow = (
    updater: (current: SlideshowPanelPayload) => SlideshowPanelPayload,
  ) => {
    setSlideshowPanel((current) => (current ? updater(current) : current));
  };

  const handleSlideshowAdd = (entryId: string, position?: number) => {
    updateSlideshow((current) => slideshowAddToQueue(current, entryId, position));
  };

  const handleSlideshowRemove = (entryId: string) => {
    updateSlideshow((current) => slideshowRemoveFromQueue(current, entryId));
  };

  const handleSlideshowReorder = (fromIndex: number, toIndex: number) => {
    updateSlideshow((current) => slideshowReorderQueue(current, fromIndex, toIndex));
  };

  const handleSlideshowMove = (index: number, direction: -1 | 1) => {
    updateSlideshow((current) => slideshowMoveInQueue(current, index, direction));
  };

  const handleSlideshowSetMax = (max: number) => {
    updateSlideshow((current) => slideshowSetMaxSlides(current, max));
  };

  const handleSlideshowClear = () => {
    updateSlideshow((current) => slideshowClearQueue(current));
  };

  const handleSlideshowAutoFill = () => {
    updateSlideshow((current) => slideshowAutoFill(current));
  };

  const updateImageDefaults = (
    updater: (current: ImageDefaultsPanelPayload) => ImageDefaultsPanelPayload,
  ) => {
    setImageDefaultsPanel((current) => (current ? updater(current) : current));
  };

  const handleImageDefaultsFieldChange = (categoryId: string, fieldKey: string, value: string[]) => {
    updateImageDefaults((current) => imageDefaultsSetField(current, categoryId, fieldKey, value));
  };

  const handleImageDefaultsReorderPriority = (categoryId: string, fromIndex: number, toIndex: number) => {
    updateImageDefaults((current) => imageDefaultsReorderPriority(current, categoryId, fromIndex, toIndex));
  };

  const handleImageDefaultsMovePriority = (categoryId: string, index: number, direction: number) => {
    updateImageDefaults((current) => imageDefaultsMovePriority(current, categoryId, index, direction));
  };

  const handleImageDefaultsResetPriority = (categoryId: string) => {
    updateImageDefaults((current) => imageDefaultsResetPriority(current, categoryId));
  };

  const handleImageDefaultsSetViewMeta = (categoryId: string, view: string, field: string, value: string) => {
    updateImageDefaults((current) => imageDefaultsSetViewMeta(current, categoryId, view, field, value));
  };

  const handleImageDefaultsToggleFit = (categoryId: string, view: string) => {
    updateImageDefaults((current) => imageDefaultsToggleFit(current, categoryId, view));
  };

  const updateCacheCdn = (
    updater: (current: CacheCdnPanelPayload) => CacheCdnPanelPayload,
  ) => {
    setCacheCdnPanel((current) => (current ? updater(current) : current));
  };

  const handleCacheCdnSetPolicyField = (policyName: string, fieldName: string, value: unknown) => {
    updateCacheCdn((current) => ({
      ...current,
      config: cacheCdnSetPolicyField(current.config, policyName, fieldName, value),
    }));
  };

  const handleCacheCdnSetPageTypeField = (pageTypeName: string, fieldName: string, value: unknown) => {
    updateCacheCdn((current) => ({
      ...current,
      config: cacheCdnSetPageTypeField(current.config, pageTypeName, fieldName, value),
    }));
  };

  const handleCacheCdnSetTargetField = (targetIndex: number, fieldName: string, value: unknown) => {
    updateCacheCdn((current) => ({
      ...current,
      config: cacheCdnSetTargetField(current.config, targetIndex, fieldName, value),
    }));
  };

  const handleCacheCdnAddTarget = () => {
    updateCacheCdn((current) => ({
      ...current,
      config: cacheCdnAddTarget(current.config),
    }));
  };

  const handleCacheCdnDeleteTarget = (targetIndex: number) => {
    updateCacheCdn((current) => ({
      ...current,
      config: cacheCdnDeleteTarget(current.config, targetIndex),
    }));
  };

  // ── Ads handlers ──────────────────────────────────────────────────

  const updateAds = (
    updater: (current: AdsPanelPayload) => AdsPanelPayload,
  ) => {
    setAdsPanel((current) => (current ? updater(current) : current));
  };

  const handleAdsSetGlobalField = (field: string, value: unknown) => {
    updateAds((current) => ({
      ...current,
      registry: adsSetGlobalField(current.registry, field, value),
    }));
  };

  const handleAdsSetPositionField = (name: string, field: string, value: unknown) => {
    updateAds((current) => ({
      ...current,
      registry: adsSetPositionField(current.registry, name, field, value),
    }));
  };

  const handleAdsAddPosition = (name: string, provider: string) => {
    updateAds((current) => {
      const result = adsAddPosition(current.registry, name, provider);
      return result ? { ...current, registry: result } : current;
    });
  };

  const handleAdsDeletePosition = (name: string) => {
    updateAds((current) => ({
      ...current,
      registry: adsDeletePosition(current.registry, name),
    }));
  };

  const handleAdsDuplicatePosition = (sourceName: string, newName: string) => {
    updateAds((current) => {
      const result = adsDuplicatePosition(current.registry, sourceName, newName);
      return result ? { ...current, registry: result } : current;
    });
  };

  const handleAdsSetInlineCollectionField = (collection: string, path: string, value: unknown) => {
    updateAds((current) => ({
      ...current,
      inline: adsSetInlineCollectionField(current.inline, collection, path, value),
    }));
  };

  const handleAdsSetInlineDefaultsField = (field: string, value: unknown) => {
    updateAds((current) => ({
      ...current,
      inline: adsSetInlineDefaultsField(current.inline, field, value),
    }));
  };

  const handleAdsAddCreative = (positionName: string) => {
    updateAds((current) => ({
      ...current,
      sponsors: adsAddCreative(current.sponsors, positionName),
    }));
  };

  const handleAdsDeleteCreative = (positionName: string, index: number) => {
    updateAds((current) => ({
      ...current,
      sponsors: adsDeleteCreative(current.sponsors, positionName, index),
    }));
  };

  const handleAdsSetCreativeField = (positionName: string, index: number, field: string, value: unknown) => {
    updateAds((current) => ({
      ...current,
      sponsors: adsSetCreativeField(current.sponsors, positionName, index, field, value),
    }));
  };

  const handleAdsNormalizeWeights = (positionName: string) => {
    updateAds((current) => ({
      ...current,
      sponsors: adsNormalizeWeights(current.sponsors, positionName),
    }));
  };

  const handleAdsSetEnabled = (enabled: boolean) => {
    updateAds((current) => ({
      ...current,
      adsEnabled: enabled,
    }));
  };

  const handleAdsScan = (): Promise<AdsScanResult> => {
    return apiJson<AdsScanResult>('/api/panels/ads/scan', { method: 'POST' });
  };

  const updateSiteColor = (which: 'primary' | 'secondary', nextColor: string) => {
    updateCategories((current) => {
      const normalized = normalizeHex(nextColor, current.siteColors[which]);
      const primary = which === 'primary' ? normalized : current.siteColors.primary;
      const nextDerived = deriveColors(primary);

      return {
        ...current,
        siteColors: {
          ...current.siteColors,
          [which]: normalized,
          derivedColors: {
            accent: nextDerived.accent,
            hover: nextDerived.hover,
            'grad-start': nextDerived['grad-start'],
            dark: nextDerived.dark,
            soft: nextDerived.soft,
          },
        },
      };
    });
  };

  const updateCategoryField = (
    categoryId: string,
    field: 'label' | 'plural',
    value: string,
  ) => {
    updateCategories((current) => ({
      ...current,
      categories: current.categories.map((category) =>
        category.id === categoryId ? { ...category, [field]: value } : category,
      ),
    }));
  };

  const updateCategoryToggle = (
    categoryId: string,
    section: 'product' | 'content',
    field: 'production' | 'vite',
    value: boolean,
  ) => {
    updateCategories((current) => ({
      ...current,
      categories: current.categories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              [section]: {
                ...category[section],
                [field]: value,
              },
            }
          : category,
      ),
    }));
  };

  const updateCategoryColor = (categoryId: string, nextColor: string) => {
    updateCategories((current) => ({
      ...current,
      categories: current.categories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              color: nextColor,
              derivedColors: deriveColors(nextColor),
            }
          : category,
      ),
    }));
  };

  const handleColorDialogClose = (nextColor: string | null) => {
    const currentDialog = colorDialog;
    setColorDialog(null);

    if (!currentDialog || !nextColor) {
      return;
    }

    if (currentDialog.mode === 'site') {
      updateSiteColor(currentDialog.which, nextColor);
      return;
    }

    updateCategoryColor(currentDialog.categoryId, nextColor);
  };

  const addCategory = (draft: AddCategoryDraft) => {
    if (!categoriesPanel) {
      setIsAddDialogOpen(false);
      return;
    }

    const categoryId = draft.id.trim().toLowerCase();
    if (!categoryId) {
      setIsAddDialogOpen(false);
      return;
    }

    if (categoriesPanel.categories.some((category) => category.id === categoryId)) {
      showToast(`'${categoryId}' already exists`, 'neutral');
      setIsAddDialogOpen(false);
      return;
    }

    updateCategories((current) => {
      const nextCategory = createNewCategory(current, draft);
      return {
        ...current,
        categoryCount: current.categories.length + 1,
        categories: [...current.categories, nextCategory],
      };
    });
    setIsAddDialogOpen(false);
  };

  const assignContentSlot = (articleKey: string, slotNumber?: number) => {
    updateContent((current) => assignArticleToSlot(current, articleKey, slotNumber));
  };

  const moveContentSlot = (fromSlot: number, toSlot: number) => {
    updateContent((current) => moveAssignedArticle(current, fromSlot, toSlot));
  };

  const removeContentSlot = (slotNumber: number) => {
    updateContent((current) => removeArticleFromSlot(current, slotNumber));
  };

  const resetContentSlots = () => {
    updateContent((current) => resetManualSlots(current));
  };

  const toggleContentPinned = (articleKey: string, isPinned: boolean) => {
    updateContent((current) => setArticlePinned(current, articleKey, isPinned));
  };

  const toggleContentExcluded = (articleKey: string, isExcluded: boolean) => {
    updateContent((current) => setArticleExcluded(current, articleKey, isExcluded));
  };

  const changeContentBadge = (articleKey: string, badgeText: string) => {
    updateContent((current) => setArticleBadge(current, articleKey, badgeText));
  };

  const selectIndexHeroType = (type: IndexHeroTypeKey) => {
    updateIndexHeroes((current) => {
      const hasAll = (current.categories[type] ?? []).some((category) => category.key === '_all');
      return {
        ...current,
        activeType: type,
        activeCategory: hasAll ? '_all' : current.activeCategory,
      };
    });
  };

  const selectIndexHeroCategory = (category: string) => {
    updateIndexHeroes((current) => ({
      ...current,
      activeCategory: category,
    }));
  };

  const assignIndexHeroSlot = (itemKey: string, slotIndex?: number) => {
    updateIndexHeroes((current) => {
      const type = current.activeType;
      const category = current.activeCategory;
      const slotCount = current.types.find((entry) => entry.key === type)?.slotCount ?? 3;
      const currentKeys = current.overrides[type]?.[category] ?? [];
      const withoutItem = currentKeys.filter((key) => key !== itemKey);

      let nextKeys = [...withoutItem];
      if (slotIndex === undefined) {
        if (nextKeys.length >= slotCount) {
          return current;
        }
        nextKeys.push(itemKey);
      } else {
        const boundedIndex = Math.max(0, Math.min(slotIndex, slotCount - 1));
        nextKeys.splice(boundedIndex, 0, itemKey);
      }
      nextKeys = nextKeys.filter(Boolean).slice(0, slotCount);

      return {
        ...current,
        overrides: {
          ...current.overrides,
          [type]: {
            ...current.overrides[type],
            [category]: nextKeys,
          },
        },
      };
    });
  };

  const removeIndexHeroSlot = (slotIndex: number) => {
    updateIndexHeroes((current) => {
      const type = current.activeType;
      const category = current.activeCategory;
      const currentKeys = current.overrides[type]?.[category] ?? [];
      if (slotIndex < 0 || slotIndex >= currentKeys.length) {
        return current;
      }

      const nextKeys = currentKeys.filter((_, index) => index !== slotIndex);
      const nextTypeOverrides = {
        ...current.overrides[type],
      };
      if (nextKeys.length > 0) {
        nextTypeOverrides[category] = nextKeys;
      } else {
        delete nextTypeOverrides[category];
      }

      return {
        ...current,
        overrides: {
          ...current.overrides,
          [type]: nextTypeOverrides,
        },
      };
    });
  };

  const clearIndexHeroOverrides = () => {
    updateIndexHeroes((current) => {
      const type = current.activeType;
      const category = current.activeCategory;
      const nextTypeOverrides = { ...current.overrides[type] };
      delete nextTypeOverrides[category];

      return {
        ...current,
        overrides: {
          ...current.overrides,
          [type]: nextTypeOverrides,
        },
      };
    });
    showToast('Overrides cleared \u2014 using auto-fill', 'success');
  };

  const updateHubToolField = (
    categoryId: string,
    toolType: string,
    field: 'title' | 'url' | 'description' | 'subtitle' | 'hero' | 'svg',
    value: string,
  ) => {
    updateHubTools((current) => ({
      ...current,
      tools: {
        ...current.tools,
        [categoryId]: (current.tools[categoryId] ?? []).map((tool) =>
          tool.tool === toolType ? { ...tool, [field]: value } : tool,
        ),
      },
    }));
  };

  const updateHubToolToggle = (
    categoryId: string,
    toolType: string,
    field: 'enabled' | 'navbar',
    value: boolean,
  ) => {
    updateHubTools((current) => ({
      ...current,
      tools: {
        ...current.tools,
        [categoryId]: (current.tools[categoryId] ?? []).map((tool) =>
          tool.tool === toolType ? { ...tool, [field]: value } : tool,
        ),
      },
    }));
  };

  const moveHubTool = (
    categoryId: string,
    toolType: string,
    direction: -1 | 1,
  ) => {
    updateHubTools((current) => {
      const tools = [...(current.tools[categoryId] ?? [])];
      const index = tools.findIndex((tool) => tool.tool === toolType);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= tools.length) {
        return current;
      }
      const [moved] = tools.splice(index, 1);
      tools.splice(nextIndex, 0, moved);
      return {
        ...current,
        tools: {
          ...current.tools,
          [categoryId]: tools,
        },
      };
    });
  };

  const removeHubTool = (categoryId: string, toolType: string) => {
    updateHubTools((current) => ({
      ...current,
      tools: {
        ...current.tools,
        [categoryId]: (current.tools[categoryId] ?? []).filter((tool) => tool.tool !== toolType),
      },
      index: Object.fromEntries(
        Object.entries(current.index).map(([view, keys]) => [
          view,
          keys.filter((key) => key !== `${categoryId}:${toolType}`),
        ]),
      ),
    }));
  };

  const addHubTool = (categoryId: string, toolType: HubToolTypeKey) => {
    updateHubTools((current) => {
      const existing = current.tools[categoryId] ?? [];
      if (existing.some((tool) => tool.tool === toolType)) {
        return current;
      }
      const typeLabel = current.toolTypes.find((type) => type.key === toolType)?.label ?? toolType;
      return {
        ...current,
        tools: {
          ...current.tools,
          [categoryId]: [...existing, createHubToolEntry(categoryId, toolType, typeLabel)],
        },
      };
    });
  };

  const setHubTooltip = (toolType: HubToolTypeKey, value: string) => {
    updateHubTools((current) => ({
      ...current,
      tooltips: {
        ...current.tooltips,
        [toolType]: value,
      },
    }));
  };

  const assignHubIndexSlot = (
    view: HubToolsIndexView,
    itemKey: string,
    slotIndex?: number,
  ) => {
    updateHubTools((current) => {
      const currentKeys = current.index[view] ?? [];
      const withoutItem = currentKeys.filter((key) => key !== itemKey);
      let nextKeys = [...withoutItem];
      if (slotIndex === undefined) {
        if (nextKeys.length >= 6) {
          return current;
        }
        nextKeys.push(itemKey);
      } else {
        const boundedIndex = Math.max(0, Math.min(slotIndex, 5));
        nextKeys.splice(boundedIndex, 0, itemKey);
      }
      nextKeys = nextKeys.filter(Boolean).slice(0, 6);
      return {
        ...current,
        index: {
          ...current.index,
          [view]: nextKeys,
        },
      };
    });
  };

  const removeHubIndexSlot = (view: HubToolsIndexView, slotIndex: number) => {
    updateHubTools((current) => {
      const currentKeys = current.index[view] ?? [];
      if (slotIndex < 0 || slotIndex >= currentKeys.length) {
        return current;
      }
      return {
        ...current,
        index: {
          ...current.index,
          [view]: currentKeys.filter((_, index) => index !== slotIndex),
        },
      };
    });
  };

  // ── Navbar handlers ──────────────────────────────────────────────────

  const handleMoveGuide = (slug: string, category: string, toSection: string) => {
    if (!navbarPanel) { return; }
    const [next, nextChanges] = moveGuideToSection(navbarPanel, navbarChanges, slug, category, toSection);
    setNavbarPanel(next);
    setNavbarChanges(nextChanges);
  };

  const handleAddSection = (category: string, name: string) => {
    if (!navbarPanel) { return; }
    const [next, nextChanges] = addSection(navbarPanel, navbarChanges, category, name);
    setNavbarPanel(next);
    setNavbarChanges(nextChanges);
  };

  const handleDeleteSection = (category: string, name: string) => {
    if (!navbarPanel) { return; }
    const [next, nextChanges] = deleteSection(navbarPanel, navbarChanges, category, name);
    setNavbarPanel(next);
    setNavbarChanges(nextChanges);
  };

  const handleRenameSection = (category: string, oldName: string, newName: string) => {
    if (!navbarPanel) { return; }
    const [next, nextChanges] = renameSection(navbarPanel, navbarChanges, category, oldName, newName);
    setNavbarPanel(next);
    setNavbarChanges(nextChanges);
  };

  const handleReorderSection = (category: string, index: number, direction: -1 | 1) => {
    if (!navbarPanel) { return; }
    const [next, nextChanges] = reorderSection(navbarPanel, navbarChanges, category, index, direction);
    setNavbarPanel(next);
    setNavbarChanges(nextChanges);
  };

  const handleRenameGuide = (slug: string, newName: string) => {
    if (!navbarPanel) { return; }
    const [next, nextChanges] = renameGuide(navbarPanel, navbarChanges, slug, newName);
    setNavbarPanel(next);
    setNavbarChanges(nextChanges);
  };

  const handleAddBrandToCategory = (slug: string, category: string) => {
    if (!navbarPanel) { return; }
    const [next, nextChanges] = addBrandToCategory(navbarPanel, navbarChanges, slug, category);
    setNavbarPanel(next);
    setNavbarChanges(nextChanges);
  };

  const handleRemoveBrandFromCategory = (slug: string, category: string) => {
    if (!navbarPanel) { return; }
    const [next, nextChanges] = removeBrandFromCategory(navbarPanel, navbarChanges, slug, category);
    setNavbarPanel(next);
    setNavbarChanges(nextChanges);
  };

  const handleToggleBrandNavbar = (slug: string, category: string) => {
    if (!navbarPanel) { return; }
    const [next, nextChanges] = toggleBrandNavbar(navbarPanel, navbarChanges, slug, category);
    setNavbarPanel(next);
    setNavbarChanges(nextChanges);
  };

  const handleRenameBrand = (slug: string, newName: string) => {
    if (!navbarPanel) { return; }
    const [next, nextChanges] = renameBrand(navbarPanel, navbarChanges, slug, newName);
    setNavbarPanel(next);
    setNavbarChanges(nextChanges);
  };

  const handleToggleGame = (slug: string, value: boolean) => {
    if (!navbarPanel) { return; }
    const [next, nextChanges] = toggleGame(navbarPanel, navbarChanges, slug, value);
    setNavbarPanel(next);
    setNavbarChanges(nextChanges);
  };

  const handleToggleAllGames = () => {
    if (!navbarPanel) { return; }
    const [next, nextChanges] = toggleAllGames(navbarPanel, navbarChanges);
    setNavbarPanel(next);
    setNavbarChanges(nextChanges);
  };

  const handleRenameGame = (slug: string, newName: string) => {
    if (!navbarPanel) { return; }
    const [next, nextChanges] = renameGame(navbarPanel, navbarChanges, slug, newName);
    setNavbarPanel(next);
    setNavbarChanges(nextChanges);
  };

  const dirtyPanels = [
    isCategoriesDirty ? 'Categories' : '',
    isContentDirty ? 'Content' : '',
    isIndexHeroesDirty ? 'Index Heroes' : '',
    isHubToolsDirty ? 'Hub Tools' : '',
    isNavbarDirty ? 'Navbar' : '',
    isSlideshowDirty ? 'Slideshow' : '',
    isImageDefaultsDirty ? 'Image Defaults' : '',
    isCacheCdnDirty ? 'Cache / CDN' : '',
    isAdsDirty ? 'Ads' : '',
  ].filter(Boolean);

  const currentStatusRight =
    activePanel === 'Categories'
      ? categoriesPanel?.statusRight ?? '0 categories'
      : activePanel === 'Content'
        ? contentPanel?.statusRight ?? '0 articles'
        : activePanel === 'Index Heroes'
          ? indexHeroesPanel?.statusRight ?? '0 heroes'
          : activePanel === 'Hub Tools'
            ? hubToolsPanel?.statusRight ?? '0 tools'
            : activePanel === 'Navbar'
              ? navbarPanel?.statusRight ?? '0 items'
              : activePanel === 'Slideshow'
                ? slideshowPanel?.statusRight ?? '0 products'
                : activePanel === 'Image Defaults'
                  ? imageDefaultsPanel?.statusRight ?? '0 products'
                  : activePanel === 'Cache / CDN'
                    ? cacheCdnPanel?.statusRight ?? '0 targets'
                    : activePanel === 'Ads'
                      ? adsPanel?.statusRight ?? '0 positions'
        : 'React port pending';

  const currentDialogColor = (() => {
    if (!colorDialog || !categoriesPanel) {
      return '';
    }
    if (colorDialog.mode === 'site') {
      return categoriesPanel.siteColors[colorDialog.which];
    }
    return (
      categoriesPanel.categories.find((category) => category.id === colorDialog.categoryId)?.color ??
      categoriesPanel.siteColors.primary
    );
  })();
  const switchTheme = async (fullThemeId: string) => {
    applyThemeVariables(categoriesPanel?.siteColors ?? null, fullThemeId);
    const family = resolveThemeFamily(fullThemeId);
    const entry = THEME_REGISTRY.find((t) => t.id === family);
    if (shell) {
      setShell({ ...shell, theme: { id: fullThemeId, label: entry?.label ?? fullThemeId, mode: 'dark' } });
    }
    await fetch('/api/shell/theme', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: fullThemeId }),
    });
  };

  const currentFullThemeId = shell?.theme.id ?? 'legacy-clone-dark';
  const iconThemeId = resolveThemeFamily(currentFullThemeId);
  const currentMode = resolveThemeMode(currentFullThemeId);

  return (
    <IconThemeContext.Provider value={iconThemeId}>
      <div className="app-shell">
      <div className="app-shell__body">
        <aside className="app-shell__sidebar">
          <div className="sidebar__logo">
            <span className="site-name sidebar__logo-wordmark">
              <span className="navsitename1">EG</span>
              <span className="navsitename2">Config</span>
            </span>
          </div>
          <div className="sidebar__rule" />
          <nav className="sidebar__nav" aria-label="Config panels">
            {shell?.navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className="sidebar__nav-item"
                data-active={item.key === activePanel ? 'true' : 'false'}
                onClick={() => setActivePanel(item.key)}
              >
                <span className="sidebar__nav-indicator" />
                <span className="sidebar__nav-icon" aria-hidden="true">
                  <NavIcon panelKey={item.key} themeId={iconThemeId} />
                </span>
                <span className="sidebar__nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar__rule" />
          <div className="sidebar__footer">
            <span className="sidebar__footer-label">
              {shell?.projectRootName ?? getSidebarFooterText(shell)}
            </span>
            <button
              type="button"
              className="sidebar__settings-cog"
              title="Settings"
              aria-label="Settings"
              onClick={() => setIsSettingsOpen(true)}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="8" cy="8" r="2.5" />
                <path d="M6.8 1.5h2.4l.3 1.8.9.4 1.5-1 1.7 1.7-1 1.5.4.9 1.8.3v2.4l-1.8.3-.4.9 1 1.5-1.7 1.7-1.5-1-.9.4-.3 1.8H6.8l-.3-1.8-.9-.4-1.5 1-1.7-1.7 1-1.5-.4-.9-1.8-.3V6.8l1.8-.3.4-.9-1-1.5 1.7-1.7 1.5 1 .9-.4.3-1.8Z" />
              </svg>
            </button>
          </div>
        </aside>

        <div className="app-shell__sidebar-stripe" />

        <div className="app-shell__main">
          <header className="context-bar">
            <div className="context-bar__inner">
              <h1 className="context-bar__title">{activePanel}</h1>
              <div className="context-bar__spacer" />
              <div className="context-bar__dirty">
                {dirtyPanels.length > 0 ? `unsaved: ${dirtyPanels.join(' · ')}` : ''}
              </div>
              <button
                type="button"
                className="token-button token-button--accent context-bar__save-button"
                onClick={saveAllDirtyPanels}
              >
                Save
              </button>
            </div>
            <div className="context-bar__border" />
          </header>

          <main className="panel-host">
            {isLoading || !categoriesPanel || !contentPanel || !indexHeroesPanel || !hubToolsPanel || !navbarPanel || !slideshowPanel || !imageDefaultsPanel ? (
              <section className="placeholder-panel">
                <div className="placeholder-panel__body">
                  <h2 className="placeholder-panel__title">Loading</h2>
                  <p className="placeholder-panel__note">Loading config shell...</p>
                </div>
              </section>
            ) : activePanel === 'Categories' ? (
              <CategoriesPanelExtracted
                panel={categoriesPanel}
                onSiteColorPick={(which) => setColorDialog({ mode: 'site', which })}
                onCategoryColorPick={(categoryId) =>
                  setColorDialog({ mode: 'category', categoryId })
                }
                onCategoryChange={updateCategoryField}
                onToggleChange={updateCategoryToggle}
                onAddCategory={() => setIsAddDialogOpen(true)}
              />
            ) : activePanel === 'Content' ? (
              <ContentPanelExtracted
                panel={contentPanel}
                activeCollection={activeContentCollection}
                onAssignToSlot={assignContentSlot}
                onRemoveSlot={removeContentSlot}
                onTogglePinned={toggleContentPinned}
                onToggleExcluded={toggleContentExcluded}
                onBadgeChange={changeContentBadge}
                onSelectCollection={setActiveContentCollection}
                onMoveSlot={moveContentSlot}
                onResetManualSlots={resetContentSlots}
              />
            ) : activePanel === 'Index Heroes' ? (
              <IndexHeroesPanel
                panel={indexHeroesPanel}
                onSelectType={selectIndexHeroType}
                onSelectCategory={selectIndexHeroCategory}
                onAssignToSlot={assignIndexHeroSlot}
                onRemoveSlot={removeIndexHeroSlot}
                onClearOverrides={clearIndexHeroOverrides}
              />
            ) : activePanel === 'Hub Tools' ? (
              <HubToolsPanel
                panel={hubToolsPanel}
                activeCategory={activeHubToolsCategory}
                activeIndexView={activeHubToolsIndexView}
                onSelectCategory={setActiveHubToolsCategory}
                onSelectIndexView={setActiveHubToolsIndexView}
                onToolFieldChange={updateHubToolField}
                onToolToggle={updateHubToolToggle}
                onMoveTool={moveHubTool}
                onRemoveTool={removeHubTool}
                onAddTool={addHubTool}
                onTooltipChange={setHubTooltip}
                onIndexAssign={assignHubIndexSlot}
                onIndexRemove={removeHubIndexSlot}
              />
            ) : activePanel === 'Navbar' ? (
              <NavbarPanelExtracted
                panel={navbarPanel}
                onMoveGuide={handleMoveGuide}
                onAddSection={handleAddSection}
                onDeleteSection={handleDeleteSection}
                onRenameSection={handleRenameSection}
                onReorderSection={handleReorderSection}
                onRenameGuide={handleRenameGuide}
                onAddBrand={handleAddBrandToCategory}
                onRemoveBrand={handleRemoveBrandFromCategory}
                onToggleBrandNavbar={handleToggleBrandNavbar}
                onRenameBrand={handleRenameBrand}
                onToggleGame={handleToggleGame}
                onToggleAllGames={handleToggleAllGames}
                onRenameGame={handleRenameGame}
              />
            ) : activePanel === 'Slideshow' ? (
              <SlideshowPanel
                panel={slideshowPanel}
                onAddToQueue={handleSlideshowAdd}
                onRemoveFromQueue={handleSlideshowRemove}
                onReorderQueue={handleSlideshowReorder}
                onMoveInQueue={handleSlideshowMove}
                onSetMaxSlides={handleSlideshowSetMax}
                onClearQueue={handleSlideshowClear}
                onAutoFill={handleSlideshowAutoFill}
              />
            ) : activePanel === 'Image Defaults' ? (
              <ImageDefaultsPanelView
                panel={imageDefaultsPanel}
                onFieldChange={handleImageDefaultsFieldChange}
                onReorderPriority={handleImageDefaultsReorderPriority}
                onMovePriority={handleImageDefaultsMovePriority}
                onResetPriority={handleImageDefaultsResetPriority}
                onSetViewMeta={handleImageDefaultsSetViewMeta}
                onToggleFit={handleImageDefaultsToggleFit}
              />
            ) : activePanel === 'Cache / CDN' && cacheCdnPanel ? (
              <CacheCdnPanelView
                panel={cacheCdnPanel}
                onSetPolicyField={handleCacheCdnSetPolicyField}
                onSetPageTypeField={handleCacheCdnSetPageTypeField}
                onSetTargetField={handleCacheCdnSetTargetField}
                onAddTarget={handleCacheCdnAddTarget}
                onDeleteTarget={handleCacheCdnDeleteTarget}
              />
            ) : activePanel === 'Ads' && adsPanel ? (
              <AdsPanelView
                panel={adsPanel}
                onSetGlobalField={handleAdsSetGlobalField}
                onSetPositionField={handleAdsSetPositionField}
                onAddPosition={handleAdsAddPosition}
                onDeletePosition={handleAdsDeletePosition}
                onDuplicatePosition={handleAdsDuplicatePosition}
                onSetInlineCollectionField={handleAdsSetInlineCollectionField}
                onSetInlineDefaultsField={handleAdsSetInlineDefaultsField}
                onAddCreative={handleAdsAddCreative}
                onDeleteCreative={handleAdsDeleteCreative}
                onSetCreativeField={handleAdsSetCreativeField}
                onNormalizeWeights={handleAdsNormalizeWeights}
                onSetAdsEnabled={handleAdsSetEnabled}
                onScan={handleAdsScan}
              />
            ) : (
              <PlaceholderPanel panelName={activePanel} />
            )}
          </main>
        </div>
      </div>

      <footer className="status-bar">
        <div className="status-bar__left">{statusText}</div>
        <div className="status-bar__right">{currentStatusRight}</div>
      </footer>

      <ColorDialog
        state={colorDialog}
        initialColor={currentDialogColor}
        accentColor={
          categoriesPanel?.siteColors.primary ??
          shell?.accent ??
          readCssToken('--theme-site-primary')
        }
        categoryId={colorDialog?.mode === 'category' ? colorDialog.categoryId : undefined}
        onClose={handleColorDialogClose}
      />

      <AddCategoryDialog
        isOpen={isAddDialogOpen}
        accentColor={
          categoriesPanel?.siteColors.primary ??
          shell?.accent ??
          readCssToken('--theme-site-primary')
        }
        onClose={() => setIsAddDialogOpen(false)}
        onSubmit={addCategory}
      />

      {isSettingsOpen ? (
        <div className="overlay" role="presentation" onClick={() => setIsSettingsOpen(false)}>
          <div
            className="dialog settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog__body">
              <div className="dialog__header">
                <h2 className="dialog__title">Settings</h2>
              </div>
              <div className="settings-dialog__section">
                <h3 className="settings-dialog__section-label">Theme</h3>
                <div className="settings-dialog__themes">
                  {THEME_REGISTRY.map((theme) => {
                    const isActiveFamily = theme.id === iconThemeId;
                    return (
                      <div key={theme.id} className="settings-dialog__theme-family">
                        <button
                          type="button"
                          className="settings-dialog__theme-tile"
                          data-active={isActiveFamily ? 'true' : 'false'}
                          onClick={() => switchTheme(`${theme.id}-${isActiveFamily ? currentMode : 'dark'}`)}
                        >
                          <span className="settings-dialog__theme-icon" aria-hidden="true">
                            {theme.icon}
                          </span>
                          <span className="settings-dialog__theme-label">{theme.label}</span>
                          <span className="settings-dialog__theme-swatches">
                            <span className="settings-dialog__theme-swatch" style={{ background: theme.preview.primary }} />
                            <span className="settings-dialog__theme-swatch" style={{ background: theme.preview.secondary }} />
                          </span>
                        </button>
                        {isActiveFamily && (
                          <div className="settings-dialog__theme-modes">
                            {(['dark', 'light', 'neutral'] as ThemeMode[]).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                className="settings-dialog__mode-btn"
                                data-active={currentMode === mode ? 'true' : 'false'}
                                onClick={() => switchTheme(`${theme.id}-${mode}`)}
                              >
                                {mode.charAt(0).toUpperCase() + mode.slice(1)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="toast-layer">
          <div className="toast" data-variant={toast.variant}>
            {toast.message}
          </div>
        </div>
      ) : null}
    </div>
    </IconThemeContext.Provider>
  );
}
