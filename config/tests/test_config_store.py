"""Tests for lib/config_store.py — reactive data layer."""

import json
import sys
import tempfile
import shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.config_store import ConfigStore


def _make_test_root(tmp: Path) -> Path:
    """Create a minimal test directory with config/data/ and sample JSON."""
    data_dir = tmp / "config" / "data"
    data_dir.mkdir(parents=True)

    categories = {
        "siteColors": {"primary": "#a6e3a1", "secondary": "#21c55e"},
        "categories": [
            {
                "id": "mouse",
                "label": "Mouse",
                "plural": "Mice",
                "color": "#00aeff",
                "product": {"production": True, "vite": True},
                "content": {"production": True, "vite": True},
                "collections": {"dataProducts": True, "reviews": True,
                                "guides": True, "news": True},
            },
            {
                "id": "keyboard",
                "label": "Keyboard",
                "plural": "Keyboards",
                "color": "#EE8B22",
                "product": {"production": True, "vite": True},
                "content": {"production": True, "vite": True},
                "collections": {"dataProducts": True, "reviews": True,
                                "guides": True, "news": True},
            },
        ],
    }
    (data_dir / "categories.json").write_text(
        json.dumps(categories, indent=2), encoding="utf-8")

    content = {"slots": {}, "pinned": [], "badges": {}, "excluded": []}
    (data_dir / "content.json").write_text(
        json.dumps(content, indent=2), encoding="utf-8")

    # Create remaining empty config files
    for name in ["slideshow.json", "hub-tools.json",
                 "navbar-guide-sections.json", "image-defaults.json",
                 "ads-registry.json", "inline-ads-config.json",
                 "cache-cdn.json",
                 "direct-sponsors.json"]:
        (data_dir / name).write_text("{}", encoding="utf-8")

    return tmp


class TestConfigStoreLoad:
    def setup_method(self):
        self._tmp = Path(tempfile.mkdtemp())
        self._root = _make_test_root(self._tmp)
        self.store = ConfigStore(self._root)

    def teardown_method(self):
        shutil.rmtree(self._tmp, ignore_errors=True)

    def test_loads_categories(self):
        data = self.store.get(ConfigStore.CATEGORIES)
        assert "categories" in data
        assert len(data["categories"]) == 2

    def test_site_colors(self):
        assert self.store.site_colors["primary"] == "#a6e3a1"
        assert self.store.site_colors["secondary"] == "#21c55e"

    def test_site_accent(self):
        assert self.store.site_accent == "#a6e3a1"

    def test_cat_colors(self):
        assert self.store.cat_colors["mouse"] == "#00aeff"
        assert self.store.cat_colors["keyboard"] == "#EE8B22"

    def test_cat_labels(self):
        assert self.store.cat_labels["mouse"] == "Mouse"
        assert self.store.cat_labels["keyboard"] == "Keyboard"

    def test_cat_ids(self):
        assert self.store.cat_ids == ["mouse", "keyboard"]

    def test_active_product_cats(self):
        assert "mouse" in self.store.active_product_cats
        assert "keyboard" in self.store.active_product_cats

    def test_active_content_cats(self):
        assert "mouse" in self.store.active_content_cats
        assert "keyboard" in self.store.active_content_cats

    def test_loads_all_configs(self):
        for key in [ConfigStore.CATEGORIES, ConfigStore.CONTENT,
                    ConfigStore.SLIDESHOW, ConfigStore.HUB_TOOLS,
                    ConfigStore.NAV_SECTIONS, ConfigStore.IMAGE_DEFAULTS,
                    ConfigStore.ADS_REGISTRY, ConfigStore.INLINE_ADS,
                    ConfigStore.SPONSORS, ConfigStore.CACHE_CDN]:
            data = self.store.get(key)
            assert isinstance(data, dict), f"{key} did not load as dict"

    def test_loads_content_json(self):
        data = self.store.get(ConfigStore.CONTENT)
        assert "slots" in data


class TestConfigStoreDerived:
    def setup_method(self):
        self._tmp = Path(tempfile.mkdtemp())
        self._root = _make_test_root(self._tmp)
        self.store = ConfigStore(self._root)

    def teardown_method(self):
        shutil.rmtree(self._tmp, ignore_errors=True)

    def test_changing_categories_rebuilds_accent(self):
        new_data = self.store.get(ConfigStore.CATEGORIES).copy()
        new_data["siteColors"] = {"primary": "#ff0000", "secondary": "#00ff00"}
        self.store.save(ConfigStore.CATEGORIES, new_data)
        assert self.store.site_accent == "#ff0000"

    def test_changing_categories_rebuilds_cat_colors(self):
        new_data = self.store.get(ConfigStore.CATEGORIES).copy()
        new_data["categories"][0]["color"] = "#abcdef"
        self.store.save(ConfigStore.CATEGORIES, new_data)
        assert self.store.cat_colors["mouse"] == "#abcdef"

    def test_changing_categories_rebuilds_active_cats(self):
        new_data = self.store.get(ConfigStore.CATEGORIES).copy()
        new_data["categories"][0]["product"] = {"production": False, "vite": False}
        self.store.save(ConfigStore.CATEGORIES, new_data)
        assert "mouse" not in self.store.active_product_cats
        assert "keyboard" in self.store.active_product_cats


class TestConfigStoreSubscribe:
    def setup_method(self):
        self._tmp = Path(tempfile.mkdtemp())
        self._root = _make_test_root(self._tmp)
        self.store = ConfigStore(self._root)

    def teardown_method(self):
        shutil.rmtree(self._tmp, ignore_errors=True)

    def test_subscribe_and_notify(self):
        called = []
        self.store.subscribe(ConfigStore.CATEGORIES, lambda: called.append(1))
        self.store.notify(ConfigStore.CATEGORIES)
        assert len(called) == 1

    def test_multiple_subscribers(self):
        calls_a, calls_b = [], []
        self.store.subscribe(ConfigStore.CATEGORIES, lambda: calls_a.append(1))
        self.store.subscribe(ConfigStore.CATEGORIES, lambda: calls_b.append(1))
        self.store.notify(ConfigStore.CATEGORIES)
        assert len(calls_a) == 1
        assert len(calls_b) == 1

    def test_unsubscribe(self):
        called = []
        cb = lambda: called.append(1)
        self.store.subscribe(ConfigStore.CATEGORIES, cb)
        self.store.unsubscribe(ConfigStore.CATEGORIES, cb)
        self.store.notify(ConfigStore.CATEGORIES)
        assert len(called) == 0

    def test_save_fires_notify(self):
        called = []
        self.store.subscribe(ConfigStore.CONTENT, lambda: called.append(1))
        new_data = {"slots": {}, "pinned": ["test"], "badges": {}, "excluded": []}
        self.store.save(ConfigStore.CONTENT, new_data)
        assert len(called) == 1

    def test_different_key_does_not_fire(self):
        called = []
        self.store.subscribe(ConfigStore.CONTENT, lambda: called.append(1))
        self.store.notify(ConfigStore.CATEGORIES)
        assert len(called) == 0


class TestConfigStoreSave:
    def setup_method(self):
        self._tmp = Path(tempfile.mkdtemp())
        self._root = _make_test_root(self._tmp)
        self.store = ConfigStore(self._root)

    def teardown_method(self):
        shutil.rmtree(self._tmp, ignore_errors=True)

    def test_save_writes_to_disk(self):
        new_data = {"test": "value"}
        self.store.save(ConfigStore.CONTENT, new_data)
        path = self.store.path_for(ConfigStore.CONTENT)
        on_disk = json.loads(path.read_text(encoding="utf-8"))
        assert on_disk == new_data

    def test_save_updates_internal_data(self):
        new_data = {"test": "value"}
        self.store.save(ConfigStore.CONTENT, new_data)
        assert self.store.get(ConfigStore.CONTENT) == new_data

    def test_save_invalid_key_raises(self):
        try:
            self.store.save("nonexistent", {})
            assert False, "Should have raised ValueError"
        except ValueError:
            pass


class TestConfigStoreReload:
    def setup_method(self):
        self._tmp = Path(tempfile.mkdtemp())
        self._root = _make_test_root(self._tmp)
        self.store = ConfigStore(self._root)

    def teardown_method(self):
        shutil.rmtree(self._tmp, ignore_errors=True)

    def test_reload_reads_fresh_data(self):
        path = self.store.path_for(ConfigStore.CONTENT)
        new_data = {"slots": {}, "pinned": ["fresh"], "badges": {}, "excluded": []}
        path.write_text(json.dumps(new_data), encoding="utf-8")
        changed = self.store.reload(ConfigStore.CONTENT)
        assert changed is True
        assert self.store.get(ConfigStore.CONTENT)["pinned"] == ["fresh"]

    def test_reload_fires_notify(self):
        called = []
        self.store.subscribe(ConfigStore.CONTENT, lambda: called.append(1))
        path = self.store.path_for(ConfigStore.CONTENT)
        new_data = {"slots": {}, "pinned": ["x"], "badges": {}, "excluded": []}
        path.write_text(json.dumps(new_data), encoding="utf-8")
        self.store.reload(ConfigStore.CONTENT)
        assert len(called) == 1

    def test_reload_noop_if_unchanged(self):
        called = []
        self.store.subscribe(ConfigStore.CONTENT, lambda: called.append(1))
        changed = self.store.reload(ConfigStore.CONTENT)
        assert changed is False
        assert len(called) == 0

    def test_reload_nonexistent_key(self):
        changed = self.store.reload("nonexistent")
        assert changed is False
