# src/types

## Purpose

`src/types/` holds ambient type declarations for vendor globals and test-only
overrides used across the app.

## Public API (The Contract)

- `vendor.d.ts`
  Ambient types for runtime globals and third-party browser integrations.
- `test-overrides.d.ts`
  Test-only ambient overrides.

## Dependencies

Allowed imports and references:

- TypeScript ambient declarations only

## Mutation Boundaries

- Read-only type metadata. No runtime side effects.

## Domain Invariants

- Prefer adding vendor/test ambient types here over using `as any` or
  `@ts-ignore`.
