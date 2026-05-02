# Python Application

This document covers the Python app itself: the legacy Tk desktop editor, the full React desktop shell, and the shared runtime services both surfaces use.

## Entry Points

| Entry point | Mode | What it starts | Current role |
| --- | --- | --- | --- |
| `config/eg-config.pyw` | Desktop Tk | `MegaConfig` window, panel registry, `ConfigStore`, `ConfigWatcher`, `DataCache` | Authoritative full editor |
| `config/launch-react-config.pyw` | Desktop React | `app.launcher.main()` -> bundle build -> local Uvicorn -> pywebview window | Full React desktop shell |
| `config/start-react-browser.cmd` | Browser React | esbuild bundle -> `python -m uvicorn main:app --port 8430` | Browser-hosted dev shell |

## Legacy Tk App: `eg-config.pyw`

### Startup Sequence

1. Calls `setup_dpi_awareness()` before any Tk window is created.
2. Creates `ConfigStore`, `DataCache`, and `ConfigWatcher`.
3. Registers the nine sidebar panels from `_NAV_ITEMS`.
4. Builds the fixed shell layout: sidebar, context bar, panel host, status bar.
5. Eager-loads `Categories` and lazy-loads the remaining panels on first visit.
6. Binds `Ctrl+S` for save and `Ctrl+1` through `Ctrl+9` for panel switching.
7. Subscribes to `ConfigStore.CATEGORIES` so accent colors and dependent panels refresh when category state changes.

### Panel Registry

| Panel | Tk implementation | Write surface | Panel doc |
| --- | --- | --- | --- |
| Categories | `panels.categories.CategoriesPanel` | `config/data/categories.json` | [Categories](../panels/categories.md) |
| Content | `panels.content.ContentPanel` | `config/data/content.json` keys `slots`, `pinned`, `badges`, `excluded` | [Content Dashboard](../panels/content-dashboard.md) |
| Index Heroes | `panels.index_heroes.IndexHeroesPanel` | `config/data/content.json` key `indexHeroes` | [Index Heroes](../panels/index-heroes.md) |
| Hub Tools | `panels.hub_tools.HubToolsPanel` | `config/data/hub-tools.json` | [Hub Tools](../panels/hub-tools.md) |
| Navbar | `panels.navbar.NavbarPanel` | `config/data/navbar-guide-sections.json` plus `src/content` frontmatter | [Navbar](../panels/navbar.md) |
| Slideshow | `panels.slideshow.SlideshowPanel` | `config/data/slideshow.json` | [Slideshow](../panels/slideshow.md) |
| Image Defaults | `panels.image_defaults.ImageDefaultsPanel` | `config/data/image-defaults.json` | [Image Defaults](../panels/image-defaults.md) |
| Ads | `panels.ads.AdsPanel` | `ads-registry.json`, `inline-ads-config.json`, `direct-sponsors.json`, root `.env` | [Ads](../panels/ads.md) |
| Cache / CDN | `panels.cache_cdn.CacheCdnPanel` | `config/data/cache-cdn.json` | [Cache / CDN](../panels/cache-cdn.md) |

### Shared Shell Behavior

- `Ctrl+S` saves all dirty loaded panels, not just the active panel.
- Category edits can propagate before save through `ConfigStore.preview(...)`.
- `ConfigWatcher` polls every 2000 ms and reloads changed files into the store.
- The status bar starts as `Ready  ·  Ctrl+S to save` in Tk and updates after saves.

## React Desktop Shell

### Startup Sequence

1. `config/launch-react-config.pyw` delegates to `config/app/launcher.pyw`.
2. The launcher runs `npx esbuild config/ui/_entry.tsx --bundle --format=iife --jsx=automatic --charset=utf8 --outfile=config/ui/app.bundle.js`.
3. It prefers port `8430`, falling back to a free localhost port when needed.
4. It starts `uvicorn main:app`.
5. It waits for `/api/health`.
6. It opens a pywebview window pointed at the local FastAPI app.

The browser launcher follows the same application path, but uses a fixed `http://localhost:8430` URL and runs without pywebview.

### Current React Coverage

- `config/app/main.py` serves the shell HTML, `app.bundle.js`, `app.css`, and all 9 panel APIs.
- `config/ui/app.tsx` renders the full chrome with all 9 panels fully ported: Categories, Content, Index Heroes, Hub Tools, Navbar, Slideshow, Image Defaults, Cache / CDN, Ads.
- The shell polls `/api/watch` every 2000 ms and reacts to version changes across all panels.

## Shared Runtime Services

### `ConfigStore`

- Owns all JSON file paths under `config/data`.
- Rebuilds derived category state after category reload or save.
- Supports `subscribe()`, `notify()`, and `preview()` for reactive panel coordination.
- Holds one transient cross-panel buffer: `brand_categories`, used by Navbar and Index Heroes before save.

### `ConfigWatcher`

- Uses Tk `after()` polling instead of threads.
- Watches JSON file mtimes every 2000 ms.
- Supports `pause()`, `snapshot()`, and `resume()` so saves do not get echoed back as external changes.

### `DataCache`

- Lazily scans articles from `src/content/reviews`, `guides`, and `news`.
- Lazily scans product JSON from `src/content/data-products`.
- Builds shared counts for categories, slideshow candidates, image view counts, navbar content, and other read-only editor views.
- Can be invalidated and re-scanned after Navbar frontmatter writes.

## Cross-Panel Coordination Rules

- Categories uses `ConfigStore.preview(ConfigStore.CATEGORIES, ...)` so dependent panels can react before the file is saved.
- Content uses the pseudo channel `content_editorial` so Index Heroes can preview unsaved pinned, badge, and excluded edits.
- Navbar stores unsaved brand-category overrides in `store.brand_categories` and notifies the pseudo channel `brand_categories` so Index Heroes can preview them.
- `content.json` is intentionally co-owned and both panels preserve the other panel's keys on save.

## Porting Implications

- A full React port requires more than visual parity. It needs the same reactive cross-panel behavior now implemented through `ConfigStore`, `ConfigWatcher`, `preview()`, and pseudo-channel notifications.
- The FastAPI backend serves all 9 panels with full payload builders, save endpoints, validation, and unsaved-state handling.
- Panels that mutate non-JSON files, especially Navbar and Ads, need dedicated API contracts instead of a generic JSON save layer.

## Cross-Links

- [System Map](../architecture/system-map.md)
- [Environment and Config](environment-and-config.md)
- [Data Contracts](../data/data-contracts.md)
- [Routing and GUI](../frontend/routing-and-gui.md)

## Validated Against

- `config/eg-config.pyw`
- `config/app/main.py`
- `config/app/runtime.py`
- `config/app/launcher.pyw`
- `config/launch-react-config.pyw`
- `config/start-react-browser.cmd`
- `config/scripts/start-browser.cmd`
- `config/lib/config_store.py`
- `config/lib/config_watcher.py`
- `config/lib/data_cache.py`
- `config/ui/app.tsx`
- `config/tests/test_config_store.py`
- `config/tests/test_config_watcher.py`
- `config/tests/test_react_desktop_api.py`
