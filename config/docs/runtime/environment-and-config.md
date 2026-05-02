# Environment And Config

This subsystem is almost entirely file-configured. The Python editor itself does not read site env vars for behavior, but one panel does write a site env var that EG-TSX reads.

## Configuration Surfaces

| Surface | Kind | Source of truth | Consumed by | Notes |
| --- | --- | --- | --- | --- |
| `config/data/*.json` | Runtime config files | `ConfigStore` path map | Tk panels, React runtime, EG-TSX imports | Primary persistent store for the config subsystem |
| `src/content/**/*.md` and `src/content/**/*.mdx` frontmatter | Content metadata | Content files themselves | Navbar panel writes; EG-TSX content collections read | Only Navbar mutates these files |
| `.env` `PUBLIC_ADS_ENABLED` | Public runtime env var | Root `.env` and `.env.example` | Ads panel writes; `src/features/ads/resolve.ts` and `bootstrap.ts` read | Current checked-in value is `false` |
| `public/images/navbar/*.svg` | Static assets | Filesystem | Categories panel and React categories payload check presence; site nav renders icons | Read-only from config app |
| `config/ui/app.bundle.js` | Generated frontend asset | esbuild output | FastAPI serves it at `/app.bundle.js` | Required for React shell startup |
| `config/ui/app.css` | Static frontend asset | Checked-in CSS file | FastAPI serves it at `/app.css` | Required for React shell startup |

## Python And Build Dependencies

### Python packages

`config/app/requirements.txt` defines the React shell's Python runtime dependencies:

- `fastapi>=0.115.0`
- `uvicorn>=0.34.0`
- `pywebview>=5.0`

The Tk app also depends on the standard-library `tkinter` and local modules under `config/lib` and `config/panels`.

### Frontend bundle build

Both React launch paths build the frontend with esbuild:

```text
npx esbuild config/ui/_entry.tsx --bundle --format=iife --jsx=automatic --charset=utf8 --outfile=config/ui/app.bundle.js
```

`config/scripts/start-browser.cmd` adds `--sourcemap` for the browser-hosted dev path.

## HTTP Surface Of The React Shell

| Route | Method | Producer | Consumer | Purpose |
| --- | --- | --- | --- | --- |
| `/` | `GET` | `config/app/main.py` | Browser or pywebview | Serves the single-page shell |
| `/app.bundle.js` | `GET` | `config/app/main.py` | Browser or pywebview | Serves the built React bundle |
| `/app.css` | `GET` | `config/app/main.py` | Browser or pywebview | Serves the shell stylesheet |
| `/api/bootstrap` | `GET` | `ConfigRuntime.get_shell_payload()` plus all 9 `get_*_payload()` methods | `config/ui/app.tsx` | Initial shell plus every panel payload |
| `/api/watch` | `GET` | `ConfigRuntime.get_watch_payload()` | `config/ui/app.tsx` | File-version polling |
| `/api/panels/<panel>` | `GET` | `ConfigRuntime.get_*_payload()` | `config/ui/app.tsx` | Panel refresh for `categories`, `content`, `index-heroes`, `hub-tools`, `navbar`, `slideshow`, `image-defaults`, `cache-cdn`, and `ads` |
| `/api/panels/<panel>/preview` | `PUT` | `ConfigRuntime.preview_*()` | `config/ui/app.tsx` | Unsaved in-memory preview for every panel with preview support |
| `/api/panels/<panel>/save` | `PUT` | `ConfigRuntime.save_*()` | `config/ui/app.tsx` | Persist panel-owned files while preserving non-owned siblings |
| `/api/panels/ads/scan` | `POST` | `ConfigRuntime.scan_ads_positions()` | `config/ui/app.tsx` | Source-usage scan for named ad positions |
| `/api/shell/theme` | `PUT` | `ConfigRuntime.save_theme()` | `config/ui/app.tsx` | Persist current shell theme in `settings.json` |
| `/api/health` | `GET` | `config/app/main.py` | Launcher | Startup readiness check |

For the route-by-route panel matrix, see [Routing and GUI](../frontend/routing-and-gui.md).

## Environment Variables Actually In Scope

| Variable | Classification | Defined in | Written by | Read by | Notes |
| --- | --- | --- | --- | --- | --- |
| `PUBLIC_ADS_ENABLED` | Runtime, public | `.env`, `.env.example` | `config/panels/ads.py` | `src/features/ads/resolve.ts`, `src/features/ads/bootstrap.ts` | The only verified site env var directly touched by the config editor |

## Variables Explicitly Out Of Scope

The root `.env` contains additional variables such as `DATABASE_URL`, `PUBLIC_COGNITO_*`, `COGNITO_*`, `CDN_BASE_URL`, `DYNAMODB_TABLE_NAME`, and affiliate tags. They are intentionally excluded from the config contract docs because no code under `config/` reads or writes them.

## Startup Preconditions

- The Tk app requires a local Python environment with Tk support.
- The React shell requires Python plus the packages in `config/app/requirements.txt`.
- The React shell also requires Node tooling capable of running `npx esbuild`.
- `config/ui/app.bundle.js` and `config/ui/app.css` must exist before `FastAPI` will start successfully.

## Cross-Links

- [Python Application](python-application.md)
- [System Map](../architecture/system-map.md)
- [Data Contracts](../data/data-contracts.md)
- [Ads](../panels/ads.md)

## Validated Against

- `config/app/main.py`
- `config/app/runtime.py`
- `config/app/launcher.pyw`
- `config/app/requirements.txt`
- `config/launch-react-config.pyw`
- `config/start-react-browser.cmd`
- `config/scripts/start-browser.cmd`
- `config/panels/ads.py`
- `.env`
- `.env.example`
- `src/features/ads/resolve.ts`
- `src/features/ads/bootstrap.ts`
