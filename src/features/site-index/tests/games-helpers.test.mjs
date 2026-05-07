import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  slugifyGenre,
  labelFromSlug,
  titleCase,
  parseGenres,
  stripExtAndSize,
  ensureBoxCoverBase,
  ensureHeroBase,
  packGame,
  buildGenreCounts,
  isPublishedGame,
  pickOgImage,
} from '../games-helpers.mjs';

describe('slugifyGenre', () => {
  it('lowercases and dasherizes', () => {
    assert.equal(slugifyGenre('Battle Royale Games'), 'battle-royale-games');
  });
  it('collapses runs of non-alphanumerics', () => {
    assert.equal(slugifyGenre('  RPG / MMO  '), 'rpg-mmo');
  });
  it('trims leading and trailing dashes', () => {
    assert.equal(slugifyGenre('---hero shooter---'), 'hero-shooter');
  });
  it('returns empty for nullish', () => {
    assert.equal(slugifyGenre(null), '');
    assert.equal(slugifyGenre(undefined), '');
    assert.equal(slugifyGenre(''), '');
  });
});

describe('labelFromSlug', () => {
  it('replaces dashes with spaces', () => {
    assert.equal(labelFromSlug('battle-royale-games'), 'battle royale games');
  });
  it('collapses extra whitespace', () => {
    assert.equal(labelFromSlug('battle-royale--games'), 'battle royale games');
  });
});

describe('titleCase', () => {
  it('uppercases each word', () => {
    assert.equal(titleCase('battle-royale-games'), 'Battle Royale Games');
  });
});

describe('parseGenres', () => {
  it('parses comma-delimited string', () => {
    assert.deepEqual(parseGenres({ genre: 'Action, Adventure' }), ['action', 'adventure']);
  });
  it('parses pipe-delimited string', () => {
    assert.deepEqual(parseGenres({ genre: 'RPG|MMO' }), ['rpg', 'mmo']);
  });
  it('parses slash-delimited string', () => {
    assert.deepEqual(parseGenres({ genre: 'Hero Shooter / FPS' }), ['hero-shooter', 'fps']);
  });
  it('parses single string', () => {
    assert.deepEqual(parseGenres({ genre: 'battle royale games' }), ['battle-royale-games']);
  });
  it('parses array input', () => {
    assert.deepEqual(parseGenres({ genre: ['Action', 'Adventure'] }), ['action', 'adventure']);
  });
  it('returns empty array for missing genre', () => {
    assert.deepEqual(parseGenres({}), []);
    assert.deepEqual(parseGenres({ genre: '' }), []);
    assert.deepEqual(parseGenres({ genre: null }), []);
  });
});

describe('stripExtAndSize', () => {
  it('strips webp extension', () => {
    assert.equal(stripExtAndSize('/images/games/foo/bar.webp'), '/images/games/foo/bar');
  });
  it('strips size suffix and extension', () => {
    assert.equal(stripExtAndSize('/images/games/foo/bar_xxl.webp'), '/images/games/foo/bar');
  });
  it('handles missing input', () => {
    assert.equal(stripExtAndSize(''), '');
    assert.equal(stripExtAndSize(null), '');
  });
});

describe('ensureBoxCoverBase', () => {
  it('uses boxCoverArt when present', () => {
    assert.equal(
      ensureBoxCoverBase({ boxCoverArt: '/images/games/apex-legends/box-art-cover_xl.webp' }, 'apex-legends'),
      '/images/games/apex-legends/box-art-cover',
    );
  });
  it('falls back to convention', () => {
    assert.equal(
      ensureBoxCoverBase({}, 'valorant'),
      '/images/games/valorant/box-art-cover',
    );
  });
  it('treats bare stems as relative to the game folder', () => {
    assert.equal(
      ensureBoxCoverBase({ boxCoverArt: 'cover' }, 'fortnite'),
      '/images/games/fortnite/cover',
    );
  });
});

describe('ensureHeroBase', () => {
  it('prefers hero stem', () => {
    assert.equal(
      ensureHeroBase({ hero: 'hero-img', heroAlt: 'alt', boxCoverArt: 'box-art-cover' }, 'apex-legends'),
      '/images/games/apex-legends/hero-img',
    );
  });
  it('falls back to heroAlt', () => {
    assert.equal(
      ensureHeroBase({ heroAlt: 'alt' }, 'foo'),
      '/images/games/foo/alt',
    );
  });
  it('falls back to boxCoverArt', () => {
    assert.equal(
      ensureHeroBase({ boxCoverArt: 'cover' }, 'foo'),
      '/images/games/foo/cover',
    );
  });
  it('falls back to convention', () => {
    assert.equal(
      ensureHeroBase({}, 'foo'),
      '/images/games/foo/hero-img',
    );
  });
});

describe('packGame', () => {
  it('packs a game entry into the canonical shape', () => {
    const entry = {
      id: 'apex-legends',
      data: {
        title: 'Apex Legends',
        game: 'Apex Legends',
        genre: 'battle royale games',
        hero: 'box-art-cover',
        iDashboard: 'all_2',
        publish: true,
      },
    };
    const packed = packGame(entry);
    assert.equal(packed.slug, 'apex-legends');
    assert.equal(packed.name, 'Apex Legends');
    assert.equal(packed.url, '/games/apex-legends/');
    assert.deepEqual(packed.genres, ['battle-royale-games']);
    assert.equal(packed.boxCoverArt, '/images/games/apex-legends/box-art-cover');
    assert.equal(packed.logoBase, '/images/games/apex-legends/box-art-cover');
    assert.equal(packed.logoExt, 'webp');
    assert.equal(packed.iDashboard, 'all_2');
    assert.equal(packed.iFilteredDashboard, null);
  });
});

describe('buildGenreCounts', () => {
  it('tallies games by genre', () => {
    const games = [
      { genres: ['action'] },
      { genres: ['action', 'rpg'] },
      { genres: ['rpg'] },
      { genres: [] },
    ];
    const counts = buildGenreCounts(games);
    assert.equal(counts.get('action'), 2);
    assert.equal(counts.get('rpg'), 2);
    assert.equal(counts.get('misc'), 1);
  });
});

describe('isPublishedGame', () => {
  it('treats undefined publish as published', () => {
    assert.equal(isPublishedGame({ data: {} }), true);
  });
  it('respects explicit false', () => {
    assert.equal(isPublishedGame({ data: { publish: false } }), false);
  });
  it('respects explicit true', () => {
    assert.equal(isPublishedGame({ data: { publish: true } }), true);
  });
});

describe('pickOgImage', () => {
  it('uses first dashboard tile if present', () => {
    const dash = [{ logoBase: '/images/games/apex-legends/hero-img', logoExt: 'webp' }];
    assert.equal(
      pickOgImage(dash, [], 'https://eggear.com'),
      'https://eggear.com/images/games/apex-legends/hero-img_xl.webp',
    );
  });
  it('falls back to first list item', () => {
    const list = [{ boxCoverArt: '/images/games/valorant/box-art-cover' }];
    assert.equal(
      pickOgImage([], list, 'https://eggear.com'),
      'https://eggear.com/images/games/valorant/box-art-cover_xl.webp',
    );
  });
  it('returns empty when nothing usable', () => {
    assert.equal(pickOgImage([], [], 'https://eggear.com'), '');
  });
});
