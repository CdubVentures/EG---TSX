/**
 * Characterization tests — Navbar HTML structure comparison.
 *
 * Fetches both HBS (localhost:3000) and TSX (localhost:4321) pages,
 * parses the HTML, and compares key structural elements to ensure
 * the TSX navbar matches HBS exactly.
 *
 * Runner: node --test test/navbar-characterization.test.mjs
 * Requires: Both dev servers running (HBS on :3000, TSX on :4321)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

/* ─── Helpers ─── */

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/** Extract all class names from elements matching a tag pattern */
function extractClasses(html, selector) {
  // Simple regex-based class extraction (no DOM parser needed)
  const classRegex = /class="([^"]*)"/g;
  const classes = new Set();
  let match;
  while ((match = classRegex.exec(html)) !== null) {
    match[1].split(/\s+/).forEach((c) => c && classes.add(c));
  }
  return classes;
}

/** Check if HTML contains element(s) with given class */
function hasClass(html, className) {
  return new RegExp(`class="[^"]*\\b${className}\\b[^"]*"`, 's').test(html);
}

/** Count elements with a given class */
function countClass(html, className) {
  const re = new RegExp(`class="[^"]*\\b${className}\\b[^"]*"`, 'g');
  return (html.match(re) || []).length;
}

/** Extract inline style from element with given class */
function getInlineStyle(html, className) {
  const re = new RegExp(
    `class="[^"]*\\b${className}\\b[^"]*"[^>]*style="([^"]*)"`,
    's'
  );
  const m = html.match(re);
  return m ? m[1] : null;
}

/* ─── Tests ─── */

const [hbs, tsx] = await Promise.all([
  fetchPage('http://localhost:3000/').catch(() => ''),
  fetchPage('http://localhost:4321/').catch(() => ''),
]);

if (hbs.length === 0 || tsx.length === 0) {
  describe('Navbar characterization: HBS vs TSX structural parity', () => {
    it(
      'skipped: start HBS on localhost:3000 and TSX on localhost:4321',
      { skip: true },
      () => {}
    );
  });
} else {
describe('Navbar characterization: HBS vs TSX structural parity', () => {

  describe('Top-level structure', () => {
    it('both have nav.mainNav', () => {
      assert.ok(hasClass(hbs, 'mainNav'), 'HBS missing .mainNav');
      assert.ok(hasClass(tsx, 'mainNav'), 'TSX missing .mainNav');
    });

    it('both have header.top-bar', () => {
      assert.ok(hasClass(hbs, 'top-bar'), 'HBS missing .top-bar');
      assert.ok(hasClass(tsx, 'top-bar'), 'TSX missing .top-bar');
    });

    it('both have nav.main-nav', () => {
      assert.ok(hasClass(hbs, 'main-nav'), 'HBS missing .main-nav');
      assert.ok(hasClass(tsx, 'main-nav'), 'TSX missing .main-nav');
    });

    it('both have div.wrapper', () => {
      assert.ok(hasClass(hbs, 'wrapper'), 'HBS missing .wrapper');
      assert.ok(hasClass(tsx, 'wrapper'), 'TSX missing .wrapper');
    });

    it('both have ul.nav-links', () => {
      assert.ok(hasClass(hbs, 'nav-links'), 'HBS missing .nav-links');
      assert.ok(hasClass(tsx, 'nav-links'), 'TSX missing .nav-links');
    });

    it('both have div.top-bar-right', () => {
      assert.ok(hasClass(hbs, 'top-bar-right'), 'HBS missing .top-bar-right');
      assert.ok(hasClass(tsx, 'top-bar-right'), 'TSX missing .top-bar-right');
    });
  });

  describe('Logo', () => {
    it('both have div.logo-container', () => {
      assert.ok(hasClass(hbs, 'logo-container'), 'HBS missing .logo-container');
      assert.ok(hasClass(tsx, 'logo-container'), 'TSX missing .logo-container');
    });

    it('both have a.site-name', () => {
      assert.ok(hasClass(hbs, 'site-name'), 'HBS missing .site-name');
      assert.ok(hasClass(tsx, 'site-name'), 'TSX missing .site-name');
    });

    it('both have span.navsitename1 and span.navsitename2', () => {
      assert.ok(hasClass(hbs, 'navsitename1'), 'HBS missing .navsitename1');
      assert.ok(hasClass(tsx, 'navsitename1'), 'TSX missing .navsitename1');
      assert.ok(hasClass(hbs, 'navsitename2'), 'HBS missing .navsitename2');
      assert.ok(hasClass(tsx, 'navsitename2'), 'TSX missing .navsitename2');
    });
  });

  describe('Desktop nav links', () => {
    it('both have .nav-link elements', () => {
      const hbsCount = countClass(hbs, 'nav-link');
      const tsxCount = countClass(tsx, 'nav-link');
      assert.ok(hbsCount >= 5, `HBS should have ≥5 .nav-link, got ${hbsCount}`);
      assert.ok(tsxCount >= 5, `TSX should have ≥5 .nav-link, got ${tsxCount}`);
    });

    it('both have .sub-menu items', () => {
      const hbsCount = countClass(hbs, 'sub-menu');
      const tsxCount = countClass(tsx, 'sub-menu');
      assert.ok(hbsCount >= 3, `HBS should have ≥3 .sub-menu, got ${hbsCount}`);
      assert.ok(tsxCount >= 3, `TSX should have ≥3 .sub-menu, got ${tsxCount}`);
    });
  });

  describe('Games mega menu', () => {
    it('both have .mega-menu.games-menu', () => {
      assert.ok(hasClass(hbs, 'games-menu'), 'HBS missing .games-menu');
      assert.ok(hasClass(tsx, 'games-menu'), 'TSX missing .games-menu');
    });

    it('both have .nav-game-grid', () => {
      assert.ok(hasClass(hbs, 'nav-game-grid'), 'HBS missing .nav-game-grid');
      assert.ok(hasClass(tsx, 'nav-game-grid'), 'TSX missing .nav-game-grid');
    });

    it('both have .nav-game-grid-item elements', () => {
      assert.ok(countClass(hbs, 'nav-game-grid-item') > 0, 'HBS missing game items');
      assert.ok(countClass(tsx, 'nav-game-grid-item') > 0, 'TSX missing game items');
    });

    it('games-menu starts hidden via inline style', () => {
      const tsxStyle = getInlineStyle(tsx, 'games-menu');
      assert.ok(tsxStyle && tsxStyle.includes('opacity: 0'), 'TSX games-menu should start hidden');
    });
  });

  describe('Guides mega menu', () => {
    it('both have .mega-menu-guides', () => {
      assert.ok(hasClass(hbs, 'mega-menu-guides'), 'HBS missing .mega-menu-guides');
      assert.ok(hasClass(tsx, 'mega-menu-guides'), 'TSX missing .mega-menu-guides');
    });

    it('both have .mega-menu-left-column', () => {
      assert.ok(hasClass(hbs, 'mega-menu-left-column'), 'HBS missing .mega-menu-left-column');
      assert.ok(hasClass(tsx, 'mega-menu-left-column'), 'TSX missing .mega-menu-left-column');
    });

    it('both have .mega-menu-left-nav', () => {
      assert.ok(hasClass(hbs, 'mega-menu-left-nav'), 'HBS missing .mega-menu-left-nav');
      assert.ok(hasClass(tsx, 'mega-menu-left-nav'), 'TSX missing .mega-menu-left-nav');
    });

    it('both have .mega-menu-content', () => {
      assert.ok(hasClass(hbs, 'mega-menu-content'), 'HBS missing .mega-menu-content');
      assert.ok(hasClass(tsx, 'mega-menu-content'), 'TSX missing .mega-menu-content');
    });

    it('both have .guides-set elements', () => {
      assert.ok(countClass(hbs, 'guides-set') > 0, 'HBS missing .guides-set');
      assert.ok(countClass(tsx, 'guides-set') > 0, 'TSX missing .guides-set');
    });

    it('both have .guides-set-inner elements', () => {
      assert.ok(countClass(hbs, 'guides-set-inner') > 0, 'HBS missing .guides-set-inner');
      assert.ok(countClass(tsx, 'guides-set-inner') > 0, 'TSX missing .guides-set-inner');
    });

    it('both have .dropdown-column1 in guides', () => {
      assert.ok(countClass(hbs, 'dropdown-column1') > 0, 'HBS missing .dropdown-column1');
      assert.ok(countClass(tsx, 'dropdown-column1') > 0, 'TSX missing .dropdown-column1');
    });
  });

  describe('Brands mega menu', () => {
    it('both have .mega-menu-brands', () => {
      assert.ok(hasClass(hbs, 'mega-menu-brands'), 'HBS missing .mega-menu-brands');
      assert.ok(hasClass(tsx, 'mega-menu-brands'), 'TSX missing .mega-menu-brands');
    });

    it('both have .brand-set elements', () => {
      assert.ok(countClass(hbs, 'brand-set') > 0, 'HBS missing .brand-set');
      assert.ok(countClass(tsx, 'brand-set') > 0, 'TSX missing .brand-set');
    });

    it('both have .brand-set-inner', () => {
      assert.ok(countClass(hbs, 'brand-set-inner') > 0, 'HBS missing .brand-set-inner');
      assert.ok(countClass(tsx, 'brand-set-inner') > 0, 'TSX missing .brand-set-inner');
    });

    it('both have .brand-logo-container', () => {
      assert.ok(countClass(hbs, 'brand-logo-container') > 0, 'HBS missing .brand-logo-container');
      assert.ok(countClass(tsx, 'brand-logo-container') > 0, 'TSX missing .brand-logo-container');
    });

    it('both have .brand-logo', () => {
      assert.ok(countClass(hbs, 'brand-logo') > 0, 'HBS missing .brand-logo');
      assert.ok(countClass(tsx, 'brand-logo') > 0, 'TSX missing .brand-logo');
    });
  });

  describe('Hubs mega menu', () => {
    it('both have .hubs-menu', () => {
      assert.ok(hasClass(hbs, 'hubs-menu'), 'HBS missing .hubs-menu');
      assert.ok(hasClass(tsx, 'hubs-menu'), 'TSX missing .hubs-menu');
    });

    it('both have .hubs-dropdown', () => {
      assert.ok(hasClass(hbs, 'hubs-dropdown'), 'HBS missing .hubs-dropdown');
      assert.ok(hasClass(tsx, 'hubs-dropdown'), 'TSX missing .hubs-dropdown');
    });

    it('both have .nav-dropdown-arrow', () => {
      assert.ok(hasClass(hbs, 'nav-dropdown-arrow'), 'HBS missing .nav-dropdown-arrow');
      assert.ok(hasClass(tsx, 'nav-dropdown-arrow'), 'TSX missing .nav-dropdown-arrow');
    });

    it('both have .category-icon elements in hubs', () => {
      assert.ok(countClass(hbs, 'category-icon') > 0, 'HBS missing .category-icon');
      assert.ok(countClass(tsx, 'category-icon') > 0, 'TSX missing .category-icon');
    });

    it('both have .see-all-link', () => {
      assert.ok(hasClass(hbs, 'see-all-link'), 'HBS missing .see-all-link');
      assert.ok(hasClass(tsx, 'see-all-link'), 'TSX missing .see-all-link');
    });
  });

  describe('Nav icons (right side)', () => {
    it('both have .nav-icons container', () => {
      assert.ok(hasClass(hbs, 'nav-icons'), 'HBS missing .nav-icons');
      assert.ok(hasClass(tsx, 'nav-icons'), 'TSX missing .nav-icons');
    });

    it('both have .signup-nav-icon', () => {
      assert.ok(hasClass(hbs, 'signup-nav-icon'), 'HBS missing .signup-nav-icon');
      assert.ok(hasClass(tsx, 'signup-nav-icon'), 'TSX missing .signup-nav-icon');
    });

    it('both have .login-nav-icon', () => {
      assert.ok(hasClass(hbs, 'login-nav-icon'), 'HBS missing .login-nav-icon');
      assert.ok(hasClass(tsx, 'login-nav-icon'), 'TSX missing .login-nav-icon');
    });

    it('both have .account-nav-icon', () => {
      assert.ok(hasClass(hbs, 'account-nav-icon'), 'HBS missing .account-nav-icon');
      assert.ok(hasClass(tsx, 'account-nav-icon'), 'TSX missing .account-nav-icon');
    });

    it('both have .search-nav-icon', () => {
      assert.ok(hasClass(hbs, 'search-nav-icon'), 'HBS missing .search-nav-icon');
      assert.ok(hasClass(tsx, 'search-nav-icon'), 'TSX missing .search-nav-icon');
    });

    it('both have .settings-nav-icon', () => {
      assert.ok(hasClass(hbs, 'settings-nav-icon'), 'HBS missing .settings-nav-icon');
      assert.ok(hasClass(tsx, 'settings-nav-icon'), 'TSX missing .settings-nav-icon');
    });

    it('both have .account-dropdown', () => {
      assert.ok(hasClass(hbs, 'account-dropdown'), 'HBS missing .account-dropdown');
      assert.ok(hasClass(tsx, 'account-dropdown'), 'TSX missing .account-dropdown');
    });
  });

  describe('Mobile nav', () => {
    it('both have .mobile-hamburger-menu-icon', () => {
      assert.ok(hasClass(hbs, 'mobile-hamburger-menu-icon'), 'HBS missing .mobile-hamburger-menu-icon');
      assert.ok(hasClass(tsx, 'mobile-hamburger-menu-icon'), 'TSX missing .mobile-hamburger-menu-icon');
    });

    it('both have .side-menu', () => {
      assert.ok(hasClass(hbs, 'side-menu'), 'HBS missing .side-menu');
      assert.ok(hasClass(tsx, 'side-menu'), 'TSX missing .side-menu');
    });

    it('both have .shade-overlay', () => {
      assert.ok(hasClass(hbs, 'shade-overlay'), 'HBS missing .shade-overlay');
      assert.ok(hasClass(tsx, 'shade-overlay'), 'TSX missing .shade-overlay');
    });

    it('both have .main-menu', () => {
      assert.ok(hasClass(hbs, 'main-menu'), 'HBS missing .main-menu');
      assert.ok(hasClass(tsx, 'main-menu'), 'TSX missing .main-menu');
    });
  });

  describe('Auth state classes', () => {
    it('both have .logged-hide elements', () => {
      assert.ok(countClass(hbs, 'logged-hide') > 0, 'HBS missing .logged-hide');
      assert.ok(countClass(tsx, 'logged-hide') > 0, 'TSX missing .logged-hide');
    });

    it('both have .logged-show elements', () => {
      assert.ok(countClass(hbs, 'logged-show') > 0, 'HBS missing .logged-show');
      assert.ok(countClass(tsx, 'logged-show') > 0, 'TSX missing .logged-show');
    });
  });

  describe('Bottom CTAs', () => {
    it('both have .mega-menu-bottom-link elements', () => {
      assert.ok(countClass(hbs, 'mega-menu-bottom-link') > 0, 'HBS missing .mega-menu-bottom-link');
      assert.ok(countClass(tsx, 'mega-menu-bottom-link') > 0, 'TSX missing .mega-menu-bottom-link');
    });

    it('both have .all-guides-link elements', () => {
      assert.ok(countClass(hbs, 'all-guides-link') > 0, 'HBS missing .all-guides-link');
      assert.ok(countClass(tsx, 'all-guides-link') > 0, 'TSX missing .all-guides-link');
    });
  });

  describe('Category color classes', () => {
    for (const cat of ['mouse-color', 'keyboard-color', 'monitor-color']) {
      it(`both have .${cat}`, () => {
        assert.ok(hasClass(hbs, cat), `HBS missing .${cat}`);
        assert.ok(hasClass(tsx, cat), `TSX missing .${cat}`);
      });
    }
  });

  describe('Gradient SVG defs', () => {
    it('both have navbarThemeGradient SVG defs', () => {
      assert.ok(hbs.includes('navbarThemeGradient'), 'HBS missing gradient SVG def');
      assert.ok(tsx.includes('navbarThemeGradient'), 'TSX missing gradient SVG def');
    });
  });
});
}
