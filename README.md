# EG-TSX

Expert Gaming rebuilt with Astro 5, React 19, Tailwind v4, and MDX.

Migrating from EG-HBS (Express/Handlebars/jQuery/Redis) to a modern static-first architecture with SSR opt-in for auth and API routes.

## Stack

- **Astro 5** — hybrid rendering (SSG default, SSR opt-in)
- **React 19** — interactive islands (`client:load`, `client:visible`)
- **Tailwind v4** — utility-first CSS with CSS variable theming
- **MDX** — articles with embedded React components
- **TypeScript** — strict, Zod at trust boundaries
- **Nano Stores** — cross-island state (`$auth`, `$vault`, `$authDialog`)

## Quick Start

```sh
npm install
npm run dev          # localhost:4321
```

Copy `.env.example` to `.env` and fill in Cognito + DynamoDB values.

## Commands

| Command | Action |
|:--------|:-------|
| `npm run dev` | Dev server at `localhost:4321` |
| `npm run build` | Production build to `./dist/` |
| `npm run preview` | Preview production build locally |
| `node --import tsx --test src/features/auth/tests/*.test.mjs` | Run auth tests (69 tests) |

## Architecture

Full documentation: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

### Key directories

```
src/
  content/          # MDX articles (147 files, slug-folder layout)
  content/data-products/  # Product JSON (366 files)
  core/             # App-wide infra (images.ts, media.ts, config.ts)
  features/         # Domain features (auth, vault, hub, pc-builder)
  shared/           # Reusable UI primitives + layouts
  pages/            # File-based routing (static + SSR)
  styles/           # global.css (CSS vars + Tailwind v4 @theme)

public/images/      # All product + article images (served as-is)
scripts/            # Build-time scripts (media, migration, validation)
config/             # categories.json + Python GUI managers
cognitoUI/          # Cognito Hosted UI dark theme CSS
docs/               # Architecture, contracts, diagrams
```

### Content counts

- 342 mouse + 12 keyboard + 12 monitor = **366 products**
- 47 reviews + 29 brands + 11 games + 33 guides + 23 news + 4 pages = **147 articles**

## Auth System

Industry-standard OAuth with AWS Cognito. HttpOnly cookies, PKCE (RFC 7636), automatic token refresh, and postMessage-based popup flow.

- **3 login providers:** Google, Discord, Email/Password
- **Desktop:** Popup window with postMessage notification + cookie poll fallback
- **Mobile:** Full-page redirect with return URL preservation
- **Token refresh:** Middleware auto-refreshes JWT within 5 minutes of expiry
- **PKCE:** Every login generates SHA-256 code challenge
- **Hosted UI theming:** Dark CSS uploaded to Cognito (`cognitoUI/template.css`)
- **69 tests** across 5 test files

### Auth endpoints

| Route | Purpose |
|-------|---------|
| `GET /login` | Email/password login (identity_provider=COGNITO) |
| `GET /login/google` | Google OAuth (skips Hosted UI) |
| `GET /login/discord` | Discord OAuth (skips Hosted UI) |
| `GET /auth/callback` | Smart callback (postMessage for popup, 302 for mobile) |
| `GET /api/auth/me` | Server-verified auth status (Cache-Control: no-store) |
| `GET /logout` | Clear cookies + Cognito sign-out |

## Phase Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1. Data Foundation | DONE | Content migrated, schemas validated |
| 2. Project Scaffold | DONE | Astro 5, themes, config, images |
| 3. Content Migration | DONE | Slug-folders, MDX conversion pending per-component |
| 4. Global Shell & Home | IN PROGRESS | Navbar done (4.1-4.2), 4.3 next |
| 5. Snapshot Page | Not started | Product detail pages |
| 6. Hub Page | Not started | Filterable product grids |
| 7. Content Pages | Not started | Reviews, guides, news, brands, games |
| 9. Auth & Dynamic | IN PROGRESS | Auth done, vault done, comments/PC builder pending |
| 10. SEO & Performance | Not started | Meta, structured data, image optimization |
| 12. Infrastructure | Not started | Deploy pipeline, Sharp image sizing |
| 13. CMS Configuration | Not started | Spec Factory integration |

## Cognito Hosted UI Customization

The `cognitoUI/template.css` file themes the Cognito login/signup pages to match the site's dark palette. Upload via:

**AWS Console:** Cognito > User Pool > App integration > Hosted UI customization > Upload CSS

**CLI:**
```sh
aws cognito-idp set-ui-customization \
  --user-pool-id <pool-id> \
  --css "$(cat cognitoUI/template.css)"
```

CSS limit: 3KB (current: ~1.9KB). Only `-customizable` class selectors are supported.
