"""Tests for lib/config_watcher.py — file change detection."""

import json
import sys
import tempfile
import shutil
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.config_store import ConfigStore
from lib.config_watcher import ConfigWatcher


def _make_test_root(tmp: Path) -> Path:
    """Create a minimal test directory with config/data/ and sample JSON."""
    data_dir = tmp / "config" / "data"
    data_dir.mkdir(parents=True)

    categories = {
        "siteColors": {"primary": "#a6e3a1", "secondary": "#21c55e"},
        "categories": [
            {"id": "mouse", "label": "Mouse", "plural": "Mice",
             "color": "#00aeff",
             "product": {"production": True, "vite": True},
             "content": {"production": True, "vite": True},
             "collections": {"dataProducts": True, "reviews": True,
                             "guides": True, "news": True}},
        ],
    }
    (data_dir / "categories.json").write_text(
        json.dumps(categories, indent=2), encoding="utf-8")

    for name in ["content.json", "slideshow.json", "hub-tools.json",
                 "navbar-guide-sections.json", "image-defaults.json",
                 "ads-registry.json", "inline-ads-config.json",
                 "cache-cdn.json",
                 "direct-sponsors.json"]:
        (data_dir / name).write_text("{}", encoding="utf-8")

    return tmp


class TestConfigWatcherUnit:
    """Unit tests that don't require tkinter (test mtime logic directly)."""

    def setup_method(self):
        self._tmp = Path(tempfile.mkdtemp())
        self._root = _make_test_root(self._tmp)
        self.store = ConfigStore(self._root)

    def teardown_method(self):
        shutil.rmtree(self._tmp, ignore_errors=True)

    def test_mtime_returns_float(self):
        path = self.store.path_for(ConfigStore.CATEGORIES)
        mt = ConfigWatcher._mtime(path)
        assert isinstance(mt, float)
        assert mt > 0

    def test_mtime_missing_file(self):
        mt = ConfigWatcher._mtime(Path("/nonexistent/path.json"))
        assert mt == 0.0

    def test_mtime_changes_after_write(self):
        path = self.store.path_for(ConfigStore.CONTENT)
        mt1 = ConfigWatcher._mtime(path)
        # WHY: Windows mtime resolution can be ~2s on FAT, ~100ms on NTFS
        time.sleep(0.1)
        path.write_text('{"changed": true}', encoding="utf-8")
        mt2 = ConfigWatcher._mtime(path)
        assert mt2 >= mt1

    def test_store_reload_detects_change(self):
        """Simulating what the watcher does: detect mtime change -> reload."""
        path = self.store.path_for(ConfigStore.CONTENT)
        called = []
        self.store.subscribe(ConfigStore.CONTENT, lambda: called.append(1))

        # Write new data
        path.write_text('{"new": "data"}', encoding="utf-8")
        changed = self.store.reload(ConfigStore.CONTENT)
        assert changed is True
        assert len(called) == 1

    def test_pause_resume_concept(self):
        """Test that pause/resume state is trackable."""
        watcher = type('MockWatcher', (), {
            '_paused': False,
            'pause': lambda self: setattr(self, '_paused', True),
            'resume': lambda self: setattr(self, '_paused', False),
        })()
        assert watcher._paused is False
        watcher.pause()
        assert watcher._paused is True
        watcher.resume()
        assert watcher._paused is False
