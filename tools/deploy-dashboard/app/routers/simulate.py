"""
Simulation endpoints for GUI testing.

These endpoints inject fake SSE streams, status data, and scenario triggers
so every dashboard state can be exercised without real builds or AWS calls.

DEV-ONLY — never enabled in production.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from services.fake_changes import apply_fake_changes

logger = logging.getLogger("deploy-dashboard.simulate")

router = APIRouter(prefix="/simulate", tags=["simulate"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sse(stage: str, line: str, source: str = "stdout") -> str:
    data = {
        "stage": stage,
        "source": source,
        "line": line,
        "timestamp": _now_iso(),
    }
    return f"data: {json.dumps(data)}\n\n"


def _get_config():
    from main import config
    return config


# ── Scenario: Quick Build Success ──────────────────────────────────────
@router.post("/build/quick-success")
async def sim_quick_success(speed: float = Query(0.05, description="Delay between events in seconds")):
    """Simulate a successful quick build with realistic output."""

    async def stream():
        # Build stage
        yield _sse("build", "Starting: Astro Build", "system")
        await asyncio.sleep(speed)
        for i, page in enumerate([
            "/monitors/lg-ultragear-27gp950/index.html",
            "/monitors/dell-alienware-aw3423dw/index.html",
            "/monitors/samsung-odyssey-g9/index.html",
            "/keyboards/logitech-g915-tkl/index.html",
            "/keyboards/keychron-q1-pro/index.html",
            "/mice/logitech-g-pro-x-superlight/index.html",
            "/mice/razer-deathadder-v3/index.html",
            "/mice/razer-viper-v3-pro/index.html",
            "/headsets/steelseries-arctis-nova-pro/index.html",
            "/headsets/hyperx-cloud-alpha/index.html",
            "/news/best-monitors-2025/index.html",
            "/news/mechanical-keyboards-guide/index.html",
            "/news/gaming-mice-roundup/index.html",
        ]):
            yield _sse("build", f"  built {page} (+{12+i}ms)")
            await asyncio.sleep(speed)

        yield _sse("build", "[build] Complete. 13 pages built in 2.4s")
        await asyncio.sleep(speed)

        # Sync stage
        yield _sse("sync", "Starting: S3 Sync", "system")
        await asyncio.sleep(speed)
        for path in [
            "monitors/lg-ultragear-27gp950/index.html",
            "monitors/dell-alienware-aw3423dw/index.html",
            "monitors/samsung-odyssey-g9/index.html",
            "keyboards/logitech-g915-tkl/index.html",
            "keyboards/keychron-q1-pro/index.html",
            "mice/logitech-g-pro-x-superlight/index.html",
            "mice/razer-deathadder-v3/index.html",
            "mice/razer-viper-v3-pro/index.html",
            "headsets/steelseries-arctis-nova-pro/index.html",
            "news/best-monitors-2025/index.html",
            "_astro/chunk-abc123.js",
            "_astro/style-def456.css",
        ]:
            yield _sse("sync", f"upload: s3://eggear-tsx/{path}")
            await asyncio.sleep(speed)

        yield _sse("sync", "delete: s3://eggear-tsx/_astro/old-chunk-xyz.js")
        await asyncio.sleep(speed)
        yield _sse("sync", "delete: s3://eggear-tsx/_astro/old-style-abc.css")
        await asyncio.sleep(speed)

        # CDN stage
        yield _sse("cdn", "Starting: CDN Invalidation", "system")
        await asyncio.sleep(speed)
        yield _sse("cdn", "Creating invalidation for distribution E1ITXKZVMDZMZ5...")
        await asyncio.sleep(speed)
        yield _sse("cdn", "InvalidationId: I3EXAMPLE12345")
        await asyncio.sleep(speed)
        yield _sse("cdn", "Status: InProgress")
        await asyncio.sleep(speed)
        yield _sse("cdn", "Paths: /*")
        await asyncio.sleep(speed)

        # Done
        yield _sse("done", "Quick build complete", "system")

    return StreamingResponse(stream(), media_type="text/event-stream")


# ── Scenario: Full Rebuild Success ─────────────────────────────────────
@router.post("/build/full-success")
async def sim_full_success(speed: float = Query(0.05)):
    """Simulate a successful full rebuild."""

    async def stream():
        yield _sse("cache-purge", "Cache purged: .astro, node_modules/.vite", "system")
        await asyncio.sleep(speed)

        yield _sse("build", "Starting: Astro Build (Clean)", "system")
        await asyncio.sleep(speed)

        pages = [
            "/monitors/lg-ultragear-27gp950/index.html",
            "/monitors/dell-alienware-aw3423dw/index.html",
            "/monitors/samsung-odyssey-g9/index.html",
            "/monitors/asus-rog-swift-pg42uq/index.html",
            "/keyboards/logitech-g915-tkl/index.html",
            "/keyboards/keychron-q1-pro/index.html",
            "/keyboards/ducky-one-3/index.html",
            "/mice/logitech-g-pro-x-superlight/index.html",
            "/mice/razer-deathadder-v3/index.html",
            "/mice/razer-viper-v3-pro/index.html",
            "/mice/endgame-gear-xm2we/index.html",
            "/headsets/steelseries-arctis-nova-pro/index.html",
            "/headsets/hyperx-cloud-alpha/index.html",
            "/news/best-monitors-2025/index.html",
            "/news/mechanical-keyboards-guide/index.html",
            "/news/gaming-mice-roundup/index.html",
            "/news/headset-buying-guide/index.html",
        ]
        for i, page in enumerate(pages):
            yield _sse("build", f"  built {page} (+{10+i*2}ms)")
            await asyncio.sleep(speed)

        yield _sse("build", f"[build] Complete. {len(pages)} pages built in 4.8s")
        await asyncio.sleep(speed)

        yield _sse("sync", "Starting: S3 Sync (Mirror)", "system")
        await asyncio.sleep(speed)
        for i in range(20):
            yield _sse("sync", f"upload: s3://eggear-tsx/page-{i:03d}/index.html")
            await asyncio.sleep(speed * 0.5)

        for i in range(5):
            yield _sse("sync", f"delete: s3://eggear-tsx/old-page-{i:03d}/index.html")
            await asyncio.sleep(speed * 0.5)

        yield _sse("cdn", "Starting: CDN Invalidation (/*)", "system")
        await asyncio.sleep(speed)
        yield _sse("cdn", "InvalidationId: I3FULLREBUILD789")
        await asyncio.sleep(speed)
        yield _sse("cdn", "Status: InProgress")
        await asyncio.sleep(speed)

        yield _sse("done", "Full rebuild complete", "system")

    return StreamingResponse(stream(), media_type="text/event-stream")


# ── Scenario: Build Failure ────────────────────────────────────────────
@router.post("/build/failure")
async def sim_build_failure(speed: float = Query(0.05)):
    """Simulate a build that fails during the Astro build stage."""

    async def stream():
        yield _sse("build", "Starting: Astro Build", "system")
        await asyncio.sleep(speed)
        yield _sse("build", "  built /monitors/lg-ultragear-27gp950/index.html (+12ms)")
        await asyncio.sleep(speed)
        yield _sse("build", "  built /monitors/dell-alienware-aw3423dw/index.html (+14ms)")
        await asyncio.sleep(speed)
        yield _sse("build", "[ERROR] Could not resolve import '@components/MissingWidget'", "stderr")
        await asyncio.sleep(speed)
        yield _sse("build", "error: Build FAILED with 1 error", "stderr")
        await asyncio.sleep(speed)
        yield _sse("build", "FAILED with exit code 1", "system")

    return StreamingResponse(stream(), media_type="text/event-stream")


# ── Scenario: Sync Failure ─────────────────────────────────────────────
@router.post("/build/sync-failure")
async def sim_sync_failure(speed: float = Query(0.05)):
    """Simulate build success but S3 sync failure."""

    async def stream():
        yield _sse("build", "Starting: Astro Build", "system")
        await asyncio.sleep(speed)
        for page in [
            "/monitors/lg-ultragear-27gp950/index.html",
            "/keyboards/logitech-g915-tkl/index.html",
            "/mice/razer-deathadder-v3/index.html",
        ]:
            yield _sse("build", f"  built {page} (+15ms)")
            await asyncio.sleep(speed)
        yield _sse("build", "[build] Complete. 3 pages built in 0.9s")
        await asyncio.sleep(speed)

        yield _sse("sync", "Starting: S3 Sync", "system")
        await asyncio.sleep(speed)
        yield _sse("sync", "upload: s3://eggear-tsx/monitors/lg-ultragear-27gp950/index.html")
        await asyncio.sleep(speed)
        yield _sse("sync", "fatal error: An error occurred (AccessDenied) when calling PutObject", "stderr")
        await asyncio.sleep(speed)
        yield _sse("sync", "FAILED with exit code 1", "system")

    return StreamingResponse(stream(), media_type="text/event-stream")


# ── Scenario: CDN Failure ──────────────────────────────────────────────
@router.post("/build/cdn-failure")
async def sim_cdn_failure(speed: float = Query(0.05)):
    """Simulate build+sync success but CDN invalidation failure."""

    async def stream():
        yield _sse("build", "Starting: Astro Build", "system")
        await asyncio.sleep(speed)
        yield _sse("build", "  built /monitors/lg-ultragear-27gp950/index.html (+12ms)")
        await asyncio.sleep(speed)
        yield _sse("build", "[build] Complete. 1 page built in 0.3s")
        await asyncio.sleep(speed)

        yield _sse("sync", "Starting: S3 Sync", "system")
        await asyncio.sleep(speed)
        yield _sse("sync", "upload: s3://eggear-tsx/monitors/lg-ultragear-27gp950/index.html")
        await asyncio.sleep(speed)

        yield _sse("cdn", "Starting: CDN Invalidation", "system")
        await asyncio.sleep(speed)
        yield _sse("cdn", "FAILED: TooManyInvalidationsInProgress — max 3 concurrent invalidations", "stderr")
        await asyncio.sleep(speed)
        yield _sse("cdn", "FAILED with exit code 1", "system")

    return StreamingResponse(stream(), media_type="text/event-stream")


# ── Scenario: Heavy Load (many pages + uploads) ───────────────────────
@router.post("/build/heavy-load")
async def sim_heavy_load(
    pages: int = Query(50, description="Number of build pages"),
    uploads: int = Query(80, description="Number of S3 uploads"),
    deletes: int = Query(15, description="Number of S3 deletes"),
    speed: float = Query(0.02),
):
    """Simulate a heavy-load scenario with many pages and sync operations."""
    categories = ["monitors", "keyboards", "mice", "headsets", "news"]

    async def stream():
        yield _sse("build", "Starting: Astro Build", "system")
        await asyncio.sleep(speed)
        for i in range(pages):
            cat = categories[i % len(categories)]
            yield _sse("build", f"  built /{cat}/product-{i:04d}/index.html (+{10+i}ms)")
            await asyncio.sleep(speed)
        yield _sse("build", f"[build] Complete. {pages} pages built in {pages * 0.08:.1f}s")
        await asyncio.sleep(speed)

        yield _sse("sync", "Starting: S3 Sync", "system")
        await asyncio.sleep(speed)
        for i in range(uploads):
            cat = categories[i % len(categories)]
            yield _sse("sync", f"upload: s3://eggear-tsx/{cat}/product-{i:04d}/index.html")
            await asyncio.sleep(speed * 0.3)
        for i in range(deletes):
            yield _sse("sync", f"delete: s3://eggear-tsx/old/{categories[i % len(categories)]}/removed-{i:03d}.html")
            await asyncio.sleep(speed * 0.3)

        yield _sse("cdn", "Starting: CDN Invalidation", "system")
        await asyncio.sleep(speed)
        yield _sse("cdn", "InvalidationId: I3HEAVYLOAD999")
        await asyncio.sleep(speed)
        yield _sse("cdn", "Status: InProgress")
        await asyncio.sleep(speed)

        yield _sse("done", "Heavy load build complete", "system")

    return StreamingResponse(stream(), media_type="text/event-stream")


# ── Scenario: Lambda Deploy Success ────────────────────────────────────
@router.post("/lambda/deploy-success")
async def sim_lambda_success(speed: float = Query(0.1)):
    """Simulate a successful Lambda deployment."""

    async def stream():
        yield _sse("lambda", "Starting: Lambda Deploy", "system")
        await asyncio.sleep(speed)
        yield _sse("lambda", "Packaging search-api-auth function...")
        await asyncio.sleep(speed * 2)
        yield _sse("lambda", "Creating deployment package: search-api-auth.zip (4.2MB)")
        await asyncio.sleep(speed * 2)
        yield _sse("lambda", "upload: s3://eg-lambda-deployments/search-api-auth-v47.zip")
        await asyncio.sleep(speed * 3)
        yield _sse("lambda", "Updating function code...")
        await asyncio.sleep(speed * 2)
        yield _sse("lambda", "Function updated: search-api-auth")
        await asyncio.sleep(speed)
        yield _sse("lambda", "Publishing version v47...")
        await asyncio.sleep(speed)
        yield _sse("lambda", "Done: search-api-auth v47 deployed successfully in 2.1s")
        await asyncio.sleep(speed)
        yield _sse("done", "Lambda deploy complete", "system")

    return StreamingResponse(stream(), media_type="text/event-stream")


# ── Scenario: Lambda Deploy Failure ────────────────────────────────────
@router.post("/lambda/deploy-failure")
async def sim_lambda_failure(speed: float = Query(0.1)):
    """Simulate a failed Lambda deployment."""

    async def stream():
        yield _sse("lambda", "Starting: Lambda Deploy", "system")
        await asyncio.sleep(speed)
        yield _sse("lambda", "Packaging search-api-auth function...")
        await asyncio.sleep(speed * 2)
        yield _sse("lambda", "Creating deployment package: search-api-auth.zip (4.2MB)")
        await asyncio.sleep(speed * 2)
        yield _sse("lambda", "error: ResourceConflictException — function update already in progress", "stderr")
        await asyncio.sleep(speed)
        yield _sse("lambda", "FAILED with exit code 1", "system")

    return StreamingResponse(stream(), media_type="text/event-stream")


# ── Mock Status with configurable data ─────────────────────────────────
@router.get("/status/pending")
async def sim_status_pending(
    count: int = Query(6),
    product_changes: bool = Query(False),
    lambda_changes: bool = Query(True),
):
    """Return a mock status with pending files."""
    files = []
    templates = [
        ("src/pages/api/search.ts", "api"),
        ("src/pages/auth/callback.ts", "auth"),
        ("src/pages/login/index.astro", "auth"),
        ("src/pages/logout.ts", "auth"),
        ("src/features/auth/server/cognito.ts", "auth"),
        ("src/features/search/index.ts", "search"),
        ("src/content/reviews/razer-viper-v3-pro/index.mdx", "review"),
        ("src/content/data-products/mice/razer/razer-viper-v3-pro.json", "product"),
        ("src/shared/ui/Button.tsx", "shared"),
        ("src/content/guides/best-gaming-mice/index.mdx", "guide"),
        ("src/content/news/new-releases-march/index.mdx", "news"),
        ("src/data/tooltips/mouse.ts", "data"),
        ("public/images/mice/razer-viper-v3-pro/top.webp", "image"),
    ]
    for i in range(min(count, len(templates))):
        path, cat = templates[i]
        files.append({
            "path": path,
            "file_type": "MODIFIED",
            "category": cat,
            "mtime": _now_iso(),
        })

    has_product = product_changes or any(f["category"] == "product" for f in files)
    has_lambda = lambda_changes or any(f["category"] in ("api", "auth", "search") for f in files)

    return {
        "pending": len(files) > 0,
        "count": len(files),
        "lastSyncAt": _now_iso(),
        "buildPending": any(file["category"] != "image" for file in files),
        "buildCount": len([file for file in files if file["category"] != "image"]),
        "buildFiles": [file for file in files if file["category"] != "image"],
        "lastBuildAt": _now_iso(),
        "lastDataSyncAt": _now_iso(),
        "lastImageSyncAt": _now_iso(),
        "hasProductChanges": has_product,
        "hasLambdaChanges": has_lambda,
        "hasPendingUploads": len(files) > 0,
        "pendingUploadCount": len(files),
        "hasPendingDataUploads": any(file["category"] != "image" for file in files),
        "pendingDataUploadCount": len([file for file in files if file["category"] != "image"]),
        "hasPendingImageUploads": any(file["category"] == "image" for file in files),
        "pendingImageUploadCount": len([file for file in files if file["category"] == "image"]),
        "files": files,
        "lambdaFiles": [file for file in files if file["category"] in ("api", "auth", "search")],
    }


# ── Mock Status: Clean (no changes) ───────────────────────────────────
@router.get("/status/clean")
async def sim_status_clean():
    """Return a clean status with no pending files."""
    return {
        "pending": False,
        "count": 0,
        "lastSyncAt": _now_iso(),
        "buildPending": False,
        "buildCount": 0,
        "buildFiles": [],
        "lastBuildAt": _now_iso(),
        "lastDataSyncAt": _now_iso(),
        "lastImageSyncAt": _now_iso(),
        "hasProductChanges": False,
        "hasLambdaChanges": False,
        "hasPendingUploads": False,
        "pendingUploadCount": 0,
        "hasPendingDataUploads": False,
        "pendingDataUploadCount": 0,
        "hasPendingImageUploads": False,
        "pendingImageUploadCount": 0,
        "files": [],
        "lambdaFiles": [],
    }


@router.post("/fake-changes")
async def sim_fake_changes():
    return apply_fake_changes(_get_config())


# ── CDN-only invalidation success mock ─────────────────────────────────
@router.post("/cdn/invalidate-success")
async def sim_cdn_invalidate_success():
    """Mock a successful standalone CDN invalidation."""
    return {
        "success": True,
        "distribution_id": "E1ITXKZVMDZMZ5",
        "paths": ["/*"],
        "output": "InvalidationId: I3MOCK12345\nStatus: InProgress",
    }


# ── CDN-only invalidation failure mock ─────────────────────────────────
@router.post("/cdn/invalidate-failure")
async def sim_cdn_invalidate_failure():
    """Mock a failed standalone CDN invalidation."""
    from fastapi import HTTPException
    raise HTTPException(status_code=500, detail="TooManyInvalidationsInProgress")


# ── Cache purge mock ───────────────────────────────────────────────────
@router.post("/cache/purge-success")
async def sim_cache_purge_success():
    return {
        "success": True,
        "cleared": [".astro", "node_modules/.vite"],
        "resetMarkers": [
            ".last_sync_success",
            ".last_astro_build_success",
            ".last_data_publish_success",
            ".last_image_publish_success",
        ],
        "message": "Local cache state reset",
    }


@router.post("/cache/purge-clean")
async def sim_cache_purge_clean():
    return {"success": True, "cleared": [], "resetMarkers": [], "message": "Cache already clean"}
