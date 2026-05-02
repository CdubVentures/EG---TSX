import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dividerPath = path.resolve(__dirname, '..', 'SectionDivider.astro');
const source = readFileSync(dividerPath, 'utf8');

describe('SectionDivider markup contract', () => {
  it('gives the generic See More link a descriptive accessible name', () => {
    assert.match(
      source,
      /<a href=\{seeMoreHref\} class="section-divider-link" aria-label=\{`See more \$\{title\}`\}>See More<\/a>/,
    );
  });
});
