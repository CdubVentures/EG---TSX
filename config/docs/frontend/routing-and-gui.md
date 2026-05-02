# Routing And GUI

The config app is a desktop shell (not a multi-page site). Navigation is panel switching inside one React app, backed by local FastAPI APIs.

## Panel Navigation Map

| Panel | Legacy Tk | React | Data contract | API status |
| --- | --- | --- | --- | --- |
| Categories | Full | Full | `categories.json` | `GET`, `PUT preview`, `PUT save` |
| Content | Full | Full | `content.json` (`slots/pinned/badges/excluded`) | `GET`, `PUT preview`, `PUT save` |
| Index Heroes | Full | Full | `content.json.indexHeroes` | `GET`, `PUT preview`, `PUT save` |
| Hub Tools | Full | Full | `hub-tools.json` (`categories + _tooltips + _index`) | `GET`, `PUT preview`, `PUT save` |
| Navbar | Full | Full | `navbar-guide-sections.json` + frontmatter | `GET`, `PUT preview`, `PUT save` |
| Slideshow | Full | Full | `slideshow.json` | `GET`, `PUT preview`, `PUT save` |
| Image Defaults | Full | Full | `image-defaults.json` | `GET`, `PUT preview`, `PUT save` |
| Ads | Full | Full | `ads-registry.json`, `inline-ads-config.json`, `direct-sponsors.json`, `.env` | `GET`, `PUT preview`, `PUT save`, `POST scan` |
| Cache / CDN | Full | Full | `cache-cdn.json` | `GET`, `PUT preview`, `PUT save` |

All 9 panels are fully ported to the React shell.

## Panel Contract Matrix

Use this matrix when modifying the higher-risk panel surfaces. It avoids accidental ownership drift.

| Panel | Main write target(s) | Preview expectation | Save rule | Special risk |
| --- | --- | --- | --- | --- |
| Slideshow | `config/data/slideshow.json` | Unsaved queue/order/limits reflected immediately in panel UI | Replace slideshow-owned keys only | Product eligibility depends on product data and category activity |
| Image Defaults | `config/data/image-defaults.json` | Unsaved fallback chain updates should preview immediately | Replace image-defaults-owned keys only | View-name mismatch causes silent fallback issues |
| Cache / CDN | `config/data/cache-cdn.json` | Unsaved changes should preview in panel tables/forms | Replace cache-cdn-owned keys only | Validation-heavy: patterns, policies, and group references |
| Ads | `config/data/ads-registry.json`, `config/data/inline-ads-config.json`, `config/data/direct-sponsors.json`, root `.env` | Unsaved ad edits should stay in-memory until explicit save | Save must preserve unrelated keys across all ad files and `.env` | Multi-file + env writes; highest blast radius |

## Shell Structure

Tk (`config/eg-config.pyw`) and React (`config/ui/app.tsx`) both use:

- Left sidebar panel navigation
- Top context bar (active panel + save)
- Main panel host
- Bottom status bar

Keyboard behavior:

- `Ctrl+1` through `Ctrl+9`: switch panel by `navItems` order.
- `Ctrl+S`: save all dirty panels in canonical order (React and Tk).

## React Architecture

## Core files

- `config/ui/app.tsx`: shell, bootstrap, watch polling, dirty snapshots, preview/save flows.
- `config/ui/panels.tsx`: shared panel views (`CategoriesPanelView`, `ContentPanelView`, `IndexHeroesPanelView`, `HubToolsPanelView`).
- `config/ui/shared-ui.tsx`: reusable controls/icons (`Toggle`, `PinIcon`, `LockIcon`, `AutoIcon`, `CloseIcon`, `StarIcon`).
- `config/ui/desktop-model.ts`: payload types + request/snapshot helpers.
- `config/ui/content-editor.ts`: pure content editing transitions.
- `config/ui/save-helpers.ts`: canonical global-save ordering for dirty panels.

## Panel state pattern (current standard)

For each ported panel in `app.tsx`:

1. `useState<PanelPayload | null>` for editable local state.
2. Two snapshots:
   - `snapshotRef` (last saved baseline)
   - `previewSnapshotRef` (last preview sent)
3. `versionRef` and `previewRequestRef`.
4. Dirty calculation via `snapshot*` helper in `desktop-model.ts`.
5. Debounced preview effect (`PUT /api/panels/<panel>/preview`).
6. Save function (`PUT /api/panels/<panel>/save`).
7. Watch refresh path gated by dirty state.

This pattern is implemented for all 9 panels:

- Categories
- Content
- Index Heroes
- Hub Tools
- Navbar
- Slideshow
- Image Defaults
- Cache / CDN
- Ads

## FastAPI Route Map (Current)

| Route | Method | Purpose |
| --- | --- | --- |
| `/` | `GET` | Shell document |
| `/app.bundle.js` | `GET` | React bundle |
| `/app.css` | `GET` | Shell styles |
| `/api/bootstrap` | `GET` | Shell + all 9 panel payloads |
| `/api/watch` | `GET` | Version polling (`categories`, `content`, `hub_tools`, etc.) |
| `/api/panels/categories` | `GET` | Categories panel payload |
| `/api/panels/categories/preview` | `PUT` | Unsaved category preview state |
| `/api/panels/categories/save` | `PUT` | Persist categories |
| `/api/panels/content` | `GET` | Content panel payload |
| `/api/panels/content/preview` | `PUT` | Unsaved content preview state |
| `/api/panels/content/save` | `PUT` | Persist content-owned keys |
| `/api/panels/index-heroes` | `GET` | Index Heroes payload |
| `/api/panels/index-heroes/preview` | `PUT` | Unsaved index-heroes preview state |
| `/api/panels/index-heroes/save` | `PUT` | Persist `indexHeroes` only |
| `/api/panels/hub-tools` | `GET` | Hub Tools payload |
| `/api/panels/hub-tools/preview` | `PUT` | Unsaved hub-tools preview state |
| `/api/panels/hub-tools/save` | `PUT` | Persist hub-tools config |
| `/api/panels/navbar` | `GET` | Navbar payload |
| `/api/panels/navbar/preview` | `PUT` | Unsaved navbar preview state |
| `/api/panels/navbar/save` | `PUT` | Persist navbar JSON/frontmatter delta |
| `/api/panels/slideshow` | `GET` | Slideshow payload |
| `/api/panels/slideshow/preview` | `PUT` | Unsaved slideshow preview state |
| `/api/panels/slideshow/save` | `PUT` | Persist slideshow config |
| `/api/panels/image-defaults` | `GET` | Image Defaults payload |
| `/api/panels/image-defaults/preview` | `PUT` | Unsaved image-defaults preview state |
| `/api/panels/image-defaults/save` | `PUT` | Persist image-defaults config |
| `/api/panels/cache-cdn` | `GET` | Cache / CDN payload |
| `/api/panels/cache-cdn/preview` | `PUT` | Unsaved cache/CDN preview state |
| `/api/panels/cache-cdn/save` | `PUT` | Persist cache/CDN config |
| `/api/panels/ads` | `GET` | Ads payload |
| `/api/panels/ads/preview` | `PUT` | Unsaved ads preview state |
| `/api/panels/ads/save` | `PUT` | Persist ads JSON plus `.env` toggle |
| `/api/panels/ads/scan` | `POST` | Scan source usage for ad positions |
| `/api/health` | `GET` | Launcher readiness probe |

## `content.json` Co-Ownership Rule

- Content owns: `slots`, `pinned`, `badges`, `excluded`
- Index Heroes owns: `indexHeroes`

Save handlers must preserve sibling-owned keys. Current behavior:

- `runtime.save_content()` merges content-owned keys into existing `content.json`.
- `runtime.save_index_heroes()` updates only `indexHeroes`.

## Design/Token Rules

Use `config/ui/app.css` tokens only. Do not hardcode new panel styles.

- Dark theme is squared: `--radius-* = 0`, `--shadow-* = none`
- Dense geometry tokens are locked (`--sidebar-width`, `--context-height`, etc.)
- Existing panel text/density tokens for Content should be reused by new panels where sensible.
- Full contract and audit checklist: [Design Token Architecture](design-token-architecture.md)

## Panel Maintenance / Extension Protocol

Use this order when extending an existing panel or adding a new panel-like surface.

For a detailed execution checklist and regression template, see:

- [Next Panel Port Playbook](next-panel-port-playbook.md)

1. Core Work

- Add backend payload + preview + save methods in `config/app/runtime.py`.
- Add API endpoints in `config/app/main.py`.
- Add panel payload/request/snapshot types in `config/ui/desktop-model.ts`.
- Add view component in `config/ui/panels.tsx` built from `shared-ui.tsx` primitives.
- Wire panel state, dirty tracking, preview, save, and watch refresh in `config/ui/app.tsx`.

2. Through-And-Through Test

- JS contracts:
  - `test/config-react-desktop-port.test.mjs`
  - `test/config-react-desktop-ui-contract.test.mjs`
- Python API:
  - `python -m pytest config/tests/test_react_desktop_api.py`
- Add red tests for the panel behavior before implementation:
  - bootstrap hydration
  - `GET /api/panels/<panel>`
  - `PUT /api/panels/<panel>/preview` (must not mutate disk)
  - `PUT /api/panels/<panel>/save` (must preserve sibling keys)
  - dirty badge + save round-trip for the new panel

3. Anti-Drift Review

- Verify no new hardcoded colors/radii/shadows.
- Verify panel spacing aligns with shell/categories/content density.
- Verify icons are themed inline SVGs (no emoji glyphs).
- Verify watch/preview behavior matches existing panel pattern.

## Common File Touchpoints

When modifying panel behavior, expect to touch some subset of:

- `config/app/runtime.py`
- `config/app/main.py`
- `config/ui/desktop-model.ts`
- `config/ui/panels.tsx`
- `config/ui/app.tsx`
- `config/ui/app.css` (tokens/selectors only; no one-off hardcoded skin styles)
- `test/config-react-desktop-port.test.mjs`
- `test/config-react-desktop-ui-contract.test.mjs`
- `config/tests/test_react_desktop_api.py` (if API contract expanded)

## Panel Work Skeleton

Use this shape to reduce decision friction and keep panel ports consistent.

### `config/app/runtime.py`

```py
def build_<panel>_payload(self) -> dict:
    # read from store/cache and return JSON-serializable payload
    ...

def preview_<panel>(self, payload: dict) -> dict:
    # do NOT write to disk
    # return shell + updated panel payload for React preview state
    ...

def save_<panel>(self, payload: dict) -> dict:
    # merge safely into owned file(s) only, then persist
    # return shell + saved panel payload + timestamp/message
    ...
```

### `config/app/main.py`

```py
@app.get("/api/panels/<panel>")
def get_<panel>():
    return runtime.build_<panel>_payload()

@app.put("/api/panels/<panel>/preview")
def preview_<panel>(payload: dict):
    return runtime.preview_<panel>(payload)

@app.put("/api/panels/<panel>/save")
def save_<panel>(payload: dict):
    return runtime.save_<panel>(payload)
```

### `config/ui/app.tsx`

```tsx
const [<panel>Panel, set<Panel>Panel] = useState<<Panel>Payload | null>(null);
const <panel>SnapshotRef = useRef('');
const <panel>PreviewSnapshotRef = useRef('');
const <panel>VersionRef = useRef(0);
const <panel>PreviewRequestRef = useRef(0);

// 1) hydrate in bootstrap
// 2) compute dirty via snapshot helper
// 3) debounce preview PUT /preview
// 4) save via PUT /save
// 5) watch refresh when !dirty and version changed
// 6) update the panel branch in app.tsx and its watch/preview/save wiring
```

### Definition of done

- React panel renders from real payload (no placeholder branch).
- Preview endpoint exists and does not write to disk.
- Save endpoint exists and preserves non-owned/sibling keys.
- `Ctrl+S` and Save button work for the panel.
- Watch refresh updates panel when external edits occur and local panel is clean.
- JS and Python contracts include red-then-green coverage for the new panel.

## Validated Against

- `config/app/main.py`
- `config/app/runtime.py`
- `config/eg-config.pyw`
- `config/ui/app.tsx`
- `config/ui/panels.tsx`
- `config/ui/shared-ui.tsx`
- `config/ui/desktop-model.ts`
- `config/ui/app.css`
- `test/config-react-desktop-port.test.mjs`
- `test/config-react-desktop-ui-contract.test.mjs`
