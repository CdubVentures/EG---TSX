import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const breadcrumbsPath = path.resolve(__dirname, '..', 'Breadcrumbs.astro');
const source = readFileSync(breadcrumbsPath, 'utf8');

describe('Breadcrumbs markup contract', () => {
  it('uses ordered-list breadcrumb semantics with Schema.org list items', () => {
    assert.match(
      source,
      /<ol[^>]*class="breadcrumb"[^>]*itemtype="https:\/\/schema\.org\/BreadcrumbList"/,
      'Breadcrumbs must render an ordered list with BreadcrumbList microdata'
    );
    assert.match(
      source,
      /<li[^>]*class="crumb"[^>]*itemprop="itemListElement"[^>]*itemtype="https:\/\/schema\.org\/ListItem"/,
      'Breadcrumbs must wrap each crumb in a ListItem'
    );
  });

  it('marks the terminal crumb as the current page', () => {
    assert.match(
      source,
      /aria-current=\{item\.href \? undefined : 'page'\}/,
      'Breadcrumbs must expose aria-current on the current page crumb'
    );
  });
});
