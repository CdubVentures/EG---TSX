# Scope

> **Purpose:** Define what EG-TSX is, what it is not, and what it explicitly excludes — so an LLM never invents features that don't exist.
> **Prerequisites:** None — read this first.
> **Last validated:** 2026-03-15

## What This Project Is

EG-TSX is a migration of `EG - HBS` (Express/Handlebars/jQuery/Redis gaming gear review site) to a modern stack: Astro 5, React 19, Tailwind CSS v4, MDX content, and AWS Lambda deployment. It covers product reviews, guides, news, brand profiles, and game gear recommendations for gaming peripherals (mice, keyboards, monitors).

The site is static-first (SSG via Astro) with SSR opt-in for auth, search, vault, and API routes served through AWS Lambda behind CloudFront.

## What This Project Is NOT

- NOT a CMS — content is authored as MDX files and JSON, not through a web editor
- NOT a SPA — it's a multi-page Astro site with React islands for interactivity
- NOT a monolith API — there is no Express server; API routes are Astro SSR endpoints
- NOT a real-time app — no WebSockets, no live updates, no push notifications
- NOT mobile-native — responsive web only
- NOT multi-tenant — single site, single brand (EG Gear)

## Explicit Exclusions

- **EG-HBS is read-only** — the original codebase is never modified, only referenced
- **No Redis/RAM cache** — static HTML on CDN replaces the 3-tier cache
- **No server-side rendering by default** — pages are pre-rendered unless explicitly opted into SSR
- **No background job queue** — no Bull, no SQS workers; build scripts run manually or via CI
- **No CMS admin panel** — the Python config tool (`config/eg-config.pyw`) manages JSON config; CMS is Phase 13

## Target Users

- Gaming peripheral enthusiasts (mice, keyboards, monitors)
- Product researchers comparing specs and reviews

## Current Status

- **Phase 4** (Global Shell & Home Page) — IN PROGRESS
- **Production deployment** — AWS CloudFormation stack operational
- Content: 366 products, 147 articles, all migrated and schema-validated

## Related Documents

- [Folder Map](folder-map.md) — where everything lives
- [Stack and Toolchain](../02-dependencies/stack-and-toolchain.md) — what it's built with
