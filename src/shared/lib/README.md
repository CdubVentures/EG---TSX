# src/shared/lib

## Purpose

`src/shared/lib/` contains tiny reusable view helpers used by shared UI and
feature presentation code.

## Public API (The Contract)

- `cn.ts`
  Class-name composition helper.

## Dependencies

Allowed imports:

- TypeScript standard library only

## Mutation Boundaries

- Read-only utility code.

## Domain Invariants

- Shared helpers here stay generic and presentation-oriented.
