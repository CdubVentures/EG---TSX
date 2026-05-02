function clampOffset(offset, length) {
  if (!Number.isFinite(length) || length <= 0) return 0;
  return ((offset % length) + length) % length;
}

function stableHash(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function rotateCreatives(creatives, offset) {
  if (!Array.isArray(creatives) || creatives.length === 0) return [];

  const start = clampOffset(offset, creatives.length);
  if (start === 0) return [...creatives];

  return [...creatives.slice(start), ...creatives.slice(0, start)];
}

function getPreferredOffset(slotKey, length) {
  const normalizedKey = String(slotKey || '').toLowerCase();
  const slotHints = [
    ['sidebar_sticky', 1],
    ['sticky', 1],
    ['sidebar', 0],
    ['in_content', 2],
    ['inline', 2],
    ['anchor', 3],
    ['footer', 4],
    ['header', 5],
  ];

  for (const [token, offset] of slotHints) {
    if (normalizedKey.includes(token)) {
      return clampOffset(offset, length);
    }
  }

  return stableHash(normalizedKey || 'sample-slot') % length;
}

export function createSampleSlotPlan({ slotKey, creatives }) {
  const safeCreatives = Array.isArray(creatives) ? creatives.filter(Boolean) : [];
  if (safeCreatives.length === 0) {
    return {
      startIndex: 0,
      creatives: [],
      initialCreative: undefined,
    };
  }

  const rotationOffset = getPreferredOffset(slotKey, safeCreatives.length);
  const rotatedCreatives = rotateCreatives(safeCreatives, rotationOffset);

  return {
    startIndex: 0,
    creatives: rotatedCreatives,
    initialCreative: rotatedCreatives[0],
  };
}

export function getSampleRefreshPlan({ placementType, sticky }) {
  if (sticky) {
    return {
      minMs: 30000,
      maxMs: 50000,
      maxRefreshes: 4,
    };
  }

  if (placementType === 'inline') {
    return {
      minMs: 60000,
      maxMs: 105000,
      maxRefreshes: 1,
    };
  }

  return {
    minMs: 45000,
    maxMs: 75000,
    maxRefreshes: 2,
  };
}

export function getSampleRefreshWindow(options) {
  const plan = getSampleRefreshPlan(options);
  return {
    minMs: plan.minMs,
    maxMs: plan.maxMs,
  };
}
