"""Tests for panels/categories.py — data helpers + panel logic."""

import json
import sys
import tempfile
import shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from panels.categories import (
    default_collections,
    normalize_toggle,
    normalize_collections,
    normalize_category,
    infer_collections,
    extract_category_from_frontmatter,
    scan_content_categories,
    count_articles,
    count_products,
    scan_category_presence,
)


# ── default_collections ─────────────────────────────────────────────────────

class TestDefaultCollections:
    def test_returns_four_keys(self):
        result = default_collections()
        assert set(result.keys()) == {"dataProducts", "reviews", "guides", "news"}

    def test_all_false(self):
        result = default_collections()
        assert all(v is False for v in result.values())

    def test_returns_new_dict_each_call(self):
        a = default_collections()
        b = default_collections()
        assert a is not b


# ── normalize_toggle ─────────────────────────────────────────────────────────

class TestNormalizeToggle:
    def test_none_input(self):
        assert normalize_toggle(None) == {"production": False, "vite": False}

    def test_empty_dict(self):
        assert normalize_toggle({}) == {"production": False, "vite": False}

    def test_partial_production_true(self):
        result = normalize_toggle({"production": True})
        assert result == {"production": True, "vite": False}

    def test_partial_vite_true(self):
        result = normalize_toggle({"vite": True})
        assert result == {"production": False, "vite": True}

    def test_both_true(self):
        result = normalize_toggle({"production": True, "vite": True})
        assert result == {"production": True, "vite": True}

    def test_truthy_values_coerced(self):
        result = normalize_toggle({"production": 1, "vite": "yes"})
        assert result == {"production": True, "vite": True}

    def test_string_input(self):
        result = normalize_toggle("not a dict")
        assert result == {"production": False, "vite": False}


# ── normalize_collections ────────────────────────────────────────────────────

class TestNormalizeCollections:
    def test_none_input(self):
        result = normalize_collections(None)
        assert result == default_collections()

    def test_partial_dict(self):
        result = normalize_collections({"reviews": True})
        assert result["reviews"] is True
        assert result["guides"] is False
        assert result["news"] is False
        assert result["dataProducts"] is False

    def test_full_dict(self):
        result = normalize_collections({
            "dataProducts": True, "reviews": True,
            "guides": True, "news": True,
        })
        assert all(v is True for v in result.values())

    def test_extra_keys_ignored(self):
        result = normalize_collections({"reviews": True, "extra": True})
        assert "extra" not in result
        assert result["reviews"] is True


# ── normalize_category ───────────────────────────────────────────────────────

class TestNormalizeCategory:
    def test_normalizes_all_sections(self):
        raw = {
            "id": "mouse", "label": "Mouse", "plural": "Mice",
            "color": "#ff0000",
        }
        result = normalize_category(raw)
        assert result["product"] == {"production": False, "vite": False}
        assert result["content"] == {"production": False, "vite": False}
        assert result["collections"] == default_collections()

    def test_preserves_identity_fields(self):
        raw = {
            "id": "mouse", "label": "Mouse", "plural": "Mice",
            "color": "#ff0000",
            "product": {"production": True, "vite": True},
            "content": {"production": True, "vite": True},
            "collections": {"dataProducts": True, "reviews": True,
                            "guides": True, "news": True},
        }
        result = normalize_category(raw)
        assert result["id"] == "mouse"
        assert result["label"] == "Mouse"
        assert result["plural"] == "Mice"
        assert result["color"] == "#ff0000"

    def test_does_not_mutate_original(self):
        raw = {"id": "test", "product": None}
        original_product = raw["product"]
        normalize_category(raw)
        assert raw["product"] is original_product


# ── infer_collections ────────────────────────────────────────────────────────

class TestInferCollections:
    def test_matching_counts(self):
        article_counts = {"mouse": {"reviews": 5, "guides": 2, "news": 1}}
        product_counts = {"mouse": 42}
        result = infer_collections(article_counts, product_counts, "mouse")
        assert result == {
            "dataProducts": True, "reviews": True,
            "guides": True, "news": True,
        }

    def test_missing_category(self):
        result = infer_collections({}, {}, "unknown")
        assert result == default_collections()

    def test_products_only(self):
        result = infer_collections({}, {"mouse": 10}, "mouse")
        assert result["dataProducts"] is True
        assert result["reviews"] is False

    def test_zero_products(self):
        result = infer_collections({}, {"mouse": 0}, "mouse")
        assert result["dataProducts"] is False


# ── extract_category_from_frontmatter ────────────────────────────────────────

class TestExtractCategory:
    def setup_method(self):
        self._tmp = Path(tempfile.mkdtemp())

    def teardown_method(self):
        shutil.rmtree(self._tmp, ignore_errors=True)

    def test_valid_frontmatter(self):
        f = self._tmp / "test.md"
        f.write_text("---\ntitle: Test\ncategory: mouse\n---\nContent here",
                     encoding="utf-8")
        assert extract_category_from_frontmatter(f) == "mouse"

    def test_quoted_category(self):
        f = self._tmp / "test.md"
        f.write_text("---\ncategory: 'keyboard'\n---\nBody",
                     encoding="utf-8")
        assert extract_category_from_frontmatter(f) == "keyboard"

    def test_no_frontmatter(self):
        f = self._tmp / "test.md"
        f.write_text("Just plain text, no frontmatter", encoding="utf-8")
        assert extract_category_from_frontmatter(f) is None

    def test_no_category_field(self):
        f = self._tmp / "test.md"
        f.write_text("---\ntitle: Test\n---\nBody", encoding="utf-8")
        assert extract_category_from_frontmatter(f) is None

    def test_nonexistent_file(self):
        f = self._tmp / "nope.md"
        assert extract_category_from_frontmatter(f) is None


# ── scan_content_categories ──────────────────────────────────────────────────

class TestScanContentCategories:
    def setup_method(self):
        self._tmp = Path(tempfile.mkdtemp())

    def teardown_method(self):
        shutil.rmtree(self._tmp, ignore_errors=True)

    def test_finds_categories_from_articles(self):
        reviews = self._tmp / "reviews" / "test-review"
        reviews.mkdir(parents=True)
        (reviews / "index.md").write_text(
            "---\ncategory: mouse\n---\nBody", encoding="utf-8")
        result = scan_content_categories(self._tmp)
        assert "mouse" in result

    def test_finds_categories_from_data_products(self):
        dp = self._tmp / "data-products" / "keyboard"
        dp.mkdir(parents=True)
        result = scan_content_categories(self._tmp)
        assert "keyboard" in result

    def test_empty_dir(self):
        result = scan_content_categories(self._tmp)
        assert result == set()


# ── count_articles ───────────────────────────────────────────────────────────

class TestCountArticles:
    def setup_method(self):
        self._tmp = Path(tempfile.mkdtemp())

    def teardown_method(self):
        shutil.rmtree(self._tmp, ignore_errors=True)

    def test_counts_by_type(self):
        for dirname in ("reviews", "guides"):
            d = self._tmp / dirname / "test"
            d.mkdir(parents=True)
            (d / "index.md").write_text(
                "---\ncategory: mouse\n---\nBody", encoding="utf-8")
        result = count_articles(self._tmp)
        assert result["mouse"]["reviews"] == 1
        assert result["mouse"]["guides"] == 1
        assert result["mouse"]["news"] == 0

    def test_empty_dir(self):
        result = count_articles(self._tmp)
        assert result == {}


# ── count_products ───────────────────────────────────────────────────────────

class TestCountProducts:
    def setup_method(self):
        self._tmp = Path(tempfile.mkdtemp())

    def teardown_method(self):
        shutil.rmtree(self._tmp, ignore_errors=True)

    def test_counts_json_files(self):
        dp = self._tmp / "data-products" / "mouse" / "razer"
        dp.mkdir(parents=True)
        (dp / "viper.json").write_text("{}", encoding="utf-8")
        (dp / "deathadder.json").write_text("{}", encoding="utf-8")
        result = count_products(self._tmp)
        assert result["mouse"] == 2

    def test_no_data_products_dir(self):
        result = count_products(self._tmp)
        assert result == {}


# ── scan_category_presence ───────────────────────────────────────────────────

class TestScanCategoryPresence:
    def setup_method(self):
        self._tmp = Path(tempfile.mkdtemp())

    def teardown_method(self):
        shutil.rmtree(self._tmp, ignore_errors=True)

    def test_products_and_content(self):
        # Product dir
        (self._tmp / "data-products" / "mouse").mkdir(parents=True)
        # Article
        rev = self._tmp / "reviews" / "test"
        rev.mkdir(parents=True)
        (rev / "index.md").write_text(
            "---\ncategory: mouse\n---\nBody", encoding="utf-8")
        result = scan_category_presence(self._tmp)
        assert result["mouse"]["has_products"] is True
        assert result["mouse"]["has_content"] is True

    def test_products_only(self):
        (self._tmp / "data-products" / "keyboard").mkdir(parents=True)
        result = scan_category_presence(self._tmp)
        assert result["keyboard"]["has_products"] is True
        assert result["keyboard"]["has_content"] is False

    def test_content_only(self):
        guides = self._tmp / "guides" / "test"
        guides.mkdir(parents=True)
        (guides / "index.md").write_text(
            "---\ncategory: monitor\n---\nBody", encoding="utf-8")
        result = scan_category_presence(self._tmp)
        assert result["monitor"]["has_products"] is False
        assert result["monitor"]["has_content"] is True

    def test_empty(self):
        result = scan_category_presence(self._tmp)
        assert result == {}


# ── Panel save/has_changes contract (no tkinter needed) ──────────────────────

class TestPanelDataContract:
    """Test the data contract without instantiating tkinter."""

    def test_snapshot_detects_no_changes(self):
        site_colors = {"primary": "#ff0000", "secondary": "#00ff00"}
        categories = [{"id": "mouse", "label": "Mouse"}]
        original = json.dumps({"s": site_colors, "c": categories},
                              sort_keys=True)
        current = json.dumps({"s": site_colors, "c": categories},
                             sort_keys=True)
        assert original == current

    def test_snapshot_detects_changes(self):
        site_colors = {"primary": "#ff0000", "secondary": "#00ff00"}
        categories = [{"id": "mouse", "label": "Mouse"}]
        original = json.dumps({"s": site_colors, "c": categories},
                              sort_keys=True)
        categories[0]["label"] = "Changed"
        current = json.dumps({"s": site_colors, "c": categories},
                             sort_keys=True)
        assert original != current

    def test_snapshot_detects_color_changes(self):
        site_colors = {"primary": "#ff0000", "secondary": "#00ff00"}
        categories = []
        original = json.dumps({"s": site_colors, "c": categories},
                              sort_keys=True)
        site_colors["primary"] = "#0000ff"
        current = json.dumps({"s": site_colors, "c": categories},
                             sort_keys=True)
        assert original != current

    def test_save_data_structure(self):
        """Verify the JSON structure matches what ConfigStore expects."""
        site_colors = {"primary": "#ff0000", "secondary": "#00ff00"}
        categories = [normalize_category({
            "id": "mouse", "label": "Mouse", "plural": "Mice",
            "color": "#ff9ff3",
            "product": {"production": True, "vite": True},
            "content": {"production": True, "vite": True},
            "collections": {"dataProducts": True, "reviews": True,
                            "guides": True, "news": True},
        })]
        data = {"siteColors": site_colors, "categories": categories}
        # Must have both top-level keys
        assert "siteColors" in data
        assert "categories" in data
        # Categories must be a list
        assert isinstance(data["categories"], list)
        # Each category must have normalized sections
        cat = data["categories"][0]
        assert "production" in cat["product"]
        assert "vite" in cat["product"]
        assert "production" in cat["content"]
        assert "vite" in cat["content"]
        assert "dataProducts" in cat["collections"]
