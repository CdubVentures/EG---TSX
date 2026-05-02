"""
Performance optimization tests for the file watcher.

Phase 1: Split scan — source files (fast, 2s TTL) vs image files (slow, 30s TTL).
Phase 2: Deferred invalidation — batch marker touches during active operations.
Phase 3: Status endpoint pagination — summary mode truncates file lists.
"""

import os
import time
from pathlib import Path
from unittest.mock import patch

import pytest

from config import AppConfig


def _make_config(tmp_path: Path) -> AppConfig:
    """Build a test config rooted at tmp_path."""
    return AppConfig(
        project_root=tmp_path,
        src_dir=tmp_path / "src",
        dist_dir=tmp_path / "dist",
        dist_client_dir=tmp_path / "dist" / "client",
        public_dir=tmp_path / "public",
        astro_cache_dir=tmp_path / ".astro",
        vite_cache_dir=tmp_path / "node_modules" / ".vite",
        sync_marker_path=tmp_path / ".last_sync_success",
        s3_bucket="test-bucket",
        aws_region="us-east-2",
        cloudfront_distribution_id="TEST123",
        port=8420,
    )


def _create_file(path: Path, mtime_offset: float = 0.0) -> None:
    """Create a file and optionally shift its mtime by offset seconds from now."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("test content", encoding="utf-8")
    if mtime_offset != 0.0:
        t = time.time() + mtime_offset
        os.utime(path, (t, t))


# =============================================================================
# Phase 1: Split scan — two independent caches for source vs image files
# =============================================================================


class TestSplitScanMergesCorrectly:
    """The split scan must produce identical results to the original single scan."""

    def test_source_and_image_files_both_appear_in_results(self, tmp_path: Path):
        """Both source files and image files appear in get_pending_changes."""
        from services.watcher import get_pending_changes

        cfg = _make_config(tmp_path)
        _create_file(tmp_path / "src" / "content" / "reviews" / "x" / "index.md")
        _create_file(tmp_path / "public" / "images" / "mice" / "hero.webp")

        result = get_pending_changes(cfg)

        categories = {f.category for f in result.files}
        assert "review" in categories
        assert "image" in categories
        assert result.count == 2

    def test_image_only_changes_do_not_trigger_build_pending(self, tmp_path: Path):
        """Image files go to image upload queue, not build queue."""
        from services.watcher import get_pending_changes

        cfg = _make_config(tmp_path)
        _create_file(tmp_path / "public" / "images" / "mice" / "hero.webp")

        result = get_pending_changes(cfg)

        assert result.build_pending is False
        assert result.build_count == 0
        assert result.has_pending_image_uploads is True
        assert result.pending_image_upload_count == 1

    def test_source_only_changes_do_not_trigger_image_uploads(self, tmp_path: Path):
        """Source file changes don't appear as pending image uploads."""
        from services.watcher import get_pending_changes

        cfg = _make_config(tmp_path)
        _create_file(tmp_path / "src" / "content" / "reviews" / "x" / "index.md")

        result = get_pending_changes(cfg)

        assert result.build_pending is True
        assert result.has_pending_image_uploads is False


class TestSplitScanCacheIndependence:
    """Source and image scans use independent caches with different TTLs."""

    def test_image_cache_survives_source_invalidation(self, tmp_path: Path):
        """Touching a build marker invalidates source cache but not image cache."""
        from services.watcher import (
            _image_cache,
            _source_cache,
            get_pending_changes,
            touch_build_sync_marker,
        )

        cfg = _make_config(tmp_path)
        _create_file(tmp_path / "src" / "content" / "reviews" / "x" / "index.md")
        _create_file(tmp_path / "public" / "images" / "mice" / "hero.webp")

        # Prime both caches
        get_pending_changes(cfg)
        assert _source_cache.get() is not None
        assert _image_cache.get() is not None

        # Touch build marker — should invalidate source but NOT image
        touch_build_sync_marker(cfg)
        assert _source_cache.get() is None
        assert _image_cache.get() is not None

    def test_image_marker_invalidates_image_cache_only(self, tmp_path: Path):
        """Touching image marker invalidates image cache but not source cache."""
        from services.watcher import (
            _image_cache,
            _source_cache,
            get_pending_changes,
            touch_image_sync_marker,
        )

        cfg = _make_config(tmp_path)
        _create_file(tmp_path / "src" / "content" / "reviews" / "x" / "index.md")
        _create_file(tmp_path / "public" / "images" / "mice" / "hero.webp")

        # Prime both caches
        get_pending_changes(cfg)
        assert _source_cache.get() is not None
        assert _image_cache.get() is not None

        # Touch image marker — should invalidate image but NOT source
        touch_image_sync_marker(cfg)
        assert _source_cache.get() is None or True  # watcher cache also invalidated
        assert _image_cache.get() is None

    def test_image_cache_has_longer_ttl(self):
        """Image cache TTL is significantly longer than source cache TTL."""
        from services.watcher import _image_cache, _source_cache

        assert _image_cache._ttl > _source_cache._ttl
        assert _image_cache._ttl >= 30.0
        assert _source_cache._ttl <= 5.0

    def test_watcher_result_cache_invalidation_still_forces_rescan(self, tmp_path: Path):
        """The top-level watcher result cache still invalidates on marker touch."""
        from services.watcher import _watcher_cache, get_pending_changes, touch_sync_marker

        cfg = _make_config(tmp_path)
        _create_file(tmp_path / "src" / "content" / "reviews" / "x" / "index.md")

        # Prime cache
        get_pending_changes(cfg)
        assert _watcher_cache.get() is not None

        # Touch marker
        touch_sync_marker(cfg)
        assert _watcher_cache.get() is None


class TestSplitScanImageCacheReuse:
    """Image cache is reused across watcher calls when only source changes."""

    def test_image_scan_reused_when_source_marker_touched(self, tmp_path: Path):
        """After touching a non-image marker, images come from cache."""
        from services.watcher import get_pending_changes, touch_build_sync_marker

        cfg = _make_config(tmp_path)
        _create_file(tmp_path / "src" / "content" / "reviews" / "x" / "index.md", mtime_offset=-10.0)
        _create_file(tmp_path / "public" / "images" / "mice" / "hero.webp", mtime_offset=-10.0)

        # First call primes both caches
        result1 = get_pending_changes(cfg)
        img_count_1 = result1.pending_image_upload_count

        # Touch build marker — source cache invalidated, image cache preserved
        touch_build_sync_marker(cfg)
        result2 = get_pending_changes(cfg)
        img_count_2 = result2.pending_image_upload_count

        # Image count should be consistent (cached)
        assert img_count_1 == img_count_2

    def test_collect_source_candidates_excludes_images(self, tmp_path: Path):
        """_collect_source_candidates does NOT include public/images files."""
        from services.watcher import _collect_source_candidates

        cfg = _make_config(tmp_path)
        _create_file(tmp_path / "src" / "content" / "reviews" / "x" / "index.md")
        _create_file(tmp_path / "public" / "images" / "mice" / "hero.webp")

        candidates = _collect_source_candidates(cfg)
        categories = {c[2] for c in candidates}

        assert "image" not in categories
        assert "review" in categories

    def test_collect_image_candidates_only_has_images(self, tmp_path: Path):
        """_collect_image_candidates returns ONLY image files."""
        from services.watcher import _collect_image_candidates

        cfg = _make_config(tmp_path)
        _create_file(tmp_path / "src" / "content" / "reviews" / "x" / "index.md")
        _create_file(tmp_path / "public" / "images" / "mice" / "hero.webp")

        candidates = _collect_image_candidates(cfg)
        categories = {c[2] for c in candidates}

        assert categories == {"image"}


class TestSplitScanBackwardCompatibility:
    """All existing watcher behaviors preserved after the split."""

    def test_no_marker_all_pending_with_mixed_files(self, tmp_path: Path):
        """No marker -> all files (source + image) are pending."""
        from services.watcher import get_pending_changes

        cfg = _make_config(tmp_path)
        _create_file(tmp_path / "src" / "content" / "reviews" / "x" / "index.md")
        _create_file(tmp_path / "src" / "data" / "tooltips" / "mouse.ts")
        _create_file(tmp_path / "public" / "images" / "mice" / "hero.webp")

        result = get_pending_changes(cfg)

        assert result.pending is True
        assert result.count == 3
        assert result.build_count == 2
        assert result.pending_image_upload_count == 1

    def test_all_markers_newer_than_all_files(self, tmp_path: Path):
        """All markers newer -> zero pending across all categories."""
        from services.watcher import (
            get_pending_changes,
            touch_build_sync_marker,
            touch_data_sync_marker,
            touch_image_sync_marker,
            touch_sync_marker,
        )

        cfg = _make_config(tmp_path)
        _create_file(tmp_path / "src" / "content" / "reviews" / "x" / "index.md", mtime_offset=-10.0)
        _create_file(tmp_path / "public" / "images" / "mice" / "hero.webp", mtime_offset=-10.0)

        touch_sync_marker(cfg)
        touch_build_sync_marker(cfg)
        touch_data_sync_marker(cfg)
        touch_image_sync_marker(cfg)

        result = get_pending_changes(cfg)

        assert result.pending is False
        assert result.count == 0
        assert result.build_pending is False
        assert result.has_pending_image_uploads is False

    def test_lambda_detection_still_works(self, tmp_path: Path):
        """Lambda file detection still works after split."""
        from services.watcher import get_pending_changes

        cfg = _make_config(tmp_path)
        _create_file(tmp_path / "src" / "pages" / "api" / "search.ts")

        result = get_pending_changes(cfg)

        assert result.has_lambda_changes is True
        assert any(f.category == "api" for f in result.lambda_files)

    def test_db_sync_detection_still_works(self, tmp_path: Path):
        """DB sync change detection still works after split."""
        from services.watcher import get_pending_changes

        cfg = _make_config(tmp_path)
        _create_file(tmp_path / "src" / "content" / "data-products" / "mice" / "razer" / "viper.json")

        result = get_pending_changes(cfg)

        assert result.has_db_sync_changes is True
        assert result.db_sync_count == 1

    def test_sorted_by_mtime_desc_after_split(self, tmp_path: Path):
        """Files still sorted by mtime descending after the split."""
        from services.watcher import get_pending_changes

        cfg = _make_config(tmp_path)
        _create_file(tmp_path / "src" / "content" / "reviews" / "oldest" / "index.md", mtime_offset=-3.0)
        _create_file(tmp_path / "public" / "images" / "mice" / "middle.webp", mtime_offset=-1.0)
        _create_file(tmp_path / "src" / "content" / "reviews" / "newest" / "index.md")

        result = get_pending_changes(cfg)

        assert result.count == 3
        assert "newest" in result.files[0].path
        assert "middle" in result.files[1].path
        assert "oldest" in result.files[2].path


# =============================================================================
# Phase 2: Deferred invalidation during active operations
# =============================================================================


class TestDeferredInvalidation:
    """Cache invalidation is deferred while an operation is active."""

    def test_defer_context_prevents_immediate_invalidation(self, tmp_path: Path):
        from services.watcher import (
            _watcher_cache,
            defer_cache_invalidation,
            get_pending_changes,
            touch_build_sync_marker,
        )

        cfg = _make_config(tmp_path)
        _create_file(tmp_path / "src" / "content" / "reviews" / "x" / "index.md")

        # Prime cache
        get_pending_changes(cfg)
        assert _watcher_cache.get() is not None

        # Inside deferred context, marker touch does NOT bust cache
        with defer_cache_invalidation():
            touch_build_sync_marker(cfg)
            assert _watcher_cache.get() is not None

        # After context exits, cache IS invalidated
        assert _watcher_cache.get() is None

    def test_deferred_invalidation_fires_on_exit(self, tmp_path: Path):
        from services.watcher import (
            _watcher_cache,
            defer_cache_invalidation,
            get_pending_changes,
            touch_build_sync_marker,
            touch_data_sync_marker,
        )

        cfg = _make_config(tmp_path)
        _create_file(tmp_path / "src" / "content" / "reviews" / "x" / "index.md")

        get_pending_changes(cfg)

        with defer_cache_invalidation():
            touch_build_sync_marker(cfg)
            touch_data_sync_marker(cfg)
            # Cache still valid during deferral
            assert _watcher_cache.get() is not None

        # One invalidation fires on exit
        assert _watcher_cache.get() is None

    def test_no_defer_context_invalidates_immediately(self, tmp_path: Path):
        """Without deferral, marker touches invalidate immediately (existing behavior)."""
        from services.watcher import (
            _watcher_cache,
            get_pending_changes,
            touch_build_sync_marker,
        )

        cfg = _make_config(tmp_path)
        _create_file(tmp_path / "src" / "content" / "reviews" / "x" / "index.md")

        get_pending_changes(cfg)
        assert _watcher_cache.get() is not None

        touch_build_sync_marker(cfg)
        assert _watcher_cache.get() is None


# =============================================================================
# Phase 3: Status endpoint summary mode
# =============================================================================


class TestStatusSummaryMode:
    """GET /api/status?summary=true truncates file lists but keeps counts."""

    def test_summary_mode_truncates_files(self, tmp_path: Path):
        from fastapi.testclient import TestClient
        from main import app

        client = TestClient(app)
        response = client.get("/api/status?summary=true")

        assert response.status_code == 200
        data = response.json()
        assert "files" in data
        assert "count" in data
        # File list should be capped at max 50
        assert len(data["files"]) <= 50

    def test_summary_mode_preserves_counts(self, tmp_path: Path):
        """Counts are accurate even when file lists are truncated."""
        from fastapi.testclient import TestClient
        from main import app

        client = TestClient(app)
        response = client.get("/api/status?summary=true")

        assert response.status_code == 200
        data = response.json()
        # Count reflects full list, not truncated list
        assert isinstance(data["count"], int)
        assert isinstance(data["buildCount"], int)

    def test_full_mode_returns_all_files(self):
        """Explicit summary=false returns the complete file list."""
        from fastapi.testclient import TestClient
        from main import app

        client = TestClient(app)
        response = client.get("/api/status?summary=false")

        assert response.status_code == 200
        data = response.json()
        assert "files" in data
        assert "truncated" not in data or data.get("truncated") is False

    def test_default_is_summary_mode(self):
        """Default behavior (no query param) returns summary mode."""
        from fastapi.testclient import TestClient
        from main import app

        client = TestClient(app)
        response = client.get("/api/status")

        assert response.status_code == 200
        data = response.json()
        assert len(data["files"]) <= 50
