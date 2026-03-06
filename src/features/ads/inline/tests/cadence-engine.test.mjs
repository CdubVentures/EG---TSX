import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

// ─── calculateInjectionPoints — table-driven from Phase B spec ──────────
describe('calculateInjectionPoints()', () => {
  const cases = [
    {
      name: 'normal: 2 ads',
      input: { anchorCount: 10, wordCount: 2000, firstAfter: 3, every: 5, max: 8, wordsPerAd: 450, minFirstAdWords: 150, manualAdIndices: [] },
      expected: [3, 8],
    },
    {
      name: 'manual at 3 consumes slot',
      input: { anchorCount: 10, wordCount: 2000, firstAfter: 3, every: 5, max: 8, wordsPerAd: 450, minFirstAdWords: 150, manualAdIndices: [3] },
      expected: [8],
    },
    {
      name: 'too few words',
      input: { anchorCount: 3, wordCount: 100, firstAfter: 3, every: 5, max: 8, wordsPerAd: 450, minFirstAdWords: 150, manualAdIndices: [] },
      expected: [],
    },
    {
      name: 'word-scaling caps to 1',
      input: { anchorCount: 20, wordCount: 500, firstAfter: 3, every: 4, max: 10, wordsPerAd: 450, minFirstAdWords: 150, manualAdIndices: [] },
      expected: [3],
    },
    {
      name: 'no content',
      input: { anchorCount: 0, wordCount: 0, firstAfter: 3, every: 5, max: 8, wordsPerAd: 450, minFirstAdWords: 150, manualAdIndices: [] },
      expected: [],
    },
    {
      name: 'limited by anchor count',
      input: { anchorCount: 5, wordCount: 2000, firstAfter: 2, every: 2, max: 10, wordsPerAd: 450, minFirstAdWords: 150, manualAdIndices: [] },
      expected: [2, 4],
    },
    {
      name: 'word-scaling disabled (wordsPerAd=0)',
      input: { anchorCount: 15, wordCount: 3000, firstAfter: 3, every: 3, max: 4, wordsPerAd: 0, minFirstAdWords: 0, manualAdIndices: [] },
      expected: [3, 6, 9, 12],
    },
    {
      name: 'two manuals shift cadence',
      input: { anchorCount: 10, wordCount: 2000, firstAfter: 3, every: 5, max: 8, wordsPerAd: 450, minFirstAdWords: 150, manualAdIndices: [1, 5] },
      expected: [8],
    },
    {
      name: 'exactly at min threshold: 1 ad',
      input: { anchorCount: 10, wordCount: 150, firstAfter: 3, every: 5, max: 8, wordsPerAd: 450, minFirstAdWords: 150, manualAdIndices: [] },
      expected: [3],
    },
    {
      name: 'just below threshold',
      input: { anchorCount: 10, wordCount: 149, firstAfter: 3, every: 5, max: 8, wordsPerAd: 450, minFirstAdWords: 150, manualAdIndices: [] },
      expected: [],
    },
  ];

  for (const { name, input, expected } of cases) {
    it(name, async () => {
      const { calculateInjectionPoints } = await import('../cadence-engine.ts');
      const result = calculateInjectionPoints(input);
      assert.deepStrictEqual(result, expected);
    });
  }
});

// ─── Edge cases ─────────────────────────────────────────────────────────
describe('calculateInjectionPoints() edge cases', () => {
  it('never returns index 0', async () => {
    const { calculateInjectionPoints } = await import('../cadence-engine.ts');
    const result = calculateInjectionPoints({
      anchorCount: 10,
      wordCount: 5000,
      firstAfter: 0,
      every: 2,
      max: 10,
      wordsPerAd: 0,
      minFirstAdWords: 0,
      manualAdIndices: [],
    });
    assert.ok(!result.includes(0), 'should never inject at index 0');
  });

  it('result is sorted ascending', async () => {
    const { calculateInjectionPoints } = await import('../cadence-engine.ts');
    const result = calculateInjectionPoints({
      anchorCount: 30,
      wordCount: 10000,
      firstAfter: 2,
      every: 3,
      max: 8,
      wordsPerAd: 0,
      minFirstAdWords: 0,
      manualAdIndices: [],
    });
    for (let i = 1; i < result.length; i++) {
      assert.ok(result[i] > result[i - 1], `${result[i]} should be > ${result[i - 1]}`);
    }
  });
});

// ─── Module exports ─────────────────────────────────────────────────────
describe('cadence-engine module exports', () => {
  it('exports calculateInjectionPoints function', async () => {
    const mod = await import('../cadence-engine.ts');
    assert.equal(typeof mod.calculateInjectionPoints, 'function');
  });
});
