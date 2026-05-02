# config/data

## Purpose

`config/data/` holds the mutable JSON single sources of truth shared by the
config manager and the TSX site runtime.

## Public API (The Contract)

- `categories.json`
  Canonical category IDs, labels, colors, and active-state flags.
- `cache-cdn.json`
  Canonical cache policy names and page-type mappings.
- `hub-tools.json`
  Hub tool definitions consumed by site and manager.
- `slideshow.json`
  Slideshow records and defaults.
- `content.json`
  Content-manager backing data.
- `navbar-guide-sections.json`
  Navbar guide-section configuration.
- `image-defaults.json`
  Image fallback and sizing defaults.
- `ads-registry.json`
  Ad inventory and placement registry.
- `direct-sponsors.json`
  Sponsor metadata.
- `settings.json`
  Shared configuration values.
- `inline-ads-config.json`
  Inline ad placement configuration.

## Dependencies

Allowed readers/writers:

- `src/core/*`
- `config/app/*`
- `config/lib/*`
- `config/panels/*`
- `config/ui/*`
- Validation scripts and tests that lock the JSON contracts

Forbidden consumers:

- Ad hoc JSON readers that bypass the documented loaders or schemas

## Mutation Boundaries

- The config manager may edit these files.
- Validation tests and scripts may read them.
- Runtime site code treats them as read-only configuration.

## Domain Invariants

- `categories.json` is the category/color/activity SSOT for both apps.
- `cache-cdn.json` is the cache/CDN policy SSOT; route handlers must not
  silently diverge from it.
- JSON shape changes require coordinated updates to the consuming contracts and
  their local READMEs.
