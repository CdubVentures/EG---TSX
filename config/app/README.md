# config/app

## Purpose

FastAPI runtime for the React-based config desktop shell. It serves the HTML/CSS/JS
bundle, exposes the panel payload routes, and delegates all panel logic to
`runtime.py`.

## Public API (The Contract)

- `main.py`
  Owns `/`, `/app.bundle.js`, `/app.css`, `/api/bootstrap`, `/api/watch`,
  `/api/health`, `/api/shell/theme`, and every `/api/panels/*` route for
  `categories`, `content`, `index-heroes`, `hub-tools`, `navbar`, `slideshow`,
  `image-defaults`, `cache-cdn`, and `ads`.
- `runtime.py`
  Owns `ConfigRuntime`, shell payload generation, watch payload generation, and
  every `get_*_payload()`, `preview_*()`, and `save_*()` implementation used by
  the routes.
- `launcher.pyw`
  Native launch entrypoint for the FastAPI shell.

## Dependencies

Allowed imports:

- `config/lib/*`
- `config/data/*.json`
- `config/ui/app.bundle.js` and `config/ui/app.css`
- `src/content/**` and `.env` only through the documented runtime helpers
- FastAPI and Python standard library modules

Forbidden imports:

- Tk panel implementations under `config/panels/`
- Direct UI bundle internals

## Mutation Boundaries

- May write `config/data/*.json` and `config/data/settings.json` via `ConfigStore`.
- May update `.env` and `src/content/**/index.md` where the panel contract
  explicitly requires it.
- Must not write unrelated project files.

## Domain Invariants

- Route handlers stay thin; normalization and persistence logic belongs in
  `runtime.py`.
- The React shell never writes files directly; all mutations flow through these
  API routes.
- Watch payloads are derived from filesystem mtimes, not client memory.
