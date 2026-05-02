# EG Deploy Dashboard

Local FastAPI + React operator dashboard for EG-TSX deploy work. It watches the repo, runs the EG-TSX deploy scripts, streams SSE progress, and persists local operator state such as deploy history and queued CDN work.

## Start Here

The canonical documentation entrypoint is [docs/README.md](docs/README.md). That tree now contains the audited system map, config matrix, data model, GUI/API map, feature flows, validation notes, and the Phase 0 deletion ledger.

Local boundary contracts:

- [app/README.md](app/README.md)
- [app/routers/README.md](app/routers/README.md)
- [app/services/README.md](app/services/README.md)
- [ui/README.md](ui/README.md)
- [scripts/README.md](scripts/README.md)
- [tests/README.md](tests/README.md)

## Launch

- Native window: `app/launcher.pyw`
- Browser mode: `scripts/start-browser.cmd`
- Direct backend: `python -m uvicorn main:app --host 127.0.0.1 --port 8420` from `app/`

## Prerequisites

- Python 3.12+
- `pip install -r app/requirements.txt`
- Node/npm on `PATH`
- AWS CLI v2 on `PATH`
- `tools/deploy-dashboard/.env.deploy`

## Current Runtime Scope

- site publish and rebuild runs
- split S3 data and image publishes that queue smart CDN work
- `CDN Publish` and `CDN Flush`
- Lambda-only deploys
- remote search DB sync
- pending-file, infra, deploy-history, CDN-queue, and system-health visibility

## Validation

Use [docs/validation/runtime-verification.md](docs/validation/runtime-verification.md) for the current executed test status. Older artifact ledgers under `docs/` are preserved only where the test suite still requires them.

## Validated Against

- `app/main.py`
- `app/launcher.pyw`
- `scripts/start-browser.cmd`
- `docs/README.md`
- `docs/validation/runtime-verification.md`
