# src/pages/login

## Purpose

`src/pages/login/` contains provider-specific login launch routes.

## Public API (The Contract)

- `google.ts`
- `discord.ts`

## Dependencies

Allowed imports:

- `@features/auth/*`
- Astro runtime APIs

## Mutation Boundaries

- May start provider login redirects through the documented auth helpers.

## Domain Invariants

- Login routes are thin launchers; provider protocol ownership stays in the auth
  feature.
