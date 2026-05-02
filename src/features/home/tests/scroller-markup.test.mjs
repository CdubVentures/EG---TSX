import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const featuredScrollerPath = path.resolve(__dirname, '..', 'components', 'FeaturedScroller.astro');
const featuredPanelPath = path.resolve(__dirname, '..', 'components', 'FeaturedPanel.astro');
const gamesScrollerPath = path.resolve(__dirname, '..', 'components', 'GamesScroller.astro');
const homeSlideshowPath = path.resolve(__dirname, '..', 'components', 'HomeSlideshow.astro');

const featuredScrollerSource = readFileSync(featuredScrollerPath, 'utf8');
const featuredPanelSource = readFileSync(featuredPanelPath, 'utf8');
const gamesScrollerSource = readFileSync(gamesScrollerPath, 'utf8');
const homeSlideshowSource = readFileSync(homeSlideshowPath, 'utf8');

describe('FeaturedScroller markup contract', () => {
  it('uses filter buttons instead of anchor tabs', () => {
    assert.match(featuredScrollerSource, /<button[\s\S]*type="button"[\s\S]*class="section-divider-link active"/);
    assert.match(featuredScrollerSource, /data-filter="all"/);
    assert.match(featuredScrollerSource, /aria-pressed="true"/);
    assert.doesNotMatch(featuredScrollerSource, /role="tablist"/);
    assert.doesNotMatch(featuredScrollerSource, /role="tab"/);
    assert.doesNotMatch(featuredScrollerSource, /href="#"/);
  });

  it('keeps the See More link but gives it a descriptive accessible name', () => {
    assert.match(
      featuredScrollerSource,
      /<a[\s\S]*href=\{seeMoreHref\}[\s\S]*aria-label=\{`See more \$\{sectionTitle\}`\}/,
    );
  });
});

describe('Scroller arrow control contract', () => {
  it('uses real buttons for featured panel arrows', () => {
    assert.match(
      featuredPanelSource,
      /<button[\s\S]*type="button"[\s\S]*class="feature-board-left-arrow feature-board-arrow scroller-arrow"[\s\S]*aria-label=\{`Scroll \$\{prefix\} items left`\}/,
    );
    assert.match(
      featuredPanelSource,
      /<button[\s\S]*type="button"[\s\S]*class="feature-board-right-arrow feature-board-arrow scroller-arrow"[\s\S]*aria-label=\{`Scroll \$\{prefix\} items right`\}/,
    );
  });

  it('uses real buttons for games scroller arrows', () => {
    assert.match(
      gamesScrollerSource,
      /<button[\s\S]*type="button"[\s\S]*class="game-left-arrow game-arrow scroller-arrow"[\s\S]*aria-label="Scroll games left"/,
    );
    assert.match(
      gamesScrollerSource,
      /<button[\s\S]*type="button"[\s\S]*class="game-right-arrow game-arrow scroller-arrow"[\s\S]*aria-label="Scroll games right"/,
    );
  });
});

describe('HomeSlideshow control markup contract', () => {
  it('uses real buttons for overlay arrows and pause control', () => {
    assert.match(
      homeSlideshowSource,
      /<button[\s\S]*type="button"[\s\S]*class="slide-card-carousel-arrow-container left-arrow"[\s\S]*aria-label="Previous slide"/,
    );
    assert.match(
      homeSlideshowSource,
      /<button[\s\S]*type="button"[\s\S]*class="slide-card-carousel-arrow-container right-arrow"[\s\S]*aria-label="Next slide"/,
    );
    assert.match(
      homeSlideshowSource,
      /<button[\s\S]*type="button"[\s\S]*class="pause-button"[\s\S]*aria-label="Pause slideshow"/,
    );
    assert.doesNotMatch(homeSlideshowSource, /role="button"/);
  });
});
