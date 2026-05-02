# Known Issues

> **Purpose:** Current bugs, tech debt, workarounds, and gotchas an LLM must know about.
> **Prerequisites:** [Scope](../01-project-overview/scope.md)
> **Last validated:** 2026-03-15

## Active Issues

| Issue | Impact | Workaround | Notes |
|-------|--------|-----------|-------|
| `/hubs/*` route files not verified | Hub page URLs are emitted by helpers but `src/pages/hubs/**` not confirmed in current snapshot | Cache/CDN contract and helper code still reference `/hubs/*` | Hub pages may be Phase 5+ |
| `/snapshots/*` route files not verified | Product detail page URLs emitted but route files not confirmed | Links may 404 until Phase 5 | Snapshot pages are Phase 5+ |
| `direct-sponsors.json` has no site consumer | Config tool manages it, but no `src/` import found | Keep documented but don't assume frontend dependency | Pre-launch sponsor integration |
| ~~React config: 4 panels still placeholder~~ | All 9 panels fully ported | React shell is the primary UI | Resolved |

## Intentional Behaviors (Not Bugs)

| Behavior | Why | Don't "Fix" |
|----------|-----|-------------|
| `News F` uses `datePublished` only, not `max(pub, upd)` | Intentional: fixing typo on old article shouldn't bump it to sidebar | This is correct behavior |
| Empty `indexHeroes` maps in `content.json` | No manual hero overrides configured yet | Auto-fill algorithm handles it |
| `PUBLIC_ADS_ENABLED=false` in `.env` | Ads intentionally disabled during development | Flip to `true` only for production |
| Category IDs use stable enum (no CUID2) | Only 10 items, not worth indirection | Don't add dynamic ID generation |

## Tech Debt

| Item | Location | Priority |
|------|----------|----------|
| `.mjs` gateway pattern | `src/core/*.mjs` files with `.ts` counterparts | Sunset when Node 22+ `--experimental-strip-types` adopted |
| Product schema uses `.passthrough()` | `src/content.config.ts` | Tighten after schema stabilizes |
| No automated doc freshness check | All docs validated manually | Consider pre-commit hook |

## Related Documents

- [Deletion Ledger](deletion-ledger.md) — removed code audit trail
- [Route Graph Warning](route-graph-warning.md) — build-time route validation
