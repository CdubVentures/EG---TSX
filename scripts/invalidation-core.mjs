import fs from 'node:fs';

const DEFAULT_MAX_PATHS = 6;
const BREADCRUMB_THRESHOLD = 5;

const FULL_FLUSH_PREFIXES = [
  'src/app/',
  'src/shared/',
];

const NO_CDN_INVALIDATION_PREFIXES = [
  'infrastructure/',
  'src/pages/api/auth/',
  'src/pages/auth/',
  'src/pages/login/',
  'src/pages/logout.ts',
  'src/features/auth/server/',
  'src/features/vault/server/',
];

const SOURCE_GROUP_RULES = [
  { path: '/reviews/*', prefixes: ['src/content/reviews/', 'reviews/'] },
  { path: '/guides/*', prefixes: ['src/content/guides/', 'guides/'] },
  { path: '/news/*', prefixes: ['src/content/news/', 'news/'] },
  { path: '/brands/*', prefixes: ['src/content/brands/', 'brands/'] },
  { path: '/games/*', prefixes: ['src/content/games/', 'games/'] },
  { path: '/hubs/*', prefixes: ['src/content/hubs/', 'src/pages/hubs/', 'hubs/', 'hubs/packets/'] },
  { path: '/images/*', prefixes: ['public/images/', 'images/'] },
  { path: '/api/search*', prefixes: ['src/pages/api/search', 'src/features/search/'] },
];

const WILDCARD_PATH_ORDER = [
  '/reviews/*',
  '/guides/*',
  '/news/*',
  '/brands/*',
  '/games/*',
  '/hubs/*',
  '/images/*',
  '/api/*',
  '/api/search*',
  '/assets/*',
  '/_astro/*',
  '/fonts/*',
  '/css/*',
  '/js/*',
  '/static/*',
  '/scripts/*',
  '/src/*',
];

const cacheCdnContract = JSON.parse(
  fs.readFileSync(new URL('../config/data/cache-cdn.json', import.meta.url), 'utf8')
);

function getFullSiteContractPaths() {
  return cacheCdnContract.targets
    .filter((target) => cacheCdnContract.pageTypes?.[target.pageType]?.policy !== 'dynamicApis')
    .flatMap((target) => target.pathPatterns)
    .filter((pathValue) => pathValue !== '*');
}

const SITE_FULL_INVALIDATION_PATHS_RAW = [
  '/',
  ...getFullSiteContractPaths(),
  '/_astro/*',
  '/images/*',
  '/reviews/*',
  '/guides/*',
  '/news/*',
  '/brands/*',
  '/games/*',
  '/hubs/*',
  '/tools/*',
  '/api/*',
  '/api/search*',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest*.json',
  '/service-worker.js',
  '/*.css',
  '/*.js',
  '/*.mjs',
  '/*.map',
  '/*.txt',
  '/*.html',
  '/*.htm',
  '/*.json',
  '/css/*',
  '/js/*',
  '/fonts/*',
  '/static/*',
  '/scripts/*',
  '/src/*',
];

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^\/+/, '');
}

function classifyPathType(value) {
  if (value === '/') {
    return 4;
  }

  if (value.endsWith('*')) {
    return 2;
  }

  const leaf = value.split('/').pop() || '';
  if (leaf.includes('.')) {
    return 3;
  }

  return 1;
}

function getWildcardOrderIndex(value) {
  const exactIndex = WILDCARD_PATH_ORDER.indexOf(value);
  if (exactIndex !== -1) {
    return exactIndex;
  }

  const normalized = String(value || '');
  const topLevelMatch = normalized.match(/^\/[^/*]+/);
  if (!topLevelMatch) {
    return -1;
  }

  const topLevelIndex = WILDCARD_PATH_ORDER.indexOf(`${topLevelMatch[0]}/*`);
  if (topLevelIndex !== -1) {
    return topLevelIndex;
  }

  if (normalized.startsWith('/api/')) {
    return WILDCARD_PATH_ORDER.indexOf('/api/*');
  }

  return -1;
}

function byOrder(left, right) {
  const leftType = classifyPathType(left);
  const rightType = classifyPathType(right);
  if (leftType !== rightType) {
    return leftType - rightType;
  }

  if (leftType === 2) {
    const leftIndex = getWildcardOrderIndex(left);
    const rightIndex = getWildcardOrderIndex(right);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right);
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  }

  return left.localeCompare(right);
}

function sortUniquePaths(paths) {
  return [...new Set(paths)].sort(byOrder);
}

function stripTrailingWildcard(value) {
  return String(value || '').endsWith('*')
    ? String(value).slice(0, -1)
    : String(value || '');
}

function isCompressibleViewerPath(value) {
  if (!value || value === '/') {
    return false;
  }

  if (value.startsWith('/_') || value.startsWith('/api/')) {
    return false;
  }

  const normalized = stripTrailingWildcard(value).replace(/\/+$/, '');
  if (!normalized || normalized === '/') {
    return false;
  }

  const leaf = normalized.split('/').pop() || '';
  return !leaf.includes('.');
}

function getViewerPathCompressionCandidates(value) {
  if (!isCompressibleViewerPath(value)) {
    return [];
  }

  const normalized = stripTrailingWildcard(value)
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length < 2) {
    return [];
  }

  return segments
    .slice(0, -1)
    .map((_, index) => `/${segments.slice(0, index + 1).join('/')}/*`);
}

function wildcardCoversPath(wildcardPath, candidatePath) {
  if (!wildcardPath.endsWith('*')) {
    return false;
  }

  const wildcardPrefix = wildcardPath.slice(0, -1);
  const normalizedCandidate = stripTrailingWildcard(candidatePath);
  if (normalizedCandidate === wildcardPrefix.replace(/\/$/, '')) {
    return true;
  }

  return normalizedCandidate.startsWith(wildcardPrefix);
}

function countViewerPathSegments(value) {
  return stripTrailingWildcard(value)
    .split('/')
    .filter(Boolean)
    .length;
}

function compressInvalidationPaths(paths, maxPaths) {
  let currentPaths = sortUniquePaths(paths);
  let compressed = false;

  while (currentPaths.length > maxPaths) {
    const coverageByWildcard = new Map();

    for (const currentPath of currentPaths) {
      for (const wildcardPath of getViewerPathCompressionCandidates(currentPath)) {
        if (!coverageByWildcard.has(wildcardPath)) {
          coverageByWildcard.set(wildcardPath, new Set());
        }

        coverageByWildcard.get(wildcardPath).add(currentPath);
      }
    }

    const candidates = [...coverageByWildcard.entries()]
      .map(([wildcardPath, coveredPaths]) => ({
        coveredPaths: [...coveredPaths].filter((path) => wildcardCoversPath(wildcardPath, path)),
        wildcardPath,
      }))
      .filter(({ coveredPaths, wildcardPath }) => coveredPaths.length >= 2 && !currentPaths.includes(wildcardPath))
      .sort((left, right) => {
        const reductionDelta = (right.coveredPaths.length - left.coveredPaths.length);
        if (reductionDelta !== 0) {
          return reductionDelta;
        }

        const depthDelta = countViewerPathSegments(right.wildcardPath) - countViewerPathSegments(left.wildcardPath);
        if (depthDelta !== 0) {
          return depthDelta;
        }

        return left.wildcardPath.localeCompare(right.wildcardPath);
      });

    const bestCandidate = candidates[0];
    if (!bestCandidate) {
      return {
        compressed,
        paths: currentPaths,
      };
    }

    currentPaths = sortUniquePaths([
      bestCandidate.wildcardPath,
      ...currentPaths.filter((path) => !bestCandidate.coveredPaths.includes(path)),
    ]);
    compressed = true;
  }

  return {
    compressed,
    paths: currentPaths,
  };
}

export function normalizeInvalidationPaths(paths) {
  return sortUniquePaths(
    paths
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .map((value) => value.startsWith('/') ? value : `/${value}`)
  );
}

export const SITE_FULL_INVALIDATION_PATHS = normalizeInvalidationPaths(SITE_FULL_INVALIDATION_PATHS_RAW);

function buildNoInvalidation(reason) {
  return {
    changedCount: 0,
    mode: 'none',
    paths: [],
    reason,
  };
}

function buildFullSiteInvalidation(reason, changedCount) {
  return {
    changedCount,
    mode: 'full',
    paths: SITE_FULL_INVALIDATION_PATHS,
    reason,
  };
}

function isCdnFacingSourcePath(pathname) {
  if (!pathname) {
    return false;
  }

  if (NO_CDN_INVALIDATION_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  return pathname.startsWith('src/') || pathname.startsWith('public/');
}

function isRootPage(pathname) {
  return pathname === 'index.html' || pathname === 'src/pages/index.astro';
}

function needsAstroAssetFlush(sourcePaths, diffPaths) {
  if (diffPaths.some((path) => path.startsWith('_astro/'))) {
    return true;
  }

  return sourcePaths.some((path) =>
    path.startsWith('src/content/') ||
    path.endsWith('.astro') ||
    (path.endsWith('.tsx') && !path.includes('/server/')) ||
    (
      path.startsWith('src/pages/') &&
      !path.startsWith('src/pages/api/') &&
      path.endsWith('.ts')
    )
  );
}

function collapseViewerRoute(route, threshold = BREADCRUMB_THRESHOLD) {
  if (!route || route === '/') {
    return '/';
  }

  if (route.endsWith('*')) {
    return route;
  }

  const segments = route.split('/').filter(Boolean);
  if (segments.length > threshold) {
    return `/${segments.slice(0, threshold).join('/')}*`;
  }

  return route.startsWith('/') ? route : `/${route}`;
}

function mapUnknownDiffPathToWildcard(pathname) {
  const firstSegment = pathname.split('/')[0];
  if (!firstSegment || firstSegment.includes('.')) {
    return null;
  }

  return `/${firstSegment}/*`;
}

function mapSiteDiffPathToViewerPath(pathname) {
  const normalized = normalizePath(pathname);
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('_astro/')) {
    return '/_astro/*';
  }

  if (normalized.startsWith('images/')) {
    return '/images/*';
  }

  if (normalized.startsWith('fonts/')) {
    return '/fonts/*';
  }

  if (normalized === 'robots.txt' || normalized === 'sitemap.xml' || normalized === 'service-worker.js') {
    return `/${normalized}`;
  }

  if (/^manifest.*\.json$/i.test(normalized)) {
    return '/manifest*.json';
  }

  if (normalized === 'index.html') {
    return '/';
  }

  if (normalized.endsWith('/index.html')) {
    return collapseViewerRoute(`/${normalized.slice(0, -'/index.html'.length)}`);
  }

  if (normalized.endsWith('.html')) {
    return collapseViewerRoute(`/${normalized.slice(0, -'.html'.length)}`);
  }

  return mapUnknownDiffPathToWildcard(normalized);
}

function mapSourcePathToInvalidationPath(pathname) {
  if (isRootPage(pathname)) {
    return '/';
  }

  for (const rule of SOURCE_GROUP_RULES) {
    if (rule.prefixes.some((prefix) => pathname.startsWith(prefix))) {
      return rule.path;
    }
  }

  return null;
}

function slugify(segment) {
  return String(segment || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

function inferPagePatternsFromImageKey(key) {
  const parts = normalizePath(key).split('/');
  const patterns = new Set();

  if (parts.length < 3 || parts[0] !== 'images') {
    return [];
  }

  const scope = parts[1];
  const s = (value) => slugify(value);

  if (scope === 'news' || scope === 'guides' || scope === 'tools') {
    if (parts.length >= 5) {
      patterns.add(`/${scope}/${s(parts[2])}/${s(parts[3])}*`);
    }
  } else if (scope === 'reviews') {
    if (parts.length >= 6) {
      patterns.add(`/reviews/${s(parts[2])}/${s(parts[3])}/${s(parts[4])}*`);
    } else if (parts.length >= 5) {
      patterns.add(`/reviews/${s(parts[2])}/${s(parts[3])}*`);
    }
  } else if (scope === 'brands') {
    if (parts.length >= 4) {
      patterns.add(`/brands/${s(parts[2])}*`);
    }
  } else if (scope === 'games') {
    if (parts.length >= 4) {
      patterns.add(`/games/${s(parts[2])}*`);
    }
  } else if (parts.length >= 4) {
    patterns.add(`/images/${s(parts[1])}/${s(parts[2])}/*`);
  }

  return [...patterns];
}

export function buildImageCdnInvalidationPlan({
  maxPaths = DEFAULT_MAX_PATHS,
  s3DiffRows = [],
} = {}) {
  const candidateRows = s3DiffRows.filter((row) => {
    const status = String(row?.status || '').toLowerCase();
    if (status !== 'modified' && status !== 'deleted') {
      return false;
    }

    return normalizePath(row?.path || '').startsWith('images/');
  });

  const paths = sortUniquePaths(
    candidateRows.flatMap((row) => inferPagePatternsFromImageKey(row.path))
  );

  if (paths.length === 0) {
    return buildNoInvalidation('No CDN invalidation is required for the current image change set.');
  }

  const compressedPlan = compressInvalidationPaths(paths, maxPaths);
  if (compressedPlan.paths.length > maxPaths) {
    return {
      changedCount: candidateRows.length,
      mode: 'full',
      paths: ['/images/*'],
      reason: 'The image change set spans too many owning pages.',
    };
  }

  return {
    changedCount: candidateRows.length,
    mode: 'smart',
    paths: compressedPlan.paths,
    reason: compressedPlan.compressed
      ? 'Compressed related image owner pages to stay within the publish invalidation budget.'
      : 'Mapped changed image keys to owning page invalidation patterns.',
  };
}

export function buildCdnInvalidationPlan({
  changedSourcePaths = [],
  maxPaths = DEFAULT_MAX_PATHS,
  s3DiffRows = [],
} = {}) {
  const normalizedSourcePaths = [...new Set(changedSourcePaths.map(normalizePath))];
  const normalizedDiffRows = s3DiffRows.filter((row) => {
    const status = String(row?.status || '').toLowerCase();
    return status === 'modified' || status === 'new' || status === 'deleted';
  });
  const normalizedDiffPaths = [...new Set(normalizedDiffRows.map((row) => normalizePath(row.path)))];
  const changedCount = normalizedSourcePaths.length + normalizedDiffPaths.length;

  if (normalizedSourcePaths.some((path) => FULL_FLUSH_PREFIXES.some((prefix) => path.startsWith(prefix)))) {
    return buildFullSiteInvalidation('Shared layout or app shell changes affect the whole site.', changedCount);
  }

  const sourceCandidates = normalizedSourcePaths.filter(isCdnFacingSourcePath);
  const diffPlannedPaths = sortUniquePaths(
    normalizedDiffPaths
      .map((path) => mapSiteDiffPathToViewerPath(path))
      .filter(Boolean)
  );
  const plannedPaths = new Set(diffPlannedPaths);

  if (diffPlannedPaths.length === 0) {
    for (const path of sourceCandidates) {
      const mapped = mapSourcePathToInvalidationPath(path);
      if (mapped) {
        plannedPaths.add(mapped);
      }
    }
  }

  if (needsAstroAssetFlush(sourceCandidates, normalizedDiffPaths)) {
    plannedPaths.add('/_astro/*');
  }

  const initialPaths = sortUniquePaths([...plannedPaths]);
  if (initialPaths.length === 0) {
    return buildNoInvalidation('No CDN invalidation is required for the current change set.');
  }

  const compressedPlan = compressInvalidationPaths(initialPaths, maxPaths);
  if (compressedPlan.paths.length > maxPaths) {
    return buildFullSiteInvalidation('The change set spans too many CDN viewer paths.', changedCount);
  }

  return {
    changedCount,
    mode: 'smart',
    paths: compressedPlan.paths,
    reason: compressedPlan.compressed
      ? 'Compressed related CDN viewer paths to stay within the publish invalidation budget.'
      : 'Built CDN-facing routes from the static sync diff.',
  };
}
