# Config Docs Deletion Ledger

## Scope

This ledger preserves two documentation migrations for the config app:

1. The 2026-03-15 consolidation that merged the old flat manager docs with the
   structured `config/docs/` tree.
2. The 2026-03-18 relocation that moved the canonical doc set back under
   `config/docs/` so the docs live beside the app they describe.

## Current Canonical Location

- `config/docs/` is the single source of truth.
- `docs/config-tools/README.md` is now a relocation stub only.

## Historical Timeline

### Before 2026-03-15

Documentation existed in two places:

- `docs/config-tools/` - flat manager docs, rules, and test matrix
- `config/docs/` - structured architecture/runtime/data/frontend docs

### 2026-03-15 Consolidation

- Merged the overlapping flat manager docs into one structured tree.
- Standardized the panel docs under `panels/`.
- Rewrote the doc index into a single config-app entrypoint.

### 2026-03-18 Relocation

- Moved the canonical tree from `docs/config-tools/` to `config/docs/`.
- Added `config/README.md` plus domain README contracts in `config/app/`,
  `config/lib/`, `config/panels/`, and `config/ui/`.
- Left `docs/config-tools/README.md` behind as a redirect so no information was
  lost during migration.

## Canonical Paths After Relocation

| Current path | Notes |
|--------------|-------|
| `config/README.md` | App-level entrypoint |
| `config/docs/README.md` | Canonical documentation index |
| `config/docs/architecture/system-map.md` | Runtime topology |
| `config/docs/architecture/panel-interconnection-matrix.md` | Cross-panel dependency map |
| `config/docs/runtime/python-application.md` | Tk + React runtime |
| `config/docs/runtime/environment-and-config.md` | Config surfaces and env |
| `config/docs/data/data-contracts.md` | File contracts and ownership |
| `config/docs/frontend/routing-and-gui.md` | GUI route map and state boundaries |
| `config/docs/frontend/design-token-architecture.md` | Theme/token rules |
| `config/docs/panels/*.md` | Per-panel deep dives |

## Historical Merges Preserved

Each panel doc still represents the combined information from the original
manager doc plus the earlier feature/architecture note for that panel:

| Panel | Historical sources |
|-------|--------------------|
| Categories | `CATEGORY-MANAGER.md` + feature doc |
| Content | `DASHBOARD-MANAGER.md` + feature doc |
| Index Heroes | `INDEX-HEROES-MANAGER.md` + feature doc |
| Hub Tools | `HUB-TOOLS-MANAGER.md` + feature doc |
| Navbar | `NAVBAR-MANAGER.md` + feature doc |
| Slideshow | `SLIDESHOW-MANAGER.md` + feature doc |
| Image Defaults | `IMAGE-MANAGER.md` + feature doc |
| Ads | `ADS-MANAGER.md` + feature doc |
| Cache / CDN | `CACHE-CDN.md` + feature doc |

## Important Findings Preserved From The Original Audit

- The config app is file-contract based, not database-backed.
- `content.json` is co-owned:
  Content owns `slots`, `pinned`, `badges`, and `excluded`;
  Index Heroes owns `indexHeroes`.
- The Navbar panel writes directly into `src/content/**` frontmatter.
- The Ads panel writes the site-level `.env` toggle `PUBLIC_ADS_ENABLED`.
- The React desktop shell now covers all nine panels.
