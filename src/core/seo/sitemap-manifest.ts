export interface BuiltHtmlPage {
  routePath: string;
  html: string;
}

export interface BuildExpectedSitemapUrlsOptions {
  siteUrl: string;
  pages: BuiltHtmlPage[];
}

export interface DiffSitemapUrlsOptions {
  expected: string[];
  actual: string[];
}

export interface SitemapDiffReport {
  missing: string[];
  unexpected: string[];
  duplicateExpected: string[];
  duplicateActual: string[];
  ok: boolean;
}

function normalizeSiteUrl(siteUrl: string): string {
  return String(siteUrl).endsWith('/') ? String(siteUrl).slice(0, -1) : String(siteUrl);
}

function normalizeUrl(url: string): string {
  return String(url).trim();
}

function isAssetRoutePath(routePath: string): boolean {
  return routePath.startsWith('/images/');
}

function sortUnique(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort();
}

function collectDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values.map(normalizeUrl)) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }
    seen.add(value);
  }

  return Array.from(duplicates).sort();
}

function findCanonicalHref(html: string): string | null {
  const directMatch = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  if (directMatch?.[1]) return directMatch[1];

  const reversedMatch = html.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i);
  return reversedMatch?.[1] ?? null;
}

function findRobotsContent(html: string): string | null {
  const directMatch = html.match(/<meta\b[^>]*name=["']robots["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  if (directMatch?.[1]) return directMatch[1];

  const reversedMatch = html.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*name=["']robots["'][^>]*>/i);
  return reversedMatch?.[1] ?? null;
}

export function extractCanonicalUrl(html: string): string | null {
  return findCanonicalHref(html)?.trim() ?? null;
}

export function isNoIndexHtml(html: string): boolean {
  const robotsContent = findRobotsContent(html);
  if (!robotsContent) return false;
  return robotsContent.toLowerCase().includes('noindex');
}

export function toAbsoluteUrl(siteUrl: string, routePath: string): string {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  const normalizedRoutePath = routePath.startsWith('/') ? routePath : `/${routePath}`;
  return new URL(normalizedRoutePath, `${normalizedSiteUrl}/`).toString();
}

export function buildExpectedSitemapUrls({
  siteUrl,
  pages,
}: BuildExpectedSitemapUrlsOptions): string[] {
  const urls = pages.flatMap((page) => {
    if (isAssetRoutePath(page.routePath)) return [];
    if (isNoIndexHtml(page.html)) return [];

    const canonicalUrl = extractCanonicalUrl(page.html);
    return [normalizeUrl(canonicalUrl ?? toAbsoluteUrl(siteUrl, page.routePath))];
  });

  return sortUnique(urls);
}

export function extractLocUrls(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gi), (match) => normalizeUrl(match[1] ?? ''))
    .filter(Boolean);
}

export function diffSitemapUrls({
  expected,
  actual,
}: DiffSitemapUrlsOptions): SitemapDiffReport {
  const normalizedExpected = expected.map(normalizeUrl);
  const normalizedActual = actual.map(normalizeUrl);

  const expectedSet = new Set(normalizedExpected);
  const actualSet = new Set(normalizedActual);

  const missing = Array.from(expectedSet).filter((url) => !actualSet.has(url)).sort();
  const unexpected = Array.from(actualSet).filter((url) => !expectedSet.has(url)).sort();
  const duplicateExpected = collectDuplicates(normalizedExpected);
  const duplicateActual = collectDuplicates(normalizedActual);

  return {
    missing,
    unexpected,
    duplicateExpected,
    duplicateActual,
    ok: missing.length === 0
      && unexpected.length === 0
      && duplicateExpected.length === 0
      && duplicateActual.length === 0,
  };
}
