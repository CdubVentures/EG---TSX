# Launch And Bootstrap

## Day-To-Day Launch Paths

### Native window

- Entry point: `app/launcher.pyw`
- Behavior: builds the bundle with `npx esbuild`, picks port `8420` unless occupied, sets `DEPLOY_DASHBOARD_PORT`, starts Uvicorn in a daemon thread, and opens a `pywebview` window.
- Shutdown behavior: closing the window ends the process and the daemon server thread with it.

### Browser mode

- Entry point: `scripts/start-browser.cmd`
- Behavior: runs esbuild from the repo root, then starts `python -m uvicorn main:app --port 8420`.
- The script assumes browser mode, so it does not auto-pick a free port the way the native launcher does.

### Direct backend run

- Entry point: `python -m uvicorn main:app --host 127.0.0.1 --port <port>` from `tools/deploy-dashboard/app`
- Use this when debugging backend routes without the launcher wrapper.

## Startup Validation

`app/main.py` checks these conditions during FastAPI lifespan startup:

- `package.json` exists under the configured project root
- `npm` is on `PATH`
- `aws` is on `PATH` as a warning-only check
- `ui/app.bundle.js` already exists

If the bundle is missing, startup fails with the exact esbuild command needed to recreate it.

## One-Time AWS Bootstrap References

The dashboard itself does not perform first-time AWS bootstrap. It documents and depends on the EG-TSX bootstrap flow:

1. Copy `infrastructure/aws/run-config.example.cmd` to `run-config.cmd`
2. Fill in at least `EG_TSX_ARTIFACT_BUCKET` and `EG_TSX_DATABASE_PASSWORD`
3. Run, in order:
   - `first-run-artifact-bucket.bat`
   - `second-run-main-stack.bat`
   - `third-run-first-deploy.bat`
4. If stack-owned IAM changes must be re-applied later, run:
   - `fourth-run-refresh-god-view-role.bat`

`infrastructure/aws/RUN-ORDER.txt` is the current bootstrap source of truth inside the audited repo.

## Operator Prerequisites

- Python 3.12+
- `pip install -r app/requirements.txt`
- Node/npm available on `PATH`
- AWS CLI v2 available on `PATH`
- A real `.env.deploy` file aligned with the target EG-TSX deployment

## Cross-Links

- Full config matrix: [../runtime/environment-and-config.md](../runtime/environment-and-config.md)
- Runtime topology: [../architecture/system-map.md](../architecture/system-map.md)
- Current verification status: [../validation/runtime-verification.md](../validation/runtime-verification.md)

## Validated Against

- `README.md`
- `app/launcher.pyw`
- `app/main.py`
- `scripts/start-browser.cmd`
- `../../infrastructure/aws/RUN-ORDER.txt`
- `../../infrastructure/aws/run-config.cmd`
