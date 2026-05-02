# Next Panel Port Playbook

This is now the handoff guide for adding a new panel-like surface or making a
large React-side extension inside `config/ui`.

As of 2026-03-18, all 9 current panels are live in both Tk and React:

- `Categories`
- `Content`
- `Index Heroes`
- `Hub Tools`
- `Navbar`
- `Slideshow`
- `Image Defaults`
- `Ads`
- `Cache / CDN`

## Historical Port Order

The previous recommended order completed in this sequence:

1. `Slideshow`
2. `Image Defaults`
3. `Cache / CDN`
4. `Ads`

That order still explains the risk gradient:

- JSON-owned surfaces were easier to port first.
- Multi-file or env-writing surfaces such as `Ads` carry a broader blast radius.

## One-Panel Contract Template

Before coding, define these five items for the target panel:

1. Inputs: exact payload shape from `runtime.build_<panel>_payload()`
2. Preview behavior: what changes are allowed in memory without disk writes
3. Save ownership: which keys/files this panel is allowed to persist
4. Non-owned siblings: which keys must be preserved untouched on save
5. Watch behavior: when `/api/watch` should refresh panel state vs hold local dirty edits

## File Touchpoints

Every panel port should touch this set (or justify why not):

- `config/app/runtime.py`
- `config/app/main.py`
- `config/ui/desktop-model.ts`
- `config/ui/panels.tsx`
- `config/ui/app.tsx`
- `config/ui/app.css`
- `test/config-react-desktop-port.test.mjs`
- `test/config-react-desktop-ui-contract.test.mjs`
- `config/tests/test_react_desktop_api.py`

## Implementation Skeleton

### Backend (`runtime.py`)

```py
def build_<panel>_payload(self) -> dict: ...
def preview_<panel>(self, payload: dict) -> dict: ...
def save_<panel>(self, payload: dict) -> dict: ...
```

Rules:

- `preview_<panel>` must not write to disk.
- `save_<panel>` must preserve non-owned sibling keys.

### API (`main.py`)

```py
@app.get("/api/panels/<panel>")
@app.put("/api/panels/<panel>/preview")
@app.put("/api/panels/<panel>/save")
```

### React shell (`app.tsx`)

```tsx
const [panel, setPanel] = useState<PanelPayload | null>(null);
const snapshotRef = useRef('');
const previewSnapshotRef = useRef('');
const versionRef = useRef(0);
const previewRequestRef = useRef(0);
```

Wire the same pattern used by the shipped panels:

- bootstrap hydration
- dirty snapshot compare
- debounced preview call
- save call
- watch refresh guarded by dirty state

### View component (`panels.tsx`)

- Keep presentational render logic in `panels.tsx`.
- Reuse `shared-ui.tsx` primitives before adding new one-off controls.
- Reuse `Content`/`Categories` structural classes first (for example: `content-panel__collection-header`, `content-pool__header`, `content-dashboard__title`, `content-dashboard__slot-*`, `content-pool__row/cell/empty`) and only add panel-prefixed classes for true panel-specific layout.

### Styles (`app.css`)

- Use existing tokens only.
- No hardcoded new colors, radii, or shadows.
- Keep shell density aligned with existing panel rhythm.
- Prefer additive overrides on shared classes over duplicate surface definitions. If a panel node already uses a `content-*` class, do not re-declare the same border/background/padding under a panel-prefixed selector unless the panel requires a different structure.

## Required RED -> GREEN Checks

Run these before and after implementation:

```bash
node --import tsx --test test/config-react-desktop-port.test.mjs test/config-react-desktop-ui-contract.test.mjs
python -m pytest config/tests/test_react_desktop_api.py
```

Add red tests first for:

- bootstrap includes panel payload
- panel `GET`, `PUT preview`, `PUT save` endpoints
- React panel branch renders real payload and no longer falls through to a stub
- dirty badge and save round-trip behavior

## Definition Of Done

- Panel or new surface renders from real payload instead of a stub path.
- Preview flow works and does not persist.
- Save flow persists only owned keys and preserves sibling-owned keys.
- `Ctrl+S` and Save button work for this panel.
- Watch refresh handles external changes when local panel is clean.
- Route/API and UI contract tests are green.

## Primary Reference

For architecture and detailed transfer steps, also read:

- [Routing and GUI](routing-and-gui.md)
