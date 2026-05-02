# config/scripts

## Purpose

`config/scripts/` contains small local launch helpers for the config manager.

## Public API (The Contract)

- `start-browser.cmd`
  Opens the local config-manager URL for operator convenience.

## Dependencies

Allowed imports and dependencies:

- Local OS/browser execution only

Forbidden dependencies:

- Business logic from `config/app/*` or `src/*`

## Mutation Boundaries

- May launch local processes or browser windows.
- Must not become a second implementation surface for config-manager logic.

## Domain Invariants

- These scripts stay as thin wrappers around the real app entrypoints.
