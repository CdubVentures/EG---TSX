# scripts

## Purpose

`scripts/` holds operator-run build, deploy, migration, and validation entry
points for EG - TSX. These scripts orchestrate existing runtime contracts; they
do not redefine them.

## Public API (The Contract)

- Build and validation:
  `run-astro-build.mjs`, `validate-route-graph.mjs`,
  `validate-image-links.mjs`, and `validate-seo-sitemap.mjs`.
- Deploy and AWS orchestration:
  `deploy-aws.mjs`, `aws-operator.mjs`, `bootstrap-artifact-bucket.mjs`,
  `bootstrap-deploy.mjs`, `bootstrap-main-stack.mjs`, and
  `invalidation-core.mjs`.
- Data and migration utilities:
  `sync-db.mjs`, `sync-db-remote.mjs`, `sync-rename.mjs`, `build-media.mjs`,
  and the preserved `migrate-*.mjs` utilities.
- TypeScript gateways:
  `aws-operator.ts`, `invalidation-core.ts`, `run-astro-build.ts`,
  and `validate-seo-sitemap.ts`.
- Shared helpers:
  `lib/`.

## Dependencies

Allowed imports:

- `src/core/*`
- `infrastructure/aws/*`
- Standard library APIs and explicitly configured CLIs/services

Forbidden imports:

- `src/shared/*`
- Client-only feature UI
- `config/app/*`

## Mutation Boundaries

- May write build artifacts under `dist/` or deployment artifacts under
  `infrastructure/aws/build/`.
- May mutate AWS, databases, or content files only when that specific script is
  designed as an operator action.

## Domain Invariants

- `run-astro-build` stays the validation gate before deploy flows.
- Deploy scripts orchestrate infrastructure and build steps; they should call
  core helpers instead of duplicating SEO or route-graph logic.
- Migration scripts must preserve the canonical content and config contracts.

## Local Sub-Boundaries

- [lib/README.md](lib/README.md)
- [tests/README.md](tests/README.md)
