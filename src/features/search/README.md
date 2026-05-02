# src/features/search

## Purpose

Owns the site-wide search dialog and the server-side search contract exposed
through `/api/search`.

## Public API (The Contract)

- `store.ts`
  Exports `$searchOpen`, `openSearch()`, and `closeSearch()`.
- `types.ts`
  Exports `SearchResult`.
- `components/SearchDialog.tsx`
  Search dialog island for query input, debounce, keyboard nav, and results UI.

## Dependencies

Allowed imports:

- `@core/db`
- `@core/images`
- `@core/media`
- `@core/article-helpers`
- `@core/config`
- `nanostores` and React/browser APIs

Forbidden imports:

- Other feature internals
- Direct UI-side ownership of backend ranking rules

## Mutation Boundaries

- Client side may issue `GET /api/search` requests.
- Server side may query the configured search backend.
- No filesystem or project-file writes.

## Domain Invariants

- The client contract remains stable even if the backend implementation changes.
- Query normalization, ranking, and backend choice stay server-side.
- The search dialog owns only UX state, not canonical data.

## Local Sub-Boundaries

- [components/README.md](components/README.md)
- [tests/README.md](tests/README.md)
