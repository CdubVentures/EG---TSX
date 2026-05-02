# Search DB Sync

## Scope

This feature syncs local searchable content into the deployed PostgreSQL database that backs `/api/search`.

## Verified Flow

%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '20px', 'actorWidth': 250, 'actorMargin': 200, 'boxMargin': 20 }}}%%
```mermaid
sequenceDiagram
    autonumber
    actor Operator
    box Client
      participant UI as Dashboard SPA
    end
    box Local Runtime
      participant DbApi as /api/db/sync
      participant Watcher as services/watcher.py
      participant History as services/deploy_history.py
    end
    box Repo
      participant Sync as scripts/sync-db-remote.mjs
      participant Content as src/content + src/content/data-products
    end
    box Deployed EG-TSX Runtime
      participant Setup as /api/admin/db-setup
      participant Upsert as /api/admin/db-sync
      participant Search as /api/search
      participant Pg as PostgreSQL
    end

    Operator->>UI: Click DB Sync
    UI->>DbApi: POST /api/db/sync
    DbApi->>Sync: Spawn sync-db-remote.mjs
    Sync->>Content: Read local products and article content
    Sync->>Setup: POST schema setup with x-admin-token
    Setup->>Pg: CREATE TABLE IF NOT EXISTS and indexes
    Sync->>Upsert: POST products and articles payloads
    Upsert->>Pg: transactional upserts
    Search->>Pg: query products and articles
    Sync-->>DbApi: stdout/stderr progress
    DbApi-->>UI: SSE stream
    alt Success
      DbApi->>Watcher: Touch .last_db_sync_success
      DbApi->>History: Record db-sync run
      DbApi-->>UI: done event
    else Failure
      DbApi->>History: Record failed db-sync run
      DbApi-->>UI: failure stream
    end
```

## Current Contract

- `app/routers/db_sync.py` is protected by its own async lock, so overlapping DB syncs return HTTP `409`.
- The route derives the target base URL from `DEPLOY_COGNITO_CALLBACK_URL` when no explicit `--url` override is passed through the script.
- `scripts/sync-db-remote.mjs` uses `eg-setup-2026` as the default token unless `--token` or `ADMIN_TOKEN` overrides it.
- The deployed admin routes upsert products and articles into PostgreSQL, and the deployed search API then queries only those tables.

## Data Boundaries

- Canonical source of truth for searchable content remains the repo files.
- Canonical runtime search store is PostgreSQL after sync.
- The dashboard tracks pending DB sync work from watcher categories `product`, `review`, `guide`, `news`, `brand`, and `game`.

## Error Paths

- If `DEPLOY_COGNITO_CALLBACK_URL` is missing and no explicit `--url` is provided, the script exits with an error before any HTTP call.
- Unauthorized or invalid JSON at the deployed admin routes becomes a failed sync run in the dashboard.
- The setup and upsert routes are separate. Table creation can succeed while the later upsert call fails.

## Cross-Links

- Schema details: [../data/database-schema.md](../data/database-schema.md)
- Env and token inputs: [../runtime/environment-and-config.md](../runtime/environment-and-config.md)
- GUI ownership: [../interface/routing-and-gui.md](../interface/routing-and-gui.md)
- Observability panels: [operator-observability.md](operator-observability.md)

## Validated Against

- `app/routers/db_sync.py`
- `app/services/deploy_history.py`
- `app/services/watcher.py`
- `ui/dashboard.jsx`
- `../../scripts/sync-db-remote.mjs`
- `../../src/core/db.ts`
- `../../src/pages/api/admin/db-setup.ts`
- `../../src/pages/api/admin/db-sync.ts`
- `../../src/pages/api/search.ts`
- `../../scripts/schema.sql`
