// ─── Image Defaults — Contract Tests ────────────────────────────────────────
// Validates:
//   1. JSON structure (config/data/image-defaults.json)
//   2. Resolver pure functions (resolveImageDefaults, resolveViewObjectFit)
//
// WHY: Per-category image config replaces hardcoded view names in components.
// The JSON is SSOT; the resolver merges category overrides with global defaults.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const JSON_PATH = join(ROOT, 'config', 'data', 'image-defaults.json');

// ─── Load JSON ──────────────────────────────────────────────────────────────

const raw = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));

// ─── Import resolver ────────────────────────────────────────────────────────

import {
  resolveImageDefaults,
  resolveViewObjectFit,
} from '../src/core/image-defaults-resolver.mjs';

// ═══════════════════════════════════════════════════════════════════════════
// 1. JSON STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════

describe('image-defaults.json — structure', () => {
  it('has a defaults object', () => {
    assert.equal(typeof raw.defaults, 'object');
    assert.ok(raw.defaults !== null);
  });

  it('has a categories object', () => {
    assert.equal(typeof raw.categories, 'object');
    assert.ok(raw.categories !== null);
  });

  it('defaults has required top-level keys', () => {
    const required = [
      'defaultImageView',
      'listThumbKeyBase',
      'coverImageView',
      'headerGame',
      'viewPriority',
      'imageDisplayOptions',
      'viewMeta',
    ];
    for (const key of required) {
      assert.ok(key in raw.defaults, `missing defaults.${key}`);
    }
  });

  it('defaultImageView is an array of non-empty strings', () => {
    assert.ok(Array.isArray(raw.defaults.defaultImageView), 'defaultImageView must be an array');
    assert.ok(raw.defaults.defaultImageView.length > 0, 'defaultImageView must not be empty');
    for (const v of raw.defaults.defaultImageView) {
      assert.equal(typeof v, 'string');
      assert.ok(v.length > 0, 'defaultImageView entries must be non-empty');
    }
  });

  it('listThumbKeyBase is an array of non-empty strings', () => {
    assert.ok(Array.isArray(raw.defaults.listThumbKeyBase), 'listThumbKeyBase must be an array');
    assert.ok(raw.defaults.listThumbKeyBase.length > 0, 'listThumbKeyBase must not be empty');
    for (const v of raw.defaults.listThumbKeyBase) {
      assert.equal(typeof v, 'string');
      assert.ok(v.length > 0, 'listThumbKeyBase entries must be non-empty');
    }
  });

  it('coverImageView is an array of non-empty strings', () => {
    assert.ok(Array.isArray(raw.defaults.coverImageView), 'coverImageView must be an array');
    assert.ok(raw.defaults.coverImageView.length > 0, 'coverImageView must not be empty');
    for (const v of raw.defaults.coverImageView) {
      assert.equal(typeof v, 'string');
      assert.ok(v.length > 0, 'coverImageView entries must be non-empty');
    }
  });

  it('headerGame is an array of strings', () => {
    assert.ok(Array.isArray(raw.defaults.headerGame));
    assert.ok(raw.defaults.headerGame.length > 0);
    for (const v of raw.defaults.headerGame) {
      assert.equal(typeof v, 'string');
    }
  });

  it('viewPriority is an array of unique strings', () => {
    const vp = raw.defaults.viewPriority;
    assert.ok(Array.isArray(vp));
    assert.ok(vp.length > 0);
    const unique = new Set(vp);
    assert.equal(vp.length, unique.size, 'duplicate entries in viewPriority');
    for (const v of vp) {
      assert.equal(typeof v, 'string');
    }
  });

  it('imageDisplayOptions is an array with view/labelFull/labelShort', () => {
    const opts = raw.defaults.imageDisplayOptions;
    assert.ok(Array.isArray(opts));
    assert.ok(opts.length > 0);
    for (const opt of opts) {
      assert.equal(typeof opt.view, 'string', 'imageDisplayOptions.view must be string');
      assert.equal(typeof opt.labelFull, 'string', 'imageDisplayOptions.labelFull must be string');
      assert.equal(typeof opt.labelShort, 'string', 'imageDisplayOptions.labelShort must be string');
    }
  });

  it('viewMeta is an object with objectFit + label + labelShort per view', () => {
    const vm = raw.defaults.viewMeta;
    assert.equal(typeof vm, 'object');
    assert.ok(Object.keys(vm).length > 0);
    for (const [view, meta] of Object.entries(vm)) {
      assert.ok(
        meta.objectFit === 'contain' || meta.objectFit === 'cover',
        `viewMeta.${view}.objectFit must be 'contain' or 'cover', got '${meta.objectFit}'`
      );
      assert.equal(typeof meta.label, 'string', `viewMeta.${view}.label must be string`);
      assert.equal(typeof meta.labelShort, 'string', `viewMeta.${view}.labelShort must be string`);
    }
  });

  it('viewMeta keys are a superset of viewPriority entries', () => {
    const vmKeys = new Set(Object.keys(raw.defaults.viewMeta));
    for (const view of raw.defaults.viewPriority) {
      assert.ok(vmKeys.has(view), `viewPriority has "${view}" but viewMeta does not`);
    }
  });

  it('no HBS view names (imgTop, imgBot, etc.) in viewPriority', () => {
    const hbsNames = ['imgTop', 'imgBot', 'imgLside', 'imgRside', 'imgSAngle', 'imgAngle',
      'imgFront', 'imgRear', 'featureImgCover', 'featureImgContain'];
    for (const name of hbsNames) {
      assert.ok(!raw.defaults.viewPriority.includes(name),
        `viewPriority contains HBS name "${name}"`);
    }
  });

  it('no HBS view names in viewMeta keys', () => {
    const hbsNames = ['imgTop', 'imgBot', 'imgLside', 'imgRside', 'imgSAngle', 'imgAngle',
      'imgFront', 'imgRear', 'featureImgCover', 'featureImgContain'];
    const vmKeys = new Set(Object.keys(raw.defaults.viewMeta));
    for (const name of hbsNames) {
      assert.ok(!vmKeys.has(name), `viewMeta contains HBS name "${name}"`);
    }
  });

  it('categories has mouse, keyboard, monitor', () => {
    for (const cat of ['mouse', 'keyboard', 'monitor']) {
      assert.ok(cat in raw.categories, `missing category: ${cat}`);
    }
  });

  it('category overrides are plain objects (may be empty)', () => {
    for (const [cat, overrides] of Object.entries(raw.categories)) {
      assert.equal(typeof overrides, 'object', `categories.${cat} must be object`);
      assert.ok(overrides !== null, `categories.${cat} must not be null`);
      assert.ok(!Array.isArray(overrides), `categories.${cat} must not be array`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. RESOLVER — resolveImageDefaults()
// ═══════════════════════════════════════════════════════════════════════════

describe('resolveImageDefaults()', () => {
  const defaults = raw.defaults;
  const categories = raw.categories;

  it('returns defaults for known category with empty overrides', () => {
    const result = resolveImageDefaults(defaults, categories, 'keyboard');
    assert.deepEqual(result.defaultImageView, defaults.defaultImageView);
    assert.deepEqual(result.coverImageView, defaults.coverImageView);
    assert.deepEqual(result.viewPriority, defaults.viewPriority);
    assert.deepEqual(result.viewMeta, defaults.viewMeta);
    assert.deepEqual(result.headerGame, defaults.headerGame);
    assert.deepEqual(result.listThumbKeyBase, defaults.listThumbKeyBase);
  });

  it('returns defaults for unknown category (fallback)', () => {
    const result = resolveImageDefaults(defaults, categories, 'nonexistent');
    assert.deepEqual(result.defaultImageView, defaults.defaultImageView);
    assert.deepEqual(result.viewPriority, defaults.viewPriority);
  });

  it('merges category array overrides into defaults', () => {
    const overrides = { mouse: { defaultImageView: ['left', 'top'] } };
    const result = resolveImageDefaults(defaults, overrides, 'mouse');
    assert.deepEqual(result.defaultImageView, ['left', 'top']);
    // Non-overridden fields still come from defaults
    assert.deepEqual(result.viewPriority, defaults.viewPriority);
  });

  it('category viewPriority override replaces entirely (not appended)', () => {
    const overrides = { mouse: { viewPriority: ['left', 'top'] } };
    const result = resolveImageDefaults(defaults, overrides, 'mouse');
    assert.deepEqual(result.viewPriority, ['left', 'top']);
  });

  it('category viewMeta override merges per-view (not replaces entire object)', () => {
    const overrides = {
      mouse: {
        viewMeta: {
          top: { objectFit: 'cover', label: 'Overhead', labelShort: 'Over' },
        },
      },
    };
    const result = resolveImageDefaults(defaults, overrides, 'mouse');
    // top should be overridden
    assert.equal(result.viewMeta.top.objectFit, 'cover');
    assert.equal(result.viewMeta.top.label, 'Overhead');
    // other views should still exist from defaults
    assert.equal(result.viewMeta.left.objectFit, defaults.viewMeta.left.objectFit);
  });

  it('returns a new object (not a reference to defaults)', () => {
    const result = resolveImageDefaults(defaults, categories, 'keyboard');
    assert.notEqual(result, defaults);
    result.defaultImageView = ['MUTATED'];
    assert.notDeepEqual(defaults.defaultImageView, ['MUTATED']);
  });

  it('deep-clones defaultImageView, listThumbKeyBase, and coverImageView arrays', () => {
    const result = resolveImageDefaults(defaults, categories, 'keyboard');
    result.defaultImageView.push('MUTATED');
    assert.ok(!defaults.defaultImageView.includes('MUTATED'),
      'mutating result.defaultImageView must not leak to defaults');
    result.listThumbKeyBase.push('MUTATED');
    assert.ok(!defaults.listThumbKeyBase.includes('MUTATED'),
      'mutating result.listThumbKeyBase must not leak to defaults');
    result.coverImageView.push('MUTATED');
    assert.ok(!defaults.coverImageView.includes('MUTATED'),
      'mutating result.coverImageView must not leak to defaults');
  });

  it('handles null/undefined category gracefully', () => {
    const result = resolveImageDefaults(defaults, categories, undefined);
    assert.deepEqual(result.defaultImageView, defaults.defaultImageView);

    const result2 = resolveImageDefaults(defaults, categories, null);
    assert.deepEqual(result2.defaultImageView, defaults.defaultImageView);
  });

  it('mouse override replaces entire defaultImageView array', () => {
    const result = resolveImageDefaults(defaults, categories, 'mouse');
    // mouse has a defaultImageView override — should be an array, not global
    assert.ok(Array.isArray(result.defaultImageView), 'mouse defaultImageView must be array');
    assert.equal(result.defaultImageView[0], 'right', 'mouse primary view should be right');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. RESOLVER — resolveViewObjectFit()
// ═══════════════════════════════════════════════════════════════════════════

describe('resolveViewObjectFit()', () => {
  const defaults = raw.defaults;
  const categories = raw.categories;

  it('returns correct objectFit for a known view', () => {
    const fit = resolveViewObjectFit(defaults, categories, 'mouse', 'top');
    assert.equal(fit, 'contain');
  });

  it('returns correct objectFit for cover views', () => {
    const fit = resolveViewObjectFit(defaults, categories, 'mouse', 'img');
    assert.equal(fit, 'cover');

    const fit2 = resolveViewObjectFit(defaults, categories, 'mouse', 'feature-image');
    assert.equal(fit2, 'cover');
  });

  it('returns "contain" for unknown view (fallback)', () => {
    const fit = resolveViewObjectFit(defaults, categories, 'mouse', 'nonexistent');
    assert.equal(fit, 'contain');
  });

  it('respects category override for objectFit', () => {
    const overrides = {
      keyboard: {
        viewMeta: {
          top: { objectFit: 'cover', label: 'Top', labelShort: 'Top' },
        },
      },
    };
    const fit = resolveViewObjectFit(defaults, overrides, 'keyboard', 'top');
    assert.equal(fit, 'cover');
  });

  it('returns "contain" for unknown category + unknown view', () => {
    const fit = resolveViewObjectFit(defaults, categories, 'nonexistent', 'nonexistent');
    assert.equal(fit, 'contain');
  });
});
