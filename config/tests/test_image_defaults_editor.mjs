import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  setFieldValue,
  reorderPriority,
  movePriority,
  resetPriorityToDefaults,
  setViewMetaField,
  toggleObjectFit,
  computeFallbacks,
  resolveDefaults,
} from '../ui/image-defaults-editor.mjs';

// ── Factories ───────────────────────────────────────────────────────────

function makePanel(overrides = {}) {
  return {
    defaults: {
      defaultImageView: ['top', 'left', 'feature-image', 'sangle'],
      listThumbKeyBase: ['left', 'top', 'sangle'],
      coverImageView: ['feature-image', 'sangle', 'angle', 'top', 'left'],
      headerGame: ['left', 'top'],
      viewPriority: ['feature-image', 'top', 'left', 'right', 'sangle', 'angle', 'front', 'rear', 'bot', 'img'],
      imageDisplayOptions: [
        { view: 'feature-image', labelFull: 'Showcase', labelShort: 'Showcase' },
        { view: 'top', labelFull: 'Top View (Default)', labelShort: 'Top' },
      ],
      viewMeta: {
        top: { objectFit: 'contain', label: 'Top View', labelShort: 'Top' },
        left: { objectFit: 'contain', label: 'Side View', labelShort: 'Side' },
        'feature-image': { objectFit: 'cover', label: 'Showcase', labelShort: 'Showcase' },
        img: { objectFit: 'cover', label: 'Studio Shot', labelShort: 'Studio' },
      },
    },
    categories: {
      mouse: { defaultImageView: ['right', 'top', 'left', 'sangle'] },
      keyboard: {},
      monitor: {},
    },
    scanner: {},
    categoryPills: [],
    canonicalViews: ['feature-image', 'top', 'left', 'right', 'sangle', 'angle', 'front', 'rear', 'bot', 'img', 'shape-side', 'shape-top'],
    categoryColors: {},
    categoryLabels: {},
    statusRight: '',
    version: 0,
    ...overrides,
  };
}

// ── setFieldValue ───────────────────────────────────────────────────────

describe('setFieldValue', () => {
  it('sets a field on global defaults when categoryId is __defaults__', () => {
    const panel = makePanel();
    const result = setFieldValue(panel, '__defaults__', 'defaultImageView', ['left', 'top']);
    assert.deepStrictEqual(result.defaults.defaultImageView, ['left', 'top']);
  });

  it('sets a field on a category override', () => {
    const panel = makePanel();
    const result = setFieldValue(panel, 'mouse', 'defaultImageView', ['top', 'right']);
    assert.deepStrictEqual(result.categories.mouse.defaultImageView, ['top', 'right']);
  });

  it('creates category override if it does not exist', () => {
    const panel = makePanel();
    const result = setFieldValue(panel, 'keyboard', 'defaultImageView', ['left']);
    assert.deepStrictEqual(result.categories.keyboard.defaultImageView, ['left']);
  });

  it('does not mutate the original panel', () => {
    const panel = makePanel();
    const originalDefaults = [...panel.defaults.defaultImageView];
    setFieldValue(panel, '__defaults__', 'defaultImageView', ['left']);
    assert.deepStrictEqual(panel.defaults.defaultImageView, originalDefaults);
  });

  it('preserves other fields when setting one', () => {
    const panel = makePanel();
    const result = setFieldValue(panel, '__defaults__', 'headerGame', ['top']);
    assert.deepStrictEqual(result.defaults.defaultImageView, panel.defaults.defaultImageView);
  });
});

// ── reorderPriority ─────────────────────────────────────────────────────

describe('reorderPriority', () => {
  it('moves item from one index to another in defaults', () => {
    const panel = makePanel();
    const result = reorderPriority(panel, '__defaults__', 0, 2);
    assert.equal(result.defaults.viewPriority[0], 'top');
    assert.equal(result.defaults.viewPriority[1], 'left');
    assert.equal(result.defaults.viewPriority[2], 'feature-image');
  });

  it('works on category override viewPriority', () => {
    const panel = makePanel({
      categories: {
        mouse: { viewPriority: ['top', 'left', 'right'] },
      },
    });
    const result = reorderPriority(panel, 'mouse', 2, 0);
    assert.deepStrictEqual(result.categories.mouse.viewPriority, ['right', 'top', 'left']);
  });

  it('no-op for same index', () => {
    const panel = makePanel();
    const result = reorderPriority(panel, '__defaults__', 1, 1);
    assert.deepStrictEqual(result.defaults.viewPriority, panel.defaults.viewPriority);
  });

  it('no-op for out of bounds', () => {
    const panel = makePanel();
    const result = reorderPriority(panel, '__defaults__', -1, 5);
    assert.deepStrictEqual(result.defaults.viewPriority, panel.defaults.viewPriority);
  });
});

// ── movePriority ────────────────────────────────────────────────────────

describe('movePriority', () => {
  it('moves item up (direction -1)', () => {
    const panel = makePanel();
    const result = movePriority(panel, '__defaults__', 1, -1);
    assert.equal(result.defaults.viewPriority[0], 'top');
    assert.equal(result.defaults.viewPriority[1], 'feature-image');
  });

  it('moves item down (direction +1)', () => {
    const panel = makePanel();
    const result = movePriority(panel, '__defaults__', 0, 1);
    assert.equal(result.defaults.viewPriority[0], 'top');
    assert.equal(result.defaults.viewPriority[1], 'feature-image');
  });

  it('no-op at top boundary (index 0, direction -1)', () => {
    const panel = makePanel();
    const result = movePriority(panel, '__defaults__', 0, -1);
    assert.deepStrictEqual(result.defaults.viewPriority, panel.defaults.viewPriority);
  });

  it('no-op at bottom boundary', () => {
    const panel = makePanel();
    const lastIdx = panel.defaults.viewPriority.length - 1;
    const result = movePriority(panel, '__defaults__', lastIdx, 1);
    assert.deepStrictEqual(result.defaults.viewPriority, panel.defaults.viewPriority);
  });
});

// ── resetPriorityToDefaults ─────────────────────────────────────────────

describe('resetPriorityToDefaults', () => {
  it('removes viewPriority from category override', () => {
    const panel = makePanel({
      categories: {
        mouse: { viewPriority: ['top', 'left'], defaultImageView: ['right'] },
      },
    });
    const result = resetPriorityToDefaults(panel, 'mouse');
    assert.equal(result.categories.mouse.viewPriority, undefined);
    assert.deepStrictEqual(result.categories.mouse.defaultImageView, ['right']);
  });

  it('no-op for __defaults__ (cannot reset globals)', () => {
    const panel = makePanel();
    const result = resetPriorityToDefaults(panel, '__defaults__');
    assert.deepStrictEqual(result.defaults.viewPriority, panel.defaults.viewPriority);
  });

  it('no-op when category has no viewPriority override', () => {
    const panel = makePanel();
    const result = resetPriorityToDefaults(panel, 'keyboard');
    assert.deepStrictEqual(result.categories.keyboard, {});
  });
});

// ── setViewMetaField ────────────────────────────────────────────────────

describe('setViewMetaField', () => {
  it('sets label on a view in global defaults', () => {
    const panel = makePanel();
    const result = setViewMetaField(panel, '__defaults__', 'top', 'label', 'Bird Eye');
    assert.equal(result.defaults.viewMeta.top.label, 'Bird Eye');
  });

  it('sets objectFit on a view in global defaults', () => {
    const panel = makePanel();
    const result = setViewMetaField(panel, '__defaults__', 'top', 'objectFit', 'cover');
    assert.equal(result.defaults.viewMeta.top.objectFit, 'cover');
  });

  it('sets labelShort on a view in category override', () => {
    const panel = makePanel();
    const result = setViewMetaField(panel, 'mouse', 'top', 'labelShort', 'T');
    assert.equal(result.categories.mouse.viewMeta.top.labelShort, 'T');
  });

  it('creates viewMeta on category if missing', () => {
    const panel = makePanel();
    const result = setViewMetaField(panel, 'keyboard', 'top', 'label', 'Top');
    assert.equal(result.categories.keyboard.viewMeta.top.label, 'Top');
  });

  it('preserves other views when setting one', () => {
    const panel = makePanel();
    const result = setViewMetaField(panel, '__defaults__', 'top', 'label', 'Bird Eye');
    assert.equal(result.defaults.viewMeta.left.label, 'Side View');
  });
});

// ── toggleObjectFit ─────────────────────────────────────────────────────

describe('toggleObjectFit', () => {
  it('toggles contain → cover in defaults', () => {
    const panel = makePanel();
    const result = toggleObjectFit(panel, '__defaults__', 'top');
    assert.equal(result.defaults.viewMeta.top.objectFit, 'cover');
  });

  it('toggles cover → contain in defaults', () => {
    const panel = makePanel();
    const result = toggleObjectFit(panel, '__defaults__', 'feature-image');
    assert.equal(result.defaults.viewMeta['feature-image'].objectFit, 'contain');
  });

  it('toggles in category override (creates viewMeta if needed)', () => {
    const panel = makePanel();
    // top defaults to contain → toggle should create mouse override with cover
    const result = toggleObjectFit(panel, 'mouse', 'top');
    assert.equal(result.categories.mouse.viewMeta.top.objectFit, 'cover');
  });
});

// ── computeFallbacks ────────────────────────────────────────────────────

describe('computeFallbacks', () => {
  it('returns views sorted by coverage desc, excluding primaries', () => {
    const available = ['top', 'left', 'sangle', 'feature-image'];
    const primaries = ['top'];
    const viewCounts = { top: 300, left: 280, sangle: 200, 'feature-image': 150 };
    const totalProducts = 300;
    const result = computeFallbacks(available, primaries, viewCounts, totalProducts);
    // Should exclude 'top' (primary), sort rest by coverage desc
    assert.equal(result[0].view, 'left');
    assert.equal(result[1].view, 'sangle');
    assert.equal(result[2].view, 'feature-image');
  });

  it('returns empty array when no non-primary views exist', () => {
    const result = computeFallbacks(['top'], ['top'], { top: 10 }, 10);
    assert.deepStrictEqual(result, []);
  });

  it('computes correct coverage percentages', () => {
    const result = computeFallbacks(['left'], [], { left: 150 }, 300);
    assert.equal(result[0].view, 'left');
    assert.equal(result[0].coveragePct, 50);
  });

  it('handles zero total products', () => {
    const result = computeFallbacks(['left'], [], { left: 0 }, 0);
    assert.equal(result[0].coveragePct, 0);
  });
});

// ── resolveDefaults ─────────────────────────────────────────────────────

describe('resolveDefaults', () => {
  it('returns global defaults for __defaults__', () => {
    const panel = makePanel();
    const result = resolveDefaults(panel, '__defaults__');
    assert.deepStrictEqual(result.defaultImageView, panel.defaults.defaultImageView);
  });

  it('merges category override onto global defaults', () => {
    const panel = makePanel();
    const result = resolveDefaults(panel, 'mouse');
    // mouse overrides defaultImageView
    assert.deepStrictEqual(result.defaultImageView, ['right', 'top', 'left', 'sangle']);
    // but keeps global listThumbKeyBase
    assert.deepStrictEqual(result.listThumbKeyBase, panel.defaults.listThumbKeyBase);
  });

  it('deep-merges viewMeta per-view', () => {
    const panel = makePanel({
      categories: {
        mouse: {
          viewMeta: { top: { objectFit: 'cover' } },
        },
      },
    });
    const result = resolveDefaults(panel, 'mouse');
    assert.equal(result.viewMeta.top.objectFit, 'cover');
    assert.equal(result.viewMeta.top.label, 'Top View'); // inherited
    assert.equal(result.viewMeta.left.objectFit, 'contain'); // unaffected
  });

  it('returns defaults clone for unknown category', () => {
    const panel = makePanel();
    const result = resolveDefaults(panel, 'nonexistent');
    assert.deepStrictEqual(result.defaultImageView, panel.defaults.defaultImageView);
  });

  it('does not mutate original panel', () => {
    const panel = makePanel();
    const result = resolveDefaults(panel, 'mouse');
    result.defaultImageView.push('extra');
    assert.equal(panel.defaults.defaultImageView.length, 4);
  });
});
