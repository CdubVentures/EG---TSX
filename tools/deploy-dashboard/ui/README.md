# tools/deploy-dashboard/ui

## Purpose

React-based operator UI for the deploy dashboard. This boundary renders the
dashboard, translates backend payloads into view state, and consumes SSE/API
responses from the backend.

## Public API (The Contract)

- `_entry.jsx` - bundle entrypoint
- `dashboard.jsx` - main operator UI
- `publish-cdn-plan.ts` - CDN plan formatting helpers
- `queued-cdn-state.ts` - queued CDN state helpers
- `site-stage-progress.ts` - stage/progress helpers
- `cdn-path-status.ts` - per-path CDN status helpers
- `invalidation-paths.js` - invalidation-path helpers
- `settings.json` - local UI settings contract

## Dependencies

Allowed imports:

- Browser APIs and React
- `/api/*` routes exposed by `app/`
- Local helper modules in this folder

Forbidden imports:

- Direct subprocess execution
- Direct filesystem writes

## Mutation Boundaries

- May mutate local UI state and browser-side settings.
- Must not invoke deploy commands except through backend routes.

## Domain Invariants

- Operator actions are backend-owned even when the UI initiates them.
- Helper modules should stay deterministic and testable without backend access.
