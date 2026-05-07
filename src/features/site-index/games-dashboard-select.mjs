// ─── Games dashboard selector — verbatim port of HBS selectDashboard6 ────────
// WHY: .mjs gateway pattern per AGENTS.md.
// Source: EG-HBS routes/site_index_games.routes.js lines 119-336.
// Behavior: deterministic, day-seeded 3×2 dashboard with editorial pin priority,
// fairness-weighted scoring, and Jaccard name-similarity dedup.

import { slugifyGenre } from './games-helpers.mjs';

// ─── Editorial pin parsing ──────────────────────────────────────────────────

/**
 * @param {unknown} v
 * @returns {{ kind: 'bool' | 'all' | 'slot' | 'genre' | 'none', slot?: number, key?: string }}
 */
function parseDash(v) {
  if (v === true || v === 'true') return { kind: 'bool' };
  if (v == null) return { kind: 'none' };
  const s = String(v).trim().toLowerCase();
  let m = /^all_(?:[1-6])$/.exec(s);
  if (m) return { kind: 'all', slot: Number(s.split('_')[1]) };
  if (/^[1-6]$/.test(s)) return { kind: 'slot', slot: Number(s) };
  m = /^([a-z0-9-_]+)_(?:[1-6])$/.exec(s);
  if (m) return { kind: 'genre', key: m[1], slot: Number(s.split('_')[1]) };
  return { kind: 'none' };
}

// ─── Seeded PRNG + Fisher-Yates shuffle ─────────────────────────────────────

/**
 * mulberry32 — small deterministic PRNG.
 * @param {number} seed
 * @returns {() => number}
 */
function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @template T
 * @param {T[]} arr
 * @param {() => number} rand
 * @returns {T[]}
 */
function seededShuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Name similarity (redundancy penalty) ───────────────────────────────────

function nameTokens(x) {
  const s = String(x?.name || x?.slug || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return new Set(s.split(/\s+/).filter(Boolean));
}

function jaccard(a, b) {
  const A = nameTokens(a);
  const B = nameTokens(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

// ─── Rarity / fairness helpers ──────────────────────────────────────────────

function primaryGenre(game, preferredOrder) {
  const arr = Array.isArray(game.genres) ? game.genres : [];
  if (!arr.length) return '';
  if (Array.isArray(preferredOrder) && preferredOrder.length) {
    for (const k of preferredOrder) if (arr.includes(k)) return k;
  }
  return arr[0];
}

function rarityWeight(game, countsMap) {
  const arr = Array.isArray(game.genres) && game.genres.length ? game.genres : ['misc'];
  let w = 0;
  for (const c of arr) {
    const n = countsMap.get(c) || 0;
    w += n ? 1 / Math.sqrt(n) : 1;
  }
  return w / arr.length;
}

// ─── Day seed (FNV-1a) ──────────────────────────────────────────────────────

/**
 * Builds the day-seeded PRNG seed from `${UTC date}|${seedKey || gen || 'all'}`.
 * Exported for tests so callers can inject a fixed `now` for determinism.
 * @param {string} seedKey
 * @param {string} gen
 * @param {Date} [now]
 * @returns {number}
 */
export function buildDaySeed(seedKey, gen, now = new Date()) {
  const key = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}|${seedKey || gen || 'all'}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ─── Main: select up to 6 tiles for the games dashboard ─────────────────────

/**
 * @param {Array<{ slug: string, name?: string, genres?: string[], iDashboard?: string|null, iFilteredDashboard?: string|null, dashKey?: unknown }>} list
 * @param {{
 *   genreSlug?: string,
 *   countsMap?: Map<string, number>,
 *   preferredOrder?: string[],
 *   seedKey?: string,
 *   now?: Date,
 * }} [opts]
 * @returns {Array<typeof list[number]>}
 */
export function selectDashboard6(list, {
  genreSlug = '',
  countsMap = new Map(),
  preferredOrder = [],
  seedKey = '',
  now,
} = {}) {
  const gen = slugifyGenre(genreSlug || '');
  const inGenre = (g) => !gen || (Array.isArray(g.genres) && g.genres.includes(gen));

  function parseAllIDash(v) {
    if (!v) return 0;
    const m = /^all_(\d)$/.exec(String(v).trim().toLowerCase());
    const n = m ? Number(m[1]) : 0;
    return n >= 1 && n <= 6 ? n : 0;
  }
  function parseFilteredIDash(v) {
    if (!v) return null;
    const s = String(v).trim();
    const m = /^(.+)_(\d)$/.exec(s);
    if (!m) return null;
    const key = slugifyGenre(m[1]);
    const slot = Number(m[2]);
    if (!key || slot < 1 || slot > 6) return null;
    return { key, slot };
  }

  const idashAll = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  const ifilterGen = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  const pinsAll = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  const pinsGen = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  const pinsBool = [];

  for (const g of list) {
    const a = parseAllIDash(g.iDashboard);
    if (a) idashAll[a].push(g);

    const f = parseFilteredIDash(g.iFilteredDashboard);
    if (f && gen && f.key === gen) ifilterGen[f.slot].push(g);

    const p = parseDash(g.dashKey);
    if (p.kind === 'all') pinsAll[p.slot].push(g);
    else if ((p.kind === 'slot' && inGenre(g)) || (p.kind === 'genre' && gen && slugifyGenre(p.key) === gen)) pinsGen[p.slot].push(g);
    else if (p.kind === 'bool' && inGenre(g)) pinsBool.push(g);
  }

  const out = Array(6).fill(null);
  const seen = new Set();
  const usedGenreCounts = new Map();

  function place(slotIdx, arrays) {
    for (const arr of arrays) {
      for (const g of arr) {
        if (!g || seen.has(g.slug)) continue;
        out[slotIdx] = g;
        seen.add(g.slug);
        const pg = primaryGenre(g, preferredOrder);
        usedGenreCounts.set(pg, (usedGenreCounts.get(pg) || 0) + 1);
        return true;
      }
    }
    return false;
  }

  // Pass 1: editorial iDashboard / iFilteredDashboard slots
  if (!gen) {
    for (let i = 1; i <= 6; i++) place(i - 1, [idashAll[i]]);
  } else {
    for (let i = 1; i <= 6; i++) place(i - 1, [ifilterGen[i]]);
  }

  // Pass 2: dashKey slot pins
  if (!gen) {
    for (let i = 1; i <= 6; i++) if (!out[i - 1]) place(i - 1, [pinsAll[i]]);
  } else {
    for (let i = 1; i <= 6; i++) if (!out[i - 1]) place(i - 1, [pinsGen[i]]);
  }

  // Day-seeded PRNG for the rest
  const daySeed = buildDaySeed(seedKey, gen, now);
  const rand = mulberry32(daySeed);

  // Pass 3: bool pins (deterministically shuffled with the same PRNG)
  const shuffledBools = seededShuffle(pinsBool, rand);
  for (let i = 0; i < 6; i++) if (!out[i]) place(i, [shuffledBools]);

  // Pass 4: scored pool (fairness + rarity + Jaccard penalty)
  const pool = list.filter((g) => g && !seen.has(g.slug) && inGenre(g));
  const candidatePool = seededShuffle(pool, rand);
  const distinctGenresTotal = new Set(candidatePool.map((g) => primaryGenre(g, preferredOrder))).size;

  const lambda = 0.7;
  const mu = 0.18;
  const rho = 0.1;

  function scoreOf(gm, chosen) {
    const pg = primaryGenre(gm, preferredOrder);
    const rarity = rarityWeight(gm, countsMap);
    let maxSim = 0;
    for (const y of chosen) maxSim = Math.max(maxSim, jaccard(gm, y));
    const used = usedGenreCounts.get(pg) || 0;
    const supply = countsMap.get(pg) || 1;
    const fairness = 1 - used / Math.max(1, Math.min(6, supply));
    const noise = (rand() - 0.5) * 0.06;
    const relevance = 1.0;
    return (lambda * relevance) + (mu * fairness) + (rho * rarity) + noise - ((1 - lambda) * maxSim);
  }

  const chosenSoFar = out.filter(Boolean);

  for (let s = 0; s < 6; s++) {
    if (out[s]) continue;

    const preferNew = usedGenreCounts.size < Math.min(6, distinctGenresTotal);
    let cand = candidatePool.filter((g) =>
      !seen.has(g.slug) && (!preferNew || !usedGenreCounts.has(primaryGenre(g, preferredOrder))),
    );
    if (!cand.length) cand = candidatePool.filter((g) => !seen.has(g.slug));
    if (!cand.length) break;

    let best = null;
    let bestScore = -Infinity;
    for (const g of cand) {
      const sc = scoreOf(g, chosenSoFar);
      if (sc > bestScore) {
        bestScore = sc;
        best = g;
      }
    }
    if (best) {
      out[s] = best;
      seen.add(best.slug);
      chosenSoFar.push(best);
      const pg = primaryGenre(best, preferredOrder);
      usedGenreCounts.set(pg, (usedGenreCounts.get(pg) || 0) + 1);
    }
  }

  // Final fill: any remaining candidates
  const remaining = candidatePool.filter((g) => !seen.has(g.slug));
  for (let i = 0, j = 0; i < 6 && j < remaining.length; i++) {
    if (!out[i]) {
      out[i] = remaining[j++];
      const pg = primaryGenre(out[i], preferredOrder);
      usedGenreCounts.set(pg, (usedGenreCounts.get(pg) || 0) + 1);
    }
  }

  return out.filter(Boolean).slice(0, 6);
}
