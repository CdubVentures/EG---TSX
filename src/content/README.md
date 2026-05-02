# src/content

## Purpose

`src/content/` is the canonical authored-content store for EG - TSX. It holds
the article collections and product JSON that the site build and runtime query.

## Public API (The Contract)

- Collection schemas are defined in `../content.config.ts`.
- Article collections live under collection folders such as `reviews/`,
  `guides/`, `news/`, `brands/`, `games/`, and `pages/`, typically as
  `{slug}/index.md` or `{slug}/index.mdx`.
- Product data lives under `data-products/<category>/<brand>/<slug>.json`.

## Dependencies

Allowed dependencies and references:

- Frontmatter fields validated by `../content.config.ts`
- Checked-in media paths under `public/images/**`
- Migration and validation scripts under `../../scripts/*`

Forbidden dependencies:

- Ad hoc frontmatter fields that are not defined in `../content.config.ts`
- Runtime-only state from `src/features/*` or `src/shared/*`

## Mutation Boundaries

- Human editing and migration scripts may create, move, or update entries here.
- Runtime application code treats this directory as read-only.

## Domain Invariants

- `content.config.ts` is the schema SSOT for every collection.
- Product/category identity must align with `@core/category-contract`.
- Slugs and filesystem locations are canonical; derived indexes and DB syncs
  must adapt to this content, not redefine it.
