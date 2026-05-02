# Stack and Toolchain

> **Purpose:** Every language, framework, runtime, package manager, and build tool — with versions.
> **Prerequisites:** [Scope](../01-project-overview/scope.md)
> **Last validated:** 2026-03-18

## Runtime

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 22.14.0 | Server runtime and build tooling |
| npm | 10.9.2 | Package manager |
| Python | 3.x (with Tkinter) | Config tool GUI |

## Framework Stack

| Package | Version | Purpose | Category |
|---------|---------|---------|----------|
| astro | ^5.17.1 | Meta-framework (SSG/SSR hybrid) | production |
| @astrojs/node | ^9.5.4 | Standalone Node adapter for Lambda | production |
| @astrojs/react | ^4.4.2 | React integration (interactive islands) | production |
| @astrojs/mdx | ^4.3.13 | MDX content support | production |
| @astrojs/sitemap | ^3.7.0 | Automatic sitemap generation | production |
| react | ^19.2.4 | UI library for interactive components | production |
| react-dom | ^19.2.4 | React DOM rendering | production |

## Styling

| Package | Version | Purpose | Category |
|---------|---------|---------|----------|
| tailwindcss | ^4.2.1 | Utility-first CSS framework (v4) | production |
| @tailwindcss/vite | ^4.2.1 | Tailwind Vite plugin | production |
| tailwind-merge | ^3.5.0 | Intelligent class deduplication | production |
| class-variance-authority | ^0.7.1 | Type-safe component variants | production |
| clsx | ^2.1.1 | Conditional class name builder | production |

## State Management

| Package | Version | Purpose | Category |
|---------|---------|---------|----------|
| nanostores | ^1.1.1 | Lightweight atomic state (cross-island) | production |
| @nanostores/react | ^1.0.0 | React hooks for Nano Stores | production |

## AWS & Auth

| Package | Version | Purpose | Category |
|---------|---------|---------|----------|
| @aws-sdk/client-dynamodb | ^3.1001.0 | DynamoDB client (vault persistence) | production |
| @aws-sdk/lib-dynamodb | ^3.1001.0 | DynamoDB document client | production |
| aws-amplify | ^6.16.2 | Cognito OAuth setup/utilities | production |
| jose | ^6.1.3 | JWT validation (Cognito tokens) | production |

## Database & Data

| Package | Version | Purpose | Category |
|---------|---------|---------|----------|
| pg | ^8.20.0 | PostgreSQL client (RDS search DB) | production |
| @paralleldrive/cuid2 | ^3.3.0 | CUID2 ID generation | production |

## UI Components

| Package | Version | Purpose | Category |
|---------|---------|---------|----------|
| embla-carousel | ^8.6.0 | Carousel/slider component | production |
| archiver | ^7.0.1 | Archive creation (deployment) | production |

## Dev Dependencies

| Package | Version | Purpose | Category |
|---------|---------|---------|----------|
| typescript | ^5.9.3 | Language and type checking | dev |
| @astrojs/check | ^0.9.6 | Astro-aware type checker | dev |
| tsx | ^4.21.0 | TypeScript execution (Node 22 --import) | dev |
| gray-matter | ^4.0.3 | YAML frontmatter parsing (scripts) | dev |
| @types/react | ^19.2.14 | React type definitions | dev |
| @types/react-dom | ^19.2.3 | React DOM type definitions | dev |
| @types/pg | (latest) | PostgreSQL type definitions | dev |

## Python Dependencies (config tool)

| Package | Version | Purpose |
|---------|---------|---------|
| fastapi | >=0.115.0 | Web framework (React config panel API) |
| uvicorn | >=0.34.0 | ASGI server |
| pywebview | >=5.0 | Desktop GUI wrapper |

## Build Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Local Astro dev server (http://localhost:4321) |
| `npm run build` | Production build via `scripts/run-astro-build.mjs` |
| `npm run type-check` | `astro check` TypeScript validation |
| `npm run test:js` | `node --import tsx --test` (all JS tests) |
| `npm run test:py` | `python -m pytest config/tests` |
| `npm run validate` | type-check + test:js + test:py |

## No Linter/Formatter Config

The project has no `.eslintrc`, `.prettierrc`, or `biome.json`. Code style is enforced via the repo-level `AGENTS.md` conventions and review.

## Related Documents

- [External Services](external-services.md) — third-party APIs and cloud services
- [Environment and Config](environment-and-config.md) — env vars and config surfaces
