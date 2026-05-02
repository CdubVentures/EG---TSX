# src/features/search/components

## Purpose

`src/features/search/components/` contains the feature-owned search dialog UI.

## Public API (The Contract)

- `SearchDialog.tsx`

## Dependencies

Allowed imports:

- Public search feature modules
- `@shared/*`
- React and browser APIs

## Mutation Boundaries

- May manage ephemeral query/input UI state and call the documented search API.

## Domain Invariants

- Search UI does not own indexing or search persistence; it consumes the API
  contract from `src/pages/api/search.ts`.
