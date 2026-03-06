// ─── Pure dashboard algorithm — no Astro / import.meta.env dependencies ──────
// WHY: Extracted so node:test can verify the logic without Astro's module system.
// The gateway (dashboard.ts) composes: JSON import + Zod parse + this filter.
// Same pattern as hub-tools-filter.mjs.

export const NUM_SLOTS = 15;

/** Composite key: "{_collection}:{id}" — matches dashboard.json format. */
export function entryKey(entry) {
  return `${entry._collection}:${entry.id}`;
}

/** Newest of datePublished / dateUpdated as epoch ms (0 if both null). */
export function newestDate(entry) {
  const pub = entry.data.datePublished?.getTime?.() ?? 0;
  const upd = entry.data.dateUpdated?.getTime?.() ?? 0;
  return Math.max(pub, upd);
}

/**
 * Split badge text into [line1, line2] for the EditorsBadge component.
 * Port of HBS splitBadge(). Defaults to "Top Pick" for empty/null input.
 * @param {string | null | undefined} text
 * @param {string} [delimiter=' ']
 * @returns {[string, string]}
 */
export function splitBadge(text, delimiter = ' ') {
  const textToSplit = text && text.trim() ? text : 'Top Pick';
  const words = textToSplit.split(delimiter);
  while (words.length < 2) words.push('');
  return [words[0], words[1]];
}

/**
 * Build the 15-slot dashboard from all article entries + editorial config.
 *
 * Algorithm (port of simulate_dashboard() from dashboard-manager.pyw):
 * 1. Build key map: {collection}:{entryId} → entry
 * 2. Filter eligible: has hero, not in excluded
 * 3. Place manual overrides from config.slots into their 1-indexed positions
 * 4. Fill remaining slots with eligible entries sorted by newest date descending
 * 5. Wrap each with DashboardMeta (isPinned, badgeText)
 *
 * @param {Array} allEntries
 * @param {object} [config]
 * @returns {Array<{entry: object, meta: {isPinned: boolean, badgeText: string|null}}>}
 */
export function buildDashboard(allEntries, config) {
  const cfg = config ?? { slots: {}, pinned: [], badges: {}, excluded: [] };
  const excludedSet = new Set(cfg.excluded ?? []);

  // Build key → entry map
  const keyMap = new Map();
  for (const entry of allEntries) {
    keyMap.set(entryKey(entry), entry);
  }

  // Filter eligible: has hero, not excluded
  const eligible = allEntries.filter(
    (e) => e.data.hero && !excludedSet.has(entryKey(e))
  );

  const slots = new Array(NUM_SLOTS).fill(null);
  const used = new Set();

  // Place manual overrides (1-indexed in config)
  for (const [slotStr, ref] of Object.entries(cfg.slots ?? {})) {
    const slotNum = parseInt(slotStr, 10);
    if (!(slotNum >= 1 && slotNum <= NUM_SLOTS)) continue;
    const key = `${ref.collection}:${ref.id}`;
    if (excludedSet.has(key)) continue;
    const entry = keyMap.get(key);
    if (!entry) continue;
    slots[slotNum - 1] = entry;
    used.add(key);
  }

  // Sort remaining eligible by date descending
  const remaining = eligible
    .filter((e) => !used.has(entryKey(e)))
    .sort((a, b) => newestDate(b) - newestDate(a));

  // Fill empty slots
  let ri = 0;
  for (let i = 0; i < NUM_SLOTS; i++) {
    if (slots[i] === null && ri < remaining.length) {
      slots[i] = remaining[ri];
      used.add(entryKey(remaining[ri]));
      ri++;
    }
  }

  // Build enriched result (filter out null slots)
  const pinnedSet = new Set(cfg.pinned ?? []);
  const badgesMap = cfg.badges ?? {};

  return slots
    .filter((entry) => entry !== null)
    .map((entry) => {
      const key = entryKey(entry);
      return {
        entry,
        meta: {
          isPinned: pinnedSet.has(key),
          badgeText: badgesMap[key] ?? null,
        },
      };
    });
}
