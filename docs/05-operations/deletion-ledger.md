# Deletion Ledger

Validated against:

- `docs/**/*.md`
- `README.md`
- `src/pages/**`
- `src/shared/layouts/**`
- `src/features/{auth,search,vault,settings,home,site-index,notifications}/**`
- `src/core/{config.ts,category-contract.ts,cache-cdn-contract.ts,db.ts,content.ts,products.ts,images.ts,seo/**}`
- `config/{eg-config.pyw,panels/**,data/**,lib/config_store.py}`
- `scripts/{run-astro-build.mjs,validate-route-graph.mjs,sync-db.mjs,sync-db-remote.mjs,schema.sql,deploy-aws.mjs}`
- `infrastructure/aws/eg-tsx-stack.yaml`

Scope for this Phase 0 pass:

- audited every current Markdown file under `docs/`
- audited the root [`README.md`](../README.md)
- treated `tools/` as off-limits and outside the audit surface

Historical note:

- This file records the original Phase 0 audit before the 2026-03-18 docs
  relocation.
- Current config-app docs live under [`../../config/docs/`](../../config/docs/).
- [`../config-tools/README.md`](../config-tools/README.md) is now only a
  relocation stub.

## Classification Ledger

| File | Classification | Reason |
|---|---|---|
| `README.md` | replace | Previous root README linked missing docs, referenced `tools/deploy-dashboard`, and described obsolete phase status and route assumptions |
| `docs/README.md` | replace | Previous index only covered a subset of the docs tree and left retained docs orphaned |
| `docs/architecture/system-map.md` | edit in place | Kept accurate deployment map, added missing cross-links into the rebuilt feature set |
| `docs/runtime/environment-and-config.md` | retain | Live env and config audit already matched the current code and stack template |
| `docs/data/database-schema.md` | edit in place | Kept core store inventory, added direct cross-links into the dedicated vault feature doc |
| `docs/frontend/routing-and-gui.md` | edit in place | Added missing settings and vault interaction surfaces and kept route-contract divergence notes |
| `docs/features/auth.md` | edit in place | Fixed data-schema traceability links and updated adjacent feature references |
| `docs/features/auth.mmd` | retain | Current sequence still matches the verified auth flow |
| `docs/features/search.md` | retain | Search flow and runtime contract already matched the live implementation |
| `docs/features/search.mmd` | retain | Current sequence still matches the verified search flow |
| `docs/features/catalog.md` | edit in place | Preserved the verified browse and compare flow, but cross-linked it to the new dedicated vault doc |
| `docs/features/catalog.mmd` | retain | Current browse-plus-compare sequence still matches the verified UI flow |
| `docs/DB-SYNC.md` | retain | Search mirror sync contract matched the current scripts and admin routes |
| `docs/DATA-GATEWAY-CONTRACT.md` | retain | Gateway rules matched current `src/core` contracts and tests |
| `docs/DATA-IMAGE-CONTRACT.md` | retain | Image and product-data contract matched current helpers, scripts, and content layout |
| `docs/VAULT-IMAGE-REFRESH-CONTRACT.md` | retain | Thumbnail-refresh contract matched the live vault and image resolver behavior |
| `docs/ROUTE-GRAPH-WARNING.md` | retain | Route-graph warning system matched the live SEO and deploy validation scripts |
| `docs/CATEGORY-COLORS.md` | retain | Color-system doc still matched the current category contract and layout injection |
| `docs/CSS-CONVENTIONS.md` | retain | CSS system reference matched the current global theme and token implementation |
| `docs/LIGHT-THEME.md` | retain | Light-theme contract matched current theme tokens, settings store behavior, and shell bootstrapping |
| `docs/LOGO.md` | edit in place | Removed stale legacy-logo residue while preserving the active favicon and placeholder contract |
| `docs/Z-INDEX-MAP.md` | retain | Layer map matched current shell, overlay, and toast implementation |
| `docs/CONFIG-INTERDEPENDENCY-MATRIX.md` | edit in place | Updated the matrix to reflect the current nine-panel mega-app and corrected stale panel-count language |
| `config/docs/README.md` | edit in place | Canonical config-app doc index now lives beside the app it documents |
| `config/docs/RULES.md` | edit in place | Corrected stale panel-count, shortcut, and registration instructions to match `eg-config.pyw` |
| `config/docs/panels/categories.md` | retain | Categories panel doc matched the current categories contract and mega-app behavior |
| `config/docs/CATEGORY-TYPES.md` | retain | Filesystem-backed category-type rules and current counts matched the repo |
| `config/docs/panels/content-dashboard.md` | retain | Content panel doc matched current `content.json` ownership and home-feed logic |
| `config/docs/DRAG-DROP-PATTERN.md` | retain | Shared drag-and-drop pattern still matched the current config-tool implementation |
| `config/docs/panels/hub-tools.md` | edit in place | Corrected stale shortcut numbering while preserving the verified tool-contract documentation |
| `config/docs/panels/image-defaults.md` | edit in place | Corrected stale shortcut numbering while preserving the verified image-default contract |
| `config/docs/panels/index-heroes.md` | retain | Index Heroes panel doc matched current brand and article hero logic |
| `config/docs/panels/navbar.md` | edit in place | Corrected stale shortcut numbering while preserving the verified frontmatter-write behavior |
| `config/docs/panels/slideshow.md` | edit in place | Corrected stale shortcut numbering while preserving the verified slideshow contract |
| `config/docs/panels/ads.md` | edit in place | Corrected stale shortcut numbering and category-refresh wording while preserving the verified ads contract |

## Files Deleted In This Pass

- None. The current `docs/` surface was salvageable through correction and
  extension, so this pass preserved and refined rather than deleting.

## New Files Added During Rebuild

- `docs/deletion-ledger.md`
- `docs/features/vault.md`
- `docs/features/vault.mmd`
- `docs/features/settings.md`
- `docs/features/settings.mmd`
- `config/docs/panels/cache-cdn.md`

## Unresolved Ambiguities Recorded Instead Of Invented

- `/hubs/*` is still present in helpers, config, data, and cache policy targets,
  but no local `src/pages/hubs/**` route file was verified in this snapshot.
- `/games/*`, `/account`, and `/about` links are emitted from live navigation
  surfaces even though no matching local route files were verified.
- The AWS stack injects `DYNAMODB_TABLE_NAME`, but the vault server reads
  `DYNAMO_PROFILES_TABLE`.
- The auth server supports `COGNITO_CLIENT_SECRET`, but the checked-in AWS stack
  template does not inject it.
- Settings dispatches `hubSettingsChanged`, but no local hub route
  implementation was verified in this snapshot.

## Major Divergences Found During Phase 0

- The previous root README described missing docs, obsolete migration phases,
  and a `tools/deploy-dashboard` surface that was outside this task scope.
- The current repo is not backed by local `src/pages/hubs/**`, `src/pages/games/**`,
  `src/pages/account/**`, or `src/pages/about/**` route files, even though live
  navigation and helper code still emit those URLs.
- The unified config app now has nine panels, but several config-tool docs still
  used older shortcut numbers and pre-consolidation instructions.
