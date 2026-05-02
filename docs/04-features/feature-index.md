# Feature Index

> **Purpose:** Master lookup table of all first-class features with key files and doc links.
> **Prerequisites:** [Folder Map](../01-project-overview/folder-map.md)
> **Last validated:** 2026-03-18

## Features

| Feature | Description | Doc | Key Files |
|---------|-------------|-----|-----------|
| Home | Landing page: slideshow, dashboard, featured scroller, news, games | [home.md](home.md) | `src/features/home/components/`, `src/pages/index.astro` |
| Auth | Cognito OAuth login, JWT session, token refresh | [auth.md](auth.md) | `src/features/auth/store.ts`, `src/features/auth/server/`, `src/middleware.ts` |
| Search | Full-text product + article search via PostgreSQL | [search.md](search.md) | `src/features/search/`, `src/pages/api/search.ts`, `src/core/db.ts` |
| Catalog | Category index pages, brand pages, product grids | [catalog.md](catalog.md) | `src/features/site-index/`, `src/pages/brands/`, `src/core/products.ts` |
| Vault | User-saved products with DynamoDB sync | [vault.md](vault.md) | `src/features/vault/store.ts`, `src/features/vault/sync.ts`, `src/pages/api/user/vault.ts` |
| Settings | Theme selection, user preferences (localStorage) | [settings.md](settings.md) | `src/features/settings/store.ts`, `src/features/settings/components/` |
| Notifications | Toast messages, vault bridge | [notifications.md](notifications.md) | `src/features/notifications/store.mjs`, `src/features/notifications/components/` |
| Ads | Ad placement, inline ads (rehype plugin), sample ads | [ads-plan.md](ads-plan.md) | `src/features/ads/config.ts`, `src/features/ads/resolve.ts`, `src/features/ads/inline/` |

## Config Manager

The 9-panel config manager is documented separately under
[config/README.md](../../config/README.md).

## Feature Boundary Rules

- Features may import `@core/*` and `@shared/*`
- Features must NOT import other features' internals
- **Shared kernel exception:** `settings` → `auth` (for user session state)
- Each feature exports its public API via `index.ts`
- No circular dependencies

## Related Documents

- [Folder Map](../01-project-overview/folder-map.md) — full directory structure
- [Data Gateway Contract](../06-references/data-gateway-contract.md) — how features access data
