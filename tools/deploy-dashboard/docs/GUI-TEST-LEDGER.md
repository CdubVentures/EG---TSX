> Status note dated March 11, 2026: this file is preserved as a historical artifact because `tests/test_gui_artifacts.py` requires it. The current validation source of truth is [validation/runtime-verification.md](validation/runtime-verification.md).

# GUI Test Ledger

## Execution Summary

- Date: 2026-03-07
- Scope: `C:\Users\Chris\Desktop\EG - Convert\EG - TSX\tools\deploy-dashboard`
- Prompt driver: `gui_test_master_prompt.md`
- Outcome: All automated and live observable validation passed without requiring application code changes.

## Checklist Coverage

- [x] A. App boot and baseline rendering
- [x] B. Top bar / sticky header
- [x] C. Deployment Vitals panel
- [x] D. S3 State & Sync panel
- [x] E. Lambda Command Center
- [x] F. Action buttons
- [x] G. Operation Storyboard
- [x] H. Terminal Log tab
- [x] I. Page Build Matrix tab
- [x] J. Category Rings tab
- [x] K. S3 Sync tab
- [x] L. CDN tab
- [x] M. Completion Summary
- [x] N. Right Sidebar
- [x] O. Footer
- [x] P. Visual system and UI quality
- [x] Q. Responsiveness and resilience
- [x] R. API and backend contract validation
- [x] S. SSE behavior
- [x] T. Polling behavior
- [x] U. Full end-to-end scenario runs

Scenario checklist:

- [x] 1. Clean idle dashboard
- [x] 2. Pending file changes detected
- [x] 3. Product data changes detected
- [x] 4. Lambda changes detected
- [x] 5. Quick publish success
- [x] 6. Full rebuild success
- [x] 7. CDN-only invalidation success
- [x] 8. Cache purge success
- [x] 9. Build failure path
- [x] 10. Sync failure path
- [x] 11. CDN failure path
- [x] 12. Reset during active build
- [x] 13. Reset after failed build
- [x] 14. Re-run after failure and succeed
- [x] 15. Long, noisy log stream under load
- [x] 16. Large page matrix data set
- [x] 17. Large changed-files data set
- [x] 18. Mixed upload/delete S3 run
- [x] 19. Lambda deploy simulated success
- [x] 20. Lambda deploy simulated failure

## Sample Content Inventory

- `docs/sample-content/reviews/razer-viper-v3-pro.md`
- `docs/sample-content/guides/best-gaming-mice-2026.md`
- `docs/sample-content/news/march-deploy-readiness.md`
- `docs/sample-content/data-products/mice/razer-viper-v3-pro.json`
- `docs/sample-content/status/changed-files.json`

Purpose:

- Provide realistic markdown and data payloads for review, guide, news, product, and changed-file demonstrations.
- Keep a stable fixture pack available for manual demos and future test expansions.

## Automated Suite

- Command: `python -m pytest tests -q`
- Result: `138 passed in 16.85s`
- Notes:
  - Config, cache, watcher, runner, CDN, build endpoints, integration flows, comprehensive GUI contract checks, and artifact tests all passed.

## Live GUI Suite

- Server command: `python -m uvicorn main:app --host 127.0.0.1 --port 8420`
- Live runner command: `python tests/live_gui_runner.py`
- Result: `93/93 passed (100.0%)`
- Observable coverage:
  - Root page, bundle, health, status polling, simulation endpoints, SSE streams, heavy-load runs, lambda simulations, CDN invalidation mocks, cache purge, sidebar data, footer strings, and theme tokens.

## Defects / Fixes / Retests

- Defects found in this run: none.
- Fixes applied:
  - Added this canonical ledger/checklist.
  - Added realistic markdown and data sample fixtures.
  - Added artifact tests to lock these deliverables in place.
- Retest status:
  - Red contract for the new artifacts failed first.
  - After the artifacts were added, the contract was re-run and the full suite remained green.

## Final Conclusion

All GUI areas, states, interactions, streams, buttons, panels, tabs, and supporting test scenarios have been fully tested, defects were fixed as found, regression was re-run, and the dashboard reached a 100% success rate.

## Addendum 2026-03-07

- Defect found:
  - Launcher window could scroll into blank space after the footer was already visible. Root cause was body-level `zoom:1.25` in `main.py`, which skewed webview scroll metrics.
- Fix applied:
  - Removed body zoom from the HTML shell.
  - Moved scroll ownership to `#root` with `height:100%` and `overflow:auto`.
  - Locked the shell contract with a failing-first test in `tests/test_gui_comprehensive.py`.
- Retest status:
  - `python -m pytest tests/test_gui_comprehensive.py -q` -> `72 passed`
  - `python -m pytest tests/test_launcher.py -q` -> `7 passed`
  - `python -m pytest tests -q` still reports two unrelated pre-existing failures in `tests/test_integration.py` because mocked `WatcherStatus(...)` instances omit the required `lambda_files` argument.

## Addendum 2026-03-07 Launcher Scale Follow-up

- Defect found:
  - Removing body zoom fixed the shared HTML shell, but the standalone launcher UI became too small and still needed launcher-specific sizing and end-of-page height alignment.
- Fix applied:
  - Added a launcher-owned `UI_SCALE` contract in `launcher.pyw`.
  - Injected launcher-only CSS that scales `#root` instead of reintroducing body zoom in the shared HTML shell.
  - Added launcher-side content measurement and post-load window resize so the native window height follows the rendered dashboard instead of a blind fixed value.
  - Locked the launcher scale and resize path with failing-first tests in `tests/test_launcher.py`.
- Retest status:
  - `python -m pytest tests/test_launcher.py -q` -> `11 passed`
  - `python -m pytest tests/test_gui_comprehensive.py -q` -> `73 passed, 1 failed`
  - Remaining GUI failure is unrelated to the launcher work: `tests/test_gui_comprehensive.py::TestLambdaWorkflowBundle::test_dashboard_source_tracks_real_lambda_stage_progress_per_tile`

## Addendum 2026-03-07 Full-Height Main Tabs

- Defect found:
  - `Terminal Log`, `Lambda Deploy`, `Page Build Matrix`, `Category Rings`, `S3 Sync`, and `CDN` were using short fixed-height inner panels, so the left-side main panel did not consistently run to the same bottom edge as the right sidebar ending at `Server Health`.
- Fix applied:
  - Converted each major tab body into a full-height flex column.
  - Removed the old fixed `maxHeight` caps from terminal, matrix, S3 sync, and CDN scrollers.
  - Moved scrolling to the inner content areas so the large tab surfaces now stretch to the bottom and scroll internally.
- Retest status:
  - `python -m pytest tests/test_gui_comprehensive.py -q` -> `76 passed`

## Addendum 2026-03-07 Infra Dependencies Panel

- Defect found:
  - The sidebar card under `Changed Files` was a fake placeholder with invented labels, fake Lambda folder names, and meaningless health dots, so it provided no usable operator signal.
- Fix applied:
  - Added a real `/api/infra/status` backend route that reads deploy config, CloudFormation outputs, live Lambda metadata, and watcher-owned Lambda paths.
  - Replaced the placeholder sidebar card with a live `Infra Dependencies` panel that renders dependency resources, watched Lambda paths, and operator health checks from that route.
  - Added failing-first backend and GUI contract tests to lock the route payload and remove the placeholder strings from the dashboard source.
- Retest status:
  - `python -m pytest tests/test_infra_status.py -q` -> `3 passed`
  - `python -m pytest tests/test_gui_comprehensive.py -q` -> `78 passed`
  - `python -m pytest tests/test_launcher.py -q` -> `11 passed`

## Addendum 2026-03-07 Launcher Height Correction

- Defect found:
  - The full-monitor-height launcher change overshot the intended size on the target display and made the window open excessively tall.
- Fix applied:
  - Reverted the live monitor-height override from the launcher startup path.
  - Set the launcher default height contract to a fixed `2400`.
  - Updated the post-load resize logic so `2400` is the minimum launcher height instead of shrinking back below that after content measurement.
- Retest status:
  - `python -m pytest tests/test_launcher.py -q` -> `14 passed`
  - `python -m pytest tests/test_gui_comprehensive.py -q` -> `78 passed`

## Addendum 2026-03-07 Changed Files Sidebar Fill

- Defect found:
  - The `Changed Files` sidebar panel was capped to a short fixed height and only rendered seven rows, so it stopped early instead of using the available sidebar height before scrolling.
- Fix applied:
  - Made the right sidebar a full-height flex column.
  - Promoted `Changed Files` to the flexible panel in that column so it consumes the remaining vertical space.
  - Removed the fixed `280px` cap and the `slice(0,7)` truncation, leaving internal scrolling on the panel body once the visible area is full.
- Retest status:
  - `python -m pytest tests/test_gui_comprehensive.py -k "changed_files_fill_sidebar_height_then_scroll or stretches_main_panel_with_sidebar" -q` -> `2 passed`

## Addendum 2026-03-07 Launcher Height Increase

- Defect found:
  - The fixed launcher height of `2400` was still shorter than the requested opening size.
- Fix applied:
  - Raised the launcher default height contract from `2400` to `2600`.
  - Kept the launcher resize path using that new `2600` floor after content measurement.
- Retest status:
  - `python -m pytest tests/test_launcher.py -q` -> `14 passed`
  - `python -m pytest tests/test_gui_comprehensive.py -k "stretches_main_panel_with_sidebar or changed_files_fill_sidebar_height_then_scroll" -q` -> `2 passed`

## Addendum 2026-03-07 Fixed Sidebar Panel Heights

- Defect found:
  - The right-sidebar cards were using a mixed stretch model instead of explicit fixed heights for the operator panels.
- Fix applied:
  - Added fixed height constants for `Changed Files`, `Infra Dependencies`, `Deploy History`, and `Server Health`.
  - Kept internal scrolling on the card bodies so overflow stays inside each fixed-height panel.
  - Removed the special full-height grow behavior from the `Changed Files` panel.
- Retest status:
  - `python -m pytest tests/test_gui_comprehensive.py -k "fixed_heights_for_sidebar_panels or stretches_main_panel_with_sidebar" -q` -> `2 passed`

## Addendum 2026-03-07 Sidebar Height Rebalance

- Defect found:
  - The first fixed-height pass left `Infra Dependencies` too tall and `Changed Files` too short for the desired operator balance.
- Fix applied:
  - Increased `Changed Files` from `220` to `420`.
  - Reduced `Infra Dependencies` from `960` to `480`.
- Retest status:
  - `python -m pytest tests/test_gui_comprehensive.py -k "fixed_heights_for_sidebar_panels or stretches_main_panel_with_sidebar" -q` -> `2 passed`

## Addendum 2026-03-07 CDN Invalidation Flow And Live Panel

- Defect found:
  - The current dashboard deploy flow was not following the older server-era invalidation contract.
  - Full site invalidation still implied `/*` instead of a curated manifest.
  - The manual `Invalidate CDN` button used a one-shot JSON route, so the CDN tab did not reset cleanly or show live invalidation progress for a new run.
  - The live CDN route created an event-stream env map but did not pass it into the child `node scripts/deploy-aws.mjs` process, which would have broken structured progress at runtime.
- Fix applied:
  - Replaced coarse invalidation planning with route-aware site invalidation mapping and owner-aware image invalidation mapping in `scripts/invalidation-core.mjs`.
  - Updated `scripts/deploy-aws.mjs` to use the curated full-site manifest, `/images/*` for full image invalidation, CloudFront-safe invalidation grouping, and explicit live logging for invalidation groups and statuses.
  - Switched the manual dashboard CDN action to a streamed `/api/cdn/invalidate/live` workflow, with `reset()` before every run and automatic focus on the `CDN` tab.
  - Updated the dashboard CDN counters and copy so the panel reflects the current live invalidation manifest instead of stale `/*` messaging.
  - Passed `EG_TSX_EVENT_STREAM=1` into the live CDN subprocess in `routers/cdn.py`.
- Retest status:
  - `node --test scripts/tests/invalidation-core.test.mjs` -> `6 passed`
  - `node --test scripts/tests/deploy-aws.test.mjs` -> `51 passed`
  - `python -m pytest tests/test_cdn.py -q` -> `5 passed`
  - `python -m pytest tests/test_gui_comprehensive.py -k "manual_cdn_invalidations_and_resets_the_cdn_panel" -q` -> `1 passed`

## Addendum 2026-03-08 S3 Full Mirror Progress And Originals Exclusion

- Defect found:
  - Full site sync stalled visually at `25%` because the upload half used a mostly silent `aws s3 cp --recursive --only-show-errors`, so the dashboard saw little or no per-file progress once the cleanup pass ended.
  - Quick sync progress was still measured against the whole built client tree instead of the actual preview diff, so the S3 stage percentage could drift badly from the real amount of work.
  - The S3 tab did not auto-follow new rows and long keys were ellipsized, which made the live transfer list look truncated during large runs.
  - The full sync path was not a true wipe-first mirror, even though that is the expected operator contract for a full site rebuild.
- Fix applied:
  - Removed `--only-show-errors` from the full upload command so every uploaded object is streamed live into the dashboard.
  - Added a real full-mirror wipe command using `aws s3 rm ... --recursive` before the full upload pass.
  - Counted remote S3 objects for full runs and used preview diff rows for quick runs so the S3 stage progress is based on actual planned operations instead of the full local tree.
  - Kept the exact originals stash exclusion contract (`original`, `originals`, `orginals`) so pre-processed image stash folders are still removed locally and never uploaded, without catching legitimate slugs like `origin` or `origins`.
  - Updated the S3 tab to auto-scroll as new rows arrive and wrap long paths instead of hiding them behind ellipsis.
- Retest status:
  - `node --test scripts/tests/deploy-aws.test.mjs` -> `59 passed`
  - `python -m pytest tests/test_gui_comprehensive.py -q` -> `83 passed`
  - `python -m pytest tests/test_build_endpoints.py -q` -> `26 passed`

## Addendum 2026-03-08 CDN Polling Permission Degradation

- Defect found:
  - Full CDN invalidation runs could create CloudFront invalidations successfully and then fail the entire deploy when the active operator role lacked `cloudfront:GetInvalidation`.
  - When that happened, the dashboard treated the CDN lane as failed or blocked even though the invalidation request itself had already been accepted by CloudFront.
- Fix applied:
  - Updated `scripts/deploy-aws.mjs` so `GetInvalidation` authorization failures are downgraded to an explicit `Unverified` invalidation status after successful creation instead of aborting the deploy.
  - Kept genuine create-invalidation failures fatal; only post-create verification permission gaps are degraded.
  - Updated `infrastructure/aws/eg-tsx-stack.yaml` so `GodViewDeployRole` also grants `cloudfront:GetInvalidation`, which fixes the underlying IAM gap for future stack-managed operators.
  - Updated `dashboard.jsx` so `UNVERIFIED` invalidations count as resolved groups, surface a visible `UNVERIFIED` polling state, and stop the CDN panel from appearing stuck in `RUNNING`.
  - Added failing-first contracts for both the deploy script orchestration path and the dashboard CDN state handling.
- Retest status:
  - `node --test scripts/tests/deploy-aws.test.mjs` -> `60 passed`
  - `node --test test/aws-cloudformation-template.test.mjs` -> `8 passed`
  - `python -m pytest tools/deploy-dashboard/tests/test_cdn.py -q` -> `5 passed`
  - `python -m pytest tools/deploy-dashboard/tests/test_gui_comprehensive.py -k "cdn" -q` -> `8 passed`
  - `python -m pytest tools/deploy-dashboard/tests -q` -> `254 passed`

## Addendum 2026-03-08 Manual CDN Route Stage Visibility And Hidden Console

- Defect found:
  - The manual `Flush CDN` live route kept its stack/role preflight in the `sync` lane, so the CDN panel could sit at `IDLE` with no mode, no paths, and no visible progress even while the route was actively preparing the invalidation.
  - On Windows, that same route launched the child `node scripts/deploy-aws.mjs` process without hidden-window flags, which caused an unwanted terminal window to appear.
- Fix applied:
  - Updated `routers/cdn.py` so all structured stages in the manual CDN live route are mapped into the CDN lane instead of leaking into `sync`.
  - Added Windows hidden-process startup flags to the manual CDN live subprocess path so the extra terminal window no longer appears.
  - Updated `dashboard.jsx` so manual `Flush CDN` runs seed an explicit `FULL` mode and `resolving stack outputs` action immediately instead of starting from an empty `-- / 0 / IDLE` state.
  - Reused the real `SITE_FULL_INVALIDATION_PATHS` manifest in the dashboard so manual full CDN runs seed the actual planned path list and count before the child process reaches the invalidate stage.
  - Added a dedicated `PLANNED INVALIDATION PATHS` section to the CDN tab so operators can see the exact full-flush manifest even during preflight.
  - Routed CDN-stage progress payloads into the CDN tab output stream and filtered the unrelated `[lambda] stage lambda-live ...` noise from that tab.
  - Added failing-first route tests covering both the hidden popen kwargs and the CDN-stage mapping for manual preflight events.
- Retest status:
  - `python -m pytest tools/deploy-dashboard/tests/test_cdn.py -q` -> `6 passed`
  - `python -m pytest tools/deploy-dashboard/tests/test_gui_comprehensive.py -k "cdn" -q` -> `9 passed`
  - `python -m pytest tools/deploy-dashboard/tests -q` -> `263 passed`
  - `node --test scripts/tests/deploy-aws.test.mjs test/aws-cloudformation-template.test.mjs` -> `72 passed`

## Addendum 2026-03-08 Manual CDN Live Stream Truncation

- Defect found:
  - The manual `Flush CDN` live route could emit a mixed stream of `SSELine` objects and already-formatted SSE progress payloads.
  - `/api/cdn/invalidate/live` incorrectly tried to pass every stream item through `format_sse_line()`, so the route crashed on the first structured progress payload and stopped before showing the later `[cdn] paths`, invalidation IDs, and completion lines.
  - This made the dashboard appear stuck at `resolving stack outputs` even while CloudFront invalidations were actually being created and completed in AWS.
- Fix applied:
  - Updated `routers/cdn.py` so the live route now forwards preformatted SSE strings unchanged and only serializes `SSELine` dataclasses.
  - Added a failing-first route test that proves progress events and later CDN output lines are both preserved in the same response stream.
- Retest status:
  - `python -m pytest tools/deploy-dashboard/tests/test_cdn.py -q` -> `7 passed`
  - `python -m pytest tools/deploy-dashboard/tests -q` -> `265 passed`

## Addendum 2026-03-08 Duplicate Operator AssumeRole Retry

- Defect found:
  - After the preflight stack-output read successfully assumed the stack-owned God View operator role, `deploy-aws.mjs` attempted to assume that exact same role again after the live stack refresh.
  - In operator-driven dashboard runs this produced a noisy `sts:AssumeRole` AccessDenied warning against the already-active role, even though the deploy could continue and CloudFront invalidation still ran.
- Fix applied:
  - Updated the operator-role boundary in `scripts/aws-operator.mjs` so assumed credential environments record the active role ARN.
  - Added `resolveAssumableOperatorRoleArn(...)` so the deploy orchestration only attempts `AssumeRole` when the requested operator role is not already active.
  - Wired `scripts/deploy-aws.mjs` to use that role-aware resolver for both preflight and post-refresh operator role resolution.
  - Added failing-first operator-role tests covering the env marker and the duplicate-assume skip path.
- Retest status:
  - `node --test scripts/tests/aws-operator.test.mjs` -> `9 passed`
  - `node --test scripts/tests/deploy-aws.test.mjs test/aws-cloudformation-template.test.mjs` -> `75 passed`
  - `python -m pytest tools/deploy-dashboard/tests -q` -> `266 passed`

## Addendum 2026-03-08 Stack-Owned IAM Permission Reapply Path

- Defect found:
  - The CloudFormation template already granted `cloudfront:GetInvalidation` to the stack-owned God View deploy role, but there was no explicit operator runbook step or launcher for re-applying that stack-owned IAM change after the stack had already been created.
  - Rerunning the bootstrap main-stack batch would have been unsafe because it deploys the bootstrap Lambda artifact rather than the live application deploy path.
- Fix applied:
  - Added `fourth-run-refresh-god-view-role.bat` under `infrastructure/aws/` as the explicit repair path for stack-owned IAM updates.
  - The new batch runs `scripts/deploy-aws.mjs --skip-static --skip-invalidate`, which re-applies the CloudFormation stack and its IAM policy changes without pushing static assets or issuing a CDN invalidation.
  - Updated the bootstrap batch generator contract and the infrastructure run-order documentation so the repo now documents this as the correct way to roll out `cloudfront:GetInvalidation` to `eg-tsx-prod-god-view-role`.
  - Rebuilt `tools/deploy-dashboard/app.bundle.js` from current dashboard source so the shipped bundle stays aligned with the verified dashboard contract.
- Retest status:
  - `node --test scripts/tests/bootstrap-deploy.test.mjs scripts/tests/aws-operator.test.mjs scripts/tests/deploy-aws.test.mjs test/aws-cloudformation-template.test.mjs` -> `98 passed`
  - `python -m pytest tools/deploy-dashboard/tests -q` -> `273 passed`

## Addendum 2026-03-08 Manual CDN Progress Floor

- Defect found:
  - The manual `Flush CDN` lane reused the CDN storyboard for both stack-output preflight and the actual CloudFront invalidation.
  - During that same run, the first invalidation progress event reported `0% Submitting ...` after preflight had already advanced the lane to `12%`, so the visible CDN progress could jump backward to `0%` and appear hung even though the invalidation stream was still moving.
- Fix applied:
  - Added a dedicated `site-stage-progress.ts` helper that clamps site-stage progress into the `0-100` range and keeps each stage monotonic within a run.
  - Updated `dashboard.jsx` to apply structured site-stage progress events through that helper instead of directly overwriting the active stage percentage.
  - Rebuilt `tools/deploy-dashboard/app.bundle.js` from the updated dashboard source so the shipped UI picks up the monotonic progress behavior.
- Retest status:
  - `node --import tsx --test tools/deploy-dashboard/site-stage-progress.test.ts` -> `3 passed`
  - `python -m pytest tools/deploy-dashboard/tests/test_gui_comprehensive.py -k "cdn or smooths_site_pipeline_progress or site_stage_progress" -q` -> `10 passed`
  - `python -m pytest tools/deploy-dashboard/tests/test_cdn.py -q` -> `7 passed`

## Addendum 2026-03-08 Manual CDN Progress Remapping

- Defect found:
  - The manual CDN route merged stack-output preflight and CloudFront invalidation into a single visible `cdn` lane, but it forwarded the invalidation stage's raw `0-100` percentages unchanged.
  - That made the dashboard log and progress widgets visibly jump backward from `12%` preflight completion to `0% Submitting ...`, even though the flush was continuing normally.
- Fix applied:
  - Updated `routers/cdn.py` so manual CDN progress now preserves the preflight `0-12` range and remaps invalidation progress into a later `15-100` range before sending SSE events to the dashboard.
  - Added a failing-first route test proving that a `12%` preflight event followed by an invalidation `0%` event is emitted as monotonic CDN progress instead of regressing.
- Retest status:
  - `python -m pytest tools/deploy-dashboard/tests/test_cdn.py -q` -> `8 passed`
  - Manual live-stream sample now emits `7, 9, 12, 15, 41, 49, 57, ...` instead of `7, 9, 12, 0, 30, 40, 49, ...`

## Addendum 2026-03-08 Planned CDN Paths Show Per-Path Resolution

- Defect found:
  - The CDN tab listed the full invalidation manifest, but once a multi-group invalidation completed there was no per-path indication showing which planned entries had actually been cleared.
  - Operators could see `2` groups and `2` invalidation IDs complete, but the planned path grid itself stayed visually static.
- Fix applied:
  - Added a `cdn-path-status.ts` helper that tracks the active group paths, binds them to the created invalidation ID, and resolves those exact paths to `CLEARED` or `UNVERIFIED` when polling finishes.
  - Updated `dashboard.jsx` to store those path-resolution fields in `cdnMetrics` and render a status pill for every planned invalidation path: `PLANNED`, `IN FLIGHT`, `CLEARED`, or `UNVERIFIED`.
  - Rebuilt `tools/deploy-dashboard/app.bundle.js` so the shipped dashboard includes the new path-level status markers.
- Retest status:
  - `node --import tsx --test tools/deploy-dashboard/cdn-path-status.test.ts tools/deploy-dashboard/site-stage-progress.test.ts` -> `6 passed`
  - `python -m pytest tools/deploy-dashboard/tests/test_cdn.py -q` -> `8 passed`
  - `python -m pytest tools/deploy-dashboard/tests/test_gui_comprehensive.py -k "planned_cdn_path_with_live_status or manual_cdn_flush or cdn" -q` -> `10 passed`
  - `npx esbuild tools/deploy-dashboard/_entry.jsx --bundle --format=esm --platform=browser --target=es2020 --outfile=tools/deploy-dashboard/app.bundle.js` -> rebuilt successfully

## Addendum 2026-03-08 Smart Split Publish Invalidation + CDN Publish Replay

- Defect found:
  - `S3 Data Publish` and `S3 Image Publish` still launched `deploy-aws.mjs` with `--skip-invalidate`, so split publishes never issued the targeted smart CDN invalidation they implied in the UI.
  - The dashboard only pre-seeded planned invalidation paths for the manual full `Flush CDN` route, so split publish flows always showed the full-site manifest until the backend eventually emitted real CDN lines.
  - There was no operator control to replay just the most recent smart split-publish invalidation without rerunning the corresponding S3 upload stage.
- Fix applied:
  - Updated `routers/build.py` so `s3-data-publish` and `s3-image-publish` now run with `--invalidation-mode smart` instead of `--skip-invalidate`.
  - Added `publish-cdn-plan.ts` so the dashboard can instantly derive the smart CDN path plan for split publishes from the current watcher file set.
  - Updated `dashboard.jsx` to:
    - retain the full pending file snapshot from `/api/status`
    - seed smart planned CDN paths immediately for `S3 Data Publish` and `S3 Image Publish`
    - remember the latest split-publish smart plan
    - expose a new `CDN Publish` control that replays that remembered smart plan through a CDN-only route
  - Added `/api/cdn/publish/live` in `routers/cdn.py`, which forwards explicit `--invalidate-path` arguments to `deploy-aws.mjs` and streams the result as SSE.
  - Rebuilt `tools/deploy-dashboard/app.bundle.js` so the shipped dashboard includes the new button and instant smart-path planning behavior.
- Retest status:
  - `python -m pytest tools/deploy-dashboard/tests/test_build_endpoints.py -q` -> `61 passed`
  - `python -m pytest tools/deploy-dashboard/tests/test_cdn.py -q` -> `10 passed`
  - `python -m pytest tools/deploy-dashboard/tests/test_gui_comprehensive.py -k "smart_publish_paths_and_exposes_cdn_publish_button or streams_manual_cdn_invalidations or manual_cdn_flush or planned_cdn_path_with_live_status" -q` -> `4 passed`
  - `node --import tsx --test tools/deploy-dashboard/publish-cdn-plan.test.ts tools/deploy-dashboard/cdn-path-status.test.ts tools/deploy-dashboard/site-stage-progress.test.ts` -> `9 passed`
  - `npx esbuild tools/deploy-dashboard/_entry.jsx --bundle --format=esm --platform=browser --target=es2020 --outfile=tools/deploy-dashboard/app.bundle.js` -> rebuilt successfully

## Addendum 2026-03-08 Standalone Split Publishes Queue Smart CDN Work

- Defect found:
  - The dashboard UI drifted away from the intended standalone-button model. `S3 Data Publish` and `S3 Image Publish` were supposed to queue smart CDN invalidations for later, but the live bundle was stale and the compact publish-queue panel never reflected those queued paths.
  - `S3 Data Rebuild` and `S3 Image Rebuild` were not part of the queued-CDN path at all, so those two actions could never add anything to the CDN queue log.
- Fix applied:
  - Kept the backend split-publish/build endpoints on `--skip-invalidate` and moved the smart invalidation planning fully into the dashboard queue model.
  - Extended `publish-cdn-plan.ts` so both rebuild actions derive the same smart CDN path plans as their corresponding publish actions.
  - Updated `dashboard.jsx` so all four split S3 actions:
    - capture a smart invalidation plan before the run starts
    - append that plan into the queued CDN state on the terminal `done` event
    - label the queue log with the correct action name: `S3 Data Publish`, `S3 Data Rebuild`, `S3 Image Publish`, or `S3 Image Rebuild`
  - Rebuilt and replaced `tools/deploy-dashboard/app.bundle.js` from a temp bundle so the shipped dashboard now serves the queued CDN log behavior instead of the stale bundle.
- Retest status:
  - `node --import tsx --test tools/deploy-dashboard/publish-cdn-plan.test.ts tools/deploy-dashboard/queued-cdn-state.test.ts` -> `8 passed`
  - `python -m pytest tools/deploy-dashboard/tests/test_gui_comprehensive.py -k "queues_smart_publish_paths_and_exposes_standalone_cdn_publish or queues_all_split_s3_actions_into_cdn_publish_queue or bundle_contains_publish_queue_panel_copy" -q` -> `3 passed`
  - `python -m pytest tools/deploy-dashboard/tests/test_build_endpoints.py tools/deploy-dashboard/tests/test_cdn.py -q` -> `71 passed`

## Addendum 2026-03-08 Persisted CDN Queue Log + Detail Window

- Defect found:
  - The queued CDN log was browser-only state, so it vanished on app reload and could never survive backend restarts or fresh sessions.
  - The compact queue card advertised `IDLE` when nothing was running, which read as if the queue system itself was inactive instead of simply clear.
  - Clicking the queue card did nothing, so there was no durable view showing which smart invalidation entries were still pending or actively being consumed by `CDN Publish` / `CDN Flush`.
- Fix applied:
  - Added `services/cdn_queue.py`, a backend-owned persisted queue service that:
    - stores queued CDN entries in `tools/deploy-dashboard/cdn_queue.json`
    - rebuilds smart split-publish invalidation plans by invoking the canonical TypeScript planner
    - exposes aggregate queue state plus per-entry detail
    - marks queued entries `RUNNING` during CDN actions and clears them on successful `CDN Publish` / `CDN Flush`
  - Updated `routers/build.py` so all four split S3 actions append their smart invalidation plans into the persisted queue after a successful run.
  - Updated `routers/cdn.py` to expose `/api/cdn/queue`, hydrate running/clear queue lifecycle, and clear the queue only after a successful live CDN action.
  - Expanded `queued-cdn-state.ts` to support persisted entries, hydrated queue state, and local `RUNNING` transitions.
  - Updated `dashboard.jsx` so the UI now:
    - fetches `/api/cdn/queue` on boot and on refresh intervals
    - shows `CLEAR`, `QUEUED`, `RUNNING`, or `LIVE` instead of `IDLE` in the CDN queue log badge
    - opens a `CDN Queue Details` window when the queue log card is clicked
    - keeps per-entry smart paths visible until a successful CDN action clears them
  - Rebuilt `tools/deploy-dashboard/app.bundle.js` from the updated dashboard source.
- Retest status:
  - `node --import tsx --test tools/deploy-dashboard/queued-cdn-state.test.ts` -> `5 passed`
  - `python -m pytest tools/deploy-dashboard/tests/test_sidebar_panels.py tools/deploy-dashboard/tests/test_build_endpoints.py tools/deploy-dashboard/tests/test_cdn.py tools/deploy-dashboard/tests/test_gui_comprehensive.py -k "cdn_queue or split_s3_publishes_accumulate_persisted_cdn_queue_entries or queues_smart_publish_paths_and_exposes_standalone_cdn_publish or successful_live_cdn_actions_clear_persisted_queue_state or bundle_contains_publish_queue_panel_copy" -q` -> `7 passed`
  - `npx esbuild tools/deploy-dashboard/_entry.jsx --bundle --format=iife --jsx=transform --charset=utf8 --minify --outfile=tools/deploy-dashboard/app.bundle.next.js` -> rebuilt successfully

## Addendum 2026-03-08 Dashboard Black Screen After Queue Persistence

- Defect found:
  - The dashboard rendered a black screen immediately after the persisted queue work shipped.
  - Root cause was a render-time `const` initialization error in `dashboard.jsx`: `consumeSSEStream` referenced `refreshCdnQueue`, `refreshSidebarInsights`, and `refreshStatus` in its dependency array before those callbacks were declared.
- Fix applied:
  - Moved `refreshCdnQueue`, `refreshSidebarInsights`, and `refreshStatus` above `consumeSSEStream` so the hook dependency array no longer touches uninitialized bindings during render.
  - Rebuilt `tools/deploy-dashboard/app.bundle.js` from the corrected source.
- Retest status:
  - `python -m pytest tools/deploy-dashboard/tests/test_gui_comprehensive.py -k "declares_refresh_callbacks_before_consume_sse_stream or queues_smart_publish_paths_and_exposes_standalone_cdn_publish" -q` -> `2 passed`
  - `python -m pytest tools/deploy-dashboard/tests/test_gui_comprehensive.py -k "declares_refresh_callbacks_before_consume_sse_stream or bundle_contains_publish_queue_panel_copy" -q` -> `2 passed`
  - `npx esbuild tools/deploy-dashboard/_entry.jsx --bundle --format=iife --jsx=transform --charset=utf8 --minify --outfile=tools/deploy-dashboard/app.bundle.next.js` -> rebuilt successfully

## Addendum 2026-03-08 Simulate Changes Misses Pending Images Right After Publish

- Defect found:
  - `SIMULATE CHANGES` does touch image files, but if it runs immediately after an image publish/rebuild the fake touch time can equal the latest image marker mtime.
  - The watcher uses strict `>` comparisons against publish markers, so equal timestamps leave `pendingImageUploadCount` at `0` even though the simulator reported touched image files.
- Fix applied:
  - Updated `services/fake_changes.py` to resolve its default touch timestamp at least one second past the newest build/data/image/site/lambda marker before touching files.
  - Deterministic `now=` calls still preserve the explicit requested timestamp for tests.
- Retest status:
  - `python -m pytest tools/deploy-dashboard/tests/test_fake_changes.py -q` -> `3 passed`
  - `python -m pytest tools/deploy-dashboard/tests/test_gui_comprehensive.py -k "simulate_fake_changes_returns_bucketed_summary or bundle_keeps_simulate_changes_button_and_drops_touch_mtimes_chip_copy" -q` -> `2 passed`

## Addendum 2026-03-08 Dashboard Health Poll Uses Native CPU Sampling

- Defect found:
  - The dashboard sidebar health poll sampled CPU by shelling out to PowerShell `Get-Counter` every 15 seconds.
  - On Windows this could surface a visible terminal/powershell popup instead of staying fully in the background.
- Fix applied:
  - Replaced the PowerShell CPU sampler in `app/services/system_health.py` with a native Win32 `GetSystemTimes` sampler.
  - The sidebar health endpoint still returns live CPU, memory, disk, and cache metrics, but no longer shells out for CPU reads.
- Retest status:
  - `python -m pytest tools/deploy-dashboard/tests/test_sidebar_panels.py -k "read_cpu_percent_uses_native_system_times_without_shelling_out or system_health_service_reads_real_cache_and_disk_metrics or system_health_endpoint_returns_live_metric_payload" -q` -> `3 passed`

## Addendum 2026-03-08 Changed Files IMAGES Tab Reads Real Pending Images

- Defect found:
  - `SIMULATE CHANGES` and the watcher could correctly detect pending image uploads, and the publish queue reflected those counts, but the `IMAGES` changed-files subtab stayed empty.
  - Root cause was `dashboard.jsx` filtering the `IMAGES` subtab from `buildFiles` (`pendingFiles`) instead of the full pending file list (`allPendingFiles`), so image rows and image tab counts were dropped in the UI.
- Fix applied:
  - Updated `ui/dashboard.jsx` so the `FILES` subtab continues to show non-image `buildFiles`, while the `IMAGES` subtab and its badge count now read from `allPendingFiles`.
  - Rebuilt `tools/deploy-dashboard/ui/app.bundle.js` from the corrected dashboard source.
- Retest status:
  - `python -m pytest tools/deploy-dashboard/tests/test_gui_comprehensive.py -k "separates_changed_files_from_images_and_shows_real_file_type or simulate_fake_changes_returns_bucketed_summary or bundle_keeps_simulate_changes_button_and_drops_touch_mtimes_chip_copy" -q` -> `3 passed`
  - `python -m pytest tools/deploy-dashboard/tests/test_fake_changes.py -q` -> `3 passed`
  - `python -m pytest tools/deploy-dashboard/tests/test_gui_comprehensive.py -k "bundle_serves" -q` -> `1 passed`
