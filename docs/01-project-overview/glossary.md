# Glossary

> **Purpose:** Project-specific terms, abbreviations, and domain language that differ from common usage.
> **Prerequisites:** [Scope](scope.md)
> **Last validated:** 2026-03-15

| Term | Definition |
|------|-----------|
| **EG-HBS** | The original site: Express + Handlebars + jQuery + Redis. Read-only reference, never modified. |
| **EG-TSX** | This project: the Astro 5 + React 19 + Tailwind v4 migration target. |
| **Gaming theme** | The dark theme. Its CSS values are frozen to exact EG-HBS values. Never modify. |
| **Light themes** | `default`, `workstation`, `review` — open for iteration, unlike the locked gaming theme. |
| **Bridge variables** | CSS variables (`--white-color-1`, `--grey-color-*`, `--section-*-background-color`) that carry exact HBS hex values in gaming theme and theme-appropriate alternatives in light themes. |
| **Semantic tokens** | Intent-based CSS variables (`--color-text-*`, `--color-bg-*`). Have different values than bridge vars in gaming theme — never swap one for the other in HBS-ported components. |
| **Island** | A React component hydrated inside an Astro page using a hydration directive (`client:load`, `client:visible`). |
| **Slug-folder** | Content layout pattern: `{slug}/index.{md,mdx}` instead of flat `{slug}.md`. Used for all 147 articles. |
| **entry.id** | Astro content collection identifier. Slug-folder `generateId` strips `/index` so `entry.id` = clean slug. |
| **imagePath** | Product JSON field pointing to the image folder. Convention: `/images/{category}/{brand-slug}/{product-slug}/`. |
| **stem** | Image filename without size suffix. Convention: `---` = color separator, `___` = edition separator, trailing digits = sequence. |
| **media object** | Structured `{ defaultColor, colors[], editions[], images[] }` in product JSON, built by `scripts/build-media.mjs`. |
| **view** | Image perspective type: `top`, `left`, `right`, `sangle`, `angle`, `front`, `rear`, `bot`, `feature-image`, `shape-side`, `shape-top`. |
| **baseModel** | Product family name (e.g., "Viper", "M55"). |
| **variant** | Differentiator within family (e.g., "V3 Pro", "Wireless", ""). |
| **model** | Full display name = baseModel + variant (e.g., "Viper V3 Pro"). |
| **ConfigStore** | Python reactive store in the config app. Manages all JSON file I/O, derived state, and cross-panel preview propagation. |
| **DataCache** | Read-only cache in the config app that scans `src/content/` for article counts, product lists, image views. |
| **Nano Store** | Lightweight state management library (`nanostores`). Used for cross-island state: auth, vault, settings, notifications. |
| **Gateway** | `src/core/` module that wraps `getCollection()` with category filtering, sorting, and validation. Components never call `getCollection()` directly. |
| **Hub** | Category landing page at `/hubs/{category}`. |
| **Snapshot page** | Product detail page at `/snapshots/{productSlug}`. |
| **Tagged card** | Product card component with image, brand/model, deal button, hub tags, and compare button. |
| **Feed scroller** | Horizontal scroll container for recommended/similar product sections. Supports grid mode for MDX. |
| **Spec Factory** | External tool that manages product identity (brand registry, catalog). Its 8-char hex ID is the stable join key. CMS output wires into product JSON as Phase 13. |
| **CDN base** | `https://d3m2jw9ed15b7k.cloudfront.net` — CloudFront distribution for all images. |
| **Lambda entry** | `lambda-entry.mjs` — proxies requests to Astro's standalone Node server on `127.0.0.1:4321`. |
| **content.json** | Co-owned config file: Content panel owns `slots/pinned/badges/excluded`; Index Heroes panel owns `indexHeroes`. |
| **11px base** | HBS root font size: `html { font-size: clamp(11px, 68.75%, 15px) }` — 1rem = 11px. All sizing derives from this. |

## Related Documents

- [Scope](scope.md) — what the project is
- [Data Image Contract](../06-references/data-image-contract.md) — image path conventions in detail
- [CSS Conventions](../08-design-system/css-conventions.md) — sizing system details
