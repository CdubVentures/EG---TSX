import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { renderBrandDashboardMarkup } from '../brand-dashboard-markup.mjs';

function tile({
  slug = 'razer',
  name = 'Razer',
  url = '/brands/razer/',
  logoBase = '/images/brands/razer/brand-logo-horizontal-index',
} = {}) {
  return { slug, name, url, logoBase, categories: ['mouse'], navbar: ['mouse'] };
}

describe('BrandDashboard markup', () => {
  it('6 items → 6 tile <a> elements with correct hrefs', () => {
    const items = Array.from({ length: 6 }, (_, i) =>
      tile({ slug: `brand-${i}`, name: `Brand ${i}`, url: `/brands/brand-${i}/`, logoBase: `/images/brands/brand-${i}/brand-logo-horizontal-index` })
    );
    const html = renderBrandDashboardMarkup(items);
    for (let i = 0; i < 6; i++) {
      assert.ok(html.includes(`href="/brands/brand-${i}/"`), `Missing href for brand-${i}`);
    }
    const tileMatches = html.match(/class="grid-dash__tile/g);
    assert.equal(tileMatches?.length, 6);
  });

  it('each tile has <img> with 7-size PNG srcset', () => {
    const items = [tile()];
    const html = renderBrandDashboardMarkup(items);
    assert.ok(html.includes('_xxs.png 100w'));
    assert.ok(html.includes('_xs.png 150w'));
    assert.ok(html.includes('_s.png 200w'));
    assert.ok(html.includes('_m.png 250w'));
    assert.ok(html.includes('_l.png 300w'));
    assert.ok(html.includes('_xl.png 400w'));
    assert.ok(html.includes('_xxl.png 500w'));
  });

  it('each tile has alt="{name} logo"', () => {
    const items = [tile({ name: 'Corsair' })];
    const html = renderBrandDashboardMarkup(items);
    assert.ok(html.includes('alt="Corsair logo"'));
  });

  it('0 items → empty string', () => {
    const html = renderBrandDashboardMarkup([]);
    assert.equal(html, '');
  });

  it('grid wrapper has correct CSS classes', () => {
    const items = [tile()];
    const html = renderBrandDashboardMarkup(items);
    assert.ok(html.includes('brands-dash__stageGrid'));
    assert.ok(html.includes('moreof-hf__grid'));
    assert.ok(html.includes('moreof-hf'));
  });
});
