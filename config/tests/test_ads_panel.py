"""Tests for panels/ads.py — pure functions + panel data contract."""
import json
import tempfile
import unittest
from pathlib import Path


# ── parse_sizes ─────────────────────────────────────────────────────────────

class TestParseSizes(unittest.TestCase):

    def test_single_size(self):
        from panels.ads import parse_sizes
        self.assertEqual(parse_sizes("300x250"), [(300, 250)])

    def test_multiple_sizes(self):
        from panels.ads import parse_sizes
        result = parse_sizes("970x250,728x90,300x250")
        self.assertEqual(result, [(970, 250), (728, 90), (300, 250)])

    def test_with_spaces(self):
        from panels.ads import parse_sizes
        result = parse_sizes("300x250 , 728x90")
        self.assertEqual(result, [(300, 250), (728, 90)])

    def test_empty_string(self):
        from panels.ads import parse_sizes
        self.assertEqual(parse_sizes(""), [])

    def test_invalid_size_skipped(self):
        from panels.ads import parse_sizes
        result = parse_sizes("300x250,invalid,728x90")
        self.assertEqual(result, [(300, 250), (728, 90)])

    def test_no_valid_sizes(self):
        from panels.ads import parse_sizes
        self.assertEqual(parse_sizes("abc,def"), [])

    def test_single_dimension(self):
        from panels.ads import parse_sizes
        self.assertEqual(parse_sizes("300"), [])


# ── filter_positions ───────────────────────────────────────────────────────

class TestFilterPositions(unittest.TestCase):

    NAMES = ["sidebar", "sidebar_sticky", "in_content"]

    def test_empty_query_returns_all(self):
        from panels.ads import filter_positions
        result = filter_positions(self.NAMES, "")
        self.assertEqual(result, self.NAMES)

    def test_filter_by_prefix(self):
        from panels.ads import filter_positions
        result = filter_positions(self.NAMES, "sidebar")
        self.assertEqual(result, ["sidebar", "sidebar_sticky"])

    def test_case_insensitive(self):
        from panels.ads import filter_positions
        result = filter_positions(self.NAMES, "STICKY")
        self.assertEqual(result, ["sidebar_sticky"])

    def test_no_matches(self):
        from panels.ads import filter_positions
        result = filter_positions(self.NAMES, "zzz")
        self.assertEqual(result, [])

    def test_partial_match(self):
        from panels.ads import filter_positions
        result = filter_positions(self.NAMES, "content")
        self.assertEqual(result, ["in_content"])


# ── normalize_weights ───────────────────────────────────────────────────────

class TestNormalizeWeights(unittest.TestCase):

    def test_already_100(self):
        from panels.ads import normalize_weights
        result = normalize_weights([50.0, 50.0])
        self.assertEqual(result, [50.0, 50.0])

    def test_proportional(self):
        from panels.ads import normalize_weights
        result = normalize_weights([60.0, 40.0])
        self.assertEqual(result, [60.0, 40.0])

    def test_unbalanced(self):
        from panels.ads import normalize_weights
        result = normalize_weights([30.0, 30.0, 30.0])
        total = sum(result)
        self.assertAlmostEqual(total, 100.0, places=0)

    def test_single_weight(self):
        from panels.ads import normalize_weights
        result = normalize_weights([75.0])
        self.assertEqual(result, [100.0])

    def test_zero_weights(self):
        from panels.ads import normalize_weights
        result = normalize_weights([0.0, 0.0])
        self.assertEqual(result, [50.0, 50.0])

    def test_empty_list(self):
        from panels.ads import normalize_weights
        result = normalize_weights([])
        self.assertEqual(result, [])


# ── calculate_inline_ads ────────────────────────────────────────────────────

class TestCalculateInlineAds(unittest.TestCase):

    CFG_REVIEWS = {
        "enabled": True,
        "desktop": {"firstAfter": 3, "every": 5, "max": 8},
        "mobile": {"firstAfter": 3, "every": 4, "max": 10},
        "wordScaling": {
            "enabled": True,
            "desktopWordsPerAd": 450,
            "mobileWordsPerAd": 350,
            "minFirstAdWords": 150,
        },
    }

    def test_word_scaling_2000_words(self):
        from panels.ads import calculate_inline_ads
        d, m = calculate_inline_ads(2000, self.CFG_REVIEWS)
        self.assertEqual(d, 4)   # 2000 / 450 = 4.44 -> 4
        self.assertEqual(m, 5)   # 2000 / 350 = 5.71 -> 5

    def test_zero_words(self):
        from panels.ads import calculate_inline_ads
        d, m = calculate_inline_ads(0, self.CFG_REVIEWS)
        self.assertEqual(d, 0)
        self.assertEqual(m, 0)

    def test_disabled_collection(self):
        from panels.ads import calculate_inline_ads
        cfg = {"enabled": False}
        d, m = calculate_inline_ads(2000, cfg)
        self.assertEqual(d, 0)
        self.assertEqual(m, 0)

    def test_max_cap(self):
        from panels.ads import calculate_inline_ads
        d, m = calculate_inline_ads(100000, self.CFG_REVIEWS)
        self.assertLessEqual(d, 8)
        self.assertLessEqual(m, 10)

    def test_paragraph_based_fallback(self):
        from panels.ads import calculate_inline_ads
        cfg = {
            "enabled": True,
            "desktop": {"firstAfter": 2, "every": 3, "max": 5},
            "mobile": {"firstAfter": 2, "every": 2, "max": 6},
        }
        d, m = calculate_inline_ads(1500, cfg)
        self.assertGreater(d, 0)
        self.assertGreater(m, 0)


# ── grep_usages ─────────────────────────────────────────────────────────────

class TestGrepUsages(unittest.TestCase):

    def test_finds_position_reference(self):
        from panels.ads import grep_usages
        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "src"
            src.mkdir()
            f = src / "page.astro"
            f.write_text('<AdSlot position="sidebar" />\n', encoding="utf-8")
            results = grep_usages("sidebar", src)
            self.assertEqual(len(results), 1)
            self.assertIn("page.astro", results[0][0])
            self.assertEqual(results[0][1], 1)

    def test_no_match(self):
        from panels.ads import grep_usages
        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "src"
            src.mkdir()
            f = src / "page.astro"
            f.write_text('<div>no ads here</div>\n', encoding="utf-8")
            results = grep_usages("nonexistent", src)
            self.assertEqual(results, [])

    def test_skips_non_source_files(self):
        from panels.ads import grep_usages
        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "src"
            src.mkdir()
            f = src / "readme.txt"
            f.write_text('"sidebar"\n', encoding="utf-8")
            results = grep_usages("sidebar", src)
            self.assertEqual(results, [])

    def test_nonexistent_dir(self):
        from panels.ads import grep_usages
        results = grep_usages("test", Path("/nonexistent/dir"))
        self.assertEqual(results, [])


# ── scan_all_positions ─────────────────────────────────────────────────────

class TestScanAllPositions(unittest.TestCase):

    def test_finds_position_attr(self):
        from panels.ads import scan_all_positions
        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "src"
            src.mkdir()
            f = src / "index.astro"
            f.write_text('<AdSlot position="sidebar" />\n', encoding="utf-8")
            results = scan_all_positions(src)
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0][2], "sidebar")

    def test_finds_multiple_positions(self):
        from panels.ads import scan_all_positions
        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "src"
            src.mkdir()
            f = src / "layout.astro"
            f.write_text(
                '<AdSlot position="sidebar" />\n'
                '<AdSlot position="in_content" />\n',
                encoding="utf-8")
            results = scan_all_positions(src)
            self.assertEqual(len(results), 2)
            names = {r[2] for r in results}
            self.assertEqual(names, {"sidebar", "in_content"})

    def test_ignores_css_position(self):
        from panels.ads import scan_all_positions
        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "src"
            src.mkdir()
            f = src / "dialog.tsx"
            f.write_text('<div position="fixed" />\n', encoding="utf-8")
            results = scan_all_positions(src)
            self.assertEqual(results, [])

    def test_finds_inline_ad_component(self):
        from panels.ads import scan_all_positions
        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "src"
            src.mkdir()
            f = src / "page.astro"
            f.write_text('<InlineAd position="in_content" />\n', encoding="utf-8")
            results = scan_all_positions(src)
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0][2], "in_content")

    def test_skips_non_source_files(self):
        from panels.ads import scan_all_positions
        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "src"
            src.mkdir()
            f = src / "notes.md"
            f.write_text('position="test"\n', encoding="utf-8")
            results = scan_all_positions(src)
            self.assertEqual(results, [])

    def test_nonexistent_dir(self):
        from panels.ads import scan_all_positions
        results = scan_all_positions(Path("/nonexistent/dir"))
        self.assertEqual(results, [])

    def test_empty_dir(self):
        from panels.ads import scan_all_positions
        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "src"
            src.mkdir()
            results = scan_all_positions(src)
            self.assertEqual(results, [])

    def test_skips_ads_internals_by_default(self):
        from panels.ads import scan_all_positions
        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "src"
            ads = src / "features" / "ads" / "components"
            ads.mkdir(parents=True)
            ads_file = ads / "InlineAd.astro"
            ads_file.write_text(
                '<AdSlot position="in_content" />\n', encoding="utf-8")
            page = src / "pages"
            page.mkdir()
            page_file = page / "index.astro"
            page_file.write_text(
                '<AdSlot position="sidebar" />\n', encoding="utf-8")
            results = scan_all_positions(src)
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0][2], "sidebar")

    def test_includes_ads_internals_when_asked(self):
        from panels.ads import scan_all_positions
        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "src"
            ads = src / "features" / "ads" / "components"
            ads.mkdir(parents=True)
            ads_file = ads / "InlineAd.astro"
            ads_file.write_text(
                '<AdSlot position="in_content" />\n', encoding="utf-8")
            results = scan_all_positions(src, skip_ads_internals=False)
            self.assertEqual(len(results), 1)


# ── Panel data contract ────────────────────────────────────────────────────

class TestAdsEnvHelpers(unittest.TestCase):

    def test_read_env_bool_true(self):
        from panels.ads import read_env_bool
        result = read_env_bool("PUBLIC_ADS_ENABLED=true\n", "PUBLIC_ADS_ENABLED")
        self.assertTrue(result)

    def test_read_env_bool_missing_returns_default(self):
        from panels.ads import read_env_bool
        result = read_env_bool("PUBLIC_SITE_URL=https://example.com\n", "PUBLIC_ADS_ENABLED", default=True)
        self.assertTrue(result)

    def test_upsert_env_value_replaces_existing_assignment(self):
        from panels.ads import upsert_env_value
        updated = upsert_env_value(
            "PUBLIC_SITE_URL=https://example.com\nPUBLIC_ADS_ENABLED=false\n",
            "PUBLIC_ADS_ENABLED",
            "true",
        )
        self.assertIn("PUBLIC_ADS_ENABLED=true\n", updated)
        self.assertNotIn("PUBLIC_ADS_ENABLED=false\n", updated)

    def test_upsert_env_value_appends_missing_assignment(self):
        from panels.ads import upsert_env_value
        updated = upsert_env_value(
            "PUBLIC_SITE_URL=https://example.com\n",
            "PUBLIC_ADS_ENABLED",
            "false",
        )
        self.assertTrue(updated.endswith("PUBLIC_ADS_ENABLED=false\n"))


class TestPanelDataContract(unittest.TestCase):
    """Test snapshot-based dirty tracking across 3 configs without tkinter."""

    def _make_registry(self, **overrides):
        base = {
            "global": {
                "adsenseClient": "",
                "adLabel": "Ad",
                "showProductionPlaceholders": False,
                "loadSampleAds": False,
                "sampleAdMode": "mixed",
                "sampleAdNetwork": "mixed",
            },
            "positions": {},
        }
        base.update(overrides)
        return base

    def _make_inline(self, **overrides):
        base = {"defaults": {"position": "in_content"}, "collections": {}}
        base.update(overrides)
        return base

    def _make_sponsors(self, **overrides):
        base = {"creatives": {}}
        base.update(overrides)
        return base

    def test_no_changes(self):
        reg = self._make_registry()
        inline = self._make_inline()
        sponsors = self._make_sponsors()
        snap_r = json.dumps(reg, sort_keys=True)
        snap_i = json.dumps(inline, sort_keys=True)
        snap_s = json.dumps(sponsors, sort_keys=True)
        self.assertEqual(snap_r, json.dumps(reg, sort_keys=True))
        self.assertEqual(snap_i, json.dumps(inline, sort_keys=True))
        self.assertEqual(snap_s, json.dumps(sponsors, sort_keys=True))

    def test_registry_change_detected(self):
        reg = self._make_registry()
        original = json.dumps(reg, sort_keys=True)
        reg["positions"]["sidebar"] = {"provider": "adsense", "display": True}
        current = json.dumps(reg, sort_keys=True)
        self.assertNotEqual(original, current)

    def test_inline_change_detected(self):
        inline = self._make_inline()
        original = json.dumps(inline, sort_keys=True)
        inline["collections"]["reviews"] = {"enabled": True}
        current = json.dumps(inline, sort_keys=True)
        self.assertNotEqual(original, current)

    def test_sponsor_change_detected(self):
        sponsors = self._make_sponsors()
        original = json.dumps(sponsors, sort_keys=True)
        sponsors["creatives"]["sidebar"] = [{"label": "Test", "weight": 100}]
        current = json.dumps(sponsors, sort_keys=True)
        self.assertNotEqual(original, current)

    def test_registry_structure(self):
        reg = self._make_registry()
        self.assertIn("global", reg)
        self.assertIn("positions", reg)
        self.assertIsInstance(reg["global"], dict)
        self.assertIsInstance(reg["positions"], dict)

    def test_inline_structure(self):
        inline = self._make_inline()
        self.assertIn("collections", inline)
        self.assertIsInstance(inline["collections"], dict)

    def test_sponsors_structure(self):
        sponsors = self._make_sponsors()
        self.assertIn("creatives", sponsors)
        self.assertIsInstance(sponsors["creatives"], dict)

    def test_default_fallback_structures(self):
        from panels.ads import DEFAULT_REGISTRY, DEFAULT_INLINE, DEFAULT_SPONSORS
        self.assertIn("global", DEFAULT_REGISTRY)
        self.assertIn("positions", DEFAULT_REGISTRY)
        self.assertIn("collections", DEFAULT_INLINE)
        self.assertIn("creatives", DEFAULT_SPONSORS)

    def test_default_registry_exposes_sample_ad_runtime_knobs(self):
        from panels.ads import DEFAULT_REGISTRY
        global_cfg = DEFAULT_REGISTRY["global"]
        self.assertEqual(global_cfg["sampleAdMode"], "mixed")
        self.assertEqual(global_cfg["sampleAdNetwork"], "mixed")


class _DummyField:

    def __init__(self, value):
        self._value = value

    def get(self):
        return self._value


class _FakeWatcher:

    def pause(self):
        pass

    def resume(self):
        pass

    def snapshot(self):
        pass


class _FakeStore:

    def save(self, *_args, **_kwargs):
        raise AssertionError("JSON save should not run for env-only changes")


class _FakeToast:

    def __init__(self):
        self.messages = []

    def show(self, message, color):
        self.messages.append((message, color))


class _FakeApp:

    def __init__(self):
        self.watcher = _FakeWatcher()
        self.store = _FakeStore()
        self.toast = _FakeToast()
        self.status_messages = []

    def set_status(self, message):
        self.status_messages.append(message)


class TestAdsPanelGlobals(unittest.TestCase):

    def test_on_global_change_persists_sample_ad_runtime_knobs(self):
        from panels.ads import AdsPanel

        fake_panel = type("FakePanel", (), {})()
        fake_panel._config_data = {"global": {}}
        fake_panel._client_var = _DummyField("ca-pub-test")
        fake_panel._label_var = _DummyField("Ad")
        fake_panel._prod_ph_toggle = _DummyField(True)
        fake_panel._sample_ads_toggle = _DummyField(True)
        fake_panel._sample_mode_var = _DummyField("video")
        fake_panel._sample_network_var = _DummyField("raptive")
        fake_panel._update_badge = lambda: None

        AdsPanel._on_global_change(fake_panel)

        self.assertEqual(fake_panel._config_data["global"]["sampleAdMode"], "video")
        self.assertEqual(fake_panel._config_data["global"]["sampleAdNetwork"], "raptive")

    def test_has_changes_detects_ads_enabled_env_toggle(self):
        from panels.ads import AdsPanel

        registry = {
            "global": {
                "adsenseClient": "",
                "adLabel": "Ad",
                "showProductionPlaceholders": False,
                "loadSampleAds": False,
                "sampleAdMode": "mixed",
                "sampleAdNetwork": "mixed",
            },
            "positions": {},
        }
        inline = {"defaults": {"position": "in_content"}, "collections": {}}
        sponsors = {"creatives": {}}

        fake_panel = type("FakePanel", (), {})()
        fake_panel._config_data = registry
        fake_panel._original = json.dumps(registry, sort_keys=True)
        fake_panel._inline_data = inline
        fake_panel._inline_original = json.dumps(inline, sort_keys=True)
        fake_panel._sponsors_data = sponsors
        fake_panel._sponsors_original = json.dumps(sponsors, sort_keys=True)
        fake_panel._ads_enabled_toggle = _DummyField(True)
        fake_panel._ads_enabled_original = False

        self.assertTrue(AdsPanel.has_changes(fake_panel))

    def test_save_writes_public_ads_enabled_to_env_file(self):
        from panels.ads import AdsPanel

        registry = {
            "global": {
                "adsenseClient": "",
                "adLabel": "Ad",
                "showProductionPlaceholders": False,
                "loadSampleAds": False,
                "sampleAdMode": "mixed",
                "sampleAdNetwork": "mixed",
            },
            "positions": {},
        }
        inline = {"defaults": {"position": "in_content"}, "collections": {}}
        sponsors = {"creatives": {}}

        with tempfile.TemporaryDirectory() as tmpdir:
            env_path = Path(tmpdir) / ".env"
            env_path.write_text(
                "PUBLIC_SITE_URL=https://example.com\nPUBLIC_ADS_ENABLED=false\n",
                encoding="utf-8",
            )

            fake_panel = type("FakePanel", (), {})()
            fake_panel._config_data = registry
            fake_panel._original = json.dumps(registry, sort_keys=True)
            fake_panel._inline_data = inline
            fake_panel._inline_original = json.dumps(inline, sort_keys=True)
            fake_panel._sponsors_data = sponsors
            fake_panel._sponsors_original = json.dumps(sponsors, sort_keys=True)
            fake_panel._ads_enabled_toggle = _DummyField(True)
            fake_panel._ads_enabled_original = False
            fake_panel._env_path = env_path
            fake_panel._app = _FakeApp()
            fake_panel._update_badge = lambda: None

            saved = AdsPanel.save(fake_panel)

            self.assertTrue(saved)
            self.assertIn(
                "PUBLIC_ADS_ENABLED=true\n",
                env_path.read_text(encoding="utf-8"),
            )
            self.assertTrue(fake_panel._ads_enabled_original)


if __name__ == "__main__":
    unittest.main()
