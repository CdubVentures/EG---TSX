# API Surface

> **Purpose:** Every exposed endpoint — method, path, purpose, auth requirement.
> **Prerequisites:** [System Map](../03-architecture/system-map.md)
> **Last validated:** 2026-03-15

## SSR API Routes

All API routes run on Lambda via the Astro standalone adapter. They are NOT prerendered.

### Search

| Method | Path | Purpose | Auth | Handler |
|--------|------|---------|------|---------|
| GET | `/api/search` | Full-text product + article search | Public | `src/pages/api/search.ts` |

### Auth

| Method | Path | Purpose | Auth | Handler |
|--------|------|---------|------|---------|
| POST | `/api/auth/sign-in` | Email/password login | Public | `src/pages/api/auth/sign-in.ts` |
| POST | `/api/auth/sign-up` | User registration | Public | `src/pages/api/auth/sign-up.ts` |
| POST | `/api/auth/confirm-sign-up` | Email verification code | Public | `src/pages/api/auth/confirm-sign-up.ts` |
| POST | `/api/auth/forgot-password` | Password reset request | Public | `src/pages/api/auth/forgot-password.ts` |
| POST | `/api/auth/confirm-forgot-password` | Password reset confirmation | Public | `src/pages/api/auth/confirm-forgot-password.ts` |
| POST | `/api/auth/resend-code` | Resend verification code | Public | `src/pages/api/auth/resend-code.ts` |
| GET | `/api/auth/me` | Get current user info | Authenticated | `src/pages/api/auth/me.ts` |

### User Data

| Method | Path | Purpose | Auth | Handler |
|--------|------|---------|------|---------|
| GET/POST | `/api/user/vault` | Read/write user vault items | Authenticated | `src/pages/api/user/vault.ts` |
| GET | `/api/vault/thumbs` | Vault thumbnail images | Public | `src/pages/api/vault/thumbs.ts` |

### Admin (operator-only)

| Method | Path | Purpose | Auth | Handler |
|--------|------|---------|------|---------|
| POST | `/api/admin/db-setup` | Bootstrap PostgreSQL schema | Admin | `src/pages/api/admin/db-setup.ts` |
| POST | `/api/admin/db-sync` | Sync content to search DB | Admin | `src/pages/api/admin/db-sync.ts` |

### OAuth

| Method | Path | Purpose | Auth | Handler |
|--------|------|---------|------|---------|
| GET | `/auth/callback` | OAuth callback (Cognito redirect) | Public | `src/pages/auth/callback.ts` |
| GET | `/login/google` | Google OAuth redirect | Public | `src/pages/login/google.ts` |
| GET | `/login/discord` | Discord OAuth redirect | Public | `src/pages/login/discord.ts` |
| GET | `/logout` | Logout + cookie clear | Public | `src/pages/logout.ts` |

## Static Routes (prerendered)

| Path | Page | Notes |
|------|------|-------|
| `/` | `src/pages/index.astro` | Home page |
| `/reviews/[...slug]` | `src/pages/reviews/[...slug].astro` | Review articles |
| `/guides/[...slug]` | `src/pages/guides/[...slug].astro` | Guide articles |
| `/news/[...slug]` | `src/pages/news/[...slug].astro` | News articles |
| `/brands/[...slug]` | `src/pages/brands/[...slug].astro` | Brand index pages |
| `/404` | `src/pages/404.astro` | Not found |
| `/robots.txt` | `src/pages/robots.txt.ts` | Dynamic robots file |

## URL Contracts (helper-emitted, no route file)

These URLs are constructed by helper functions but may not have corresponding route files in the current snapshot:

| Path | Emitted by | Purpose |
|------|-----------|---------|
| `/hubs/{category}` | `src/core/hub-tools.ts` | Category hub pages |
| `/snapshots/{productSlug}` | Product helpers | Product detail pages |
| `/games/{gameSlug}` | Game helpers | Game detail pages |

## Related Documents

- [System Map](../03-architecture/system-map.md) — deployment topology showing static vs dynamic split
- [Auth Feature](../04-features/auth.md) — full auth flow documentation
- [Search Feature](../04-features/search.md) — search implementation details
