/**
 * migrate-to-slug-folders.test.mjs
 *
 * Tests for the migration script that converts flat article files
 * to slug-folder structure: {slug}.md → {slug}/index.md
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Functions under test (imported from migration script) ──────────────────

import { deriveTarget, shouldSkip } from '../migrate-to-slug-folders.mjs';

// ─── deriveTarget ───────────────────────────────────────────────────────────

describe('deriveTarget', () => {
  it('converts flat .md file to slug-folder', () => {
    assert.equal(
      deriveTarget('apex-legends.md'),
      'apex-legends/index.md'
    );
  });

  it('converts flat .mdx file to slug-folder', () => {
    assert.equal(
      deriveTarget('mouse-grip-guide.mdx'),
      'mouse-grip-guide/index.mdx'
    );
  });

  it('preserves subdirectory structure', () => {
    assert.equal(
      deriveTarget('mouse/alienware-aw610m-review.md'),
      'mouse/alienware-aw610m-review/index.md'
    );
  });

  it('preserves nested subdirectory structure', () => {
    assert.equal(
      deriveTarget('ai/common-sense-machines-article.md'),
      'ai/common-sense-machines-article/index.md'
    );
  });

  it('normalizes backslashes to forward slashes', () => {
    assert.equal(
      deriveTarget('mouse\\alienware-aw610m-review.md'),
      'mouse/alienware-aw610m-review/index.md'
    );
  });

  it('returns null for files already named index.md', () => {
    assert.equal(deriveTarget('apex-legends/index.md'), null);
  });

  it('returns null for files already named index.mdx', () => {
    assert.equal(deriveTarget('mouse/mouse-grip-guide/index.mdx'), null);
  });
});

// ─── shouldSkip ─────────────────────────────────────────────────────────────

describe('shouldSkip', () => {
  it('skips files already in slug-folder form (index.md)', () => {
    assert.equal(shouldSkip('apex-legends/index.md'), true);
  });

  it('skips files already in slug-folder form (index.mdx)', () => {
    assert.equal(shouldSkip('mouse/mouse-grip-guide/index.mdx'), true);
  });

  it('does not skip flat .md files', () => {
    assert.equal(shouldSkip('apex-legends.md'), false);
  });

  it('does not skip flat .mdx files', () => {
    assert.equal(shouldSkip('mouse-grip-guide.mdx'), false);
  });

  it('does not skip flat files in subdirectories', () => {
    assert.equal(shouldSkip('mouse/alienware-aw610m-review.md'), false);
  });

  it('handles backslashes', () => {
    assert.equal(shouldSkip('apex-legends\\index.md'), true);
  });
});
