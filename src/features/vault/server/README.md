# src/features/vault/server

## Purpose

`src/features/vault/server/` owns the server-side persistence contract for the
comparison vault.

## Public API (The Contract)

- `db.ts`
  DynamoDB-backed read/write helpers for vault state.
- `schema.ts`
  Request/response schemas for server and API validation.

## Dependencies

Allowed imports:

- `@core/*`
- AWS DynamoDB SDKs
- `zod`

## Mutation Boundaries

- May read/write the documented vault persistence store.

## Domain Invariants

- Server persistence must preserve the vault schema and rev-based sync rules.
