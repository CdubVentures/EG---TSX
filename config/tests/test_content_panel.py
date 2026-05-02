"""Tests for panels/content.py — data helpers + panel logic."""

import json
import sys
import tempfile
import shutil
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from panels.content import (
    COLLECTIONS,
    NUM_SLOTS,
    GRID_ROWS,
    COLL_COLORS,
    COLL_LABELS,
    COLL_SHORT,
    COLL_PRIORITY,
    FEED_ORDER,
    NOT_ON_PAGE,
    date_ts,
    production_order,
    fmt_date,
    pinned_then_date,
    simulate_dashboard,
    simulate_feeds,
    parse_frontmatter,
    entry_id,
    load_articles,
    build_config,
)


# ── Constants ────────────────────────────────────────────────────────────────

class TestConstants:
    def test_collections_has_five(self):
        assert len(COLLECTIONS) == 5
        assert set(COLLECTIONS) == {"reviews", "guides", "news", "brands", "games"}

    def test_num_slots(self):
        assert NUM_SLOTS == 15

    def test_grid_rows_total_slots(self):
        total = sum(len(slots) for _, slots, _ in GRID_ROWS)
        assert total == NUM_SLOTS

    def test_coll_colors_covers_all(self):
        for c in COLLECTIONS:
            assert c in COLL_COLORS

    def test_coll_labels_covers_all(self):
        for c in COLLECTIONS:
            assert c in COLL_LABELS

    def test_coll_short_covers_all(self):
        for c in COLLECTIONS:
            assert c in COLL_SHORT

    def test_coll_priority_covers_all(self):
        for c in COLLECTIONS:
            assert c in COLL_PRIORITY

    def test_not_on_page_large(self):
        assert NOT_ON_PAGE > NUM_SLOTS * 100


# ── date_ts ──────────────────────────────────────────────────────────────────

class TestDateTs:
    def test_empty_string(self):
        assert date_ts("") == 0.0

    def test_none(self):
        assert date_ts(None) == 0.0

    def test_valid_date(self):
        result = date_ts("2025-01-15")
        expected = datetime(2025, 1, 15).timestamp()
        assert result == expected

    def test_date_with_time(self):
        # Should parse only the first 10 chars
        result = date_ts("2025-01-15T10:30:00")
        expected = datetime(2025, 1, 15).timestamp()
        assert result == expected

    def test_invalid_format(self):
        assert date_ts("not-a-date") == 0.0

    def test_short_string(self):
        assert date_ts("abc") == 0.0


# ── fmt_date ─────────────────────────────────────────────────────────────────

class TestFmtDate:
    def test_published_only(self):
        art = {"date_published": "2025-03-15", "date_updated": ""}
        result = fmt_date(art)
        assert "03-15-25" in result
        assert result.endswith("p")

    def test_updated_newer(self):
        art = {"date_published": "2025-01-01", "date_updated": "2025-06-01"}
        result = fmt_date(art)
        assert "06-01-25" in result
        assert result.endswith("u")

    def test_published_newer(self):
        art = {"date_published": "2025-06-01", "date_updated": "2025-01-01"}
        result = fmt_date(art)
        assert "06-01-25" in result
        assert result.endswith("p")

    def test_no_dates(self):
        art = {"date_published": "", "date_updated": ""}
        assert fmt_date(art) == "\u2014"

    def test_missing_keys(self):
        art = {}
        assert fmt_date(art) == "\u2014"

    def test_equal_dates_uses_updated(self):
        art = {"date_published": "2025-03-15", "date_updated": "2025-03-15"}
        result = fmt_date(art)
        assert result.endswith("u")


# ── production_order ─────────────────────────────────────────────────────────

class TestProductionOrder:
    def test_sorts_by_collection_then_date(self):
        articles = [
            {"collection": "news", "date_published": "2025-01-01",
             "key": "news:a"},
            {"collection": "reviews", "date_published": "2025-01-01",
             "key": "rev:a"},
            {"collection": "guides", "date_published": "2025-01-01",
             "key": "guide:a"},
        ]
        result = production_order(articles)
        assert result[0]["collection"] == "reviews"
        assert result[1]["collection"] == "guides"
        assert result[2]["collection"] == "news"

    def test_within_collection_sorts_by_published_desc(self):
        articles = [
            {"collection": "reviews", "date_published": "2025-01-01",
             "key": "rev:a"},
            {"collection": "reviews", "date_published": "2025-06-01",
             "key": "rev:b"},
        ]
        result = production_order(articles)
        assert result[0]["key"] == "rev:b"
        assert result[1]["key"] == "rev:a"

    def test_empty_list(self):
        assert production_order([]) == []


# ── pinned_then_date ─────────────────────────────────────────────────────────

class TestPinnedThenDate:
    def test_pinned_first(self):
        articles = [
            {"key": "a", "sort_date": "2025-01-01"},
            {"key": "b", "sort_date": "2025-06-01"},
        ]
        result = pinned_then_date(articles, {"a"})
        assert result[0]["key"] == "a"

    def test_no_pinned(self):
        articles = [
            {"key": "a", "sort_date": "2025-01-01"},
            {"key": "b", "sort_date": "2025-06-01"},
        ]
        result = pinned_then_date(articles, set())
        assert result[0]["key"] == "b"  # newest first

    def test_multiple_pinned_sorted_by_date(self):
        articles = [
            {"key": "a", "sort_date": "2025-01-01"},
            {"key": "b", "sort_date": "2025-06-01"},
        ]
        result = pinned_then_date(articles, {"a", "b"})
        assert result[0]["key"] == "b"  # newer pin first
        assert result[1]["key"] == "a"

    def test_empty_list(self):
        assert pinned_then_date([], set()) == []


# ── simulate_dashboard ───────────────────────────────────────────────────────

class TestSimulateDashboard:
    def _make_article(self, key, collection="reviews", sort_date="2025-01-01",
                      date_published="2025-01-01", full_article=True,
                      draft=False, has_hero=True, excluded=False,
                      category_active=True, category="mouse"):
        return {
            "key": key,
            "collection": collection,
            "entry_id": key.split(":")[-1] if ":" in key else key,
            "title": f"Article {key}",
            "date_published": date_published,
            "date_updated": "",
            "sort_date": sort_date,
            "category": category,
            "has_hero": has_hero,
            "full_article": full_article,
            "draft": draft,
            "category_active": category_active,
        }

    def test_auto_fills_by_date(self):
        articles = [
            self._make_article("reviews:a", sort_date="2025-01-01"),
            self._make_article("reviews:b", sort_date="2025-06-01"),
        ]
        slots = simulate_dashboard(articles, {}, set())
        assert slots[0]["key"] == "reviews:b"  # newest first
        assert slots[1]["key"] == "reviews:a"

    def test_manual_overrides(self):
        articles = [
            self._make_article("reviews:a", sort_date="2025-01-01"),
            self._make_article("reviews:b", sort_date="2025-06-01"),
        ]
        manual = {1: "reviews:a"}
        slots = simulate_dashboard(articles, manual, set())
        assert slots[0]["key"] == "reviews:a"  # manual override in slot 1

    def test_excluded_not_placed(self):
        articles = [
            self._make_article("reviews:a", sort_date="2025-06-01"),
            self._make_article("reviews:b", sort_date="2025-01-01"),
        ]
        slots = simulate_dashboard(articles, {}, {"reviews:a"})
        filled = [s for s in slots if s is not None]
        assert all(s["key"] != "reviews:a" for s in filled)

    def test_returns_num_slots_length(self):
        slots = simulate_dashboard([], {}, set())
        assert len(slots) == NUM_SLOTS

    def test_drafts_excluded(self):
        articles = [
            self._make_article("reviews:a", draft=True),
        ]
        slots = simulate_dashboard(articles, {}, set())
        assert all(s is None for s in slots)

    def test_no_hero_excluded(self):
        articles = [
            self._make_article("reviews:a", has_hero=False),
        ]
        slots = simulate_dashboard(articles, {}, set())
        assert all(s is None for s in slots)

    def test_games_never_in_dashboard(self):
        articles = [
            self._make_article("games:a", collection="games",
                               sort_date="2025-12-01"),
        ]
        slots = simulate_dashboard(articles, {}, set())
        assert all(s is None for s in slots)

    def test_brands_never_in_dashboard(self):
        articles = [
            self._make_article("brands:a", collection="brands",
                               sort_date="2025-12-01"),
        ]
        slots = simulate_dashboard(articles, {}, set())
        assert all(s is None for s in slots)

    def test_inactive_category_excluded(self):
        articles = [
            self._make_article("reviews:a", category_active=False),
        ]
        slots = simulate_dashboard(articles, {}, set())
        assert all(s is None for s in slots)


# ── simulate_feeds ───────────────────────────────────────────────────────────

class TestSimulateFeeds:
    def _make_article(self, key, collection="reviews", sort_date="2025-01-01",
                      date_published="2025-01-01", full_article=True,
                      draft=False, has_hero=True, category_active=True,
                      category="mouse"):
        return {
            "key": key,
            "collection": collection,
            "entry_id": key.split(":")[-1] if ":" in key else key,
            "title": f"Article {key}",
            "date_published": date_published,
            "date_updated": "",
            "sort_date": sort_date,
            "category": category,
            "has_hero": has_hero,
            "full_article": full_article,
            "draft": draft,
            "category_active": category_active,
        }

    def test_dashboard_articles_get_dash_label(self):
        articles = [
            self._make_article("reviews:a", sort_date="2025-01-01"),
        ]
        simulated_slots = [articles[0]] + [None] * 14
        result = simulate_feeds(articles, simulated_slots, set())
        assert "Dash" in result["reviews:a"]["labels"]

    def test_news_feed_labels(self):
        articles = [
            self._make_article(f"news:{i}", collection="news",
                               date_published=f"2025-0{i+1}-01",
                               sort_date=f"2025-0{i+1}-01")
            for i in range(4)
        ]
        result = simulate_feeds(articles, [None] * 15, set())
        # Top 3 news get "News F"
        news_f_count = sum(
            1 for a in articles
            if a["key"] in result and "News F" in result[a["key"]]["labels"]
        )
        assert news_f_count == 3

    def test_games_get_games_label(self):
        articles = [
            self._make_article("games:a", collection="games",
                               sort_date="2025-01-01"),
        ]
        result = simulate_feeds(articles, [None] * 15, set())
        assert "Games" in result["games:a"]["labels"]

    def test_empty_inputs(self):
        result = simulate_feeds([], [None] * 15, set())
        assert result == {}

    def test_review_hero_label(self):
        articles = [
            self._make_article("reviews:a", sort_date="2025-06-01",
                               date_published="2025-06-01"),
            self._make_article("reviews:b", sort_date="2025-01-01",
                               date_published="2025-01-01"),
        ]
        result = simulate_feeds(articles, [None] * 15, set())
        assert "Rev H" in result["reviews:a"]["labels"]
        assert "Rev" in result["reviews:b"]["labels"]


# ── parse_frontmatter ────────────────────────────────────────────────────────

class TestParseFrontmatter:
    def setup_method(self):
        self._tmp = Path(tempfile.mkdtemp())

    def teardown_method(self):
        shutil.rmtree(self._tmp, ignore_errors=True)

    def test_valid_frontmatter(self):
        f = self._tmp / "test.md"
        f.write_text("---\ntitle: Hello World\ncategory: mouse\n---\nBody",
                     encoding="utf-8")
        result = parse_frontmatter(f)
        assert result["title"] == "Hello World"
        assert result["category"] == "mouse"

    def test_no_frontmatter(self):
        f = self._tmp / "test.md"
        f.write_text("Just plain text", encoding="utf-8")
        assert parse_frontmatter(f) == {}

    def test_nonexistent_file(self):
        f = self._tmp / "nope.md"
        assert parse_frontmatter(f) == {}

    def test_empty_frontmatter(self):
        f = self._tmp / "test.md"
        f.write_text("---\n---\nBody", encoding="utf-8")
        assert parse_frontmatter(f) == {}


# ── entry_id ─────────────────────────────────────────────────────────────────

class TestEntryId:
    def test_slug_folder(self):
        content_dir = Path("/content/reviews")
        filepath = Path("/content/reviews/my-review/index.md")
        assert entry_id(filepath, content_dir) == "my-review"

    def test_nested_slug_folder(self):
        content_dir = Path("/content/reviews")
        filepath = Path("/content/reviews/mouse/my-review/index.md")
        assert entry_id(filepath, content_dir) == "mouse/my-review"

    def test_flat_file(self):
        content_dir = Path("/content/reviews")
        filepath = Path("/content/reviews/my-review.md")
        assert entry_id(filepath, content_dir) == "my-review"

    def test_index_only(self):
        content_dir = Path("/content/reviews")
        filepath = Path("/content/reviews/index.md")
        assert entry_id(filepath, content_dir) == ""


# ── load_articles ────────────────────────────────────────────────────────────

class TestLoadArticles:
    def setup_method(self):
        self._tmp = Path(tempfile.mkdtemp())
        self._images = self._tmp / "public" / "images"
        self._images.mkdir(parents=True)

    def teardown_method(self):
        shutil.rmtree(self._tmp, ignore_errors=True)

    def test_loads_from_collections(self):
        reviews = self._tmp / "reviews" / "my-review"
        reviews.mkdir(parents=True)
        (reviews / "index.md").write_text(
            "---\ntitle: My Review\ncategory: mouse\n"
            "datePublished: 2025-01-15\n---\nBody",
            encoding="utf-8")
        result = load_articles(self._tmp, self._images, set())
        assert len(result) == 1
        assert result[0]["key"] == "reviews:my-review"
        assert result[0]["collection"] == "reviews"
        assert result[0]["title"] == "My Review"

    def test_empty_dir(self):
        result = load_articles(self._tmp, self._images, set())
        assert result == []

    def test_skips_non_md_files(self):
        reviews = self._tmp / "reviews"
        reviews.mkdir(parents=True)
        (reviews / "readme.txt").write_text("Not markdown", encoding="utf-8")
        result = load_articles(self._tmp, self._images, set())
        assert result == []

    def test_has_hero_from_image_dir(self):
        reviews = self._tmp / "reviews" / "my-review"
        reviews.mkdir(parents=True)
        (reviews / "index.md").write_text(
            "---\ntitle: My Review\ncategory: mouse\n---\nBody",
            encoding="utf-8")
        # Create image directory
        (self._images / "reviews" / "my-review").mkdir(parents=True)
        result = load_articles(self._tmp, self._images, set())
        assert result[0]["has_hero"] is True

    def test_has_hero_from_frontmatter(self):
        reviews = self._tmp / "reviews" / "my-review"
        reviews.mkdir(parents=True)
        (reviews / "index.md").write_text(
            "---\ntitle: My Review\ncategory: mouse\nhero: cover\n---\nBody",
            encoding="utf-8")
        result = load_articles(self._tmp, self._images, set())
        assert result[0]["has_hero"] is True


# ── build_config ─────────────────────────────────────────────────────────────

class TestBuildConfig:
    def test_structure(self):
        article_map = {
            "reviews:my-review": {
                "key": "reviews:my-review",
                "collection": "reviews",
                "entry_id": "my-review",
            },
        }
        manual_slots = {1: "reviews:my-review"}
        pinned = {"reviews:my-review"}
        badges = {"reviews:my-review": "Top Pick"}
        excluded = set()
        result = build_config(article_map, manual_slots, pinned, badges,
                              excluded)
        assert "slots" in result
        assert "pinned" in result
        assert "badges" in result
        assert "excluded" in result

    def test_slot_format(self):
        article_map = {
            "reviews:my-review": {
                "key": "reviews:my-review",
                "collection": "reviews",
                "entry_id": "my-review",
            },
        }
        result = build_config(article_map, {1: "reviews:my-review"}, set(),
                              {}, set())
        slot = result["slots"]["1"]
        assert slot["collection"] == "reviews"
        assert slot["id"] == "my-review"

    def test_pinned_sorted(self):
        result = build_config({}, {}, {"b", "a", "c"}, {}, set())
        assert result["pinned"] == ["a", "b", "c"]

    def test_excluded_sorted(self):
        result = build_config({}, {}, set(), {}, {"z", "a"})
        assert result["excluded"] == ["a", "z"]

    def test_empty_state(self):
        result = build_config({}, {}, set(), {}, set())
        assert result == {
            "slots": {},
            "pinned": [],
            "badges": {},
            "excluded": [],
        }


# ── Panel data contract (no tkinter) ────────────────────────────────────────

class TestPanelDataContract:
    def test_snapshot_no_changes(self):
        config = {"slots": {}, "pinned": [], "badges": {}, "excluded": []}
        original = json.dumps(config, sort_keys=True)
        current = json.dumps(config, sort_keys=True)
        assert original == current

    def test_snapshot_detects_pinned_change(self):
        config_a = {"slots": {}, "pinned": [], "badges": {}, "excluded": []}
        config_b = {"slots": {}, "pinned": ["a"], "badges": {}, "excluded": []}
        assert json.dumps(config_a, sort_keys=True) != json.dumps(
            config_b, sort_keys=True)

    def test_snapshot_detects_slot_change(self):
        config_a = {"slots": {}, "pinned": [], "badges": {}, "excluded": []}
        config_b = {"slots": {"1": {"collection": "reviews", "id": "test"}},
                    "pinned": [], "badges": {}, "excluded": []}
        assert json.dumps(config_a, sort_keys=True) != json.dumps(
            config_b, sort_keys=True)

    def test_snapshot_detects_badge_change(self):
        config_a = {"slots": {}, "pinned": [], "badges": {}, "excluded": []}
        config_b = {"slots": {}, "pinned": [],
                    "badges": {"a": "Top Pick"}, "excluded": []}
        assert json.dumps(config_a, sort_keys=True) != json.dumps(
            config_b, sort_keys=True)
