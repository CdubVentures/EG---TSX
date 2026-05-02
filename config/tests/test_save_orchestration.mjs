/**
 * test_save_orchestration.mjs — Tests for global save orchestration helpers.
 * Runner: node --test config/tests/test_save_orchestration.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PANEL_ORDER, buildSaveQueue, hasDirtyPanels } from '../ui/save-helpers.ts';

// ── buildSaveQueue ──────────────────────────────────────────────────────

describe('buildSaveQueue', () => {
  it('returns empty array when no panels are dirty', () => {
    const dirtyMap = Object.fromEntries(PANEL_ORDER.map((k) => [k, false]));
    assert.deepStrictEqual(buildSaveQueue(dirtyMap), []);
  });

  it('returns all dirty panel keys in stable order', () => {
    const dirtyMap = { 'Navbar': true, 'Categories': true };
    const result = buildSaveQueue(dirtyMap);
    assert.deepStrictEqual(result, ['Categories', 'Navbar']);
  });

  it('returns only dirty panels, skipping clean ones', () => {
    const dirtyMap = {
      'Categories': false,
      'Content': true,
      'Index Heroes': false,
      'Hub Tools': true,
      'Navbar': false,
      'Slideshow': false,
      'Image Defaults': false,
      'Cache / CDN': false,
      'Ads': false,
    };
    assert.deepStrictEqual(buildSaveQueue(dirtyMap), ['Content', 'Hub Tools']);
  });

  it('returns all 9 when all are dirty', () => {
    const dirtyMap = Object.fromEntries(PANEL_ORDER.map((k) => [k, true]));
    const result = buildSaveQueue(dirtyMap);
    assert.strictEqual(result.length, 9);
    assert.deepStrictEqual(result, [...PANEL_ORDER]);
  });

  it('preserves canonical panel order regardless of input order', () => {
    const dirtyMap = { 'Ads': true, 'Categories': true, 'Slideshow': true };
    const result = buildSaveQueue(dirtyMap);
    assert.deepStrictEqual(result, ['Categories', 'Slideshow', 'Ads']);
  });

  it('handles empty dirtyMap', () => {
    assert.deepStrictEqual(buildSaveQueue({}), []);
  });

  it('ignores unknown panel keys', () => {
    const dirtyMap = { 'Categories': true, 'FakePanel': true };
    assert.deepStrictEqual(buildSaveQueue(dirtyMap), ['Categories']);
  });
});

// ── hasDirtyPanels ──────────────────────────────────────────────────────

describe('hasDirtyPanels', () => {
  it('returns false for empty array', () => {
    assert.strictEqual(hasDirtyPanels([]), false);
  });

  it('returns true when one panel is dirty', () => {
    assert.strictEqual(hasDirtyPanels(['Categories']), true);
  });

  it('returns true when multiple panels are dirty', () => {
    assert.strictEqual(hasDirtyPanels(['Categories', 'Content', 'Navbar']), true);
  });
});

// ── PANEL_ORDER ─────────────────────────────────────────────────────────

describe('PANEL_ORDER', () => {
  it('contains exactly 9 panels', () => {
    assert.strictEqual(PANEL_ORDER.length, 9);
  });

  it('matches the canonical panel set', () => {
    const expected = [
      'Categories', 'Content', 'Index Heroes', 'Hub Tools', 'Navbar',
      'Slideshow', 'Image Defaults', 'Cache / CDN', 'Ads',
    ];
    assert.deepStrictEqual([...PANEL_ORDER], expected);
  });
});
