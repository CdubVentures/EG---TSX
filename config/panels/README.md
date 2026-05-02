# config/panels

## Purpose

Tk implementations of the nine config panels used by the native desktop shell in
`eg-config.pyw`.

## Public API (The Contract)

- `categories.py` -> `CategoriesPanel`
- `content.py` -> `ContentPanel`
- `index_heroes.py` -> `IndexHeroesPanel`
- `hub_tools.py` -> `HubToolsPanel`
- `navbar.py` -> `NavbarPanel`
- `slideshow.py` -> `SlideshowPanel`
- `image_defaults.py` -> `ImageDefaultsPanel`
- `ads.py` -> `AdsPanel`
- `cache_cdn.py` -> `CacheCdnPanel`

Each module also owns its local normalization, scanning, and save helpers used
by that panel only.

## Dependencies

Allowed imports:

- `config/lib/*`
- Python standard library and `tkinter`
- `config/data/*.json`
- `src/content/**`, `src/features/**`, `public/**`, and `.env` only where the
  panel contract explicitly reads or writes them

Forbidden imports:

- `config/ui/*`
- `tools/deploy-dashboard/*`

## Mutation Boundaries

- May write the config files mapped through `ConfigStore`.
- `navbar.py` may write frontmatter in `src/content/**`.
- `ads.py` may update `.env` values defined by the ad contract.
- No direct deployment, git, or unrelated file mutations.

## Domain Invariants

- Tk panels must treat `ConfigStore` as the only canonical config owner.
- Save actions should be panel-scoped and idempotent.
- Cross-panel propagation happens through store preview/save, not manual file
  rereads inside sibling panels.
