"""Tests for panels/navbar.py — pure functions + panel data contract."""
import json
import tempfile
import textwrap
import unittest
from pathlib import Path


class TestEntrySlug(unittest.TestCase):
    """Test entry_slug() slug derivation."""

    def test_slug_folder(self):
        from panels.navbar import entry_slug
        base = Path("/content/guides")
        fp = base / "mouse-guide" / "index.md"
        self.assertEqual(entry_slug(fp, base), "mouse-guide")

    def test_flat_file(self):
        from panels.navbar import entry_slug
        base = Path("/content/guides")
        fp = base / "mouse-guide.md"
        self.assertEqual(entry_slug(fp, base), "mouse-guide")

    def test_nested(self):
        from panels.navbar import entry_slug
        base = Path("/content/guides")
        fp = base / "mouse" / "my-guide" / "index.md"
        self.assertEqual(entry_slug(fp, base), "mouse/my-guide")

    def test_root_index(self):
        from panels.navbar import entry_slug
        base = Path("/content/guides")
        fp = base / "index.md"
        self.assertEqual(entry_slug(fp, base), "")

    def test_mdx_extension(self):
        from panels.navbar import entry_slug
        base = Path("/content/guides")
        fp = base / "mouse-guide" / "index.mdx"
        self.assertEqual(entry_slug(fp, base), "mouse-guide")


class TestListContentFiles(unittest.TestCase):
    """Test list_content_files() file scanning."""

    def test_valid_dir(self):
        from panels.navbar import list_content_files
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "a.md").write_text("---\ntitle: A\n---\n", encoding="utf-8")
            (d / "b.mdx").write_text("---\ntitle: B\n---\n", encoding="utf-8")
            result = list_content_files(d)
            self.assertEqual(len(result), 2)
            self.assertTrue(all(isinstance(p, Path) for p in result))

    def test_nonexistent_dir(self):
        from panels.navbar import list_content_files
        result = list_content_files(Path("/nonexistent/dir"))
        self.assertEqual(result, [])

    def test_filters_non_md(self):
        from panels.navbar import list_content_files
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "a.md").write_text("x", encoding="utf-8")
            (d / "b.txt").write_text("x", encoding="utf-8")
            (d / "c.json").write_text("{}", encoding="utf-8")
            result = list_content_files(d)
            self.assertEqual(len(result), 1)

    def test_sorted_output(self):
        from panels.navbar import list_content_files
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "z.md").write_text("x", encoding="utf-8")
            (d / "a.md").write_text("x", encoding="utf-8")
            result = list_content_files(d)
            names = [p.name for p in result]
            self.assertEqual(names, ["a.md", "z.md"])


class TestReadFrontmatter(unittest.TestCase):
    """Test read_frontmatter() YAML parsing."""

    def test_valid(self):
        from panels.navbar import read_frontmatter
        with tempfile.NamedTemporaryFile(suffix=".md", mode="w",
                                         delete=False, encoding="utf-8") as f:
            f.write("---\ntitle: Test\ncategory: mouse\n---\nBody text")
            f.flush()
            fm, text = read_frontmatter(Path(f.name))
            self.assertEqual(fm["title"], "Test")
            self.assertEqual(fm["category"], "mouse")
            self.assertIn("Body text", text)

    def test_no_frontmatter(self):
        from panels.navbar import read_frontmatter
        with tempfile.NamedTemporaryFile(suffix=".md", mode="w",
                                         delete=False, encoding="utf-8") as f:
            f.write("Just plain text")
            f.flush()
            fm, text = read_frontmatter(Path(f.name))
            self.assertEqual(fm, {})

    def test_empty_frontmatter(self):
        from panels.navbar import read_frontmatter
        with tempfile.NamedTemporaryFile(suffix=".md", mode="w",
                                         delete=False, encoding="utf-8") as f:
            f.write("---\n---\nBody")
            f.flush()
            fm, text = read_frontmatter(Path(f.name))
            self.assertEqual(fm, {})


class TestWriteNavbarField(unittest.TestCase):
    """Test write_navbar_field() frontmatter mutation."""

    def _make_file(self, content):
        f = tempfile.NamedTemporaryFile(suffix=".md", mode="w",
                                        delete=False, encoding="utf-8")
        f.write(content)
        f.flush()
        f.close()
        return Path(f.name)

    def test_bool_true(self):
        from panels.navbar import write_navbar_field
        p = self._make_file("---\ntitle: Test\n---\nBody")
        write_navbar_field(p, True)
        text = p.read_text(encoding="utf-8")
        self.assertIn("navbar: true", text)

    def test_bool_false(self):
        from panels.navbar import write_navbar_field
        p = self._make_file("---\ntitle: Test\n---\nBody")
        write_navbar_field(p, False)
        text = p.read_text(encoding="utf-8")
        self.assertIn("navbar: false", text)

    def test_list(self):
        from panels.navbar import write_navbar_field
        p = self._make_file("---\ntitle: Test\n---\nBody")
        write_navbar_field(p, ["Buying Guides"])
        text = p.read_text(encoding="utf-8")
        self.assertIn("navbar:", text)
        self.assertIn("  - Buying Guides", text)

    def test_empty_list(self):
        from panels.navbar import write_navbar_field
        p = self._make_file("---\ntitle: Test\n---\nBody")
        write_navbar_field(p, [])
        text = p.read_text(encoding="utf-8")
        self.assertIn("navbar: []", text)

    def test_replaces_existing(self):
        from panels.navbar import write_navbar_field
        p = self._make_file("---\ntitle: Test\nnavbar: true\n---\nBody")
        write_navbar_field(p, False)
        text = p.read_text(encoding="utf-8")
        self.assertIn("navbar: false", text)
        self.assertEqual(text.count("navbar"), 1)

    def test_replaces_existing_list(self):
        from panels.navbar import write_navbar_field
        p = self._make_file("---\ntitle: Test\nnavbar:\n  - Old Section\n---\nBody")
        write_navbar_field(p, ["New Section"])
        text = p.read_text(encoding="utf-8")
        self.assertNotIn("Old Section", text)
        self.assertIn("  - New Section", text)

    def test_no_frontmatter_noop(self):
        from panels.navbar import write_navbar_field
        p = self._make_file("Just text")
        write_navbar_field(p, True)
        text = p.read_text(encoding="utf-8")
        self.assertEqual(text, "Just text")


class TestWriteField(unittest.TestCase):
    """Test write_field() scalar frontmatter mutation."""

    def _make_file(self, content):
        f = tempfile.NamedTemporaryFile(suffix=".md", mode="w",
                                        delete=False, encoding="utf-8")
        f.write(content)
        f.flush()
        f.close()
        return Path(f.name)

    def test_update_existing(self):
        from panels.navbar import write_field
        p = self._make_file("---\ntitle: Old\n---\nBody")
        write_field(p, "title", "New")
        text = p.read_text(encoding="utf-8")
        self.assertIn("title: New", text)
        self.assertNotIn("Old", text)

    def test_insert_new(self):
        from panels.navbar import write_field
        p = self._make_file("---\ntitle: Test\n---\nBody")
        write_field(p, "guide", "My Guide")
        text = p.read_text(encoding="utf-8")
        self.assertIn("guide: My Guide", text)

    def test_special_chars_quoted(self):
        from panels.navbar import write_field
        p = self._make_file("---\ntitle: Test\n---\nBody")
        write_field(p, "title", "Test: With Colon")
        text = p.read_text(encoding="utf-8")
        self.assertIn('"Test: With Colon"', text)

    def test_no_frontmatter_noop(self):
        from panels.navbar import write_field
        p = self._make_file("Just text")
        write_field(p, "title", "New")
        text = p.read_text(encoding="utf-8")
        self.assertEqual(text, "Just text")


class TestLoadGuides(unittest.TestCase):
    """Test load_guides() scanning."""

    def test_loads_guides(self):
        from panels.navbar import load_guides
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp) / "guides"
            d.mkdir()
            slug_dir = d / "best-mouse"
            slug_dir.mkdir()
            (slug_dir / "index.md").write_text(
                "---\ntitle: Best Mouse\ncategory: mouse\n"
                "guide: Best Mouse Guide\nnavbar:\n  - Buying Guides\n---\n",
                encoding="utf-8")
            result = load_guides(d)
            self.assertEqual(len(result), 1)
            g = result[0]
            self.assertEqual(g["filename"], "best-mouse")
            self.assertEqual(g["category"], "mouse")
            self.assertEqual(g["guide"], "Best Mouse Guide")
            self.assertEqual(g["navbar"], ["Buying Guides"])

    def test_empty_dir(self):
        from panels.navbar import load_guides
        result = load_guides(Path("/nonexistent"))
        self.assertEqual(result, [])

    def test_no_navbar_defaults_empty_list(self):
        from panels.navbar import load_guides
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp) / "guides"
            d.mkdir()
            (d / "test.md").write_text(
                "---\ntitle: Test\ncategory: mouse\n---\n",
                encoding="utf-8")
            result = load_guides(d)
            self.assertEqual(result[0]["navbar"], [])


class TestLoadBrands(unittest.TestCase):
    """Test load_brands() scanning."""

    def test_loads_brands(self):
        from panels.navbar import load_brands
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp) / "brands"
            d.mkdir()
            slug_dir = d / "razer"
            slug_dir.mkdir()
            (slug_dir / "index.md").write_text(
                "---\nbrand: razer\ndisplayName: Razer\nnavbar:\n  - mouse\n---\n",
                encoding="utf-8")
            result = load_brands(d)
            self.assertEqual(len(result), 1)
            b = result[0]
            self.assertEqual(b["filename"], "razer")
            self.assertEqual(b["brand"], "razer")
            self.assertEqual(b["displayName"], "Razer")
            self.assertEqual(b["navbar"], ["mouse"])

    def test_empty_dir(self):
        from panels.navbar import load_brands
        result = load_brands(Path("/nonexistent"))
        self.assertEqual(result, [])


class TestLoadGames(unittest.TestCase):
    """Test load_games() scanning."""

    def test_loads_games(self):
        from panels.navbar import load_games
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp) / "games"
            d.mkdir()
            slug_dir = d / "apex-legends"
            slug_dir.mkdir()
            (slug_dir / "index.md").write_text(
                "---\ntitle: Apex Legends\ngame: Apex Legends\nnavbar: true\n---\n",
                encoding="utf-8")
            result = load_games(d)
            self.assertEqual(len(result), 1)
            g = result[0]
            self.assertEqual(g["filename"], "apex-legends")
            self.assertEqual(g["game"], "Apex Legends")
            self.assertTrue(g["navbar"])

    def test_empty_dir(self):
        from panels.navbar import load_games
        result = load_games(Path("/nonexistent"))
        self.assertEqual(result, [])

    def test_navbar_false(self):
        from panels.navbar import load_games
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp) / "games"
            d.mkdir()
            (d / "test.md").write_text(
                "---\ntitle: Test\ngame: Test\nnavbar: false\n---\n",
                encoding="utf-8")
            result = load_games(d)
            self.assertFalse(result[0]["navbar"])


class TestPanelDataContract(unittest.TestCase):
    """Test dirty tracking logic without tkinter."""

    def test_no_changes(self):
        pending = {}
        pending_fields = {}
        section_order = {"mouse": ["Buying Guides"]}
        original_sections = {"mouse": ["Buying Guides"]}
        has = bool(pending) or bool(pending_fields) or section_order != original_sections
        self.assertFalse(has)

    def test_navbar_change_detected(self):
        pending = {"/path/to/file.md": {"navbar": True, "type": "bool"}}
        has = bool(pending)
        self.assertTrue(has)

    def test_field_change_detected(self):
        pending_fields = {"/path/to/file.md": {"title": "New"}}
        has = bool(pending_fields)
        self.assertTrue(has)

    def test_section_order_change_detected(self):
        section_order = {"mouse": ["Buying Guides", "Settings"]}
        original_sections = {"mouse": ["Buying Guides"]}
        has = section_order != original_sections
        self.assertTrue(has)

    def test_section_order_same(self):
        section_order = {"mouse": ["Buying Guides"]}
        original_sections = {"mouse": ["Buying Guides"]}
        has = section_order != original_sections
        self.assertFalse(has)


if __name__ == "__main__":
    unittest.main()
