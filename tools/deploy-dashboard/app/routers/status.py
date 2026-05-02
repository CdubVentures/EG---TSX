"""
Status endpoint.

GET /api/status -- returns pending file changes since last deploy.

Supports ?summary=true (default) to truncate file lists for polling,
and ?summary=false to return the full file list (for the Changed Files tab).
"""

from __future__ import annotations

import logging
from dataclasses import asdict

from fastapi import APIRouter, Query

from services.watcher import get_pending_changes

logger = logging.getLogger("deploy-dashboard.status")

router = APIRouter()

_SUMMARY_FILE_LIMIT = 50


def _truncate_file_list(
    files: list[dict],
    limit: int = _SUMMARY_FILE_LIMIT,
) -> tuple[list[dict], bool]:
    """Return (truncated_list, was_truncated)."""
    if len(files) <= limit:
        return files, False
    return files[:limit], True


@router.get("/status")
async def status(summary: bool = Query(True)):
    from main import config

    result = get_pending_changes(config)
    logger.debug("Status check: %d pending files", result.count)

    all_files = [asdict(f) for f in result.files]
    build_files = [asdict(f) for f in (result.build_files or [])]
    lambda_files = [asdict(f) for f in result.lambda_files]
    db_sync_files = [asdict(f) for f in (result.db_sync_files or [])]

    if summary:
        all_files, files_truncated = _truncate_file_list(all_files)
        build_files, build_truncated = _truncate_file_list(build_files)
        lambda_files, lambda_truncated = _truncate_file_list(lambda_files)
        db_sync_files, db_truncated = _truncate_file_list(db_sync_files)

    response = {
        "pending": result.pending,
        "count": result.count,
        "lastSyncAt": result.last_sync_at,
        "buildPending": result.build_pending,
        "buildCount": result.build_count,
        "buildFiles": build_files,
        "lastBuildAt": result.last_build_at,
        "lastDataSyncAt": result.last_data_sync_at,
        "lastImageSyncAt": result.last_image_sync_at,
        "hasProductChanges": result.has_product_changes,
        "hasLambdaChanges": result.has_lambda_changes,
        "lambdaBuildRequired": result.lambda_build_required,
        "hasPendingUploads": result.has_pending_uploads,
        "pendingUploadCount": result.pending_upload_count,
        "hasPendingDataUploads": result.has_pending_data_uploads,
        "pendingDataUploadCount": result.pending_data_upload_count,
        "hasPendingImageUploads": result.has_pending_image_uploads,
        "pendingImageUploadCount": result.pending_image_upload_count,
        "files": all_files,
        "lambdaFiles": lambda_files,
        "hasDbSyncChanges": result.has_db_sync_changes,
        "dbSyncCount": result.db_sync_count,
        "dbSyncFiles": db_sync_files,
        "lastDbSyncAt": result.last_db_sync_at,
    }

    if summary:
        response["truncated"] = (
            files_truncated or build_truncated or lambda_truncated or db_truncated
        )

    return response
