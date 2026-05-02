"""Tests for panels/hub_tools.py — data helpers + panel data contract."""
import json
import unittest


class TestConstants(unittest.TestCase):
    """Verify panel constants are well-formed."""

    def test_tool_types_count(self):
        from panels.hub_tools import TOOL_TYPES
        self.assertEqual(len(TOOL_TYPES), 5)

    def test_tool_types_contents(self):
        from panels.hub_tools import TOOL_TYPES
        self.assertEqual(TOOL_TYPES, ["hub", "database", "versus", "radar", "shapes"])

    def test_tool_type_labels_coverage(self):
        from panels.hub_tools import TOOL_TYPES, TOOL_TYPE_LABELS
        for t in TOOL_TYPES:
            self.assertIn(t, TOOL_TYPE_LABELS)
            self.assertIsInstance(TOOL_TYPE_LABELS[t], str)

    def test_default_tooltips_coverage(self):
        from panels.hub_tools import TOOL_TYPES, DEFAULT_TOOLTIPS
        for t in TOOL_TYPES:
            self.assertIn(t, DEFAULT_TOOLTIPS)
            self.assertTrue(len(DEFAULT_TOOLTIPS[t]) > 0)

    def test_default_urls_coverage(self):
        from panels.hub_tools import TOOL_TYPES, DEFAULT_URLS
        for t in TOOL_TYPES:
            self.assertIn(t, DEFAULT_URLS)
            self.assertIn("{cat}", DEFAULT_URLS[t])

    def test_default_descriptions_structure(self):
        from panels.hub_tools import DEFAULT_DESCRIPTIONS
        for cat in ("mouse", "keyboard", "monitor"):
            self.assertIn(cat, DEFAULT_DESCRIPTIONS)
            self.assertIn("hub", DEFAULT_DESCRIPTIONS[cat])

    def test_default_subtitles_structure(self):
        from panels.hub_tools import DEFAULT_SUBTITLES
        for cat in ("mouse", "keyboard", "monitor"):
            self.assertIn(cat, DEFAULT_SUBTITLES)
            self.assertIn("hub", DEFAULT_SUBTITLES[cat])


class TestIsProductActive(unittest.TestCase):
    """Test is_product_active() helper."""

    def test_both_flags(self):
        from panels.hub_tools import is_product_active
        cat = {"id": "mouse", "product": {"production": True, "vite": True}}
        self.assertTrue(is_product_active(cat))

    def test_production_only(self):
        from panels.hub_tools import is_product_active
        cat = {"id": "mouse", "product": {"production": True, "vite": False}}
        self.assertTrue(is_product_active(cat))

    def test_vite_only(self):
        from panels.hub_tools import is_product_active
        cat = {"id": "mouse", "product": {"production": False, "vite": True}}
        self.assertTrue(is_product_active(cat))

    def test_neither_flag(self):
        from panels.hub_tools import is_product_active
        cat = {"id": "mouse", "product": {"production": False, "vite": False}}
        self.assertFalse(is_product_active(cat))

    def test_no_product_key(self):
        from panels.hub_tools import is_product_active
        cat = {"id": "mouse"}
        self.assertFalse(is_product_active(cat))

    def test_empty_product(self):
        from panels.hub_tools import is_product_active
        cat = {"id": "mouse", "product": {}}
        self.assertFalse(is_product_active(cat))


class TestMakeDefaultTool(unittest.TestCase):
    """Test make_default_tool() factory."""

    def test_mouse_hub(self):
        from panels.hub_tools import make_default_tool
        t = make_default_tool("mouse", "hub")
        self.assertEqual(t["tool"], "hub")
        self.assertEqual(t["title"], "Hub")
        self.assertEqual(t["url"], "/hubs/mouse")
        self.assertTrue(t["navbar"])
        self.assertTrue(t["enabled"])
        self.assertIn("/images/tools/mouse/hub/hero-img", t["hero"])

    def test_mouse_database(self):
        from panels.hub_tools import make_default_tool
        t = make_default_tool("mouse", "database")
        self.assertEqual(t["tool"], "database")
        self.assertFalse(t["navbar"])
        self.assertEqual(t["hero"], "")
        self.assertEqual(t["url"], "/hubs/mouse?view=list")

    def test_mouse_shapes(self):
        from panels.hub_tools import make_default_tool
        t = make_default_tool("mouse", "shapes")
        self.assertTrue(t["enabled"])
        self.assertIsInstance(t["description"], str)
        self.assertTrue(len(t["description"]) > 0)

    def test_unknown_category(self):
        from panels.hub_tools import make_default_tool
        t = make_default_tool("headset", "hub")
        self.assertEqual(t["url"], "/hubs/headset")
        self.assertIn("headset", t["description"].lower())

    def test_custom_tool_type(self):
        from panels.hub_tools import make_default_tool
        t = make_default_tool("mouse", "custom_thing")
        self.assertEqual(t["tool"], "custom_thing")
        self.assertEqual(t["title"], "Custom_thing")

    def test_all_required_keys(self):
        from panels.hub_tools import make_default_tool
        t = make_default_tool("mouse", "hub")
        for key in ("tool", "title", "description", "subtitle", "url",
                     "svg", "enabled", "navbar", "hero"):
            self.assertIn(key, t, f"Missing key: {key}")

    def test_keyboard_versus_url(self):
        from panels.hub_tools import make_default_tool
        t = make_default_tool("keyboard", "versus")
        self.assertEqual(t["url"], "/hubs/keyboard?compare=stats")

    def test_monitor_radar_url(self):
        from panels.hub_tools import make_default_tool
        t = make_default_tool("monitor", "radar")
        self.assertEqual(t["url"], "/hubs/monitor?compare=radar")


class TestEnsureDefaults(unittest.TestCase):
    """Test ensure_defaults() scaffolding."""

    def test_empty_data_fills_all(self):
        from panels.hub_tools import ensure_defaults, TOOL_TYPES
        cats = [
            {"id": "mouse", "product": {"production": True, "vite": False}},
            {"id": "keyboard", "product": {"production": True, "vite": False}},
        ]
        data = ensure_defaults({}, cats)
        self.assertEqual(len(data["mouse"]), 5)
        self.assertEqual(len(data["keyboard"]), 5)
        mouse_tools = {t["tool"] for t in data["mouse"]}
        self.assertEqual(mouse_tools, set(TOOL_TYPES))

    def test_partial_data_keeps_existing(self):
        from panels.hub_tools import ensure_defaults
        cats = [{"id": "mouse", "product": {"production": True, "vite": False}}]
        existing_hub = {
            "tool": "hub", "title": "Custom Hub", "description": "custom",
            "subtitle": "sub", "url": "/custom", "svg": "<svg/>",
            "enabled": True, "navbar": True, "hero": "/custom-hero",
        }
        data = ensure_defaults({"mouse": [existing_hub]}, cats)
        hub = next(t for t in data["mouse"] if t["tool"] == "hub")
        self.assertEqual(hub["title"], "Custom Hub")
        self.assertEqual(len(data["mouse"]), 5)

    def test_inactive_cat_all_disabled(self):
        from panels.hub_tools import ensure_defaults
        cats = [{"id": "headset", "product": {"production": False, "vite": False}}]
        data = ensure_defaults({}, cats)
        for tool in data["headset"]:
            self.assertFalse(tool["enabled"],
                             f"{tool['tool']} should be disabled for inactive cat")

    def test_shapes_disabled_for_non_mouse(self):
        from panels.hub_tools import ensure_defaults
        cats = [{"id": "keyboard", "product": {"production": True, "vite": False}}]
        data = ensure_defaults({}, cats)
        shapes = next(t for t in data["keyboard"] if t["tool"] == "shapes")
        self.assertFalse(shapes["enabled"])

    def test_shapes_enabled_for_mouse(self):
        from panels.hub_tools import ensure_defaults
        cats = [{"id": "mouse", "product": {"production": True, "vite": False}}]
        data = ensure_defaults({}, cats)
        shapes = next(t for t in data["mouse"] if t["tool"] == "shapes")
        self.assertTrue(shapes["enabled"])

    def test_tool_order_matches_tool_types(self):
        from panels.hub_tools import ensure_defaults, TOOL_TYPES
        cats = [{"id": "mouse", "product": {"production": True, "vite": False}}]
        data = ensure_defaults({}, cats)
        tool_order = [t["tool"] for t in data["mouse"]]
        self.assertEqual(tool_order, TOOL_TYPES)

    def test_no_duplicate_tools(self):
        from panels.hub_tools import ensure_defaults
        cats = [{"id": "mouse", "product": {"production": True, "vite": False}}]
        data = ensure_defaults({}, cats)
        # Run again — should not duplicate
        data = ensure_defaults(data, cats)
        self.assertEqual(len(data["mouse"]), 5)


class TestBuildConfig(unittest.TestCase):
    """Test build_config() output structure."""

    def test_structure(self):
        from panels.hub_tools import build_config
        data = {
            "mouse": [{"tool": "hub", "title": "Hub", "enabled": True}],
            "_tooltips": {"hub": "desc"},
            "_index": {"all": ["mouse:hub"]},
        }
        result = build_config(data)
        self.assertIn("mouse", result)
        self.assertIn("_tooltips", result)
        self.assertIn("_index", result)

    def test_passthrough(self):
        from panels.hub_tools import build_config
        data = {
            "mouse": [{"tool": "hub", "title": "Hub"}],
            "keyboard": [{"tool": "hub", "title": "Hub"}],
            "_tooltips": {"hub": "tip"},
            "_index": {"all": []},
        }
        result = build_config(data)
        self.assertEqual(result["mouse"], data["mouse"])
        self.assertEqual(result["keyboard"], data["keyboard"])

    def test_empty(self):
        from panels.hub_tools import build_config
        result = build_config({})
        self.assertIsInstance(result, dict)


class TestPanelDataContract(unittest.TestCase):
    """Test snapshot-based dirty tracking without tkinter."""

    def _make_data(self):
        return {
            "mouse": [
                {"tool": "hub", "title": "Hub", "description": "desc",
                 "subtitle": "sub", "url": "/hubs/mouse", "svg": "",
                 "enabled": True, "navbar": True, "hero": "/img"},
            ],
            "_tooltips": {"hub": "tip"},
            "_index": {"all": []},
        }

    def test_no_changes(self):
        data = self._make_data()
        original = json.dumps(data, sort_keys=True)
        current = json.dumps(data, sort_keys=True)
        self.assertEqual(original, current)

    def test_title_change_detected(self):
        data = self._make_data()
        original = json.dumps(data, sort_keys=True)
        data["mouse"][0]["title"] = "Changed"
        current = json.dumps(data, sort_keys=True)
        self.assertNotEqual(original, current)

    def test_enabled_change_detected(self):
        data = self._make_data()
        original = json.dumps(data, sort_keys=True)
        data["mouse"][0]["enabled"] = False
        current = json.dumps(data, sort_keys=True)
        self.assertNotEqual(original, current)

    def test_tooltip_change_detected(self):
        data = self._make_data()
        original = json.dumps(data, sort_keys=True)
        data["_tooltips"]["hub"] = "new tip"
        current = json.dumps(data, sort_keys=True)
        self.assertNotEqual(original, current)

    def test_index_change_detected(self):
        data = self._make_data()
        original = json.dumps(data, sort_keys=True)
        data["_index"]["all"] = ["mouse:hub"]
        current = json.dumps(data, sort_keys=True)
        self.assertNotEqual(original, current)


if __name__ == "__main__":
    unittest.main()
