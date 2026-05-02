# src

## Purpose

`src/` is the application root for EG - TSX. It contains the site composition
boundaries: routing, content schemas, core shared kernel modules, shared UI, and
feature slices.

## Public API (The Contract)

- `content.config.ts`
  Defines the canonical Astro content collections and their schemas.
- `middleware.ts`
  Owns request-time guards and redirects before page or API handlers run.
- Boundary roots:
  `core/`, `features/`, `shared/`, `pages/`, `content/`, `styles/`, and `types/`.

## Dependencies

Allowed imports:

- Astro runtime and content APIs
- TypeScript/Node standard library APIs
- Public contracts exported from `src/core/*`, `src/features/*`, and `src/shared/*`

Forbidden imports:

- `config/app/*`
- `tools/deploy-dashboard/*`
- Direct cross-feature imports that bypass a feature's public contract

## Mutation Boundaries

- Runtime code under `src/` may mutate only through documented server routes,
  browser state, cookies, or external services owned by the importing boundary.
- `content.config.ts` and `middleware.ts` must not write project files.

## Domain Invariants

- `pages/` is the composition root for route entrypoints.
- `content/` is the canonical authored-content source; runtime code reads it but
  does not treat generated output as canonical.
- `core/` remains a leaf dependency and must not depend on `features/`,
  `shared/`, or `pages/`.
- `shared/` stays reusable and presentational; feature ownership lives in
  `features/`.
