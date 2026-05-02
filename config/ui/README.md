# config/ui

## Purpose

React desktop shell for the config app. This boundary owns the client-side panel
state, editor interactions, and fetch contract with `config/app/`.

## Public API (The Contract)

- `_entry.tsx`
  Bundle entrypoint.
- `app.tsx`
  Exports `ConfigDesktopApp`, the React shell.
- `panels.tsx`
  Exports the extracted panel view components.
- `desktop-model.ts`
  Owns payload types, snapshot builders, and request payload builders.
- Editor modules:
  `content-editor.ts`, `navbar-editor.ts`, `slideshow-editor.mjs`,
  `image-defaults-editor.mjs`, `cache-cdn-editor.mjs`, `ads-editor.mjs`.
- UI support:
  `shared-ui.tsx`, `save-helpers.ts`, `app.css`.

## Dependencies

Allowed imports:

- React and browser APIs
- `config/app` HTTP routes via `fetch('/api/*')`
- Local editor/model modules

Forbidden imports:

- Direct filesystem access
- Direct writes to `config/data/*`
- Tk panel modules

## Mutation Boundaries

- May mutate local React state and issue HTTP requests to `config/app`.
- Must not read or write project files directly.

## Domain Invariants

- The React shell mirrors the server payload contract; disk writes stay server-side.
- Editor modules remain pure or near-pure so they can be tested without the DOM.
- Panel UI state is ephemeral; canonical config state lives in the backend store.
