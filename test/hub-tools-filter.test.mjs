// ─── Hub Tools Filter — Unit Tests ────────────────────────────────────────────
// Tests the pure filtering/sorting logic extracted from hub-tools.ts.
// Mirrors the pattern of test/products-filter.test.mjs.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterHubTools,
  sortDesktopTools,
  groupMobileTools,
  TOOL_PRIORITY,
} from '../src/core/hub-tools-filter.mjs';

// ─── Factories ───────────────────────────────────────────────────────────────

function makeTool(overrides = {}) {
  return {
    tool: 'hub',
    title: 'Hub',
    description: 'Browse and compare',
    subtitle: 'Your One-Stop Hub',
    url: '/hubs/mouse',
    svg: '<svg></svg>',
    enabled: true,
    navbar: true,
    heroImg: '',
    category: 'mouse',
    ...overrides,
  };
}

// ─── filterHubTools ──────────────────────────────────────────────────────────

describe('filterHubTools', () => {
  it('returns only tools whose category is in activeCategories', () => {
    const tools = [
      makeTool({ category: 'mouse', tool: 'hub' }),
      makeTool({ category: 'keyboard', tool: 'hub' }),
      makeTool({ category: 'headset', tool: 'hub' }),
    ];
    const result = filterHubTools(tools, ['mouse', 'keyboard']);
    assert.equal(result.length, 2);
    assert.deepEqual(result.map(t => t.category), ['mouse', 'keyboard']);
  });

  it('excludes disabled tools', () => {
    const tools = [
      makeTool({ category: 'mouse', tool: 'hub', enabled: true }),
      makeTool({ category: 'mouse', tool: 'shapes', enabled: false }),
    ];
    const result = filterHubTools(tools, ['mouse']);
    assert.equal(result.length, 1);
    assert.equal(result[0].tool, 'hub');
  });

  it('returns empty array when no categories match', () => {
    const tools = [makeTool({ category: 'mouse' })];
    const result = filterHubTools(tools, ['headset']);
    assert.equal(result.length, 0);
  });

  it('returns empty array for empty input', () => {
    assert.equal(filterHubTools([], ['mouse']).length, 0);
  });

  it('handles empty activeCategories', () => {
    const tools = [makeTool({ category: 'mouse' })];
    assert.equal(filterHubTools(tools, []).length, 0);
  });
});

// ─── sortDesktopTools ────────────────────────────────────────────────────────

describe('sortDesktopTools', () => {
  it('sorts by tool type priority first', () => {
    const tools = [
      makeTool({ tool: 'radar', category: 'mouse' }),
      makeTool({ tool: 'hub', category: 'mouse' }),
      makeTool({ tool: 'database', category: 'mouse' }),
      makeTool({ tool: 'shapes', category: 'mouse' }),
      makeTool({ tool: 'versus', category: 'mouse' }),
    ];
    const result = sortDesktopTools(tools);
    assert.deepEqual(
      result.map(t => t.tool),
      ['hub', 'database', 'shapes', 'versus', 'radar']
    );
  });

  it('sorts by category order within same tool type', () => {
    const tools = [
      makeTool({ tool: 'hub', category: 'monitor' }),
      makeTool({ tool: 'hub', category: 'mouse' }),
      makeTool({ tool: 'hub', category: 'keyboard' }),
    ];
    const catOrder = ['mouse', 'keyboard', 'monitor'];
    const result = sortDesktopTools(tools, catOrder);
    assert.deepEqual(
      result.map(t => t.category),
      ['mouse', 'keyboard', 'monitor']
    );
  });

  it('tool priority trumps category order', () => {
    const tools = [
      makeTool({ tool: 'database', category: 'mouse' }),
      makeTool({ tool: 'hub', category: 'keyboard' }),
      makeTool({ tool: 'hub', category: 'mouse' }),
      makeTool({ tool: 'database', category: 'keyboard' }),
    ];
    const catOrder = ['mouse', 'keyboard'];
    const result = sortDesktopTools(tools, catOrder);
    assert.deepEqual(
      result.map(t => `${t.tool}:${t.category}`),
      ['hub:mouse', 'hub:keyboard', 'database:mouse', 'database:keyboard']
    );
  });

  it('unknown tool types sort last', () => {
    const tools = [
      makeTool({ tool: 'unknown', category: 'mouse' }),
      makeTool({ tool: 'hub', category: 'mouse' }),
    ];
    const result = sortDesktopTools(tools);
    assert.equal(result[0].tool, 'hub');
    assert.equal(result[1].tool, 'unknown');
  });

  it('does not mutate input', () => {
    const tools = [
      makeTool({ tool: 'radar', category: 'mouse' }),
      makeTool({ tool: 'hub', category: 'mouse' }),
    ];
    const copy = [...tools];
    sortDesktopTools(tools);
    assert.deepEqual(tools, copy);
  });
});

// ─── groupMobileTools ────────────────────────────────────────────────────────

describe('groupMobileTools', () => {
  it('groups tools by category (alphabetical without categoryOrder)', () => {
    const tools = [
      makeTool({ tool: 'hub', category: 'mouse' }),
      makeTool({ tool: 'database', category: 'mouse' }),
      makeTool({ tool: 'hub', category: 'keyboard' }),
    ];
    const result = groupMobileTools(tools);
    assert.equal(result.length, 2);
    // WHY: without explicit categoryOrder, falls back to alphabetical
    assert.equal(result[0].category, 'keyboard');
    assert.equal(result[0].tools.length, 1);
    assert.equal(result[1].category, 'mouse');
    assert.equal(result[1].tools.length, 2);
  });

  it('respects category order', () => {
    const tools = [
      makeTool({ tool: 'hub', category: 'keyboard' }),
      makeTool({ tool: 'hub', category: 'mouse' }),
    ];
    const catOrder = ['mouse', 'keyboard'];
    const result = groupMobileTools(tools, catOrder);
    assert.equal(result[0].category, 'mouse');
    assert.equal(result[1].category, 'keyboard');
  });

  it('sorts tools within each category by tool priority', () => {
    const tools = [
      makeTool({ tool: 'radar', category: 'mouse' }),
      makeTool({ tool: 'hub', category: 'mouse' }),
      makeTool({ tool: 'versus', category: 'mouse' }),
    ];
    const result = groupMobileTools(tools);
    assert.deepEqual(
      result[0].tools.map(t => t.tool),
      ['hub', 'versus', 'radar']
    );
  });

  it('returns empty array for no tools', () => {
    assert.equal(groupMobileTools([]).length, 0);
  });
});

// ─── TOOL_PRIORITY ───────────────────────────────────────────────────────────

describe('TOOL_PRIORITY', () => {
  it('is an array of 5 tool types in correct order', () => {
    assert.deepEqual(TOOL_PRIORITY, ['hub', 'database', 'shapes', 'versus', 'radar']);
  });
});
