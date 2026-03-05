import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Score formatting logic (extracted for testability) ──────────────────────
// These functions mirror what DexaBadge.astro computes at build time.
// We import from a shared module so the component and tests share one source of truth.
import {
  formatScore,
  scoreLetterSpacing,
  makeGradientId,
} from '../src/shared/ui/dexa-badge-logic.mjs';

// ═══════════════════════════════════════════════════════════════════════════════
// Contract: formatScore(score) → { text: string, render: boolean }
// ═══════════════════════════════════════════════════════════════════════════════
describe('formatScore', () => {
  it('formats decimal scores to one decimal place', () => {
    const result = formatScore(8.5);
    assert.equal(result.text, '8.5');
    assert.equal(result.render, true);
  });

  it('formats integer scores with one decimal (except 10)', () => {
    const result = formatScore(7);
    assert.equal(result.text, '7.0');
    assert.equal(result.render, true);
  });

  it('formats score of 10 as "10" (no decimal)', () => {
    const result = formatScore(10);
    assert.equal(result.text, '10');
    assert.equal(result.render, true);
  });

  it('formats score of 0 as "0.0"', () => {
    const result = formatScore(0);
    assert.equal(result.text, '0.0');
    assert.equal(result.render, true);
  });

  it('handles string score "8.5"', () => {
    const result = formatScore('8.5');
    assert.equal(result.text, '8.5');
    assert.equal(result.render, true);
  });

  it('handles string score "10"', () => {
    const result = formatScore('10');
    assert.equal(result.text, '10');
    assert.equal(result.render, true);
  });

  it('returns render=false for empty string', () => {
    const result = formatScore('');
    assert.equal(result.render, false);
  });

  it('returns render=false for null', () => {
    const result = formatScore(null);
    assert.equal(result.render, false);
  });

  it('returns render=false for undefined', () => {
    const result = formatScore(undefined);
    assert.equal(result.render, false);
  });

  it('returns render=false for NaN', () => {
    const result = formatScore(NaN);
    assert.equal(result.render, false);
  });

  it('returns render=false for non-numeric string', () => {
    const result = formatScore('N/A');
    assert.equal(result.render, false);
  });

  it('handles 9.99 → "10.0" (rounding edge)', () => {
    // toFixed(1) rounds 9.99 → "10.0", but value !== 10
    const result = formatScore(9.99);
    assert.equal(result.text, '10.0');
    assert.equal(result.render, true);
  });

  it('handles 0.1 correctly', () => {
    const result = formatScore(0.1);
    assert.equal(result.text, '0.1');
    assert.equal(result.render, true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Contract: scoreLetterSpacing(score) → CSS letter-spacing string
// ═══════════════════════════════════════════════════════════════════════════════
describe('scoreLetterSpacing', () => {
  it('returns "letter-spacing:1.75px" for score 10', () => {
    assert.equal(scoreLetterSpacing(10), 'letter-spacing:1.75px');
  });

  it('returns "letter-spacing:1.75px" for string "10"', () => {
    assert.equal(scoreLetterSpacing('10'), 'letter-spacing:1.75px');
  });

  it('returns empty string for score 8.5 (default CSS handles it)', () => {
    assert.equal(scoreLetterSpacing(8.5), '');
  });

  it('returns empty string for score 0', () => {
    assert.equal(scoreLetterSpacing(0), '');
  });

  it('returns empty string for score 9', () => {
    assert.equal(scoreLetterSpacing(9), '');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Contract: makeGradientId() → unique string ID per call
// ═══════════════════════════════════════════════════════════════════════════════
describe('makeGradientId', () => {
  it('returns a string starting with "dexaGrad-"', () => {
    const id = makeGradientId();
    assert.match(id, /^dexaGrad-/);
  });

  it('returns unique IDs across multiple calls', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(makeGradientId());
    }
    assert.equal(ids.size, 100, 'Expected 100 unique gradient IDs');
  });

  it('returns a non-empty string', () => {
    const id = makeGradientId();
    assert.ok(id.length > 'dexaGrad-'.length);
  });
});
