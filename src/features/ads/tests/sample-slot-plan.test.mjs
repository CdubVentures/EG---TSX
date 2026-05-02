import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSampleSlotPlan,
  getSampleRefreshPlan,
} from '../sample-slot-plan.mjs';

const sampleCreatives = [
  { source: 'creative-a', brand: 'Brand A', campaign: 'Campaign A', kind: 'svg' },
  { source: 'creative-b', brand: 'Brand B', campaign: 'Campaign B', kind: 'video' },
  { source: 'creative-c', brand: 'Brand C', campaign: 'Campaign C', kind: 'svg' },
  { source: 'creative-d', brand: 'Brand D', campaign: 'Campaign D', kind: 'video' },
];

test('createSampleSlotPlan is deterministic for the same slot key', () => {
  const first = createSampleSlotPlan({
    slotKey: 'sidebar|300x600|rail|static',
    creatives: sampleCreatives,
  });
  const second = createSampleSlotPlan({
    slotKey: 'sidebar|300x600|rail|static',
    creatives: sampleCreatives,
  });

  assert.deepEqual(first.creatives.map((creative) => creative.source), second.creatives.map((creative) => creative.source));
});

test('createSampleSlotPlan spreads first creative across common page slots', () => {
  const sidebar = createSampleSlotPlan({
    slotKey: 'sidebar|300x600|rail|static',
    creatives: sampleCreatives,
  });
  const sticky = createSampleSlotPlan({
    slotKey: 'sidebar_sticky|300x600|rail|sticky',
    creatives: sampleCreatives,
  });
  const inline = createSampleSlotPlan({
    slotKey: 'in_content|300x250|inline|static',
    creatives: sampleCreatives,
  });

  const firstSources = new Set([
    sidebar.initialCreative?.source,
    sticky.initialCreative?.source,
    inline.initialCreative?.source,
  ]);

  assert.equal(firstSources.size, 3);
});

test('getSampleRefreshPlan matches more realistic ad refresh timing', () => {
  assert.deepEqual(
    getSampleRefreshPlan({ placementType: 'rail', sticky: false }),
    { minMs: 45000, maxMs: 75000, maxRefreshes: 2 }
  );
  assert.deepEqual(
    getSampleRefreshPlan({ placementType: 'rail', sticky: true }),
    { minMs: 30000, maxMs: 50000, maxRefreshes: 4 }
  );
  assert.deepEqual(
    getSampleRefreshPlan({ placementType: 'inline', sticky: false }),
    { minMs: 60000, maxMs: 105000, maxRefreshes: 1 }
  );
});
