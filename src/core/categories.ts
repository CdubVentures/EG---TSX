// ─── Category Color Derivation Engine ────────────────────────────────────────
// SSOT for deriving all category color variants from a single base hex.
// Used by MainLayout.astro (build-time CSS variable injection) and any
// component that needs computed category colors.

import { categoryColor, siteColors, CONFIG } from './config';

// ─── Color Manipulation ─────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ─── Derivation ─────────────────────────────────────────────────────────────

export interface CategoryColorVariants {
  base: string;
  accent: string;
  dark: string;
  hover: string;
  gradStart: string;
  scoreEnd: string;
  rgb: [number, number, number];
  softRgb: [number, number, number];
}

export function deriveCategoryColors(hex: string): CategoryColorVariants {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);

  // WHY "soft": HBS glow/shadow colors use a desaturated + lightened version
  // that doesn't blow out on dark backgrounds.
  const softHex = hslToHex(h, s * 0.6, Math.min(l * 1.15, 85));
  const [sr, sg, sb] = hexToRgb(softHex);

  return {
    base: hex,
    accent: hslToHex(h, s, l * 0.9),
    dark: hslToHex(h, s * 0.4, l * 0.35),
    hover: hslToHex(h, s, l * 0.7),
    gradStart: hslToHex(h, s * 0.85, l * 0.5),
    scoreEnd: hslToHex(h, s, l * 0.75),
    rgb: [r, g, b],
    softRgb: [sr, sg, sb],
  };
}

/** Get derived color variants for a category ID. */
export function getCategoryColors(cat: string): CategoryColorVariants {
  return deriveCategoryColors(categoryColor(cat));
}

// ─── CSS Variable Generation (for MainLayout build-time injection) ──────────

function deriveCategoryVars(id: string, hex: string): string {
  const c = deriveCategoryColors(hex);
  const [r, g, b] = c.rgb;
  const [sr, sg, sb] = c.softRgb;

  return [
    `--cat-${id}: ${c.base}`,
    `--cat-${id}-accent: ${c.accent}`,
    `--cat-${id}-dark: ${c.dark}`,
    `--cat-${id}-hover: ${c.hover}`,
    `--cat-${id}-gradient-start: ${c.gradStart}`,
    `--cat-${id}-highlight: rgba(${r}, ${g}, ${b}, 0.1)`,
    `--cat-${id}-glow: rgba(${sr}, ${sg}, ${sb}, 0.8)`,
    `--cat-${id}-rgb: ${r}, ${g}, ${b}`,
    `--cat-${id}-soft-rgb: ${sr}, ${sg}, ${sb}`,
    `--cat-${id}-shadow-light: 0 4px 8px rgba(${sr}, ${sg}, ${sb}, 0.2)`,
    `--cat-${id}-shadow-xl: 0 2px 5px rgba(${sr}, ${sg}, ${sb}, 0.1)`,
    `--cat-${id}-shadow-strong: 0 6px 12px rgba(${r}, ${g}, ${b}, 0.4)`,
    `--cat-${id}-score-start: ${c.base}`,
    `--cat-${id}-score-end: ${c.scoreEnd}`,
    `--cat-${id}-score-rgba: rgba(${r}, ${g}, ${b}, 1)`,
  ].join('; ');
}

/** Generate --card-* class mappings for a category (HBS-compatible indirection). */
export function categoryColorClass(id: string): string {
  return `.${id}-color { ` + [
    `--card-color: var(--cat-${id})`,
    `--card-accent: var(--cat-${id}-accent)`,
    `--card-dark-accent: var(--cat-${id}-dark)`,
    `--card-rgb: var(--cat-${id}-rgb)`,
    `--card-soft-rgb: var(--cat-${id}-soft-rgb)`,
    `--card-glow: var(--cat-${id}-glow)`,
    `--card-hover: var(--cat-${id}-hover)`,
    `--card-gradientStart: var(--cat-${id}-gradient-start)`,
    `--card-highlight: var(--cat-${id}-highlight)`,
    `--card-shadow-light: var(--cat-${id}-shadow-light)`,
    `--card-shadow-extra-light: var(--cat-${id}-shadow-xl)`,
    `--card-shadow-strong: var(--cat-${id}-shadow-strong)`,
    `--card-score-start: var(--cat-${id}-score-start)`,
    `--card-score-end: var(--cat-${id}-score-end)`,
    `--card-score-rgba: var(--cat-${id}-score-rgba)`,
  ].join('; ') + '; }';
}

/** Build all category CSS variable rules for injection into a <style> tag. */
export function buildAllCategoryVars(): string {
  return CONFIG.allCategories
    .map(id => deriveCategoryVars(id, categoryColor(id)))
    .join('; ');
}

/** Build all --card-* class rules for injection into a <style> tag. */
export function buildAllCategoryClasses(): string {
  return CONFIG.allCategories
    .map(id => categoryColorClass(id))
    .join('\n');
}

// ─── Site Color Derivation ────────────────────────────────────────────────────
// WHY: siteColors.primary and .secondary in categories.json are the SSOT for
// the site-wide gradient. All --site-* vars are derived from primary; --brand-color
// is secondary. Change them in the GUI → seasonal themes (Easter, Christmas, etc.).

export function deriveSiteVars(primary: string, secondary: string): string {
  const [r, g, b] = hexToRgb(primary);
  const [h, s, l] = rgbToHsl(r, g, b);
  const accent = hslToHex(h, s, l * 0.9);
  const dark = hslToHex(h, s * 0.4, l * 0.35);
  const hover = hslToHex(h, s, l * 0.7);
  const gradStart = hslToHex(h, s * 0.85, l * 0.5);
  const softHex = hslToHex(h, s * 0.6, Math.min(l * 1.15, 85));
  const [sr, sg, sb] = hexToRgb(softHex);

  return [
    `--site-color: ${primary}`,
    `--brand-color: ${secondary}`,
    `--site-accent: ${accent}`,
    `--site-dark-accent: ${dark}`,
    `--site-hover: ${hover}`,
    `--site-gradientStart: ${gradStart}`,
    `--site-highlight: rgba(${r}, ${g}, ${b}, 0.1)`,
    `--site-glow: rgba(${sr}, ${sg}, ${sb}, 0.8)`,
    `--site-rgb: ${r}, ${g}, ${b}`,
    `--site-shadow-light: 0 4px 8px rgba(${sr}, ${sg}, ${sb}, 0.2)`,
    `--site-shadow-extra-light: 0 2px 5px rgba(${sr}, ${sg}, ${sb}, 0.1)`,
    `--site-shadow-strong: 0 6px 12px rgba(${r}, ${g}, ${b}, 0.4)`,
    `--site-score-start: ${primary}`,
    `--site-start-color: ${primary}`,
    `--site-score-end: ${secondary}`,
    `--site-end-color: ${secondary}`,
    `--site-score-rgba: rgba(${r}, ${g}, ${b}, 1)`,
    `--site-gradient-start: ${primary}`,
    `--site-gradient-end: ${secondary}`,
    `--site-gradient-text: linear-gradient(to right, ${primary}, ${secondary})`,
    `--site-background-gradient: linear-gradient(to right, ${primary}, ${secondary})`,
  ].join('; ');
}

/** Build the complete CSS block for <style> injection (`:root { ... }` + `.cat-color { ... }`). */
export function buildCategoryVarsBlock(): string {
  const siteVarStr = deriveSiteVars(siteColors.primary, siteColors.secondary);
  const rootVars = buildAllCategoryVars();
  const cardClasses = buildAllCategoryClasses();
  return `:root { ${siteVarStr}; ${rootVars} }\n${cardClasses}`;
}

/** CSS variable reference for a category's base color. */
export function catVar(cat: string): string {
  return `var(--cat-${cat})`;
}
