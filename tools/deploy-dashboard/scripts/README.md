# tools/deploy-dashboard/scripts

## Purpose

`tools/deploy-dashboard/scripts/` holds local helper scripts for the deploy
dashboard operator app.

## Public API (The Contract)

- `start-browser.cmd`
  Opens the local deploy-dashboard URL.
- `fake_publish_updates.py`
  Emits simulated publish/update events for local dashboard testing.

## Dependencies

Allowed imports and dependencies:

- Local OS/browser execution
- Python standard library and documented dashboard runtime hooks

Forbidden dependencies:

- Direct replacement of the root site deploy path in `../../scripts/deploy-aws.mjs`

## Mutation Boundaries

- May launch local tools or emit fake local update events for testing.
- Must not mutate live deployment infrastructure.

## Domain Invariants

- These scripts exist to support the dashboard app locally; production deploy
  orchestration remains in the root `scripts/` boundary.
