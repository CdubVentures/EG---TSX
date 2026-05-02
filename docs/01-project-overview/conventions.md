# Conventions

> **Purpose:** File naming, code style, test placement, and import rules — know the rules before touching anything.
> **Prerequisites:** [Scope](scope.md), [Folder Map](folder-map.md)
> **Last validated:** 2026-03-18

## File Naming

| Pattern | Convention | Example |
|---------|-----------|---------|
| TypeScript modules | kebab-case `.ts` | `article-helpers.ts` |
| React components | PascalCase `.tsx` | `SearchDialog.tsx` |
| Astro components | PascalCase `.astro` | `MainLayout.astro` |
| Test files | kebab-case `.test.mjs` | `dashboard.test.mjs` |
| Content articles | `{slug}/index.{md,mdx}` | `reviews/razer-viper/index.mdx` |
| Product data | `{brand-slug}/{product-slug}.json` | `razer/viper-v3-pro.json` |
| Scripts | kebab-case `.mjs` | `build-media.mjs` |
| Config data | kebab-case `.json` | `categories.json` |

## File Type Rules

| Use Case | File Type | Reason |
|----------|-----------|--------|
| Routing, layouts, static HTML | `.astro` | Zero client JS |
| Interactive client components | `.tsx` | React island with hydration directive |
| Core logic, utilities, types | `.ts` | TypeScript default |
| `node --test` compatible modules | `.mjs` | Direct execution without transpilation |
| Each `.mjs` gateway | Must have `.ts` counterpart | Composes with Astro-specific logic |

## Architecture Rules

- **Feature-first organization** — organize by domain, not technical layer
- **No generic junk drawers** — `src/utils`, `src/helpers`, `src/services` are prohibited
- Features may import `core/` and `shared/` — never other features' internals
- **Shared kernel exception:** `settings` -> `auth` (one-directional, for user session)
- Each feature exports a public API via `index.ts`
- No circular dependencies

## Import Order

1. Node built-ins
2. Third-party packages
3. `@core/*` imports
4. `@shared/*` imports
5. `@features/*` imports (own feature only)
6. Relative imports

## TypeScript Rules

- **Strict mode** — `strictNullChecks: true`, `noUncheckedIndexedAccess: true`
- `@ts-ignore` and `@ts-nocheck` are forbidden
- `as any` forbidden except for third-party runtime globals (requires `// WHY` comment)
- All React component props must have explicit `interface` or `type` definitions
- Validate at trust boundaries with `zod`
- Infer TypeScript types from Zod schemas (`z.infer<typeof schema>`)

## Styling Rules

- **Tailwind utility classes only** — no `.css` files for components
- Astro `<style>` blocks are permitted (compile to scoped CSS)
- All values use CSS variables from `global.css` — no hardcoded hex/px in features
- **HBS port exception:** Hardcoded values matching frozen HBS source are allowed with `/* always-dark */` comment
- No inline `style={{...}}` except data-driven values (category colors, rating widths)

## Sizing System

1. **Static var** — `var(--font-size-Xpx)` — fixed size, auto-scales across 11px/10px/9px breakpoints
2. **Fluid var** — `var(--ft-A-B)`, `var(--ftm-A-B)`, `var(--fm-A-B)` — smooth viewport interpolation
3. **Raw `rem`** — valid when 11px base scaling is intentional
- For `font-size`: always use option 1 or 2, never raw `px`/`rem`/`em`

## Test Conventions

- Runner: `node --test` (no Jest/Vitest)
- Placement: `src/features/<feature>/tests/` for unit + feature tests
- Root `test/` for integration, E2E, smoke only
- Test behavior over implementation — test through public APIs
- Use factories — avoid `let`/`beforeEach` mutation patterns
- Prefer table-driven tests

## Git & Commits

- Human handles all git operations — agents are read-only for git
- No force push, no reset, no checkout, no stash

## Related Documents

- [CSS Conventions](../08-design-system/css-conventions.md) — detailed sizing system, fluid vars, theme tokens
- [Light Theme](../08-design-system/light-theme.md) — light/dark theme rules
- [Repo AGENTS.md](../../../AGENTS.md) — full agent rules
