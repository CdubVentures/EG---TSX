// ─── Pure resolver for per-category image defaults ──────────────────────────
// WHY: Extracted as .mjs so node:test can verify the logic without Astro.
// The gateway (config.ts) composes: JSON import + this resolver.

/**
 * Merge category-specific overrides into global defaults.
 * viewMeta is deep-merged (per-view); all other keys are replaced wholesale.
 *
 * @param {object} globalDefaults - The "defaults" object from image-defaults.json
 * @param {object} categoryOverrides - The "categories" object from image-defaults.json
 * @param {string|null|undefined} category - Category ID (e.g. "mouse")
 * @returns {object} Resolved image defaults for the category
 */
export function resolveImageDefaults(globalDefaults, categoryOverrides, category) {
  // Start with a shallow clone of defaults
  const result = { ...globalDefaults };

  // Deep-clone viewMeta so mutations don't leak
  result.viewMeta = { ...globalDefaults.viewMeta };
  for (const [view, meta] of Object.entries(result.viewMeta)) {
    result.viewMeta[view] = { ...meta };
  }

  // Deep-clone arrays so mutations don't leak
  result.defaultImageView = [...globalDefaults.defaultImageView];
  result.listThumbKeyBase = [...globalDefaults.listThumbKeyBase];
  result.coverImageView = [...globalDefaults.coverImageView];
  result.viewPriority = [...globalDefaults.viewPriority];
  result.headerGame = [...globalDefaults.headerGame];
  result.imageDisplayOptions = globalDefaults.imageDisplayOptions.map(o => ({ ...o }));

  // If no category or category not in overrides, return defaults
  if (!category || !categoryOverrides[category]) return result;

  const overrides = categoryOverrides[category];

  // Merge array keys (replaced wholesale)
  for (const key of ['defaultImageView', 'listThumbKeyBase', 'coverImageView', 'viewPriority', 'headerGame', 'imageDisplayOptions']) {
    if (key in overrides) {
      result[key] = Array.isArray(overrides[key])
        ? overrides[key].map(v => typeof v === 'object' ? { ...v } : v)
        : overrides[key];
    }
  }

  // Deep-merge viewMeta (per-view override)
  if (overrides.viewMeta) {
    for (const [view, meta] of Object.entries(overrides.viewMeta)) {
      result.viewMeta[view] = { ...result.viewMeta[view], ...meta };
    }
  }

  return result;
}

/**
 * Get the objectFit for a specific view in a category.
 * Falls back to 'contain' if the view isn't in viewMeta.
 *
 * @param {object} globalDefaults - The "defaults" object from image-defaults.json
 * @param {object} categoryOverrides - The "categories" object from image-defaults.json
 * @param {string} category - Category ID
 * @param {string} view - View name (e.g. "top", "feature-image")
 * @returns {'contain'|'cover'} The objectFit value
 */
export function resolveViewObjectFit(globalDefaults, categoryOverrides, category, view) {
  const resolved = resolveImageDefaults(globalDefaults, categoryOverrides, category);
  return resolved.viewMeta[view]?.objectFit ?? 'contain';
}
