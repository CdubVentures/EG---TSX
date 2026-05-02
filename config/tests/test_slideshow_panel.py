"""Tests for panels/slideshow.py — pure functions + panel data contract."""
import json
import tempfile
import unittest
from pathlib import Path


class TestParseReleaseDate(unittest.TestCase):
    """Test parse_release_date() date parsing."""

    def test_valid_mm_yyyy(self):
        from panels.slideshow import parse_release_date
        self.assertEqual(parse_release_date("01/2025"), (2025, 1))

    def test_valid_mm_yyyy_december(self):
        from panels.slideshow import parse_release_date
        self.assertEqual(parse_release_date("12/2023"), (2023, 12))

    def test_bare_year(self):
        from panels.slideshow import parse_release_date
        self.assertEqual(parse_release_date("2024"), (2024, 0))

    def test_empty_string(self):
        from panels.slideshow import parse_release_date
        self.assertEqual(parse_release_date(""), (0, 0))

    def test_none(self):
        from panels.slideshow import parse_release_date
        self.assertEqual(parse_release_date(None), (0, 0))

    def test_invalid(self):
        from panels.slideshow import parse_release_date
        self.assertEqual(parse_release_date("invalid"), (0, 0))

    def test_whitespace(self):
        from panels.slideshow import parse_release_date
        self.assertEqual(parse_release_date("  01/2025  "), (2025, 1))


class TestHasDealLink(unittest.TestCase):
    """Test has_deal_link() URL checking."""

    def test_with_amazon(self):
        from panels.slideshow import has_deal_link
        data = {"alink_amazon": "https://amazon.com/dp/B123"}
        self.assertTrue(has_deal_link(data))

    def test_with_bestbuy(self):
        from panels.slideshow import has_deal_link
        data = {"alink_bestbuy": "https://bestbuy.com/site/123"}
        self.assertTrue(has_deal_link(data))

    def test_with_affiliate_links_array(self):
        from panels.slideshow import has_deal_link
        data = {
            "affiliateLinks": [
                {"url": "https://www.amazon.com/dp/B123", "retailer": "amazon"}
            ]
        }
        self.assertTrue(has_deal_link(data))

    def test_placeholder_domain(self):
        from panels.slideshow import has_deal_link
        data = {"alink_amazon": "dasad.com"}
        self.assertFalse(has_deal_link(data))

    def test_empty_string(self):
        from panels.slideshow import has_deal_link
        data = {"alink_amazon": ""}
        self.assertFalse(has_deal_link(data))

    def test_no_alink_fields(self):
        from panels.slideshow import has_deal_link
        data = {"brand": "Razer", "model": "Viper"}
        self.assertFalse(has_deal_link(data))

    def test_non_http(self):
        from panels.slideshow import has_deal_link
        data = {"alink_amazon": "not-a-url"}
        self.assertFalse(has_deal_link(data))

    def test_dasd_placeholder(self):
        from panels.slideshow import has_deal_link
        data = {"alink_amazon": "dasd.com"}
        self.assertFalse(has_deal_link(data))

    def test_affiliate_links_invalid_url(self):
        from panels.slideshow import has_deal_link
        data = {"affiliateLinks": [{"url": "not-a-url", "retailer": "amazon"}]}
        self.assertFalse(has_deal_link(data))


class TestLoadProducts(unittest.TestCase):
    """Test load_products() product scanning."""

    def _make_product(self, tmpdir, category, brand, slug, overall=9.0,
                      release_date="01/2025", images=None):
        """Create a product JSON in the expected directory structure."""
        d = Path(tmpdir) / category / brand
        d.mkdir(parents=True, exist_ok=True)
        data = {
            "category": category,
            "brand": brand.title(),
            "model": f"{brand.title()} {slug.title()}",
            "slug": slug,
            "overall": overall,
            "release_date": release_date,
            "imagePath": f"/images/products/{category}/{brand}/{slug}",
            "media": {"images": [{"stem": "top", "view": "top"}] if images is None else images},
        }
        (d / f"{slug}.json").write_text(
            json.dumps(data), encoding="utf-8")
        return data

    def test_loads_products(self):
        from panels.slideshow import load_products
        with tempfile.TemporaryDirectory() as tmp:
            self._make_product(tmp, "mouse", "razer", "viper")
            result = load_products(Path(tmp))
            self.assertEqual(len(result), 1)
            p = result[0]
            self.assertEqual(p["entry_id"], "razer-viper")
            self.assertEqual(p["category"], "mouse")
            self.assertAlmostEqual(p["overall"], 9.0)

    def test_empty_dir(self):
        from panels.slideshow import load_products
        result = load_products(Path("/nonexistent/dir"))
        self.assertEqual(result, [])

    def test_excludes_zero_score(self):
        from panels.slideshow import load_products
        with tempfile.TemporaryDirectory() as tmp:
            self._make_product(tmp, "mouse", "razer", "viper", overall=0)
            result = load_products(Path(tmp))
            self.assertEqual(len(result), 0)

    def test_excludes_no_media(self):
        from panels.slideshow import load_products
        with tempfile.TemporaryDirectory() as tmp:
            self._make_product(tmp, "mouse", "razer", "viper", images=[])
            result = load_products(Path(tmp))
            self.assertEqual(len(result), 0)

    def test_entry_id_format(self):
        from panels.slideshow import load_products
        with tempfile.TemporaryDirectory() as tmp:
            self._make_product(tmp, "mouse", "logitech-g", "pro-x-superlight")
            result = load_products(Path(tmp))
            self.assertEqual(len(result), 1)
            self.assertEqual(result[0]["entry_id"], "logitech-g-pro-x-superlight")

    def test_has_deal_field(self):
        from panels.slideshow import load_products
        with tempfile.TemporaryDirectory() as tmp:
            self._make_product(tmp, "mouse", "razer", "viper")
            result = load_products(Path(tmp))
            self.assertIn("has_deal", result[0])
            self.assertIsInstance(result[0]["has_deal"], bool)

    def test_has_deal_true_from_affiliate_links(self):
        from panels.slideshow import load_products
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp) / "mouse" / "razer"
            d.mkdir(parents=True, exist_ok=True)
            data = {
                "category": "mouse",
                "brand": "Razer",
                "model": "Razer Viper",
                "slug": "viper",
                "overall": 9.0,
                "release_date": "01/2025",
                "imagePath": "/images/products/mouse/razer/viper",
                "media": {"images": [{"stem": "top", "view": "top"}]},
                "affiliateLinks": [
                    {"url": "https://www.amazon.com/dp/B123", "retailer": "amazon"}
                ],
            }
            (d / "viper.json").write_text(json.dumps(data), encoding="utf-8")

            result = load_products(Path(tmp))
            self.assertTrue(result[0]["has_deal"])

    def test_release_sort_field(self):
        from panels.slideshow import load_products
        with tempfile.TemporaryDirectory() as tmp:
            self._make_product(tmp, "mouse", "razer", "viper",
                              release_date="06/2024")
            result = load_products(Path(tmp))
            self.assertEqual(result[0]["release_sort"], (2024, 6))


class TestAutoFillSlots(unittest.TestCase):
    """Test auto_fill_slots() queue filling logic."""

    def _product(self, eid, category="mouse", overall=9.0,
                 has_deal=False, release_sort=(2025, 1)):
        return {
            "entry_id": eid, "category": category,
            "overall": overall, "has_deal": has_deal,
            "release_sort": release_sort,
        }

    def test_fills_empty_queue(self):
        from panels.slideshow import auto_fill_slots
        products = [
            self._product("a", overall=9.0, release_sort=(2025, 1)),
            self._product("b", overall=8.5, release_sort=(2024, 6)),
        ]
        queue, added = auto_fill_slots(products, [], 5)
        self.assertEqual(added, 2)
        self.assertEqual(len(queue), 2)

    def test_full_queue_returns_zero(self):
        from panels.slideshow import auto_fill_slots
        products = [self._product("a")]
        queue, added = auto_fill_slots(products, ["x", "y", "z"], 3)
        self.assertEqual(added, 0)
        self.assertEqual(queue, ["x", "y", "z"])

    def test_max_per_cat(self):
        from panels.slideshow import auto_fill_slots
        products = [
            self._product(f"m{i}", category="mouse", overall=9.0,
                         release_sort=(2025, i))
            for i in range(6)
        ]
        queue, added = auto_fill_slots(products, [], 10)
        self.assertEqual(added, 3)  # MAX_PER_CAT = 3

    def test_min_score_filter(self):
        from panels.slideshow import auto_fill_slots
        products = [
            self._product("low", overall=7.5),
            self._product("high", overall=8.5),
        ]
        queue, added = auto_fill_slots(products, [], 5)
        self.assertEqual(added, 1)
        self.assertIn("high", queue)
        self.assertNotIn("low", queue)

    def test_skips_already_queued(self):
        from panels.slideshow import auto_fill_slots
        products = [
            self._product("a", overall=9.0),
            self._product("b", overall=8.5),
        ]
        queue, added = auto_fill_slots(products, ["a"], 5)
        self.assertEqual(added, 1)
        self.assertIn("b", queue)
        # "a" should still be there (was already queued)
        self.assertIn("a", queue)

    def test_deal_links_first(self):
        from panels.slideshow import auto_fill_slots
        products = [
            self._product("no_deal", overall=9.5, has_deal=False,
                         release_sort=(2025, 6)),
            self._product("has_deal", overall=8.0, has_deal=True,
                         release_sort=(2024, 1)),
        ]
        queue, added = auto_fill_slots(products, [], 5)
        self.assertEqual(added, 2)
        self.assertEqual(queue[0], "has_deal")  # deals sort first

    def test_respects_max_slides(self):
        from panels.slideshow import auto_fill_slots
        products = [
            self._product(f"p{i}", overall=9.0, release_sort=(2025, i))
            for i in range(10)
        ]
        queue, added = auto_fill_slots(products, ["existing"], 3)
        self.assertEqual(len(queue), 3)  # existing + 2 added
        self.assertEqual(added, 2)


class TestPanelDataContract(unittest.TestCase):
    """Test snapshot-based dirty tracking without tkinter."""

    def _make_config(self, max_slides=10, slides=None):
        return {"maxSlides": max_slides, "slides": slides or []}

    def test_no_changes(self):
        cfg = self._make_config(10, ["a", "b"])
        original = json.dumps(cfg, sort_keys=True)
        current = json.dumps(cfg, sort_keys=True)
        self.assertEqual(original, current)

    def test_slide_change_detected(self):
        cfg = self._make_config(10, ["a", "b"])
        original = json.dumps(cfg, sort_keys=True)
        cfg["slides"].append("c")
        current = json.dumps(cfg, sort_keys=True)
        self.assertNotEqual(original, current)

    def test_max_change_detected(self):
        cfg = self._make_config(10, ["a"])
        original = json.dumps(cfg, sort_keys=True)
        cfg["maxSlides"] = 15
        current = json.dumps(cfg, sort_keys=True)
        self.assertNotEqual(original, current)

    def test_config_structure(self):
        cfg = self._make_config(10, ["a", "b"])
        self.assertIn("maxSlides", cfg)
        self.assertIn("slides", cfg)
        self.assertIsInstance(cfg["maxSlides"], int)
        self.assertIsInstance(cfg["slides"], list)

    def test_reorder_detected(self):
        cfg = self._make_config(10, ["a", "b", "c"])
        original = json.dumps(cfg, sort_keys=True)
        cfg["slides"] = ["c", "a", "b"]
        current = json.dumps(cfg, sort_keys=True)
        self.assertNotEqual(original, current)


if __name__ == "__main__":
    unittest.main()
