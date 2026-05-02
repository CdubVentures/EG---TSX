/**
 * ads-editor.mjs — Pure functions for Ads panel state transitions.
 * Operates on three configs: registry, inline, and sponsors.
 * All functions follow immutable (data, ...) => data pattern.
 * .mjs so node --test can import directly without transpilation.
 */

const POSITION_NAME_RE = /^[a-z0-9][a-z0-9_\-]*$/;
const SIZE_RE = /^\d+x\d+$/;

// ── Registry functions ──────────────────────────────────────────────────

/**
 * Set a field on the global config.
 * @param {object} registry
 * @param {string} fieldName
 * @param {*} value
 * @returns {object} Updated registry (immutable)
 */
export function setGlobalField(registry, fieldName, value) {
  return {
    ...registry,
    global: {
      ...registry.global,
      [fieldName]: value,
    },
  };
}

/**
 * Set a field on a named position.
 * @param {object} registry
 * @param {string} positionName
 * @param {string} fieldName
 * @param {*} value
 * @returns {object} Updated registry (immutable)
 */
export function setPositionField(registry, positionName, fieldName, value) {
  return {
    ...registry,
    positions: {
      ...registry.positions,
      [positionName]: {
        ...registry.positions[positionName],
        [fieldName]: value,
      },
    },
  };
}

/**
 * Add a new position. Returns null if name is invalid or duplicate.
 * @param {object} registry
 * @param {string} name
 * @param {string} provider
 * @returns {object|null} Updated registry or null
 */
export function addPosition(registry, name, provider) {
  if (!name || !POSITION_NAME_RE.test(name)) {
    return null;
  }
  if (name in registry.positions) {
    return null;
  }
  return {
    ...registry,
    positions: {
      ...registry.positions,
      [name]: {
        provider: provider || 'adsense',
        adSlot: '',
        sizes: '',
        placementType: 'rail',
        display: true,
        notes: '',
      },
    },
  };
}

/**
 * Delete a position by name. No-op when only 1 position remains.
 * @param {object} registry
 * @param {string} positionName
 * @returns {object} Updated registry (immutable)
 */
export function deletePosition(registry, positionName) {
  const names = Object.keys(registry.positions);
  if (names.length <= 1) {
    return registry;
  }
  const { [positionName]: _, ...remaining } = registry.positions;
  return { ...registry, positions: remaining };
}

/**
 * Duplicate a position. Returns null if source doesn't exist or new name is invalid/duplicate.
 * @param {object} registry
 * @param {string} sourceName
 * @param {string} newName
 * @returns {object|null} Updated registry or null
 */
export function duplicatePosition(registry, sourceName, newName) {
  if (!(sourceName in registry.positions)) {
    return null;
  }
  if (!newName || !POSITION_NAME_RE.test(newName)) {
    return null;
  }
  if (newName in registry.positions) {
    return null;
  }
  return {
    ...registry,
    positions: {
      ...registry.positions,
      [newName]: { ...registry.positions[sourceName] },
    },
  };
}

/**
 * Parse a comma-separated sizes string into {width, height} objects.
 * @param {string} sizesStr
 * @returns {{width: number, height: number}[]}
 */
export function parseSizes(sizesStr) {
  if (!sizesStr) {
    return [];
  }
  const result = [];
  for (const s of sizesStr.split(',')) {
    const trimmed = s.trim();
    if (SIZE_RE.test(trimmed)) {
      const [w, h] = trimmed.split('x');
      result.push({ width: Number.parseInt(w, 10), height: Number.parseInt(h, 10) });
    }
  }
  return result;
}

/**
 * Filter position names by case-insensitive substring match.
 * @param {string[]} names
 * @param {string} query
 * @returns {string[]}
 */
export function filterPositions(names, query) {
  if (!query) {
    return [...names];
  }
  const q = query.toLowerCase();
  return names.filter((n) => n.toLowerCase().includes(q));
}

// ── Inline functions ────────────────────────────────────────────────────

/**
 * Set a field on an inline collection config. Supports dotted paths like "desktop.firstAfter".
 * @param {object} inline
 * @param {string} collection
 * @param {string} path
 * @param {*} value
 * @returns {object} Updated inline config (immutable)
 */
export function setInlineCollectionField(inline, collection, path, value) {
  const parts = path.split('.');
  const collectionData = inline.collections[collection];
  if (!collectionData) {
    return inline;
  }

  let updated;
  if (parts.length === 1) {
    updated = { ...collectionData, [parts[0]]: value };

    // WHY: collections like games/brands/pages start with only { enabled: false }.
    // When enabling, initialize cadence defaults so the editor fields appear.
    if (path === 'enabled' && value === true) {
      if (!collectionData.desktop) {
        updated.desktop = { firstAfter: 3, every: 5, max: 8 };
      }
      if (!collectionData.mobile) {
        updated.mobile = { firstAfter: 3, every: 4, max: 10 };
      }
      if (!collectionData.wordScaling) {
        updated.wordScaling = {
          enabled: false,
          desktopWordsPerAd: 450,
          mobileWordsPerAd: 350,
          minFirstAdWords: 150,
        };
      }
    }
  } else {
    const [group, field] = parts;
    updated = {
      ...collectionData,
      [group]: {
        ...collectionData[group],
        [field]: value,
      },
    };
  }

  return {
    ...inline,
    collections: {
      ...inline.collections,
      [collection]: updated,
    },
  };
}

/**
 * Set a field on the inline defaults.
 * @param {object} inline
 * @param {string} fieldName
 * @param {*} value
 * @returns {object} Updated inline config (immutable)
 */
export function setInlineDefaultsField(inline, fieldName, value) {
  return {
    ...inline,
    defaults: {
      ...inline.defaults,
      [fieldName]: value,
    },
  };
}

/**
 * Calculate number of inline ads for desktop and mobile.
 * Parity with calculate_inline_ads() in config/panels/ads.py.
 * @param {number} wordCount
 * @param {object} cfg - Collection config
 * @returns {{desktop: number, mobile: number}}
 */
export function calculateInlineAds(wordCount, cfg) {
  const desktopCfg = cfg.desktop || {};
  const mobileCfg = cfg.mobile || {};
  const scaling = cfg.wordScaling;

  let dCount = 0;
  let mCount = 0;

  if (desktopCfg.max !== undefined) {
    const wpa = (scaling || {}).desktopWordsPerAd || 0;
    const maxD = desktopCfg.max ?? 8;
    if (scaling && scaling.enabled && wpa > 0) {
      dCount = Math.min(Math.floor(wordCount / wpa), maxD);
    } else {
      const paras = Math.max(1, Math.floor(wordCount / 100));
      const first = desktopCfg.firstAfter ?? 3;
      const every = desktopCfg.every ?? 5;
      if (paras > first && every > 0) {
        dCount = Math.min(1 + Math.floor((paras - first - 1) / every), maxD);
      }
    }
  }

  if (mobileCfg.max !== undefined) {
    const wpa = (scaling || {}).mobileWordsPerAd || 0;
    const maxM = mobileCfg.max ?? 10;
    if (scaling && scaling.enabled && wpa > 0) {
      mCount = Math.min(Math.floor(wordCount / wpa), maxM);
    } else {
      const paras = Math.max(1, Math.floor(wordCount / 100));
      const first = mobileCfg.firstAfter ?? 3;
      const every = mobileCfg.every ?? 4;
      if (paras > first && every > 0) {
        mCount = Math.min(1 + Math.floor((paras - first - 1) / every), maxM);
      }
    }
  }

  return { desktop: dCount, mobile: mCount };
}

// ── Sponsors functions ──────────────────────────────────────────────────

/**
 * Add a new creative with defaults to a position.
 * @param {object} sponsors
 * @param {string} positionName
 * @returns {object} Updated sponsors (immutable)
 */
export function addCreative(sponsors, positionName) {
  const existing = sponsors.creatives[positionName] || [];
  const newCreative = {
    label: '',
    img: '',
    href: '',
    width: 300,
    height: 250,
    weight: 0,
    startDate: '',
    endDate: '',
    rel: 'nofollow sponsored noopener',
    alt: '',
  };
  return {
    ...sponsors,
    creatives: {
      ...sponsors.creatives,
      [positionName]: [...existing, newCreative],
    },
  };
}

/**
 * Delete a creative by index from a position.
 * @param {object} sponsors
 * @param {string} positionName
 * @param {number} index
 * @returns {object} Updated sponsors (immutable)
 */
export function deleteCreative(sponsors, positionName, index) {
  const existing = sponsors.creatives[positionName];
  if (!existing) {
    return sponsors;
  }
  return {
    ...sponsors,
    creatives: {
      ...sponsors.creatives,
      [positionName]: existing.filter((_, i) => i !== index),
    },
  };
}

/**
 * Set a field on a creative by position and index.
 * @param {object} sponsors
 * @param {string} positionName
 * @param {number} index
 * @param {string} fieldName
 * @param {*} value
 * @returns {object} Updated sponsors (immutable)
 */
export function setCreativeField(sponsors, positionName, index, fieldName, value) {
  const existing = sponsors.creatives[positionName];
  if (!existing) {
    return sponsors;
  }
  return {
    ...sponsors,
    creatives: {
      ...sponsors.creatives,
      [positionName]: existing.map((creative, i) =>
        i === index ? { ...creative, [fieldName]: value } : creative,
      ),
    },
  };
}

/**
 * Normalize weights for all creatives in a position to sum to 100.
 * Parity with normalize_weights() in config/panels/ads.py.
 * @param {object} sponsors
 * @param {string} positionName
 * @returns {object} Updated sponsors (immutable)
 */
export function normalizeWeights(sponsors, positionName) {
  const existing = sponsors.creatives[positionName];
  if (!existing || existing.length === 0) {
    return sponsors;
  }

  const weights = existing.map((c) => c.weight || 0);
  const total = weights.reduce((sum, w) => sum + w, 0);

  let normalized;
  if (total === 0) {
    const equal = Math.round((100 / existing.length) * 10) / 10;
    normalized = weights.map(() => equal);
  } else {
    normalized = weights.map((w) => Math.round((w / total) * 1000) / 10);
  }

  return {
    ...sponsors,
    creatives: {
      ...sponsors.creatives,
      [positionName]: existing.map((creative, i) => ({
        ...creative,
        weight: normalized[i],
      })),
    },
  };
}

/**
 * Get creative status based on date range.
 * @param {object} creative
 * @returns {"active" | "scheduled" | "expired"}
 */
export function getCreativeStatus(creative) {
  const today = new Date().toISOString().slice(0, 10);
  const start = creative.startDate || '';
  const end = creative.endDate || '';

  if (start && today < start) {
    return 'scheduled';
  }
  if (end && today > end) {
    return 'expired';
  }
  return 'active';
}
