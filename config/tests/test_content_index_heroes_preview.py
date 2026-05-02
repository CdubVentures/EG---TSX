"""Tests for Content→Index Heroes live preview propagation.

Bug: get_index_heroes_payload() reads pinned/badges/excluded from disk
(ConfigStore.CONTENT) instead of checking _content_preview first.
When Content panel previews changes, Index Heroes re-fetch gets stale data.

Fix: check _content_preview before falling back to store, same pattern
as _current_content_state().
"""

import json
import shutil
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "app"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from runtime import ConfigRuntime


def _make_test_root(tmp: Path) -> Path:
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
                "collections": {
                    "dataProducts": True,
                    "reviews": True,
                    "guides": True,
                    "news": True,
                },
            }
        ],
    }
    (data_dir / "categories.json").write_text(
        json.dumps(categories, indent=2), encoding="utf-8"
    )

    content = {"slots": {}, "pinned": [], "badges": {}, "excluded": []}
    (data_dir / "content.json").write_text(
        json.dumps(content, indent=2), encoding="utf-8"
    )

    for name in [
        "slideshow.json",
        "hub-tools.json",
        "navbar-guide-sections.json",
        "image-defaults.json",
        "ads-registry.json",
        "inline-ads-config.json",
        "cache-cdn.json",
        "direct-sponsors.json",
    ]:
        (data_dir / name).write_text("{}", encoding="utf-8")

    (tmp / "src" / "content").mkdir(parents=True)
    (tmp / "public" / "images" / "navbar").mkdir(parents=True)
    return tmp


def _add_review_article(root: Path, slug: str, *, title: str = "",
                        category: str = "mouse", hero: str = "hero-img",
                        draft: bool = False, publish: bool = True) -> str:
    """Create a review article that is eligible for index heroes. Returns the key."""
    article_dir = root / "src" / "content" / "reviews" / slug
    article_dir.mkdir(parents=True, exist_ok=True)
    title = title or slug.replace("-", " ").title()
    fm_lines = [
        "---",
        f"title: {title}",
        f"category: {category}",
        f"datePublished: '2025-06-01'",
    ]
    if hero:
        fm_lines.append(f"hero: {hero}")
    if draft:
        fm_lines.append("draft: true")
    if not publish:
        fm_lines.append("publish: false")
    fm_lines.append("---")
    fm_lines.append("Body text.")
    (article_dir / "index.md").write_text(
        "\n".join(fm_lines), encoding="utf-8"
    )
    return f"reviews:{slug}"


class TestContentIndexHeroesPreview:
    """Content preview state must propagate to Index Heroes payload."""

    def test_excluded_article_absent_from_heroes_pool_during_preview(self):
        tmp = Path(tempfile.mkdtemp())
        try:
            root = _make_test_root(tmp)
            key_a = _add_review_article(root, "alpha-mouse", title="Alpha Mouse")
            key_b = _add_review_article(root, "beta-mouse", title="Beta Mouse")

            runtime = ConfigRuntime(root)

            # Preview: exclude alpha
            runtime.preview_content({
                "manualSlots": {},
                "pinned": [],
                "badges": {},
                "excluded": [key_a],
            })

            payload = runtime.get_index_heroes_payload()

            # Alpha should NOT appear in the reviews pool
            pool_keys = {item["key"] for item in payload["pools"].get("reviews", [])}
            assert key_a not in pool_keys, (
                f"Excluded article {key_a} should not appear in heroes pool during preview"
            )
            # Beta should still be there
            assert key_b in pool_keys
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_pinned_flag_propagates_to_heroes_during_preview(self):
        tmp = Path(tempfile.mkdtemp())
        try:
            root = _make_test_root(tmp)
            key_a = _add_review_article(root, "alpha-mouse", title="Alpha Mouse")

            runtime = ConfigRuntime(root)

            # Preview: pin alpha
            runtime.preview_content({
                "manualSlots": {},
                "pinned": [key_a],
                "badges": {},
                "excluded": [],
            })

            payload = runtime.get_index_heroes_payload()

            # Find alpha in pool or slots — it should have isPinned=true
            all_items = payload["pools"].get("reviews", [])
            slots = payload["slots"].get("reviews", [])
            all_items.extend(item for item in slots if item is not None)
            alpha_items = [item for item in all_items if item["key"] == key_a]
            assert len(alpha_items) > 0, f"Article {key_a} should appear in heroes"
            assert alpha_items[0]["isPinned"] is True, (
                f"Article {key_a} should be pinned during preview"
            )
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_badge_propagates_to_heroes_during_preview(self):
        tmp = Path(tempfile.mkdtemp())
        try:
            root = _make_test_root(tmp)
            key_a = _add_review_article(root, "alpha-mouse", title="Alpha Mouse")

            runtime = ConfigRuntime(root)

            # Preview: badge alpha
            runtime.preview_content({
                "manualSlots": {},
                "pinned": [],
                "badges": {key_a: "Editor's Choice"},
                "excluded": [],
            })

            payload = runtime.get_index_heroes_payload()

            all_items = payload["pools"].get("reviews", [])
            slots = payload["slots"].get("reviews", [])
            all_items.extend(item for item in slots if item is not None)
            alpha_items = [item for item in all_items if item["key"] == key_a]
            assert len(alpha_items) > 0, f"Article {key_a} should appear in heroes"
            assert alpha_items[0]["badge"] == "Editor's Choice", (
                f"Article {key_a} should have badge during preview"
            )
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_save_clears_preview_and_heroes_reads_store(self):
        tmp = Path(tempfile.mkdtemp())
        try:
            root = _make_test_root(tmp)
            key_a = _add_review_article(root, "alpha-mouse", title="Alpha Mouse")
            key_b = _add_review_article(root, "beta-mouse", title="Beta Mouse")

            runtime = ConfigRuntime(root)

            # Preview: exclude alpha
            runtime.preview_content({
                "manualSlots": {},
                "pinned": [],
                "badges": {},
                "excluded": [key_a],
            })

            # Save: exclude beta (different from preview)
            runtime.save_content({
                "manualSlots": {},
                "pinned": [],
                "badges": {},
                "excluded": [key_b],
            })

            # After save, preview is cleared — heroes should use disk state
            payload = runtime.get_index_heroes_payload()
            pool_keys = {item["key"] for item in payload["pools"].get("reviews", [])}
            # Alpha should be back (no longer excluded)
            assert key_a in pool_keys, (
                f"After save, {key_a} should be in pool (not excluded on disk)"
            )
            # Beta should be excluded (saved to disk)
            assert key_b not in pool_keys, (
                f"After save, {key_b} should be excluded (saved to disk)"
            )
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_no_preview_reads_from_store(self):
        tmp = Path(tempfile.mkdtemp())
        try:
            root = _make_test_root(tmp)
            key_a = _add_review_article(root, "alpha-mouse", title="Alpha Mouse")
            key_b = _add_review_article(root, "beta-mouse", title="Beta Mouse")

            # Write disk content with alpha excluded
            data_dir = root / "config" / "data"
            content = {
                "slots": {},
                "pinned": [],
                "badges": {},
                "excluded": [key_a],
            }
            (data_dir / "content.json").write_text(
                json.dumps(content, indent=2), encoding="utf-8"
            )

            runtime = ConfigRuntime(root)

            # No preview call — should read from store
            payload = runtime.get_index_heroes_payload()
            pool_keys = {item["key"] for item in payload["pools"].get("reviews", [])}
            assert key_a not in pool_keys, (
                f"Disk-excluded {key_a} should not appear in pool"
            )
            assert key_b in pool_keys
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
