import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adSlotPath = path.resolve(__dirname, '..', 'components', 'AdSlot.astro');
const source = readFileSync(adSlotPath, 'utf8');

describe('AdSlot markup contract', () => {
  it('keeps the production placeholder as the only framed ad shell', () => {
    assert.match(
      source,
      /class="ad-slot ad-slot--production"/,
    );
    assert.match(source, /class="ad-slot ad-slot--sample"/);
    assert.doesNotMatch(source, /ad-slot--framed/);
  });

  it('keeps the ad badge dead center and hides it again after live fill', () => {
    assert.match(
      source,
      /\.ad-label\s*\{[\s\S]*top:\s*50%;[\s\S]*left:\s*50%;[\s\S]*transform:\s*translate\(-50%,\s*-50%\);/,
    );
    assert.match(
      source,
      /\.ad-slot\[data-fill="filled"\]\s+\.ad-label\s*\{\s*display:\s*none;/,
    );
  });
});
