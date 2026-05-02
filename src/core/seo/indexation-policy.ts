export const INDEXABLE_ROBOTS_DIRECTIVES = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
export const NOINDEX_ROBOTS_DIRECTIVES = 'noindex,nofollow';
export const DEFAULT_ROBOTS_TXT_DISALLOWS = ['/api/', '/profile/', '/login/', '/logout', '/auth/'];

export interface BuildDocumentIndexationOptions {
  noIndex?: boolean;
}

export interface BuildRobotsTxtOptions {
  siteUrl: string;
  disallowPaths?: string[];
}

function normalizeSiteUrl(siteUrl: string): string {
  const normalizedSiteUrl = String(siteUrl);
  return normalizedSiteUrl.endsWith('/') ? normalizedSiteUrl.slice(0, -1) : normalizedSiteUrl;
}

export function buildDocumentIndexation({ noIndex = false }: BuildDocumentIndexationOptions): {
  robots: string;
  googlebot: string;
} {
  const directives = noIndex ? NOINDEX_ROBOTS_DIRECTIVES : INDEXABLE_ROBOTS_DIRECTIVES;
  return {
    robots: directives,
    googlebot: directives,
  };
}

export function withNoIndexHeaders(headersInit: HeadersInit = {}): Headers {
  const headers = new Headers(headersInit);
  headers.set('X-Robots-Tag', NOINDEX_ROBOTS_DIRECTIVES);
  return headers;
}

export function jsonNoIndex(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, {
    ...init,
    headers: withNoIndexHeaders(init.headers),
  });
}

export function buildRobotsTxt({
  siteUrl,
  disallowPaths = DEFAULT_ROBOTS_TXT_DISALLOWS,
}: BuildRobotsTxtOptions): string {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  return [
    'User-agent: *',
    'Allow: /',
    ...disallowPaths.map((path) => `Disallow: ${path}`),
    `Sitemap: ${normalizedSiteUrl}/sitemap-index.xml`,
  ].join('\n');
}
