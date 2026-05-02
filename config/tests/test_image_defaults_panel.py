"""Tests for panels/image_defaults.py — pure functions + panel data contract."""
import json
import tempfile
import unittest
from pathlib import Path


class TestScanProductViews(unittest.TestCase):
    """Test scan_product_views() product scanning."""

    def _make_product(self, tmpdir, category, brand, slug, views=None):
        """Create a product JSON with given views in the expected dir structure."""
        d = Path(tmpdir) / category / brand
        d.mkdir(parents=True, exist_ok=True)
        images = []
        for v in (views if views is not None else ["top", "left"]):
            images.append({"stem": v, "view": v})
        data = {
            "category": category,
            "brand": brand.title(),
            "model": f"{brand.title()} {slug.title()}",
            "media": {"images": images},
        }
        (d / f"{slug}.json").write_text(
            json.dumps(data), encoding="utf-8")

    def test_counts_views(self):
        from panels.image_defaults import scan_product_views
        with tempfile.TemporaryDirectory() as tmp:
            self._make_product(tmp, "mouse", "razer", "viper",
                              views=["top", "left", "sangle"])
            self._make_product(tmp, "mouse", "logitech", "gpro",
                              views=["top", "left"])
            view_counts, product_counts = scan_product_views(Path(tmp))
            self.assertEqual(product_counts["mouse"], 2)
            self.assertEqual(view_counts["mouse"]["top"], 2)
            self.assertEqual(view_counts["mouse"]["left"], 2)
            self.assertEqual(view_counts["mouse"]["sangle"], 1)

    def test_empty_dir(self):
        from panels.image_defaults import scan_product_views
        view_counts, product_counts = scan_product_views(
            Path("/nonexistent/dir"))
        self.assertEqual(view_counts, {})
        self.assertEqual(product_counts, {})

    def test_excludes_no_media(self):
        from panels.image_defaults import scan_product_views
        with tempfile.TemporaryDirectory() as tmp:
            self._make_product(tmp, "mouse", "razer", "viper", views=[])
            view_counts, product_counts = scan_product_views(Path(tmp))
            self.assertEqual(product_counts.get("mouse", 0), 0)

    def test_deduplicates_views_per_product(self):
        from panels.image_defaults import scan_product_views
        with tempfile.TemporaryDirectory() as tmp:
            # Product with two "top" images (e.g. different colors)
            d = Path(tmp) / "mouse" / "razer"
            d.mkdir(parents=True)
            data = {
                "category": "mouse",
                "brand": "Razer",
                "model": "Razer Viper",
                "media": {"images": [
                    {"stem": "top", "view": "top"},
                    {"stem": "top---black", "view": "top"},
                ]},
            }
            (d / "viper.json").write_text(
                json.dumps(data), encoding="utf-8")
            view_counts, product_counts = scan_product_views(Path(tmp))
            self.assertEqual(view_counts["mouse"]["top"], 1)

    def test_non_canonical_views_still_counted(self):
        from panels.image_defaults import scan_product_views
        with tempfile.TemporaryDirectory() as tmp:
            self._make_product(tmp, "mouse", "razer", "viper",
                              views=["top", "weird-view"])
            view_counts, _ = scan_product_views(Path(tmp))
            self.assertEqual(view_counts["mouse"]["weird-view"], 1)

    def test_multiple_categories(self):
        from panels.image_defaults import scan_product_views
        with tempfile.TemporaryDirectory() as tmp:
            self._make_product(tmp, "mouse", "razer", "viper",
                              views=["top"])
            self._make_product(tmp, "keyboard", "corsair", "k70",
                              views=["top", "front"])
            view_counts, product_counts = scan_product_views(Path(tmp))
            self.assertEqual(product_counts["mouse"], 1)
            self.assertEqual(product_counts["keyboard"], 1)
            self.assertNotIn("front", view_counts.get("mouse", {}))
            self.assertEqual(view_counts["keyboard"]["front"], 1)


class TestGetResolvedDefaults(unittest.TestCase):
    """Test get_resolved_defaults() merge logic."""

    def _make_config(self, defaults=None, categories=None):
        return {
            "defaults": defaults or {
                "defaultImageView": ["top", "left"],
                "listThumbKeyBase": ["left"],
                "coverImageView": ["feature-image"],
                "headerGame": ["left", "top"],
                "viewPriority": ["top", "left", "right"],
                "viewMeta": {
                    "top": {"objectFit": "contain", "label": "Top"},
                    "left": {"objectFit": "contain", "label": "Left Side"},
                },
                "imageDisplayOptions": [],
            },
            "categories": categories or {},
        }

    def test_global_returns_defaults(self):
        from panels.image_defaults import get_resolved_defaults
        cfg = self._make_config()
        result = get_resolved_defaults(cfg, "__defaults__")
        self.assertEqual(result["defaultImageView"], ["top", "left"])
        self.assertEqual(result["viewPriority"], ["top", "left", "right"])

    def test_no_override_returns_defaults(self):
        from panels.image_defaults import get_resolved_defaults
        cfg = self._make_config()
        result = get_resolved_defaults(cfg, "mouse")
        self.assertEqual(result["defaultImageView"], ["top", "left"])

    def test_category_override_applied(self):
        from panels.image_defaults import get_resolved_defaults
        cfg = self._make_config(categories={
            "mouse": {"defaultImageView": ["sangle", "top"]},
        })
        result = get_resolved_defaults(cfg, "mouse")
        self.assertEqual(result["defaultImageView"], ["sangle", "top"])
        # Other fields still inherited
        self.assertEqual(result["listThumbKeyBase"], ["left"])

    def test_viewMeta_deep_merge(self):
        from panels.image_defaults import get_resolved_defaults
        cfg = self._make_config(categories={
            "mouse": {
                "viewMeta": {
                    "top": {"objectFit": "cover"},
                },
            },
        })
        result = get_resolved_defaults(cfg, "mouse")
        # top: objectFit overridden, label inherited
        self.assertEqual(result["viewMeta"]["top"]["objectFit"], "cover")
        self.assertEqual(result["viewMeta"]["top"]["label"], "Top")
        # left: fully inherited
        self.assertEqual(result["viewMeta"]["left"]["objectFit"], "contain")

    def test_viewMeta_add_new_view(self):
        from panels.image_defaults import get_resolved_defaults
        cfg = self._make_config(categories={
            "mouse": {
                "viewMeta": {
                    "sangle": {"objectFit": "contain", "label": "S-Angle"},
                },
            },
        })
        result = get_resolved_defaults(cfg, "mouse")
        # New view added
        self.assertEqual(result["viewMeta"]["sangle"]["label"], "S-Angle")
        # Existing views preserved
        self.assertIn("top", result["viewMeta"])
        self.assertIn("left", result["viewMeta"])

    def test_viewPriority_override(self):
        from panels.image_defaults import get_resolved_defaults
        cfg = self._make_config(categories={
            "mouse": {"viewPriority": ["left", "top", "sangle"]},
        })
        result = get_resolved_defaults(cfg, "mouse")
        self.assertEqual(result["viewPriority"], ["left", "top", "sangle"])


class TestPanelDataContract(unittest.TestCase):
    """Test snapshot-based dirty tracking without tkinter."""

    def _make_config(self, defaults=None, categories=None):
        return {
            "defaults": defaults or {
                "defaultImageView": ["top"],
                "viewPriority": ["top", "left"],
                "viewMeta": {},
            },
            "categories": categories or {},
        }

    def test_no_changes(self):
        cfg = self._make_config()
        original = json.dumps(cfg, sort_keys=True)
        current = json.dumps(cfg, sort_keys=True)
        self.assertEqual(original, current)

    def test_field_change_detected(self):
        cfg = self._make_config()
        original = json.dumps(cfg, sort_keys=True)
        cfg["defaults"]["defaultImageView"] = ["left"]
        current = json.dumps(cfg, sort_keys=True)
        self.assertNotEqual(original, current)

    def test_viewMeta_change_detected(self):
        cfg = self._make_config()
        original = json.dumps(cfg, sort_keys=True)
        cfg["defaults"]["viewMeta"]["top"] = {"objectFit": "cover"}
        current = json.dumps(cfg, sort_keys=True)
        self.assertNotEqual(original, current)

    def test_category_override_detected(self):
        cfg = self._make_config()
        original = json.dumps(cfg, sort_keys=True)
        cfg["categories"]["mouse"] = {"defaultImageView": ["sangle"]}
        current = json.dumps(cfg, sort_keys=True)
        self.assertNotEqual(original, current)

    def test_config_structure(self):
        cfg = self._make_config()
        self.assertIn("defaults", cfg)
        self.assertIn("categories", cfg)
        self.assertIsInstance(cfg["defaults"], dict)
        self.assertIsInstance(cfg["categories"], dict)

    def test_default_fallback_structure(self):
        from panels.image_defaults import DEFAULT_CONFIG
        self.assertIn("defaults", DEFAULT_CONFIG)
        self.assertIn("categories", DEFAULT_CONFIG)
        defaults = DEFAULT_CONFIG["defaults"]
        self.assertIn("defaultImageView", defaults)
        self.assertIn("viewPriority", defaults)
        self.assertIn("viewMeta", defaults)
        self.assertIsInstance(defaults["defaultImageView"], list)
        self.assertIsInstance(defaults["viewPriority"], list)
        self.assertIsInstance(defaults["viewMeta"], dict)


if __name__ == "__main__":
    unittest.main()
