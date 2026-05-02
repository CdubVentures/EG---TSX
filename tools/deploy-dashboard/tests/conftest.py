import sys

import pytest

from tests.paths import APP_DIR


app_path = str(APP_DIR)
if app_path not in sys.path:
    sys.path.insert(0, app_path)


@pytest.fixture(autouse=True)
def _clear_ttl_caches():
    """Invalidate all TTL caches before each test so cached results don't leak."""
    import services.watcher as watcher_mod

    watcher_mod._watcher_cache.invalidate()
    watcher_mod._source_cache.invalidate()
    watcher_mod._image_cache.invalidate()

    # Reset deferred invalidation state
    with watcher_mod._defer_lock:
        watcher_mod._defer_depth = 0
        watcher_mod._defer_pending = False
        watcher_mod._defer_pending_image = False

    try:
        from routers.lambda_catalog import _lambda_cache
        _lambda_cache.invalidate()
    except ImportError:
        pass

    try:
        from routers.infra_status import _infra_cache, _stack_cache
        _infra_cache.invalidate()
        _stack_cache.invalidate()
    except ImportError:
        pass
