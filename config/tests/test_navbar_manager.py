"""
test_navbar_manager.py

Tests for the pure functions extracted from navbar-manager.py.
Focuses on slug derivation from slug-folder and flat file layouts.
"""

import sys
import unittest
from pathlib import Path

# Add config/ to path so we can import the module (hyphenated filename)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import importlib
_nm = importlib.import_module("navbar-manager")
entry_slug = _nm.entry_slug
list_content_files = _nm.list_content_files


# ── Tests ────────────────────────────────────────────────────────────────────

class TestEntrySlug(unittest.TestCase):
    """entry_slug: derive slug from content file path."""

    # ── Slug-folder layout (post-migration) ──────────────────────────────

    def test_slug_folder_simple(self):
        """games/apex-legends/index.md → apex-legends"""
        fp = Path("src/content/games/apex-legends/index.md")
        base = Path("src/content/games")
        self.assertEqual(entry_slug(fp, base), "apex-legends")

    def test_slug_folder_with_category_subdir(self):
        """guides/mouse/mouse-best-budget/index.md → mouse/mouse-best-budget"""
        fp = Path("src/content/guides/mouse/mouse-best-budget/index.md")
        base = Path("src/content/guides")
        self.assertEqual(entry_slug(fp, base), "mouse/mouse-best-budget")

    def test_slug_folder_mdx(self):
        """brands/razer/index.mdx → razer"""
        fp = Path("src/content/brands/razer/index.mdx")
        base = Path("src/content/brands")
        self.assertEqual(entry_slug(fp, base), "razer")

    def test_slug_folder_deep_subdir(self):
        """reviews/mouse/alienware-aw610m-review/index.md → mouse/alienware-aw610m-review"""
        fp = Path("src/content/reviews/mouse/alienware-aw610m-review/index.md")
        base = Path("src/content/reviews")
        self.assertEqual(entry_slug(fp, base), "mouse/alienware-aw610m-review")

    def test_slug_folder_news_with_category(self):
        """news/hardware/ces-2026/index.md → hardware/ces-2026"""
        fp = Path("src/content/news/hardware/ces-2026/index.md")
        base = Path("src/content/news")
        self.assertEqual(entry_slug(fp, base), "hardware/ces-2026")

    # ── Flat layout (legacy, backward-compat) ────────────────────────────

    def test_flat_simple(self):
        """games/apex-legends.md → apex-legends"""
        fp = Path("src/content/games/apex-legends.md")
        base = Path("src/content/games")
        self.assertEqual(entry_slug(fp, base), "apex-legends")

    def test_flat_with_category_subdir(self):
        """guides/mouse/mouse-best-budget.md → mouse/mouse-best-budget"""
        fp = Path("src/content/guides/mouse/mouse-best-budget.md")
        base = Path("src/content/guides")
        self.assertEqual(entry_slug(fp, base), "mouse/mouse-best-budget")

    def test_flat_mdx(self):
        """brands/razer.mdx → razer"""
        fp = Path("src/content/brands/razer.mdx")
        base = Path("src/content/brands")
        self.assertEqual(entry_slug(fp, base), "razer")

    # ── Edge cases ───────────────────────────────────────────────────────

    def test_index_at_root_returns_empty(self):
        """index.md at collection root → empty string"""
        fp = Path("src/content/games/index.md")
        base = Path("src/content/games")
        self.assertEqual(entry_slug(fp, base), "")

    def test_slug_never_contains_backslash(self):
        """Slug should always use forward slashes, even on Windows."""
        fp = Path("src/content/guides/mouse/mouse-best-budget/index.md")
        base = Path("src/content/guides")
        result = entry_slug(fp, base)
        self.assertNotIn("\\", result)


class TestListContentFiles(unittest.TestCase):
    """list_content_files: find .md and .mdx files recursively."""

    def test_returns_empty_for_nonexistent_dir(self):
        result = list_content_files(Path("/nonexistent/path"))
        self.assertEqual(result, [])

    def test_finds_md_files(self):
        """Should find .md files in real content directory."""
        d = Path(__file__).resolve().parent.parent.parent / "src" / "content" / "games"
        if not d.is_dir():
            self.skipTest("games content directory not found")
        files = list_content_files(d)
        self.assertGreater(len(files), 0)
        for f in files:
            self.assertIn(f.suffix, (".md", ".mdx"))

    def test_finds_index_md_in_slug_folders(self):
        """After slug-folder migration, files should be index.md inside folders."""
        d = Path(__file__).resolve().parent.parent.parent / "src" / "content" / "games"
        if not d.is_dir():
            self.skipTest("games content directory not found")
        files = list_content_files(d)
        # All files should be named index.md or index.mdx (post-migration)
        for f in files:
            self.assertIn(f.stem, ("index",),
                          f"Expected index.md/mdx but found {f.name}")


class TestEntrySlugIntegration(unittest.TestCase):
    """Integration: entry_slug produces correct slugs from real content files."""

    def test_all_games_have_meaningful_slugs(self):
        d = Path(__file__).resolve().parent.parent.parent / "src" / "content" / "games"
        if not d.is_dir():
            self.skipTest("games content directory not found")
        files = list_content_files(d)
        for f in files:
            slug = entry_slug(f, d)
            self.assertTrue(slug, f"Empty slug for {f}")
            self.assertNotEqual(slug, "index", f"Slug is 'index' for {f}")

    def test_all_brands_have_meaningful_slugs(self):
        d = Path(__file__).resolve().parent.parent.parent / "src" / "content" / "brands"
        if not d.is_dir():
            self.skipTest("brands content directory not found")
        files = list_content_files(d)
        for f in files:
            slug = entry_slug(f, d)
            self.assertTrue(slug, f"Empty slug for {f}")
            self.assertNotEqual(slug, "index", f"Slug is 'index' for {f}")

    def test_all_guides_have_meaningful_slugs(self):
        d = Path(__file__).resolve().parent.parent.parent / "src" / "content" / "guides"
        if not d.is_dir():
            self.skipTest("guides content directory not found")
        files = list_content_files(d)
        for f in files:
            slug = entry_slug(f, d)
            self.assertTrue(slug, f"Empty slug for {f}")
            self.assertNotEqual(slug, "index", f"Slug is 'index' for {f}")


class TestLoadFunctions(unittest.TestCase):
    """Integration: load_guides/brands/games return correct data post-migration."""

    def test_load_guides_no_index_filenames(self):
        """No guide should have filename='index' after slug-folder fix."""
        guides = _nm.load_guides()
        if not guides:
            self.skipTest("No guides loaded")
        for g in guides:
            self.assertNotEqual(g["filename"], "index",
                                f"Guide {g['path']} has filename='index'")
            self.assertTrue(g["filename"], f"Guide {g['path']} has empty filename")

    def test_load_guides_count(self):
        """Should find all 33 guides (across categories)."""
        guides = _nm.load_guides()
        self.assertGreaterEqual(len(guides), 30,
                                f"Expected ~33 guides, found {len(guides)}")

    def test_load_brands_no_index_filenames(self):
        """No brand should have filename='index' after slug-folder fix."""
        brands = _nm.load_brands()
        if not brands:
            self.skipTest("No brands loaded")
        for b in brands:
            self.assertNotEqual(b["filename"], "index",
                                f"Brand {b['path']} has filename='index'")
            self.assertTrue(b["brand"], f"Brand {b['path']} has empty brand name")
            self.assertNotEqual(b["brand"], "index",
                                f"Brand {b['path']} has brand='index'")

    def test_load_brands_count(self):
        """Should find all 30 brands."""
        brands = _nm.load_brands()
        self.assertGreaterEqual(len(brands), 28,
                                f"Expected ~30 brands, found {len(brands)}")

    def test_load_games_no_index_filenames(self):
        """No game should have filename='index' after slug-folder fix."""
        games = _nm.load_games()
        if not games:
            self.skipTest("No games loaded")
        for g in games:
            self.assertNotEqual(g["filename"], "index",
                                f"Game {g['path']} has filename='index'")
            self.assertTrue(g["game"], f"Game {g['path']} has empty game name")
            self.assertNotEqual(g["game"], "index",
                                f"Game {g['path']} has game='index'")

    def test_load_games_count(self):
        """Should find all 11 games."""
        games = _nm.load_games()
        self.assertGreaterEqual(len(games), 10,
                                f"Expected ~11 games, found {len(games)}")

    def test_guide_slugs_match_folder_names(self):
        """Guide filename (slug) should match the slug-folder name."""
        guides = _nm.load_guides()
        for g in guides:
            path = g["path"]
            # For slug-folder: path = .../mouse/mouse-best-budget/index.md
            # filename should be mouse/mouse-best-budget
            if path.stem == "index":
                expected_slug_end = path.parent.name
                self.assertTrue(g["filename"].endswith(expected_slug_end),
                                f"Slug '{g['filename']}' doesn't end with folder '{expected_slug_end}'")


if __name__ == "__main__":
    unittest.main()
