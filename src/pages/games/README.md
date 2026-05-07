# pages/games — Local Contract

## Purpose
File-based routes for the games index page family. Renders a 3×2 day-seeded
dashboard plus an A–Z box-art poster grid of every published game, with
optional genre filtering and pagination.

## Public API (The Contract)
- `[...slug].astro` — emits these URLs:
  - `/games/` (all games, page 1)
  - `/games/page/N/` (all games, page N)
  - `/games/{genre}/` (genre-filtered, page 1)
  - `/games/{genre}/page/N/` (genre-filtered, page N)
- Genre slugs come from `entry.data.genre` (free-text, comma/pipe/slash-delimited)
  parsed by `parseGenres()` in `@features/site-index/games-helpers`.
- Out of scope: `/games/{slug}/` single-game pages — handled by a future route.

## Dependencies
- Allowed: `@shared/layouts/MainLayout`, `@features/site-index/*`,
  `@core/content` (via the definitions module).
- Forbidden: direct content-collection access; cross-feature imports.

## Domain Invariants
- Static paths emit only for genre slugs that have ≥1 published game — no empty
  buckets, no `/games/misc/` unless real games lack a `genre` field.
- Dashboard tiles are deterministic per UTC-day per route URL (FNV-1a + mulberry32).
- Games with `publish: false` are excluded from every bucket.
- Genre filtering is membership: a game with `"action, rpg"` appears in both
  `/games/action/` and `/games/rpg/`.
- Genre-slug routes never collide with single-game routes because static paths
  are emitted only for known genre slugs.
