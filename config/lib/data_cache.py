"""
data_cache.py — Shared data cache for EG Config Manager.

Loads products and articles ONCE from disk, lazily on first access.
All panels share via app.cache instead of each scanning independently.
"""

import json
import re
from pathlib import Path
from collections import defaultdict


def _extract_category(filepath: Path) -> str | None:
    """Extract category: value from YAML frontmatter."""
    try:
        text = filepath.read_text(encoding="utf-8", errors="replace")
        parts = text.split("---", 2)
        if len(parts) < 3:
            return None
        for line in parts[1].splitlines():
            m = re.match(r"^category:\s*(.+)", line)
            if m:
                val = m.group(1).strip().strip("'\"")
                if val:
                    return val
    except Exception:
        pass
    return None


class DataCache:
    """Single scan, many consumers. Lazy-loaded on first access."""

    def __init__(self, root: Path):
        self._root = root
        self._content_dir = root / "src" / "content"
        self._data_products = self._content_dir / "data-products"

        # Lazy caches (None = not yet loaded)
        self._article_data: dict | None = None
        self._product_data: dict | None = None
        self._navbar_data: dict | None = None

    # ── Article scanning ─────────────────────────────────────────────────

    def _ensure_articles(self):
        if self._article_data is not None:
            return

        article_counts: dict[str, dict[str, int]] = {}
        content_categories: set[str] = set()
        category_presence_articles: set[str] = set()

        for dirname in ("reviews", "guides", "news"):
            d = self._content_dir / dirname
            if not d.is_dir():
                continue
            for f in d.rglob("*"):
                if f.suffix in (".md", ".mdx") and f.is_file():
                    cat = _extract_category(f)
                    if cat:
                        content_categories.add(cat)
                        category_presence_articles.add(cat)
                        article_counts.setdefault(
                            cat, {"reviews": 0, "guides": 0, "news": 0})
                        article_counts[cat][dirname] += 1

        # Also scan data-products dirs for content_categories
        if self._data_products.is_dir():
            for child in self._data_products.iterdir():
                if child.is_dir():
                    content_categories.add(child.name)

        self._article_data = {
            "article_counts": article_counts,
            "content_categories": content_categories,
            "category_presence_articles": category_presence_articles,
        }

    # ── Product scanning ─────────────────────────────────────────────────

    def _ensure_products(self):
        if self._product_data is not None:
            return

        products = []
        product_counts: dict[str, int] = {}
        view_counts: dict[str, dict[str, int]] = defaultdict(
            lambda: defaultdict(int))
        product_view_counts: dict[str, int] = defaultdict(int)
        product_dirs: set[str] = set()

        if self._data_products.is_dir():
            product_dirs = {
                d.name for d in self._data_products.iterdir() if d.is_dir()}

            for json_path in sorted(self._data_products.rglob("*.json")):
                try:
                    data = json.loads(
                        json_path.read_text(encoding="utf-8"))
                except (json.JSONDecodeError, OSError):
                    continue

                rel = json_path.relative_to(self._data_products)
                parts = rel.with_suffix("").parts
                if len(parts) != 3:
                    continue

                category = data.get("category", parts[0])
                product_counts[category] = product_counts.get(category, 0) + 1

                # Slideshow-format product entry
                entry_id = "-".join(parts[1:])
                brand = data.get("brand", "")
                model = data.get("model", "")
                slug = data.get("slug", parts[2])
                overall_raw = data.get("overall", "")
                release_date = str(data.get("release_date", ""))
                image_path = data.get("imagePath", "")
                media = data.get("media", {})
                images = media.get("images", [])
                image_count = len(images)

                try:
                    overall = float(overall_raw)
                except (ValueError, TypeError):
                    overall = 0.0

                # View counts for image_defaults
                seen_views = set()
                for img in images:
                    view = img.get("view", "")
                    if view and view not in seen_views:
                        seen_views.add(view)
                        view_counts[category][view] += 1
                if images:
                    product_view_counts[category] += 1

                # Deal link check for slideshow
                has_deal = False
                placeholder_domains = {"dasad.com", "dasd.com", ""}
                for key in ("alink_amazon", "alink_bestbuy", "alink_newegg",
                            "alink_walmart", "alink_brand"):
                    val = str(data.get(key, "")).strip()
                    if (val and val not in placeholder_domains
                            and val.startswith("http")):
                        has_deal = True
                        break

                # Parse release date for sorting
                release_sort = (0, 0)
                if release_date and isinstance(release_date, str):
                    rd = release_date.strip()
                    rd_parts = rd.split("/")
                    if len(rd_parts) == 2:
                        try:
                            release_sort = (int(rd_parts[1]), int(rd_parts[0]))
                        except ValueError:
                            pass
                    else:
                        try:
                            release_sort = (int(rd), 0)
                        except ValueError:
                            pass

                products.append({
                    "entry_id": entry_id,
                    "slug": slug,
                    "brand": brand,
                    "model": model,
                    "category": category,
                    "overall": overall,
                    "release_date": release_date,
                    "release_sort": release_sort,
                    "image_path": image_path,
                    "image_count": image_count,
                    "has_deal": has_deal,
                })

        self._product_data = {
            "products": products,
            "product_counts": product_counts,
            "view_counts": dict(view_counts),
            "product_view_counts": dict(product_view_counts),
            "product_dirs": product_dirs,
        }

    # ── Public accessors ─────────────────────────────────────────────────

    def get_article_counts(self) -> dict[str, dict[str, int]]:
        self._ensure_articles()
        return self._article_data["article_counts"]

    def get_content_categories(self) -> set[str]:
        self._ensure_articles()
        return self._article_data["content_categories"]

    def get_product_counts(self) -> dict[str, int]:
        self._ensure_products()
        return self._product_data["product_counts"]

    def get_products(self) -> list[dict]:
        """All product entries for the slideshow pool (no eligibility filter)."""
        self._ensure_products()
        return self._product_data["products"]

    def get_view_counts(self) -> tuple[dict, dict]:
        """Returns (view_counts, product_view_counts) for image_defaults."""
        self._ensure_products()
        return (self._product_data["view_counts"],
                self._product_data["product_view_counts"])

    def get_category_presence(self) -> dict[str, dict[str, bool]]:
        """Returns {cat_id: {has_products, has_content}}."""
        self._ensure_articles()
        self._ensure_products()
        article_cats = self._article_data["category_presence_articles"]
        product_dirs = self._product_data["product_dirs"]
        result: dict[str, dict[str, bool]] = {}
        all_ids = product_dirs | article_cats
        for cat_id in all_ids:
            result[cat_id] = {
                "has_products": cat_id in product_dirs,
                "has_content": cat_id in article_cats,
            }
        return result

    # ── Navbar content scanning ────────────────────────────────────────────

    def _ensure_navbar(self):
        if self._navbar_data is not None:
            return

        import yaml

        def _entry_slug(filepath: Path, content_dir: Path) -> str:
            rel = filepath.relative_to(content_dir)
            parts = rel.with_suffix("").parts
            if parts and parts[-1] == "index":
                if len(parts) == 1:
                    return ""
                return "/".join(parts[:-1])
            return "/".join(parts)

        def _list_files(d: Path) -> list[Path]:
            if not d.is_dir():
                return []
            return sorted(f for f in d.rglob("*")
                          if f.suffix in (".md", ".mdx") and f.is_file())

        def _read_fm(fp: Path) -> tuple[dict, str]:
            text = fp.read_text(encoding="utf-8")
            parts = text.split("---", 2)
            if len(parts) < 3:
                return {}, text
            return yaml.safe_load(parts[1]) or {}, text

        guides_dir = self._content_dir / "guides"
        brands_dir = self._content_dir / "brands"
        games_dir = self._content_dir / "games"

        guides = []
        for f in _list_files(guides_dir):
            fm, _ = _read_fm(f)
            slug = _entry_slug(f, guides_dir)
            guides.append({
                "path": f, "filename": slug,
                "category": fm.get("category", ""),
                "guide": fm.get("guide", fm.get("title", slug)),
                "title": fm.get("title", slug),
                "navbar": fm.get("navbar", []),
            })

        brands = []
        for f in _list_files(brands_dir):
            fm, _ = _read_fm(f)
            slug = _entry_slug(f, brands_dir)
            brands.append({
                "path": f, "filename": slug,
                "brand": fm.get("brand", slug),
                "displayName": fm.get("displayName", fm.get("brand", slug)),
                "categories": fm.get("categories", []),
                "navbar": fm.get("navbar", []),
            })

        games = []
        for f in _list_files(games_dir):
            fm, _ = _read_fm(f)
            slug = _entry_slug(f, games_dir)
            games.append({
                "path": f, "filename": slug,
                "game": fm.get("game", fm.get("title", slug)),
                "title": fm.get("title", slug),
                "navbar": fm.get("navbar", False),
            })

        self._navbar_data = {
            "guides": guides,
            "brands": brands,
            "games": games,
        }

    def get_guides(self) -> list[dict]:
        self._ensure_navbar()
        return self._navbar_data["guides"]

    def get_brands(self) -> list[dict]:
        self._ensure_navbar()
        return self._navbar_data["brands"]

    def get_games(self) -> list[dict]:
        self._ensure_navbar()
        return self._navbar_data["games"]

    def get_content_only_cats(self) -> set[str]:
        """Categories with articles but NO data-products folder."""
        self._ensure_articles()
        self._ensure_products()
        article_cats = self._article_data["category_presence_articles"]
        product_dirs = self._product_data["product_dirs"]
        return article_cats - product_dirs

    def invalidate(self):
        """Reset all caches so next access re-scans."""
        self._article_data = None
        self._product_data = None
        self._navbar_data = None
