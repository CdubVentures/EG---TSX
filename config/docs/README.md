# EG Config Manager Documentation

Canonical documentation entrypoint for the config app under `EG - TSX/config/`.
This doc set is colocated with the runtime it documents.

Launch: `pythonw config/eg-config.pyw`

## Reading Order

1. This file
2. [Architecture: System Map](architecture/system-map.md)
3. [Architecture: Panel Interconnection Matrix](architecture/panel-interconnection-matrix.md)
4. [Runtime: Python Application](runtime/python-application.md)
5. [Runtime: Environment and Config](runtime/environment-and-config.md)
6. [Data: Data Contracts](data/data-contracts.md)
7. [Frontend: Routing and GUI](frontend/routing-and-gui.md)
8. [Frontend: Design Token Architecture](frontend/design-token-architecture.md)
9. Panel docs
10. [RULES.md](RULES.md)
11. [LIVE-TEST-MATRIX.md](LIVE-TEST-MATRIX.md)

## Local Contracts

- [../README.md](../README.md)
- [../app/README.md](../app/README.md)
- [../lib/README.md](../lib/README.md)
- [../panels/README.md](../panels/README.md)
- [../ui/README.md](../ui/README.md)
- [../data/README.md](../data/README.md)
- [../tests/README.md](../tests/README.md)
- [../scripts/README.md](../scripts/README.md)

## Local Doc Indexes

- [architecture/README.md](architecture/README.md)
- [data/README.md](data/README.md)
- [frontend/README.md](frontend/README.md)
- [panels/README.md](panels/README.md)
- [runtime/README.md](runtime/README.md)

## Shell Layout

```text
EG Config Manager
- Sidebar
  - Categories
  - Content
  - Index Heroes
  - Hub Tools
  - Navbar
  - Slideshow
  - Image Defaults
  - Ads
  - Cache / CDN
- Context bar
- Active panel region
- Status bar
```

Keyboard shortcuts:

- `Ctrl+1` through `Ctrl+9` switch panels
- `Ctrl+S` saves every dirty panel, not only the visible one

## Documentation Index

### Architecture and Runtime

| Document | Purpose |
|----------|---------|
| [architecture/system-map.md](architecture/system-map.md) | Full topology: Tk shell, React shell, shared runtime, and site consumers |
| [architecture/panel-interconnection-matrix.md](architecture/panel-interconnection-matrix.md) | Cross-panel dependencies, derived state, and watch behavior |
| [runtime/python-application.md](runtime/python-application.md) | Tk startup, React shell startup, ConfigStore, ConfigWatcher, and runtime implications |
| [runtime/environment-and-config.md](runtime/environment-and-config.md) | Config surfaces, Python/build deps, HTTP routes, and env vars |
| [architecture/README.md](architecture/README.md) | Folder index for topology and dependency docs |
| [runtime/README.md](runtime/README.md) | Folder index for launch and runtime docs |

### Data and Frontend

| Document | Purpose |
|----------|---------|
| [data/data-contracts.md](data/data-contracts.md) | File contracts, ownership, read/write boundaries, and derived state |
| [frontend/routing-and-gui.md](frontend/routing-and-gui.md) | Panel navigation map, React state pattern, and FastAPI route map |
| [frontend/design-token-architecture.md](frontend/design-token-architecture.md) | Skin/skeleton token layers and component rules |
| [frontend/next-panel-port-playbook.md](frontend/next-panel-port-playbook.md) | Future panel/surface extension playbook for the React shell |
| [frontend/react-port-remediation-log.md](frontend/react-port-remediation-log.md) | React-port defect audit trail and resolution summary |
| [data/README.md](data/README.md) | Folder index for file ownership and contract docs |
| [frontend/README.md](frontend/README.md) | Folder index for React shell docs |

### Panel Documentation

| Panel | Document |
|-------|----------|
| Categories | [panels/categories.md](panels/categories.md) |
| Content | [panels/content-dashboard.md](panels/content-dashboard.md) |
| Index Heroes | [panels/index-heroes.md](panels/index-heroes.md) |
| Hub Tools | [panels/hub-tools.md](panels/hub-tools.md) |
| Navbar | [panels/navbar.md](panels/navbar.md) |
| Slideshow | [panels/slideshow.md](panels/slideshow.md) |
| Image Defaults | [panels/image-defaults.md](panels/image-defaults.md) |
| Ads | [panels/ads.md](panels/ads.md) |
| Cache / CDN | [panels/cache-cdn.md](panels/cache-cdn.md) |
| Panel folder index | [panels/README.md](panels/README.md) |

### Standards and Audit Trail

| Document | Purpose |
|----------|---------|
| [RULES.md](RULES.md) | Mandatory standards for layout, widgets, drag-and-drop, accent colors, and save behavior |
| [LIVE-TEST-MATRIX.md](LIVE-TEST-MATRIX.md) | Comprehensive live testing checklist for the React desktop app |
| [DRAG-DROP-PATTERN.md](DRAG-DROP-PATTERN.md) | Shared drag-and-drop architecture |
| [CATEGORY-TYPES.md](CATEGORY-TYPES.md) | Product vs content category detection logic |
| [deletion-ledger.md](deletion-ledger.md) | Consolidation history and canonical-path migration notes |

## Validated Against

- `../eg-config.pyw`
- `../panels/*.py`
- `../app/main.py`
- `../app/runtime.py`
- `../ui/app.tsx`
- `../ui/panels.tsx`
