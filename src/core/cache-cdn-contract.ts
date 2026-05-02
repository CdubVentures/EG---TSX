import { z } from 'zod';

import cacheCdnData from '../../config/data/cache-cdn.json' with { type: 'json' };

export const CACHE_POLICY_NAMES = [
  'staticPages',
  'hubPages',
  'staticAssets',
  'images',
  'searchApi',
  'dynamicApis',
] as const;

export const CACHE_PAGE_TYPE_NAMES = [
  'sitePages',
  'hubPages',
  'staticAssets',
  'images',
  'searchApi',
  'authAndSession',
  'userData',
  'apiFallback',
] as const;

const INVALIDATION_GROUPS = [
  'pages',
  'hubs',
  'assets',
  'images',
  'api-search',
  'dynamic',
] as const;

const cachePolicyNameSchema = z.enum(CACHE_POLICY_NAMES);
const cachePageTypeNameSchema = z.enum(CACHE_PAGE_TYPE_NAMES);
const invalidationGroupSchema = z.enum(INVALIDATION_GROUPS);
const varyQuerySchema = z.enum(['none', 'all']);

const cachePolicySchema = z.object({
  browserMaxAge: z.number().int().nonnegative(),
  edgeMaxAge: z.number().int().nonnegative(),
  staleWhileRevalidate: z.number().int().nonnegative(),
  mustRevalidate: z.boolean(),
  immutable: z.boolean(),
  noStore: z.boolean(),
  varyQuery: varyQuerySchema,
  varyHeaders: z.array(z.string().min(1)),
  invalidationGroup: invalidationGroupSchema,
}).superRefine((value, context) => {
  if (value.noStore) {
    if (value.browserMaxAge !== 0 || value.edgeMaxAge !== 0 || value.staleWhileRevalidate !== 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'noStore policies must zero browserMaxAge, edgeMaxAge, and staleWhileRevalidate',
      });
    }

    if (value.immutable) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'noStore policies cannot be immutable',
      });
    }

    if (value.mustRevalidate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'noStore policies cannot require revalidation',
      });
    }
  }

  if (
    !value.noStore &&
    !value.immutable &&
    value.browserMaxAge === 0 &&
    value.edgeMaxAge > 0 &&
    !value.mustRevalidate
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'browser-revalidated public policies must set mustRevalidate when browserMaxAge is zero',
    });
  }
});

const cacheTargetSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  pathPatterns: z.array(z.string().min(1)).min(1),
  pageType: cachePageTypeNameSchema,
});

const cachePageTypeSchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
  policy: cachePolicyNameSchema,
});

const cacheCdnContractSchema = z.object({
  policies: z.object({
    staticPages: cachePolicySchema,
    hubPages: cachePolicySchema,
    staticAssets: cachePolicySchema,
    images: cachePolicySchema,
    searchApi: cachePolicySchema,
    dynamicApis: cachePolicySchema,
  }),
  pageTypes: z.object({
    sitePages: cachePageTypeSchema,
    hubPages: cachePageTypeSchema,
    staticAssets: cachePageTypeSchema,
    images: cachePageTypeSchema,
    searchApi: cachePageTypeSchema,
    authAndSession: cachePageTypeSchema,
    userData: cachePageTypeSchema,
    apiFallback: cachePageTypeSchema,
  }),
  targets: z.array(cacheTargetSchema).min(1),
}).superRefine((value, context) => {
  const seenTargetIds = new Set<string>();

  value.targets.forEach((target, index) => {
    if (seenTargetIds.has(target.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate target id "${target.id}"`,
        path: ['targets', index, 'id'],
      });
      return;
    }

    seenTargetIds.add(target.id);
  });
});

export type CachePolicyName = z.infer<typeof cachePolicyNameSchema>;
export type CachePageTypeName = z.infer<typeof cachePageTypeNameSchema>;
export type CachePolicy = z.infer<typeof cachePolicySchema>;
export type CachePageType = z.infer<typeof cachePageTypeSchema>;
export type CacheTarget = z.infer<typeof cacheTargetSchema>;
export type CacheCdnContract = z.infer<typeof cacheCdnContractSchema>;

export const CACHE_CDN_CONTRACT = cacheCdnContractSchema.parse(cacheCdnData);

export function getCachePolicy(policyName: CachePolicyName): CachePolicy {
  return CACHE_CDN_CONTRACT.policies[policyName];
}

export function getCachePageType(pageTypeName: CachePageTypeName): CachePageType {
  return CACHE_CDN_CONTRACT.pageTypes[pageTypeName];
}

export function getPageTypePolicyName(pageTypeName: CachePageTypeName): CachePolicyName {
  return getCachePageType(pageTypeName).policy;
}

export function resolveTargetPolicyName(targetId: string): CachePolicyName {
  const target = CACHE_CDN_CONTRACT.targets.find((entry) => entry.id === targetId);
  if (!target) {
    throw new Error(`Unknown cache target id: ${targetId}`);
  }

  return getPageTypePolicyName(target.pageType);
}

export function buildCacheControlHeader(policyName: CachePolicyName): string {
  const policy = getCachePolicy(policyName);

  if (policy.noStore) {
    return 'no-store';
  }

  const parts = [
    'public',
    `max-age=${policy.browserMaxAge}`,
    `s-maxage=${policy.edgeMaxAge}`,
  ];

  if (policy.staleWhileRevalidate > 0) {
    parts.push(`stale-while-revalidate=${policy.staleWhileRevalidate}`);
  }

  if (policy.mustRevalidate) {
    parts.push('must-revalidate');
  }

  if (policy.immutable) {
    parts.push('immutable');
  }

  return parts.join(', ');
}

export function withCachePolicyHeaders(
  policyName: CachePolicyName,
  headersInit: HeadersInit = {},
): Headers {
  const headers = new Headers(headersInit);
  const policy = getCachePolicy(policyName);

  headers.set('Cache-Control', buildCacheControlHeader(policyName));

  if (policy.varyHeaders.length > 0) {
    headers.set('Vary', policy.varyHeaders.join(', '));
  }

  return headers;
}
