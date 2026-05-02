/**
 * image-defaults-editor.mjs — Pure functions for image defaults panel state transitions.
 * All functions follow immutable (panel, ...) => panel pattern.
 * .mjs so node --test can import directly without transpilation.
 */

/**
 * Get the target config object for a category (defaults or category override).
 * @param {object} panel
 * @param {string} categoryId - '__defaults__' for globals, else category key
 * @returns {object} The config target (defaults or categories[categoryId])
 */
function getTarget(panel, categoryId) {
  if (categoryId === '__defaults__') return panel.defaults;
  return panel.categories[categoryId] ?? {};
}

/**
 * Set a fallback chain field value.
 * @param {object} panel
 * @param {string} categoryId
 * @param {string} fieldKey - e.g. 'defaultImageView', 'listThumbKeyBase'
 * @param {string[]} value
 * @returns {object} Updated panel
 */
export function setFieldValue(panel, categoryId, fieldKey, value) {
  if (categoryId === '__defaults__') {
    return {
      ...panel,
      defaults: { ...panel.defaults, [fieldKey]: [...value] },
    };
  }
  const catOverride = panel.categories[categoryId] ?? {};
  return {
    ...panel,
    categories: {
      ...panel.categories,
      [categoryId]: { ...catOverride, [fieldKey]: [...value] },
    },
  };
}

/**
 * Reorder an item in viewPriority from one index to another.
 * @param {object} panel
 * @param {string} categoryId
 * @param {number} fromIndex
 * @param {number} toIndex
 * @returns {object} Updated panel
 */
export function reorderPriority(panel, categoryId, fromIndex, toIndex) {
  const target = getTarget(panel, categoryId);
  const priority = target.viewPriority ?? panel.defaults.viewPriority;
  if (fromIndex === toIndex) return panel;
  if (fromIndex < 0 || fromIndex >= priority.length) return panel;
  if (toIndex < 0 || toIndex >= priority.length) return panel;

  const next = [...priority];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);

  if (categoryId === '__defaults__') {
    return { ...panel, defaults: { ...panel.defaults, viewPriority: next } };
  }
  return {
    ...panel,
    categories: {
      ...panel.categories,
      [categoryId]: { ...(panel.categories[categoryId] ?? {}), viewPriority: next },
    },
  };
}

/**
 * Move an item up or down in viewPriority by direction (-1 or +1).
 * @param {object} panel
 * @param {string} categoryId
 * @param {number} index
 * @param {number} direction - -1 for up, +1 for down
 * @returns {object} Updated panel
 */
export function movePriority(panel, categoryId, index, direction) {
  const target = getTarget(panel, categoryId);
  const priority = target.viewPriority ?? panel.defaults.viewPriority;
  const targetIdx = index + direction;
  if (targetIdx < 0 || targetIdx >= priority.length) return panel;
  if (index < 0 || index >= priority.length) return panel;

  const next = [...priority];
  [next[index], next[targetIdx]] = [next[targetIdx], next[index]];

  if (categoryId === '__defaults__') {
    return { ...panel, defaults: { ...panel.defaults, viewPriority: next } };
  }
  return {
    ...panel,
    categories: {
      ...panel.categories,
      [categoryId]: { ...(panel.categories[categoryId] ?? {}), viewPriority: next },
    },
  };
}

/**
 * Remove viewPriority from a category override (reset to global defaults).
 * No-op for __defaults__.
 * @param {object} panel
 * @param {string} categoryId
 * @returns {object} Updated panel
 */
export function resetPriorityToDefaults(panel, categoryId) {
  if (categoryId === '__defaults__') return panel;
  const catOverride = panel.categories[categoryId];
  if (!catOverride || !catOverride.viewPriority) return panel;

  const { viewPriority: _, ...rest } = catOverride;
  return {
    ...panel,
    categories: { ...panel.categories, [categoryId]: rest },
  };
}

/**
 * Set a viewMeta field on a specific view.
 * @param {object} panel
 * @param {string} categoryId
 * @param {string} view - e.g. 'top', 'feature-image'
 * @param {string} field - 'objectFit', 'label', or 'labelShort'
 * @param {string} value
 * @returns {object} Updated panel
 */
export function setViewMetaField(panel, categoryId, view, field, value) {
  if (categoryId === '__defaults__') {
    const viewMeta = { ...panel.defaults.viewMeta };
    viewMeta[view] = { ...(viewMeta[view] ?? {}), [field]: value };
    return { ...panel, defaults: { ...panel.defaults, viewMeta } };
  }

  const catOverride = panel.categories[categoryId] ?? {};
  const catViewMeta = { ...(catOverride.viewMeta ?? {}) };
  catViewMeta[view] = { ...(catViewMeta[view] ?? {}), [field]: value };
  return {
    ...panel,
    categories: {
      ...panel.categories,
      [categoryId]: { ...catOverride, viewMeta: catViewMeta },
    },
  };
}

/**
 * Toggle objectFit between 'contain' and 'cover' for a view.
 * @param {object} panel
 * @param {string} categoryId
 * @param {string} view
 * @returns {object} Updated panel
 */
export function toggleObjectFit(panel, categoryId, view) {
  // Resolve current value
  const resolved = resolveDefaults(panel, categoryId);
  const current = resolved.viewMeta[view]?.objectFit ?? 'contain';
  const next = current === 'contain' ? 'cover' : 'contain';
  return setViewMetaField(panel, categoryId, view, 'objectFit', next);
}

/**
 * Compute fallback chain for display.
 * Returns views sorted by coverage %, excluding primaries.
 * @param {string[]} availableViews - All views that exist in scanner data
 * @param {string[]} primaries - Primary views to exclude from fallback list
 * @param {Record<string, number>} viewCounts - Per-view product counts
 * @param {number} totalProducts - Total product count
 * @returns {Array<{view: string, count: number, coveragePct: number}>}
 */
export function computeFallbacks(availableViews, primaries, viewCounts, totalProducts) {
  const primarySet = new Set(primaries);
  return availableViews
    .filter((v) => !primarySet.has(v))
    .map((view) => {
      const count = viewCounts[view] ?? 0;
      const coveragePct = totalProducts > 0 ? Math.round((count / totalProducts) * 100) : 0;
      return { view, count, coveragePct };
    })
    .sort((a, b) => b.coveragePct - a.coveragePct);
}

/**
 * Deep-merge category overrides onto global defaults.
 * Mirrors the logic in src/core/image-defaults-resolver.mjs.
 * @param {object} panel
 * @param {string} categoryId
 * @returns {object} Resolved config
 */
export function resolveDefaults(panel, categoryId) {
  const defaults = panel.defaults;

  // Deep clone defaults
  const result = { ...defaults };
  result.viewMeta = { ...defaults.viewMeta };
  for (const [view, meta] of Object.entries(result.viewMeta)) {
    result.viewMeta[view] = { ...meta };
  }
  result.defaultImageView = [...defaults.defaultImageView];
  result.listThumbKeyBase = [...defaults.listThumbKeyBase];
  result.coverImageView = [...defaults.coverImageView];
  result.viewPriority = [...defaults.viewPriority];
  result.headerGame = [...defaults.headerGame];
  result.imageDisplayOptions = (defaults.imageDisplayOptions ?? []).map((o) => ({ ...o }));

  if (categoryId === '__defaults__') return result;

  const overrides = panel.categories[categoryId];
  if (!overrides) return result;

  // Array keys: replaced wholesale
  for (const key of ['defaultImageView', 'listThumbKeyBase', 'coverImageView', 'viewPriority', 'headerGame', 'imageDisplayOptions']) {
    if (key in overrides) {
      result[key] = Array.isArray(overrides[key])
        ? overrides[key].map((v) => (typeof v === 'object' ? { ...v } : v))
        : overrides[key];
    }
  }

  // viewMeta: deep-merge per-view
  if (overrides.viewMeta) {
    for (const [view, meta] of Object.entries(overrides.viewMeta)) {
      result.viewMeta[view] = { ...result.viewMeta[view], ...meta };
    }
  }

  return result;
}
