# src/pages

## Purpose

`src/pages/` is the Astro routing composition root. It maps URLs to static
pages, server-rendered endpoints, auth redirects, and API handlers.

## Public API (The Contract)

- Static page entrypoints:
  `index.astro`, `404.astro`, `brands/[...slug].astro`,
  `reviews/[...slug].astro`, `guides/[...slug].astro`, and
  `news/[...slug].astro`.
- Request-time endpoints:
  `robots.txt.ts`, `logout.ts`, `auth/callback.ts`, and `login/*.ts`.
- API boundary:
  `api/` owns the `/api/**` surface.

## Dependencies

Allowed imports:

- `@core/*`
- `@shared/*`
- Public exports from `@features/*`
- Astro runtime APIs

Forbidden imports:

- `config/app/*`
- `tools/deploy-dashboard/*`
- Feature internals when a public feature contract already exists

## Mutation Boundaries

- Static routes are read-only and render from content/config/core data.
- Dynamic routes may mutate only through their documented server integrations
  such as auth cookies or API requests.

## Domain Invariants

- File-based routing defines the public URL surface; moved files require doc
  updates in `docs/03-architecture/` and the folder map.
- Server endpoints in this boundary that depend on request state must export
  `prerender = false`.
- Page entrypoints compose feature and shared modules but do not own canonical
  business logic themselves.

## Local Sub-Boundaries

- [api/README.md](api/README.md)
- [auth/README.md](auth/README.md)
- [brands/README.md](brands/README.md)
- [guides/README.md](guides/README.md)
- [login/README.md](login/README.md)
- [news/README.md](news/README.md)
- [reviews/README.md](reviews/README.md)
