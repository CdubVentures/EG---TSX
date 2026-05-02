# EG - TSX

Astro 5 + React 19 implementation of the EG site. This repo also contains the
config manager app under `config/` and the deploy dashboard under
`tools/deploy-dashboard/`.

## Start Here

- [docs/README.md](docs/README.md) - canonical site documentation entrypoint
- [docs/03-architecture/system-map.md](docs/03-architecture/system-map.md) - deployment topology
- [docs/03-architecture/routing-and-gui.md](docs/03-architecture/routing-and-gui.md) - route ownership
- [docs/02-dependencies/environment-and-config.md](docs/02-dependencies/environment-and-config.md) - env and config surfaces
- [config/README.md](config/README.md) - config manager app and colocated docs
- [tools/deploy-dashboard/README.md](tools/deploy-dashboard/README.md) - deploy dashboard app docs

## Local Contracts

Read the nearest folder `README.md` before changing code in that boundary:

- [src/README.md](src/README.md) - source boundary map for pages, content, core, shared, and features
- [src/pages/README.md](src/pages/README.md) - Astro route ownership and composition-root rules
- [src/content/README.md](src/content/README.md) - content collection and frontmatter contract
- [scripts/README.md](scripts/README.md) - build, deploy, migration, and validation script contract
- [infrastructure/README.md](infrastructure/README.md) - infrastructure-as-code and generated artifact boundary
- [config/README.md](config/README.md) - config manager app and mutable JSON contract
- [tools/deploy-dashboard/README.md](tools/deploy-dashboard/README.md) - local deploy operator app contract

## Verified Runtime Shape

- Static HTML and assets are built by Astro and served from S3 behind CloudFront.
- Dynamic auth, search, vault, admin, and utility routes run through the Astro
  standalone adapter behind the Lambda Function URL.
- Search is backed by PostgreSQL.
- Auth is backed by Cognito.
- Signed-in vault persistence is backed by DynamoDB.

## Local Commands

```sh
npm install
npm run dev
npm run type-check
npm run test:js
npm run build
```
