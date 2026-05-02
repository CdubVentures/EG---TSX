/**
 * cache-cdn-editor.mjs — Pure functions for Cache/CDN panel state transitions.
 * All functions follow immutable (config, ...) => config pattern.
 * .mjs so node --test can import directly without transpilation.
 */

const POLICY_NAMES = [
  'staticPages', 'hubPages', 'staticAssets', 'images', 'searchApi', 'dynamicApis',
];

const PAGE_TYPE_NAMES = [
  'sitePages', 'hubPages', 'staticAssets', 'images', 'searchApi',
  'authAndSession', 'userData', 'apiFallback',
];

/**
 * Set a field on a named policy.
 * @param {object} config
 * @param {string} policyName
 * @param {string} fieldName
 * @param {*} value
 * @returns {object} Updated config (immutable)
 */
export function setPolicyField(config, policyName, fieldName, value) {
  return {
    ...config,
    policies: {
      ...config.policies,
      [policyName]: {
        ...config.policies[policyName],
        [fieldName]: value,
      },
    },
  };
}

/**
 * Set a field on a named page type.
 * @param {object} config
 * @param {string} pageTypeName
 * @param {string} fieldName
 * @param {*} value
 * @returns {object} Updated config (immutable)
 */
export function setPageTypeField(config, pageTypeName, fieldName, value) {
  return {
    ...config,
    pageTypes: {
      ...config.pageTypes,
      [pageTypeName]: {
        ...config.pageTypes[pageTypeName],
        [fieldName]: value,
      },
    },
  };
}

/**
 * Set a field on a target by index.
 * @param {object} config
 * @param {number} targetIndex
 * @param {string} fieldName
 * @param {*} value
 * @returns {object} Updated config (immutable)
 */
export function setTargetField(config, targetIndex, fieldName, value) {
  const targets = config.targets.map((target, i) =>
    i === targetIndex ? { ...target, [fieldName]: value } : target,
  );
  return { ...config, targets };
}

/**
 * Append a new target with defaults and a unique id.
 * @param {object} config
 * @returns {object} Updated config (immutable)
 */
export function addTarget(config) {
  const nextIndex = config.targets.length + 1;
  const existingIds = new Set(config.targets.map((t) => t.id));
  let id = `new-target-${nextIndex}`;
  let counter = nextIndex;
  while (existingIds.has(id)) {
    counter += 1;
    id = `new-target-${counter}`;
  }

  const newTarget = {
    id,
    label: `New Target ${counter}`,
    pathPatterns: ['/new-path/*'],
    pageType: 'sitePages',
  };

  return {
    ...config,
    targets: [...config.targets, newTarget],
  };
}

/**
 * Delete a target by index. No-op when only 1 target remains.
 * @param {object} config
 * @param {number} targetIndex
 * @returns {object} Updated config (immutable)
 */
export function deleteTarget(config, targetIndex) {
  if (config.targets.length <= 1) {
    return config;
  }
  return {
    ...config,
    targets: config.targets.filter((_, i) => i !== targetIndex),
  };
}

/**
 * Coerce a value to a non-negative integer.
 * @param {*} value
 * @param {number} defaultValue
 * @returns {number}
 */
export function coerceInt(value, defaultValue = 0) {
  const str = String(value).trim();
  const parsed = Number.parseInt(str, 10);
  if (Number.isNaN(parsed)) {
    return defaultValue;
  }
  return Math.max(0, parsed);
}

/**
 * Clean a header value into an array of trimmed, non-empty strings.
 * Accepts comma-separated string or array.
 * @param {string|string[]} value
 * @returns {string[]}
 */
export function cleanHeaders(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(',');
  return items.map((item) => String(item).trim()).filter(Boolean);
}

/**
 * Clean a patterns value into an array of trimmed, non-empty strings.
 * Accepts newline-separated string or array.
 * @param {string|string[]} value
 * @returns {string[]}
 */
export function cleanPatterns(value) {
  const items = Array.isArray(value) ? value : String(value || '').split('\n');
  return items.map((item) => String(item).trim()).filter(Boolean);
}

/**
 * Build the Cache-Control preview string for a single policy object.
 * Must match buildCacheControlHeader() in src/core/cache-cdn-contract.ts
 * and build_policy_preview() in config/panels/cache_cdn.py.
 * @param {object} policy
 * @returns {string}
 */
export function buildPolicyPreview(policy) {
  if (policy.noStore) {
    return 'no-store';
  }

  const parts = [
    'public',
    `max-age=${Number.parseInt(String(policy.browserMaxAge ?? 0), 10)}`,
    `s-maxage=${Number.parseInt(String(policy.edgeMaxAge ?? 0), 10)}`,
  ];

  const stale = Number.parseInt(String(policy.staleWhileRevalidate ?? 0), 10);
  if (stale > 0) {
    parts.push(`stale-while-revalidate=${stale}`);
  }

  if (policy.mustRevalidate) {
    parts.push('must-revalidate');
  }

  if (policy.immutable) {
    parts.push('immutable');
  }

  return parts.join(', ');
}

/**
 * Build the full preview text for the entire config.
 * Matches the Tk _refresh_preview() output format.
 * @param {object} config
 * @returns {string}
 */
export function buildPreviewText(config) {
  const lines = ['Document Types', ''];

  for (const policyName of POLICY_NAMES) {
    const policy = config.policies[policyName];
    lines.push(`${policyName}: ${buildPolicyPreview(policy)}`);
    const headers = (policy.varyHeaders ?? []).join(', ') || 'none';
    lines.push(`  varyQuery=${policy.varyQuery} varyHeaders=${headers}`);
  }

  lines.push('', 'Page Types', '');

  for (const pageTypeName of PAGE_TYPE_NAMES) {
    const pageType = config.pageTypes[pageTypeName];
    const patterns = listPageTypeTargets(config, pageTypeName);
    lines.push(`${pageTypeName}: ${pageType.policy}  -  ${pageType.label}`);
    lines.push(`  routes=${patterns.length > 0 ? patterns.join(', ') : 'none'}`);
  }

  return lines.join('\n');
}

/**
 * Audit the config for validation issues.
 * Returns human-readable issue strings. Empty array = clean.
 * Matches audit_cache_cdn_config() in config/panels/cache_cdn.py.
 * @param {object} config
 * @returns {string[]}
 */
export function auditConfig(config) {
  const issues = [];
  const policies = config.policies ?? {};
  const pageTypes = config.pageTypes ?? {};
  const targets = config.targets ?? [];
  const seenPatterns = {};

  for (const [policyName, policy] of Object.entries(policies)) {
    if (
      policy.noStore &&
      (coerceInt(policy.browserMaxAge) !== 0 ||
        coerceInt(policy.edgeMaxAge) !== 0 ||
        coerceInt(policy.staleWhileRevalidate) !== 0)
    ) {
      issues.push(`${policyName}: no-store policies must use zero TTLs.`);
    }
    if (policy.noStore && policy.immutable) {
      issues.push(`${policyName}: no-store policies cannot be immutable.`);
    }
    if (policy.noStore && policy.mustRevalidate) {
      issues.push(`${policyName}: no-store policies cannot require revalidation.`);
    }
    if (
      !policy.noStore &&
      !policy.immutable &&
      coerceInt(policy.browserMaxAge) === 0 &&
      coerceInt(policy.edgeMaxAge) > 0 &&
      !policy.mustRevalidate
    ) {
      issues.push(
        `${policyName}: browser-revalidated public policies should set must-revalidate when browser TTL is zero.`,
      );
    }
  }

  for (const [pageTypeName, pageType] of Object.entries(pageTypes)) {
    if (!(pageType.policy in policies)) {
      issues.push(`${pageTypeName}: unknown policy '${pageType.policy}'.`);
    }
  }

  for (const target of targets) {
    const targetId = String(target.id ?? '?');
    const pageType = String(target.pageType ?? '');
    if (!(pageType in pageTypes)) {
      issues.push(`${targetId}: unknown page type '${pageType}'.`);
    }
    for (const pattern of cleanPatterns(target.pathPatterns ?? [])) {
      if (pattern in seenPatterns) {
        issues.push(
          `Duplicate path pattern "${pattern}" in ${seenPatterns[pattern]} and ${targetId}.`,
        );
        continue;
      }
      seenPatterns[pattern] = targetId;
    }
  }

  return issues;
}

/**
 * Return all path patterns currently assigned to a page type.
 * @param {object} config
 * @param {string} pageTypeName
 * @returns {string[]}
 */
export function listPageTypeTargets(config, pageTypeName) {
  return (config.targets ?? [])
    .filter((target) => target.pageType === pageTypeName)
    .flatMap((target) => target.pathPatterns ?? []);
}
