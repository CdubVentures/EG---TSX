"""
Phase 3 tests -- file watcher logic and status endpoint.
"""

import os
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

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


# -- get_pending_changes tests ------------------------------------------------


def test_no_marker_all_pending(tmp_path: Path):
    from services.watcher import get_pending_changes

    cfg = _make_config(tmp_path)
    _create_file(tmp_path / "src" / "content" / "reviews" / "mouse" / "test" / "index.md")
    _create_file(tmp_path / "src" / "content" / "news" / "post" / "index.md")
    _create_file(tmp_path / "src" / "data" / "tooltips" / "mouse.ts")

    result = get_pending_changes(cfg)

    assert result.pending is True
    assert result.count == 3
    assert result.last_sync_at is None


def test_marker_older_than_files(tmp_path: Path):
    from services.watcher import get_pending_changes

    cfg = _make_config(tmp_path)
    # Marker is old
    _create_file(cfg.sync_marker_path, mtime_offset=-10.0)
    # Files are recent
    _create_file(tmp_path / "src" / "content" / "reviews" / "x" / "index.md")
    _create_file(tmp_path / "src" / "data" / "metrics" / "mouse.ts")

    result = get_pending_changes(cfg)

    assert result.pending is True
    assert result.count == 2


def test_marker_newer_than_files(tmp_path: Path):
    from services.watcher import get_pending_changes

    cfg = _make_config(tmp_path)
    # Files are old
    _create_file(tmp_path / "src" / "content" / "reviews" / "x" / "index.md", mtime_offset=-10.0)
    _create_file(tmp_path / "src" / "data" / "tooltips" / "x.ts", mtime_offset=-10.0)
    # Marker is recent
    _create_file(cfg.sync_marker_path)

    result = get_pending_changes(cfg)

    assert result.pending is False
    assert result.count == 0


def test_build_marker_newer_than_content_files_clears_changed_files_and_sets_pending_data_uploads(tmp_path: Path):
    from services.watcher import (
        get_data_sync_marker_path,
        get_pending_changes,
        touch_build_sync_marker,
    )

    cfg = _make_config(tmp_path)
    _create_file(tmp_path / "src" / "content" / "reviews" / "x" / "index.md", mtime_offset=-10.0)
    _create_file(get_data_sync_marker_path(cfg), mtime_offset=-20.0)

    touch_build_sync_marker(cfg)
    result = get_pending_changes(cfg)

    assert result.pending is True
    assert result.count == 1
    assert result.build_pending is False
    assert result.build_count == 0
    assert result.has_pending_data_uploads is True
    assert result.pending_data_upload_count == 1
    assert result.has_pending_uploads is True
    assert result.pending_upload_count == 1
    assert result.last_build_at is not None


def test_unbuilt_content_changes_do_not_set_pending_data_uploads(tmp_path: Path):
    from services.watcher import get_data_sync_marker_path, get_pending_changes

    cfg = _make_config(tmp_path)
    _create_file(get_data_sync_marker_path(cfg), mtime_offset=-20.0)
    _create_file(tmp_path / "src" / "content" / "reviews" / "x" / "index.md")

    result = get_pending_changes(cfg)

    assert result.pending is True
    assert result.count == 1
    assert result.build_pending is True
    assert result.build_count == 1
    assert result.has_pending_data_uploads is False
    assert result.pending_data_upload_count == 0


def test_image_changes_only_light_pending_image_uploads(tmp_path: Path):
    from services.watcher import get_pending_changes

    cfg = _make_config(tmp_path)
    _create_file(tmp_path / "public" / "images" / "mice" / "hero.webp")

    result = get_pending_changes(cfg)

    assert result.pending is True
    assert result.count == 1
    assert result.build_pending is False
    assert result.build_count == 0
    assert result.has_pending_image_uploads is True
    assert result.pending_image_upload_count == 1
    assert result.has_pending_uploads is True
    assert result.pending_upload_count == 1


def test_mixed_old_and_new(tmp_path: Path):
    from services.watcher import get_pending_changes

    cfg = _make_config(tmp_path)
    # Marker at a known time
    _create_file(cfg.sync_marker_path, mtime_offset=-5.0)
    # 1 old file (before marker)
    _create_file(tmp_path / "src" / "content" / "brands" / "old" / "index.md", mtime_offset=-10.0)
    # 2 new files (after marker)
    _create_file(tmp_path / "src" / "content" / "reviews" / "new1" / "index.md")
    _create_file(tmp_path / "src" / "content" / "news" / "new2" / "index.md")

    result = get_pending_changes(cfg)

    assert result.count == 2


# -- categorize_path tests ----------------------------------------------------


def test_categorize_review():
    from services.watcher import categorize_path

    assert categorize_path("src/content/reviews/mouse/x/index.md") == "review"


def test_categorize_product():
    from services.watcher import categorize_path

    assert categorize_path("src/content/data-products/mouse/razer/viper.json") == "product"


def test_categorize_data():
    from services.watcher import categorize_path

    assert categorize_path("src/data/tooltips/mouse.ts") == "data"


def test_categorize_other():
    from services.watcher import categorize_path

    assert categorize_path("src/something/foo.ts") == "other"


def test_categorize_feature():
    from services.watcher import categorize_path

    assert categorize_path("src/features/pc-builder/store.ts") == "feature"


def test_categorize_shared():
    from services.watcher import categorize_path

    assert categorize_path("src/shared/ui/Button.tsx") == "shared"


def test_categorize_api():
    from services.watcher import categorize_path

    assert categorize_path("src/pages/api/search.ts") == "api"


def test_categorize_auth_page():
    from services.watcher import categorize_path

    assert categorize_path("src/pages/auth/callback.ts") == "auth"


def test_categorize_auth_feature():
    from services.watcher import categorize_path

    assert categorize_path("src/features/auth/server/cognito.ts") == "auth"


def test_categorize_auth_client_feature_as_feature():
    from services.watcher import categorize_path

    assert categorize_path("src/features/auth/store.ts") == "feature"


def test_categorize_search_feature():
    from services.watcher import categorize_path

    assert categorize_path("src/features/search/store.ts") == "search"


def test_categorize_logout_route_as_auth():
    from services.watcher import categorize_path

    assert categorize_path("src/pages/logout.ts") == "auth"


def test_categorize_page_template():
    from services.watcher import categorize_path

    assert categorize_path("src/pages/index.astro") == "page-template"


def test_categorize_image():
    from services.watcher import categorize_path

    assert categorize_path("public/images/mice/razer-viper/top_l.webp") == "image"


def test_has_product_changes_true(tmp_path: Path):
    from services.watcher import get_pending_changes

    cfg = _make_config(tmp_path)
    _create_file(tmp_path / "src" / "content" / "data-products" / "mice" / "razer" / "viper.json")

    result = get_pending_changes(cfg)

    assert result.has_product_changes is True


def test_has_product_changes_false(tmp_path: Path):
    from services.watcher import get_pending_changes

    cfg = _make_config(tmp_path)
    _create_file(tmp_path / "src" / "content" / "reviews" / "x" / "index.md")

    result = get_pending_changes(cfg)

    assert result.has_product_changes is False


# -- sorting and cap ----------------------------------------------------------


def test_sorted_by_mtime_desc(tmp_path: Path):
    from services.watcher import get_pending_changes

    cfg = _make_config(tmp_path)
    # Create files with distinct mtimes (no marker -> all pending)
    _create_file(tmp_path / "src" / "content" / "reviews" / "oldest" / "index.md", mtime_offset=-3.0)
    _create_file(tmp_path / "src" / "content" / "reviews" / "middle" / "index.md", mtime_offset=-1.0)
    _create_file(tmp_path / "src" / "content" / "reviews" / "newest" / "index.md")

    result = get_pending_changes(cfg)

    assert result.count == 3
    # Most recent first
    assert "newest" in result.files[0].path
    assert "middle" in result.files[1].path
    assert "oldest" in result.files[2].path


def test_returns_all_pending_files_without_capping(tmp_path: Path):
    from services.watcher import get_pending_changes

    cfg = _make_config(tmp_path)
    for i in range(60):
        _create_file(tmp_path / "src" / "content" / "reviews" / f"file{i}" / "index.md")

    result = get_pending_changes(cfg)

    assert result.count == 60
    assert len(result.files) == 60


def test_returns_all_lambda_files_without_capping(tmp_path: Path):
    from services.watcher import get_pending_changes

    cfg = _make_config(tmp_path)
    for i in range(60):
        _create_file(tmp_path / "src" / "pages" / "api" / f"handler{i}.ts")

    result = get_pending_changes(cfg)

    assert result.has_lambda_changes is True
    assert len(result.lambda_files) == 60


# -- touch_sync_marker ---------------------------------------------------------


def test_touch_sync_marker(tmp_path: Path):
    from services.watcher import touch_sync_marker

    cfg = _make_config(tmp_path)
    assert not cfg.sync_marker_path.exists()

    touch_sync_marker(cfg)

    assert cfg.sync_marker_path.is_file()
    # mtime should be very recent (within 2 seconds)
    mtime = cfg.sync_marker_path.stat().st_mtime
    assert abs(time.time() - mtime) < 2.0


def test_touch_build_data_and_image_markers(tmp_path: Path):
    from services.watcher import (
        get_build_sync_marker_path,
        get_data_sync_marker_path,
        get_image_sync_marker_path,
        touch_build_sync_marker,
        touch_data_sync_marker,
        touch_image_sync_marker,
    )

    cfg = _make_config(tmp_path)

    touch_build_sync_marker(cfg)
    touch_data_sync_marker(cfg)
    touch_image_sync_marker(cfg)

    assert get_build_sync_marker_path(cfg).is_file()
    assert get_data_sync_marker_path(cfg).is_file()
    assert get_image_sync_marker_path(cfg).is_file()


def test_cache_purge_resets_pending_state_to_all_files_and_images(tmp_path: Path):
    from routers.cache import purge_cache
    from services.watcher import (
        get_pending_changes,
        touch_build_sync_marker,
        touch_data_sync_marker,
        touch_image_sync_marker,
        touch_sync_marker,
    )

    cfg = _make_config(tmp_path)
    _create_file(tmp_path / "src" / "content" / "reviews" / "x" / "index.md", mtime_offset=-10.0)
    _create_file(tmp_path / "src" / "data" / "tooltips" / "x.ts", mtime_offset=-10.0)
    _create_file(tmp_path / "public" / "images" / "mice" / "hero.webp", mtime_offset=-10.0)

    touch_sync_marker(cfg)
    touch_build_sync_marker(cfg)
    touch_data_sync_marker(cfg)
    touch_image_sync_marker(cfg)

    before = get_pending_changes(cfg)
    assert before.pending is False
    assert before.build_pending is False
    assert before.has_pending_uploads is False

    purge_cache(cfg)
    after = get_pending_changes(cfg)

    assert after.pending is True
    assert after.count == 3
    assert after.build_pending is True
    assert after.build_count == 2
    assert after.has_pending_data_uploads is False
    assert after.pending_data_upload_count == 0
    assert after.has_pending_image_uploads is True
    assert after.pending_image_upload_count == 1
    assert sorted(changed_file.category for changed_file in after.files) == ["data", "image", "review"]


def test_lambda_marker_newer_than_lambda_files_clears_lambda_watcher(tmp_path: Path):
    from services.watcher import get_pending_changes, touch_lambda_sync_marker

    cfg = _make_config(tmp_path)
    _create_file(tmp_path / "src" / "pages" / "api" / "search.ts", mtime_offset=-10.0)

    touch_lambda_sync_marker(cfg)
    result = get_pending_changes(cfg)

    assert result.has_lambda_changes is False
    assert result.lambda_files == []


# -- endpoint test -------------------------------------------------------------


def test_status_endpoint_returns_200():
    from main import app

    client = TestClient(app)
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert "pending" in data
    assert "count" in data
    assert "files" in data
    assert "lastSyncAt" in data
    assert "buildPending" in data
    assert "buildCount" in data
    assert "buildFiles" in data
    assert "lastBuildAt" in data
    assert "lastDataSyncAt" in data
    assert "lastImageSyncAt" in data
    assert "hasProductChanges" in data
    assert "hasLambdaChanges" in data
    assert "hasPendingUploads" in data
    assert "hasPendingDataUploads" in data
    assert "hasPendingImageUploads" in data
    assert "pendingUploadCount" in data
    assert "pendingDataUploadCount" in data
    assert "pendingImageUploadCount" in data
    assert "lambdaFiles" in data


# -- Lambda change detection ---------------------------------------------------


def test_has_lambda_changes_api(tmp_path: Path):
    from services.watcher import get_pending_changes

    cfg = _make_config(tmp_path)
    _create_file(tmp_path / "src" / "pages" / "api" / "search.ts")

    result = get_pending_changes(cfg)

    assert result.has_lambda_changes is True
    assert any(f.category == "api" for f in result.files)


def test_has_lambda_changes_auth(tmp_path: Path):
    from services.watcher import get_pending_changes

    cfg = _make_config(tmp_path)
    _create_file(tmp_path / "src" / "features" / "auth" / "server" / "cognito.ts")

    result = get_pending_changes(cfg)

    assert result.has_lambda_changes is True
    assert any(f.category == "auth" for f in result.files)


def test_has_lambda_changes_search(tmp_path: Path):
    from services.watcher import get_pending_changes

    cfg = _make_config(tmp_path)
    _create_file(tmp_path / "src" / "features" / "search" / "store.ts")

    result = get_pending_changes(cfg)

    assert result.has_lambda_changes is True
    assert any(f.category == "search" for f in result.files)


def test_has_lambda_changes_logout(tmp_path: Path):
    from services.watcher import get_pending_changes

    cfg = _make_config(tmp_path)
    _create_file(tmp_path / "src" / "pages" / "logout.ts")

    result = get_pending_changes(cfg)

    assert result.has_lambda_changes is True
    assert any(f.category == "auth" for f in result.files)


def test_client_auth_feature_does_not_trigger_lambda(tmp_path: Path):
    from services.watcher import get_pending_changes

    cfg = _make_config(tmp_path)
    _create_file(tmp_path / "src" / "features" / "auth" / "store.ts")

    result = get_pending_changes(cfg)

    assert result.has_lambda_changes is False
    assert any(f.category == "feature" for f in result.files)


def test_has_lambda_changes_false(tmp_path: Path):
    from services.watcher import get_pending_changes

    cfg = _make_config(tmp_path)
    _create_file(tmp_path / "src" / "content" / "reviews" / "x" / "index.md")

    result = get_pending_changes(cfg)

    assert result.has_lambda_changes is False


# -- forward slashes -----------------------------------------------------------


def test_forward_slashes_in_paths(tmp_path: Path):
    from services.watcher import get_pending_changes

    cfg = _make_config(tmp_path)
    _create_file(tmp_path / "src" / "content" / "reviews" / "mouse" / "test" / "index.md")

    result = get_pending_changes(cfg)

    assert result.count >= 1
    for f in result.files:
        assert "\\" not in f.path, f"Backslash found in path: {f.path}"
        assert "/" in f.path
