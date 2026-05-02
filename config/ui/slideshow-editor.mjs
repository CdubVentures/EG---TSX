/**
 * slideshow-editor.mjs — Pure functions for slideshow panel state transitions.
 * All functions follow immutable (panel) => panel pattern.
 * .mjs so node --test can import directly without transpilation.
 */

const MIN_AUTOFILL_SCORE = 8.0;
const MAX_PER_CAT = 3;

export function parseReleaseDate(raw) {
  if (!raw || typeof raw !== 'string') return [0, 0];
  const trimmed = raw.trim();
  const parts = trimmed.split('/');
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const y = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(y)) return [y, m];
  }
  const year = parseInt(trimmed, 10);
  if (!isNaN(year)) return [year, 0];
  return [0, 0];
}

export function addToQueue(panel, entryId, position) {
  if (panel.slides.includes(entryId)) return panel;
  if (panel.slides.length >= panel.maxSlides) return panel;
  const slides = [...panel.slides];
  if (position !== undefined && position >= 0 && position <= slides.length) {
    slides.splice(position, 0, entryId);
  } else {
    slides.push(entryId);
  }
  return { ...panel, slides };
}

export function removeFromQueue(panel, entryId) {
  const idx = panel.slides.indexOf(entryId);
  if (idx === -1) return panel;
  const slides = [...panel.slides];
  slides.splice(idx, 1);
  return { ...panel, slides };
}

export function reorderQueue(panel, fromIndex, toIndex) {
  if (fromIndex === toIndex) return panel;
  if (fromIndex < 0 || fromIndex >= panel.slides.length) return panel;
  if (toIndex < 0 || toIndex >= panel.slides.length) return panel;
  const slides = [...panel.slides];
  const [item] = slides.splice(fromIndex, 1);
  slides.splice(toIndex, 0, item);
  return { ...panel, slides };
}

export function moveInQueue(panel, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= panel.slides.length) return panel;
  if (index < 0 || index >= panel.slides.length) return panel;
  const slides = [...panel.slides];
  [slides[index], slides[target]] = [slides[target], slides[index]];
  return { ...panel, slides };
}

export function setMaxSlides(panel, max) {
  const clamped = Math.max(1, Math.min(20, max));
  const slides = panel.slides.length > clamped
    ? panel.slides.slice(0, clamped)
    : [...panel.slides];
  return { ...panel, maxSlides: clamped, slides };
}

export function clearQueue(panel) {
  return { ...panel, slides: [] };
}

export function autoFill(panel) {
  const slides = [...panel.slides];
  const remaining = panel.maxSlides - slides.length;
  if (remaining <= 0) return panel;

  const queueSet = new Set(slides);
  const eligible = panel.products
    .filter(p => !queueSet.has(p.entryId) && p.overall >= MIN_AUTOFILL_SCORE);

  eligible.sort((a, b) => {
    const dealA = a.hasDeal ? 0 : 1;
    const dealB = b.hasDeal ? 0 : 1;
    if (dealA !== dealB) return dealA - dealB;

    const [yearA, monthA] = parseReleaseDate(a.releaseDate);
    const [yearB, monthB] = parseReleaseDate(b.releaseDate);
    if (yearA !== yearB) return yearB - yearA;
    if (monthA !== monthB) return monthB - monthA;

    return b.overall - a.overall;
  });

  const catCounts = {};
  let added = 0;

  for (const p of eligible) {
    if (added >= remaining) break;
    const count = catCounts[p.category] || 0;
    if (count >= MAX_PER_CAT) continue;
    slides.push(p.entryId);
    catCounts[p.category] = count + 1;
    added += 1;
  }

  return { ...panel, slides };
}
