# Runtime Verification

This page records what was actually executed during the documentation rebuild on March 11, 2026. It replaces older blanket "all green" claims as the current source of truth.

## Executed Commands

| Command | Result | Notes |
| --- | --- | --- |
| `python -m pytest tests -q` | `362 passed, 0 failed` | Re-run after cleaning stale GUI and infra test contracts |
| `node --import tsx --test tests/node/*.test.ts` | `16 passed, 0 failed` | Node-side dashboard helper tests passed |

## Current Status

The safe local automated suite is fully green as of March 11, 2026.

- Python tests: `362 passed`
- Node tests: `16 passed`

The prior 8 failures were stale assertions in `tests/test_gui_comprehensive.py` and `tests/test_infra_status.py`. They were updated to match the current dashboard shell, current source constants, and the expanded Lambda watch-path contract already present in the live backend.

## Commands Not Executed

- No live deploy commands were run against AWS during this task.
- No `POST /api/build/*`, `/api/cdn/*/live`, `/api/lambda/deploy`, or `/api/db/sync` action was executed against real infrastructure because those routes can change deployed resources, invalidate CloudFront, or update the remote database.
- Current behavior for those flows is documented from direct source inspection plus the safe automated tests above.

## Historical Artifact Handling

- `docs/GUI-TEST-LEDGER.md` is still preserved because `tests/test_gui_artifacts.py` requires it.
- That ledger reflects a March 7, 2026 artifact pass and should be read as historical evidence, not current suite status.

## Cross-Links

- Historical artifact ledger: [../GUI-TEST-LEDGER.md](../GUI-TEST-LEDGER.md)
- Audit decisions: [../deletion-ledger.md](../deletion-ledger.md)
- Launch prerequisites: [../operations/launch-and-bootstrap.md](../operations/launch-and-bootstrap.md)

## Validated Against

- `tests/test_gui_artifacts.py`
- `tests/test_gui_comprehensive.py`
- `tests/test_infra_status.py`
- `tests/node/cdn-path-status.test.ts`
- `tests/node/publish-cdn-plan.test.ts`
- `tests/node/queued-cdn-state.test.ts`
- `tests/node/site-stage-progress.test.ts`
- `app/main.py`
- `app/routers/infra_status.py`
- `ui/dashboard.jsx`
