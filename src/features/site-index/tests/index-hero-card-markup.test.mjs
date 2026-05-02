import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cardPath = path.resolve(__dirname, '..', 'components', 'IndexHeroCard.astro');
const source = readFileSync(cardPath, 'utf8');

describe('IndexHeroCard heading contract', () => {
  it('uses an h2 for the page-leading dashboard hero title', () => {
    assert.match(source, /<h2 class="moreof-hero__title">\{item\.title\}<\/h2>/);
    assert.doesNotMatch(source, /<h3 class="moreof-hero__title">\{item\.title\}<\/h3>/);
  });
});
