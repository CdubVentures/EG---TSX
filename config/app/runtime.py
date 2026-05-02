from __future__ import annotations

import copy
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

_THIS_DIR = Path(__file__).resolve().parent
_CONFIG_ROOT = _THIS_DIR.parent
_PROJECT_ROOT = _CONFIG_ROOT.parent

if str(_CONFIG_ROOT) not in sys.path:
    sys.path.insert(0, str(_CONFIG_ROOT))

from lib.config_store import ConfigStore
from lib.data_cache import DataCache
from lib.shared import derive_colors, generate_distinct_color
from panels.categories import infer_collections, normalize_category
from panels.navbar import (
    load_brands as load_navbar_brands,
    load_games as load_navbar_games,
    load_guides as load_navbar_guides,
    write_field as write_navbar_scalar_field,
    write_list_field as write_navbar_list_field,
)
from panels.content import (
  COLL_COLORS as CONTENT_COLL_COLORS,
  COLL_LABELS as CONTENT_COLL_LABELS,
    COLLECTIONS as CONTENT_COLLECTIONS,
    GRID_ROWS as CONTENT_GRID_ROWS,
    NUM_SLOTS as CONTENT_NUM_SLOTS,
    ROW_LABELS as CONTENT_ROW_LABELS,
    build_config as build_content_config,
    fmt_date as format_content_date,
    load_articles as load_content_articles,
  simulate_dashboard as simulate_content_dashboard,
  simulate_feeds as simulate_content_feeds,
)
from panels.index_heroes import (
    ALL_KEY as INDEX_ALL_KEY,
    ARTICLE_TYPES as INDEX_ARTICLE_TYPES,
    HERO_SLOTS as INDEX_HERO_SLOTS,
    INDEX_COLORS as INDEX_COLORS,
    INDEX_LABELS as INDEX_LABELS,
    INDEX_TYPES as INDEX_TYPES,
    build_index_heroes as build_index_heroes_config,
    fmt_date as format_index_date,
    load_articles as load_index_articles,
    load_brands as load_index_brands,
    select_algorithm as select_index_algorithm,
    select_brand_algorithm as select_index_brand_algorithm,
)


_HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

HUB_TOOL_TYPES = ["hub", "database", "versus", "radar", "shapes"]
HUB_TOOL_TYPE_LABELS = {
    "hub": "Hub",
    "database": "Database",
    "versus": "Versus",
    "radar": "Radars",
    "shapes": "Shapes",
}
HUB_DEFAULT_TOOLTIPS = {
    "database": "Structured lists you can filter and sort to find the best fit.",
    "hub": "The main landing pages for each category-start here to explore everything in one place.",
    "radar": "Visual scorecards that summarize strengths and weaknesses at a glance.",
    "shapes": "A visual catalogue of shapes/profiles to help understand fit and ergonomics.",
    "versus": "Side-by-side comparisons to quickly see what's different and what wins.",
}
HUB_DEFAULT_URLS = {
    "hub": "/hubs/{cat}",
    "database": "/hubs/{cat}?view=list",
    "versus": "/hubs/{cat}?compare=stats",
    "radar": "/hubs/{cat}?compare=radar",
    "shapes": "/hubs/{cat}?compare=shapes",
}
HUB_DEFAULT_DESCRIPTIONS = {
    "mouse": {
        "hub": "Explore and compare over 500 gaming mouse",
        "database": "Full database of mice",
        "versus": "Compare up to 8 gaming mice side-by-side",
        "radar": "Discover the best mouse for your needs",
        "shapes": "Find your perfect mouse shape",
    },
    "keyboard": {
        "hub": "Browse and compare 100s gaming keyboard",
        "database": "Full database of gaming keyboards",
        "versus": "Compare up to 8 gaming keyboards side-by-side",
        "radar": "Discover the best keyboard for your needs",
        "shapes": None,
    },
    "monitor": {
        "hub": "Explore and compare 100s of gaming monitors",
        "database": "Full database of monitors",
        "versus": "Compare up to 8 gaming Monitors side-by-side",
        "radar": "Discover the best Monitor for your needs",
        "shapes": None,
    },
}
HUB_DEFAULT_SUBTITLES = {
    "mouse": {
        "hub": "Your One-Stop Mouse Hub",
        "database": "Your One-Stop Mouse database",
        "versus": "Compare Pp To 500 Gaming Mice.",
        "radar": "Compare Mouse Specs Instantly",
        "shapes": "Find the Perfect Shape Fast",
    },
    "keyboard": {
        "hub": "Your One-Stop Keyboard Hub",
        "database": "Your One-Stop Keyboard Database",
        "versus": "Compare Pp To 500 Gaming Keyboards.",
        "radar": "Compare Keyboard Specs Instantly",
        "shapes": None,
    },
    "monitor": {
        "hub": "Your One-Stop Monitor Hub",
        "database": "Your One-Stop Monitor databse",
        "versus": "Compare Pp To 500 Gaming Monitors.",
        "radar": "Compare Monitor Specs Instantly",
        "shapes": None,
    },
}
HUB_INDEX_VIEWS = ["all", *HUB_TOOL_TYPES]


def _is_hub_product_active(category: dict[str, Any]) -> bool:
    product = category.get("product", {})
    if not isinstance(product, dict):
        return False
    return bool(product.get("production", False) or product.get("vite", False))


def _make_hub_default_tool(category_id: str, tool_type: str) -> dict[str, Any]:
    description = (
        HUB_DEFAULT_DESCRIPTIONS.get(category_id, {}).get(tool_type)
        or f"Explore {category_id} {tool_type}"
    )
    subtitle = (
        HUB_DEFAULT_SUBTITLES.get(category_id, {}).get(tool_type)
        or f"{category_id.capitalize()} {HUB_TOOL_TYPE_LABELS.get(tool_type, tool_type)}"
    )
    hero = f"/images/tools/{category_id}/{tool_type}/hero-img" if tool_type == "hub" else ""
    return {
        "tool": tool_type,
        "title": HUB_TOOL_TYPE_LABELS.get(tool_type, tool_type.capitalize()),
        "description": description,
        "subtitle": subtitle,
        "url": HUB_DEFAULT_URLS.get(tool_type, f"/hubs/{category_id}").replace("{cat}", category_id),
        "svg": "",
        "enabled": True,
        "navbar": tool_type == "hub",
        "hero": hero,
    }


def _normalize_hub_tool_entry(
    category_id: str,
    tool_type: str,
    raw_entry: dict[str, Any],
) -> dict[str, Any]:
    default = _make_hub_default_tool(category_id, tool_type)
    return {
        "tool": tool_type,
        "title": str(raw_entry.get("title", default["title"]) or default["title"]),
        "description": str(raw_entry.get("description", default["description"]) or default["description"]),
        "subtitle": str(raw_entry.get("subtitle", default["subtitle"]) or default["subtitle"]),
        "url": str(raw_entry.get("url", default["url"]) or default["url"]),
        "svg": str(raw_entry.get("svg", default["svg"]) or ""),
        "enabled": bool(raw_entry.get("enabled", default["enabled"])),
        "navbar": bool(raw_entry.get("navbar", default["navbar"])),
        "hero": str(raw_entry.get("hero", default["hero"]) or ""),
    }


def _ensure_hub_defaults(
    data: dict[str, Any],
    categories: list[dict[str, Any]],
) -> dict[str, Any]:
    for category in categories:
        category_id = category["id"]
        active = _is_hub_product_active(category)
        if not isinstance(data.get(category_id), list):
            data[category_id] = []

        existing_tools = {
            str(entry.get("tool", "")).strip().lower()
            for entry in data[category_id]
            if isinstance(entry, dict)
        }

        for tool_type in HUB_TOOL_TYPES:
            if tool_type in existing_tools:
                continue
            entry = _make_hub_default_tool(category_id, tool_type)
            if not active:
                entry["enabled"] = False
            elif tool_type == "shapes" and category_id != "mouse":
                entry["enabled"] = False
            data[category_id].append(entry)

        order = {tool_type: idx for idx, tool_type in enumerate(HUB_TOOL_TYPES)}
        data[category_id] = sorted(
            data[category_id],
            key=lambda entry: order.get(str(entry.get("tool", "")).strip().lower(), 99),
        )

    return data

NAV_ITEMS = [
    {"key": "Categories", "label": "Categories", "icon": "🏷"},
    {"key": "Content", "label": "Content", "icon": "📰"},
    {"key": "Index Heroes", "label": "Index Heroes", "icon": "🏆"},
    {"key": "Hub Tools", "label": "Hub Tools", "icon": "🔧"},
    {"key": "Navbar", "label": "Navbar", "icon": "🧭"},
    {"key": "Slideshow", "label": "Slideshow", "icon": "🖼"},
    {"key": "Image Defaults", "label": "Image Defaults", "icon": "📷"},
    {"key": "Ads", "label": "Ads", "icon": "💰"},
    {"key": "Cache / CDN", "label": "Cache / CDN", "icon": "☁"},
]


def _normalize_hex(value: Any, fallback: str) -> str:
    color = str(value or "").strip()
    if not color.startswith("#"):
        color = f"#{color}"
    if _HEX_COLOR_RE.match(color):
        return color.lower()
    return fallback.lower()


class ConfigRuntime:
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.store = ConfigStore(project_root)
        self.cache = DataCache(project_root)
        self._content_preview: dict[str, Any] | None = None
        self._index_heroes_preview: dict[str, Any] | None = None
        self._hub_tools_preview: dict[str, Any] | None = None
        self._navbar_preview_section_order: dict[str, list[str]] | None = None
        self._slideshow_preview: dict[str, Any] | None = None
        self._image_defaults_preview: dict[str, Any] | None = None
        self._cache_cdn_preview: dict[str, Any] | None = None
        self._ads_preview: dict[str, Any] | None = None
        self._mtimes = {
            key: self._mtime(path)
            for key, path in self.store._paths.items()
        }

    @staticmethod
    def _mtime(path: Path) -> float:
        try:
            return path.stat().st_mtime
        except (FileNotFoundError, OSError):
            return 0.0

    def poll_changes(self) -> list[str]:
        changed: list[str] = []
        for key, path in self.store._paths.items():
            new_mtime = self._mtime(path)
            if new_mtime != self._mtimes.get(key, 0.0):
                self._mtimes[key] = new_mtime
                self.store.reload(key)
                if key == ConfigStore.CONTENT:
                    self._content_preview = None
                    self._index_heroes_preview = None
                if key == ConfigStore.CATEGORIES:
                    self._hub_tools_preview = None
                if key == ConfigStore.NAV_SECTIONS:
                    self._navbar_preview_section_order = None
                if key == ConfigStore.HUB_TOOLS:
                    self._hub_tools_preview = None
                if key == ConfigStore.SLIDESHOW:
                    self._slideshow_preview = None
                if key == ConfigStore.IMAGE_DEFAULTS:
                    self._image_defaults_preview = None
                if key == ConfigStore.CACHE_CDN:
                    self._cache_cdn_preview = None
                if key in (ConfigStore.ADS_REGISTRY, ConfigStore.INLINE_ADS, ConfigStore.SPONSORS):
                    self._ads_preview = None
                changed.append(key)
        return changed

    def snapshot(self) -> None:
        for key, path in self.store._paths.items():
            self._mtimes[key] = self._mtime(path)

    def versions(self) -> dict[str, float]:
        return {key: self._mtimes.get(key, 0.0) for key in self.store._paths}

    _THEME_LABELS: dict[str, str] = {
        "legacy-clone-dark": "Legacy Clone Dark",
        "legacy-clone-light": "Legacy Clone Light",
        "legacy-clone-neutral": "Legacy Clone Neutral",
        "arcade-neon-dark": "Arcade Neon Dark",
        "arcade-neon-light": "Arcade Neon Light",
        "arcade-neon-neutral": "Arcade Neon Neutral",
        "pip-boy-dark": "Pip-Boy Dark",
        "pip-boy-light": "Pip-Boy Light",
        "pip-boy-neutral": "Pip-Boy Neutral",
        "phantom-dark": "Phantom Dark",
        "phantom-light": "Phantom Light",
        "phantom-neutral": "Phantom Neutral",
        "cloux-dark": "Cloux Dark",
        "cloux-light": "Cloux Light",
        "cloux-neutral": "Cloux Neutral",
        "deus-ex-dark": "Deus Ex Dark",
        "deus-ex-light": "Deus Ex Light",
        "deus-ex-neutral": "Deus Ex Neutral",
        "overwatch-dark": "Overwatch Dark",
        "overwatch-light": "Overwatch Light",
        "overwatch-neutral": "Overwatch Neutral",
        "warcraft-dark": "Warcraft Dark",
        "warcraft-light": "Warcraft Light",
        "warcraft-neutral": "Warcraft Neutral",
    }

    _VALID_THEMES: set[str] = set(_THEME_LABELS)

    def get_shell_payload(self) -> dict[str, Any]:
        self.poll_changes()
        settings = self.store.get(ConfigStore.SETTINGS)
        theme_id = settings.get("theme", "legacy-clone-dark")
        if theme_id not in self._VALID_THEMES:
            theme_id = "legacy-clone-dark"
        return {
            "appTitle": "EG Config Manager",
            "projectRootName": self.project_root.name,
            "theme": {
                "id": theme_id,
                "label": self._THEME_LABELS.get(theme_id, theme_id),
                "mode": "dark",
            },
            "navItems": NAV_ITEMS,
            "accent": self.store.site_accent,
            "statusText": "Ready · Ctrl+S to save",
            "versions": self.versions(),
        }

    def save_theme(self, theme_id: str) -> dict[str, Any]:
        if theme_id not in self._VALID_THEMES:
            theme_id = "legacy-clone-dark"
        settings = dict(self.store.get(ConfigStore.SETTINGS))
        settings["theme"] = theme_id
        self.store.save(ConfigStore.SETTINGS, settings)
        return self.get_shell_payload()

    def get_watch_payload(self) -> dict[str, Any]:
        changed = self.poll_changes()
        return {
            "changed": changed,
            "versions": self.versions(),
        }

    def _normalize_site_colors(self, value: Any) -> dict[str, str]:
        current = self.store.site_colors or {}
        primary = _normalize_hex(value.get("primary") if isinstance(value, dict) else None,
                                 current.get("primary", "#89b4fa"))
        secondary = _normalize_hex(value.get("secondary") if isinstance(value, dict) else None,
                                   current.get("secondary", primary))
        return {
            "primary": primary,
            "secondary": secondary,
        }

    def _auto_discover_categories(
        self,
        categories: list[dict[str, Any]],
        article_counts: dict[str, dict[str, int]],
        product_counts: dict[str, int],
    ) -> list[dict[str, Any]]:
        discovered = list(categories)
        existing_ids = {cat["id"] for cat in discovered}
        existing_colors = [cat.get("color", "") for cat in discovered]

        for category_id in sorted(self.cache.get_content_categories() - existing_ids):
            color = generate_distinct_color(existing_colors)
            existing_colors.append(color)
            discovered.append({
                "id": category_id,
                "label": category_id.capitalize(),
                "plural": f"{category_id.capitalize()}s",
                "color": color,
                "product": {"production": False, "vite": True},
                "content": {"production": False, "vite": True},
                "collections": infer_collections(
                    article_counts,
                    product_counts,
                    category_id,
                ),
            })

        return discovered

    @staticmethod
    def _count_text(
        category_id: str,
        article_counts: dict[str, dict[str, int]],
        product_counts: dict[str, int],
    ) -> tuple[str, dict[str, int]]:
        parts: list[str] = []
        counts = article_counts.get(category_id, {})
        product_count = product_counts.get(category_id, 0)
        if product_count > 0:
            parts.append(f"{product_count} products")

        reviews = counts.get("reviews", 0)
        guides = counts.get("guides", 0)
        news = counts.get("news", 0)
        if reviews + guides + news > 0:
            parts.append(f"{reviews} reviews · {guides} guides · {news} news")

        return ("  |  ".join(parts) if parts else "no data found"), {
            "products": product_count,
            "reviews": reviews,
            "guides": guides,
            "news": news,
        }

    def get_categories_payload(self) -> dict[str, Any]:
        self.poll_changes()

        raw = self.store.get(ConfigStore.CATEGORIES)
        site_colors = self._normalize_site_colors(raw.get("siteColors", {}))
        article_counts = self.cache.get_article_counts()
        product_counts = self.cache.get_product_counts()
        category_presence = self.cache.get_category_presence()

        categories = [
            normalize_category(category)
            for category in raw.get("categories", [])
            if isinstance(category, dict)
        ]
        categories = self._auto_discover_categories(
            categories,
            article_counts,
            product_counts,
        )

        panel_categories: list[dict[str, Any]] = []
        icon_dir = self.project_root / "public" / "images" / "navbar"

        for category in categories:
            category_id = str(category.get("id", "")).strip().lower()
            if not category_id:
                continue

            color = _normalize_hex(category.get("color"), site_colors["primary"])
            presence = category_presence.get(
                category_id,
                {"has_products": False, "has_content": False},
            )
            has_products = bool(presence["has_products"])
            has_content = bool(presence["has_content"])
            show_product = has_products or (not has_products and not has_content)
            show_content = has_content or (not has_products and not has_content)
            count_text, counts = self._count_text(
                category_id,
                article_counts,
                product_counts,
            )

            icon_path = icon_dir / f"{category_id}.svg"
            has_icon = icon_path.is_file()
            panel_categories.append({
                "id": category_id,
                "label": category.get("label", category_id.title()),
                "plural": category.get("plural", f"{category_id.title()}s"),
                "color": color,
                "derivedColors": derive_colors(color),
                "product": category.get("product", {"production": False, "vite": False}),
                "content": category.get("content", {"production": False, "vite": False}),
                "collections": category.get("collections", {}),
                "counts": counts,
                "countText": count_text,
                "presence": {
                    "hasProducts": has_products,
                    "hasContent": has_content,
                },
                "showProductToggles": show_product,
                "showContentToggles": show_content,
                "iconStatus": {
                    "exists": has_icon,
                    "label": f"{category_id}.svg" if has_icon else "MISSING ICON",
                    "path": f"public/images/navbar/{category_id}.svg",
                    "tooltip": (
                        f"Navbar icon: public/images/navbar/{category_id}.svg\n"
                        "Found - custom icon active."
                    ) if has_icon else (
                        f"Navbar icon: public/images/navbar/{category_id}.svg\n"
                        "NOT FOUND - navbar will have no icon for this category.\n"
                        "Add a 24x24 SVG silhouette to this path."
                    ),
                },
            })

        site_derived = derive_colors(site_colors["primary"])
        return {
            "siteColors": {
                **site_colors,
                "derivedColors": {
                    "accent": site_derived["accent"],
                    "hover": site_derived["hover"],
                    "grad-start": site_derived["grad-start"],
                    "dark": site_derived["dark"],
                    "soft": site_derived["soft"],
                },
            },
            "categories": panel_categories,
            "categoryCount": len(panel_categories),
            "statusRight": f"{len(panel_categories)} categories",
            "version": self._mtimes.get(ConfigStore.CATEGORIES, 0.0),
        }

    def preview_categories(self, payload: dict[str, Any]) -> dict[str, Any]:
        data = self._sanitize_categories_payload(payload)
        self.store.preview(ConfigStore.CATEGORIES, data)
        self._hub_tools_preview = None
        return {
            "shell": self.get_shell_payload(),
            "panel": self.get_categories_payload(),
        }

    def _sanitize_categories_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        site_colors = self._normalize_site_colors(payload.get("siteColors", {}))
        categories_payload = payload.get("categories", [])
        sanitized_categories: list[dict[str, Any]] = []
        seen_ids: set[str] = set()

        for raw_category in categories_payload:
            if not isinstance(raw_category, dict):
                continue

            category_id = str(raw_category.get("id", "")).strip().lower()
            if not category_id or category_id in seen_ids:
                continue
            seen_ids.add(category_id)

            label = str(raw_category.get("label", "")).strip() or category_id.title()
            plural = str(raw_category.get("plural", "")).strip() or f"{label}s"
            color = _normalize_hex(raw_category.get("color"), site_colors["primary"])

            sanitized_categories.append(normalize_category({
                "id": category_id,
                "label": label,
                "plural": plural,
                "color": color,
                "product": raw_category.get("product"),
                "content": raw_category.get("content"),
                "collections": raw_category.get("collections"),
            }))

        return {
            "siteColors": site_colors,
            "categories": sanitized_categories,
        }

    def save_categories(self, payload: dict[str, Any]) -> dict[str, Any]:
        data = self._sanitize_categories_payload(payload)
        self.store.save(ConfigStore.CATEGORIES, data)
        self._hub_tools_preview = None
        self.snapshot()

        saved_at = datetime.now().strftime("%H:%M:%S")
        return {
            "savedAt": saved_at,
            "message": f"Saved site colors + {len(data['categories'])} categories at {saved_at}",
            "shell": self.get_shell_payload(),
            "panel": self.get_categories_payload(),
        }

    def _content_slot_layout(self) -> dict[int, dict[str, Any]]:
        layout: dict[int, dict[str, Any]] = {}
        for row_index, slots, row_weight in CONTENT_GRID_ROWS:
            for slot_number, column_start, column_span in slots:
                layout[slot_number] = {
                    "slotNumber": slot_number,
                    "rowIndex": row_index,
                    "columnStart": column_start,
                    "columnSpan": column_span,
                    "rowWeight": row_weight,
                    "rowLabel": CONTENT_ROW_LABELS.get(row_index, ""),
                }
        return layout

    def _load_content_articles(self) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
        articles = load_content_articles(
            self.project_root / "src" / "content",
            self.project_root / "public" / "images",
            self.store.active_content_cats,
        )
        return articles, {article["key"]: article for article in articles}

    def _content_state_from_store(
        self,
        article_map: dict[str, dict[str, Any]],
    ) -> dict[str, Any]:
        cfg = self.store.get(ConfigStore.CONTENT)
        manual_slots: dict[int, str] = {}

        for slot_str, slot_val in cfg.get("slots", {}).items():
            try:
                slot_num = int(slot_str)
            except (TypeError, ValueError):
                continue
            if not (1 <= slot_num <= CONTENT_NUM_SLOTS):
                continue
            if not isinstance(slot_val, dict):
                continue
            collection = str(slot_val.get("collection", "")).strip()
            entry_id = str(slot_val.get("id", "")).strip()
            article_key = f"{collection}:{entry_id}"
            if article_key in article_map:
                manual_slots[slot_num] = article_key

        return {
            "manualSlots": manual_slots,
            "pinned": {
                key for key in cfg.get("pinned", [])
                if isinstance(key, str) and key in article_map
            },
            "badges": {
                str(key): str(value).strip()
                for key, value in cfg.get("badges", {}).items()
                if isinstance(key, str) and key in article_map and str(value).strip()
            },
            "excluded": {
                key for key in cfg.get("excluded", [])
                if isinstance(key, str) and key in article_map
            },
        }

    def _current_content_state(
        self,
        article_map: dict[str, dict[str, Any]],
    ) -> dict[str, Any]:
        if self._content_preview is not None:
            return {
                "manualSlots": dict(self._content_preview["manualSlots"]),
                "pinned": set(self._content_preview["pinned"]),
                "badges": dict(self._content_preview["badges"]),
                "excluded": set(self._content_preview["excluded"]),
            }
        return self._content_state_from_store(article_map)

    def _sanitize_content_payload(
        self,
        payload: dict[str, Any],
    ) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, dict[str, Any]]]:
        articles, article_map = self._load_content_articles()

        manual_slots: dict[int, str] = {}
        raw_slots = payload.get("manualSlots", {})
        if isinstance(raw_slots, dict):
            for slot_str, key_value in raw_slots.items():
                try:
                    slot_num = int(slot_str)
                except (TypeError, ValueError):
                    continue
                if not (1 <= slot_num <= CONTENT_NUM_SLOTS):
                    continue

                article_key = str(key_value or "").strip()
                if article_key in article_map:
                    manual_slots[slot_num] = article_key

        pinned = {
            str(key).strip()
            for key in payload.get("pinned", [])
            if isinstance(key, str) and str(key).strip() in article_map
        }
        badges = {
            str(key).strip(): str(value).strip()
            for key, value in payload.get("badges", {}).items()
            if isinstance(key, str) and str(key).strip() in article_map and str(value).strip()
        }
        excluded = {
            str(key).strip()
            for key in payload.get("excluded", [])
            if isinstance(key, str) and str(key).strip() in article_map
        }

        manual_slots = {
            slot_num: article_key
            for slot_num, article_key in manual_slots.items()
            if article_key not in excluded
        }

        return {
            "manualSlots": manual_slots,
            "pinned": pinned,
            "badges": badges,
            "excluded": excluded,
        }, articles, article_map

    def _serialize_content_article(
        self,
        article: dict[str, Any],
        feeds: dict[str, dict[str, Any]],
        state: dict[str, Any],
        manual_values: set[str],
    ) -> dict[str, Any]:
        category_id = str(article.get("category", "") or "")
        category_label = (
            self.store.cat_labels.get(category_id, category_id.title())
            if category_id
            else ""
        )
        category_color = (
            self.store.cat_colors.get(category_id)
            if category_id
            else CONTENT_COLL_COLORS.get(article["collection"], self.store.site_accent)
        )
        feed_entry = feeds.get(article["key"], {})

        return {
            "key": article["key"],
            "collection": article["collection"],
            "collectionLabel": CONTENT_COLL_LABELS.get(
                article["collection"],
                article["collection"].title(),
            ),
            "collectionColor": CONTENT_COLL_COLORS.get(
                article["collection"],
                self.store.site_accent,
            ),
            "entryId": article["entry_id"],
            "title": article["title"],
            "category": category_id,
            "categoryLabel": category_label,
            "categoryColor": category_color,
            "datePublished": article.get("date_published", ""),
            "dateUpdated": article.get("date_updated", ""),
            "sortDate": article.get("sort_date", ""),
            "dateText": format_content_date(article),
            "hasHero": bool(article.get("has_hero")),
            "fullArticle": article.get("full_article", True) is not False,
            "draft": bool(article.get("draft", False)),
            "categoryActive": bool(article.get("category_active", True)),
            "isPinned": article["key"] in state["pinned"],
            "badge": state["badges"].get(article["key"], ""),
            "isExcluded": article["key"] in state["excluded"],
            "isManualAssigned": article["key"] in manual_values,
            "feedLabels": list(feed_entry.get("labels", [])),
            "feedPosition": int(feed_entry.get("pos", 0) or 0),
        }

    def get_content_payload(self) -> dict[str, Any]:
        self.poll_changes()

        articles, article_map = self._load_content_articles()
        state = self._current_content_state(article_map)
        simulated = simulate_content_dashboard(
            articles,
            state["manualSlots"],
            state["excluded"],
        )
        feeds = simulate_content_feeds(
            articles,
            simulated,
            state["excluded"],
            state["pinned"],
        )
        manual_values = set(state["manualSlots"].values())
        layout = self._content_slot_layout()

        eligible_articles = [
            article for article in articles
            if article["full_article"] is not False
            and not article["draft"]
            and article["has_hero"]
            and article["key"] not in state["excluded"]
            and article.get("category_active", True)
        ]
        disabled_count = sum(
            1 for article in articles
            if not article.get("category_active", True)
        )

        dashboard_slots: list[dict[str, Any]] = []
        for slot_number in range(1, CONTENT_NUM_SLOTS + 1):
            article = simulated[slot_number - 1]
            dashboard_slots.append({
                **layout.get(slot_number, {
                    "slotNumber": slot_number,
                    "rowIndex": 0,
                    "columnStart": 0,
                    "columnSpan": 1,
                    "rowWeight": 1,
                    "rowLabel": "",
                }),
                "isManual": slot_number in state["manualSlots"],
                "manualKey": state["manualSlots"].get(slot_number, ""),
                "article": (
                    self._serialize_content_article(article, feeds, state, manual_values)
                    if article
                    else None
                ),
            })

        article_pool = [
            self._serialize_content_article(article, feeds, state, manual_values)
            for article in articles
            if article["key"] not in manual_values
        ]
        article_pool.sort(
            key=lambda article: (article["collection"], article["title"].lower(), article["key"]),
        )
        article_pool.sort(key=lambda article: article["sortDate"] or "", reverse=True)

        tabs = {
            collection: [] for collection in CONTENT_COLLECTIONS
        }
        for article in articles:
            tabs.setdefault(article["collection"], []).append(
                self._serialize_content_article(article, feeds, state, manual_values)
            )
        for collection in tabs:
            tabs[collection].sort(
                key=lambda article: article["title"].lower(),
            )
            tabs[collection].sort(key=lambda article: article["sortDate"] or "", reverse=True)

        manual_slots_payload = {
            str(slot_num): article_key
            for slot_num, article_key in sorted(state["manualSlots"].items())
        }
        pinned_payload = sorted(state["pinned"])
        badges_payload = dict(sorted(state["badges"].items()))
        excluded_payload = sorted(state["excluded"])

        return {
            "summary": {
                "totalArticles": len(articles),
                "eligibleArticles": len(eligible_articles),
                "disabledArticles": disabled_count,
                "slotCount": CONTENT_NUM_SLOTS,
                "manualCount": len(manual_slots_payload),
                "pinnedCount": len(pinned_payload),
                "badgedCount": len(badges_payload),
                "excludedCount": len(excluded_payload),
            },
            "statusRight": (
                f"{len(articles)} articles  ·  {len(eligible_articles)} eligible  ·  "
                f"{disabled_count} disabled  ·  {CONTENT_NUM_SLOTS} slots"
            ),
            "manualSlots": manual_slots_payload,
            "pinned": pinned_payload,
            "badges": badges_payload,
            "excluded": excluded_payload,
            "dashboardSlots": dashboard_slots,
            "articlePool": article_pool,
            "tabs": tabs,
            "version": self._mtimes.get(ConfigStore.CONTENT, 0.0),
        }

    def preview_content(self, payload: dict[str, Any]) -> dict[str, Any]:
        state, _, _ = self._sanitize_content_payload(payload)
        self._content_preview = state
        return {
            "shell": self.get_shell_payload(),
            "panel": self.get_content_payload(),
        }

    def save_content(self, payload: dict[str, Any]) -> dict[str, Any]:
        state, _, article_map = self._sanitize_content_payload(payload)
        persisted = build_content_config(
            article_map,
            state["manualSlots"],
            state["pinned"],
            state["badges"],
            state["excluded"],
        )
        existing = dict(self.store.get(ConfigStore.CONTENT))
        existing.update(persisted)

        self.store.save(ConfigStore.CONTENT, existing)
        self._content_preview = None
        self.snapshot()

        saved_at = datetime.now().strftime("%H:%M:%S")
        return {
            "savedAt": saved_at,
            "message": (
                f"Saved ({len(state['manualSlots'])} manual, {len(state['pinned'])} pinned, "
                f"{len(state['excluded'])} excluded, {len(state['badges'])} badges) at {saved_at}"
            ),
            "shell": self.get_shell_payload(),
            "panel": self.get_content_payload(),
        }

    def _hub_categories(self) -> list[dict[str, Any]]:
        content_only_categories = self.cache.get_content_only_cats()
        categories: list[dict[str, Any]] = []

        for category in self.store.categories:
            category_id = str(category.get("id", "")).strip().lower()
            if not category_id or category_id in content_only_categories:
                continue

            categories.append({
                "id": category_id,
                "label": str(category.get("label", category_id.title()) or category_id.title()),
                "color": _normalize_hex(category.get("color"), self.store.site_accent),
                "product": category.get("product", {}),
            })

        return categories

    def _hub_state_from_store(
        self,
        categories: list[dict[str, Any]],
    ) -> dict[str, Any]:
        raw = self.store.get(ConfigStore.HUB_TOOLS)
        base = copy.deepcopy(raw) if isinstance(raw, dict) else {}
        return _ensure_hub_defaults(base, categories)

    def _current_hub_state(
        self,
        categories: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if self._hub_tools_preview is not None:
            return copy.deepcopy(self._hub_tools_preview)
        return self._hub_state_from_store(categories)

    def _hub_valid_index_keys(
        self,
        data: dict[str, Any],
        categories: list[dict[str, Any]],
    ) -> dict[str, set[str]]:
        valid: dict[str, set[str]] = {
            view: set() for view in HUB_INDEX_VIEWS
        }

        for category in categories:
            category_id = category["id"]
            entries = data.get(category_id, [])
            if not isinstance(entries, list):
                continue

            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                tool_type = str(entry.get("tool", "")).strip().lower()
                if not tool_type:
                    continue
                item_key = f"{category_id}:{tool_type}"
                valid["all"].add(item_key)
                if tool_type in valid:
                    valid[tool_type].add(item_key)

        return valid

    def _sanitize_hub_index(
        self,
        raw_index: Any,
        data: dict[str, Any],
        categories: list[dict[str, Any]],
    ) -> dict[str, list[str]]:
        valid = self._hub_valid_index_keys(data, categories)
        cleaned: dict[str, list[str]] = {}

        index_map = raw_index if isinstance(raw_index, dict) else {}
        for view in HUB_INDEX_VIEWS:
            values = index_map.get(view, [])
            if not isinstance(values, list):
                values = []

            deduped: list[str] = []
            for value in values:
                key = str(value or "").strip()
                if not key or key in deduped:
                    continue
                if key in valid[view]:
                    deduped.append(key)
            cleaned[view] = deduped

        return cleaned

    def _sanitize_hub_tools_payload(
        self,
        payload: dict[str, Any],
        categories: list[dict[str, Any]],
    ) -> dict[str, Any]:
        state = self._current_hub_state(categories)

        raw_tools = payload.get("tools", {})
        tools_map = raw_tools if isinstance(raw_tools, dict) else {}

        for category in categories:
            category_id = category["id"]
            existing_entries = state.get(category_id, [])
            requested_entries = tools_map.get(category_id, existing_entries)
            if not isinstance(requested_entries, list):
                requested_entries = existing_entries if isinstance(existing_entries, list) else []

            normalized_entries: list[dict[str, Any]] = []
            seen_tool_types: set[str] = set()
            for raw_entry in requested_entries:
                if not isinstance(raw_entry, dict):
                    continue
                tool_type = str(raw_entry.get("tool", "")).strip().lower()
                if not tool_type or tool_type in seen_tool_types:
                    continue
                seen_tool_types.add(tool_type)
                normalized_entries.append(
                    _normalize_hub_tool_entry(category_id, tool_type, raw_entry)
                )

            state[category_id] = normalized_entries

        state = _ensure_hub_defaults(state, categories)

        existing_tooltips = state.get("_tooltips", {})
        if not isinstance(existing_tooltips, dict):
            existing_tooltips = {}
        raw_tooltips = payload.get("tooltips", {})
        tooltip_map = raw_tooltips if isinstance(raw_tooltips, dict) else {}

        normalized_tooltips: dict[str, str] = {}
        for tool_type in HUB_TOOL_TYPES:
            fallback = str(
                existing_tooltips.get(tool_type, HUB_DEFAULT_TOOLTIPS.get(tool_type, ""))
            )
            value = str(tooltip_map.get(tool_type, fallback) or "").strip()
            normalized_tooltips[tool_type] = value or HUB_DEFAULT_TOOLTIPS.get(tool_type, "")
        state["_tooltips"] = normalized_tooltips

        raw_index = payload.get("index", state.get("_index", {}))
        state["_index"] = self._sanitize_hub_index(raw_index, state, categories)

        return state

    def get_hub_tools_payload(self) -> dict[str, Any]:
        self.poll_changes()

        categories = self._hub_categories()
        state = self._current_hub_state(categories)

        tools_payload: dict[str, list[dict[str, Any]]] = {}
        category_payload: list[dict[str, Any]] = []
        total_tools = 0

        for category in categories:
            category_id = category["id"]
            entries = state.get(category_id, [])
            normalized_entries: list[dict[str, Any]] = []
            seen_tool_types: set[str] = set()
            if isinstance(entries, list):
                for raw_entry in entries:
                    if not isinstance(raw_entry, dict):
                        continue
                    tool_type = str(raw_entry.get("tool", "")).strip().lower()
                    if not tool_type or tool_type in seen_tool_types:
                        continue
                    seen_tool_types.add(tool_type)
                    normalized_entries.append(
                        _normalize_hub_tool_entry(category_id, tool_type, raw_entry)
                    )

            tools_payload[category_id] = normalized_entries
            total_count = len(normalized_entries)
            enabled_count = sum(
                1 for entry in normalized_entries
                if bool(entry.get("enabled", False))
            )
            total_tools += total_count
            category_payload.append({
                "id": category_id,
                "label": category["label"],
                "color": category["color"],
                "productActive": _is_hub_product_active(category),
                "enabledCount": enabled_count,
                "totalCount": total_count,
            })

        raw_tooltips = state.get("_tooltips", {})
        tooltip_map = raw_tooltips if isinstance(raw_tooltips, dict) else {}
        tooltips = {
            tool_type: str(
                tooltip_map.get(tool_type, HUB_DEFAULT_TOOLTIPS.get(tool_type, ""))
            )
            for tool_type in HUB_TOOL_TYPES
        }

        raw_index = state.get("_index", {})
        index = self._sanitize_hub_index(raw_index, state, categories)

        return {
            "toolTypes": [
                {
                    "key": tool_type,
                    "label": HUB_TOOL_TYPE_LABELS[tool_type],
                }
                for tool_type in HUB_TOOL_TYPES
            ],
            "categories": category_payload,
            "tools": tools_payload,
            "tooltips": tooltips,
            "index": index,
            "statusRight": f"{total_tools} tools across {len(category_payload)} categories",
            "version": self._mtimes.get(ConfigStore.HUB_TOOLS, 0.0),
        }

    def preview_hub_tools(self, payload: dict[str, Any]) -> dict[str, Any]:
        categories = self._hub_categories()
        self._hub_tools_preview = self._sanitize_hub_tools_payload(payload, categories)
        return {
            "shell": self.get_shell_payload(),
            "panel": self.get_hub_tools_payload(),
        }

    def save_hub_tools(self, payload: dict[str, Any]) -> dict[str, Any]:
        categories = self._hub_categories()
        data = self._sanitize_hub_tools_payload(payload, categories)

        self.store.save(ConfigStore.HUB_TOOLS, data)
        self._hub_tools_preview = None
        self.snapshot()

        saved_at = datetime.now().strftime("%H:%M:%S")
        saved_count = sum(
            len(entries)
            for key, entries in data.items()
            if not str(key).startswith("_") and isinstance(entries, list)
        )
        return {
            "savedAt": saved_at,
            "message": f"Saved {saved_count} tools at {saved_at}",
            "shell": self.get_shell_payload(),
            "panel": self.get_hub_tools_payload(),
        }

    # ── Slideshow panel ──────────────────────────────────────────────────

    def _slideshow_category_info(self) -> tuple[dict[str, str], dict[str, str]]:
        cats_cfg = self.store.get(ConfigStore.CATEGORIES)
        categories = cats_cfg.get("categories", [])
        colors: dict[str, str] = {}
        labels: dict[str, str] = {}
        for cat in categories:
            if not isinstance(cat, dict):
                continue
            cat_id = str(cat.get("id", "")).strip().lower()
            if not cat_id:
                continue
            colors[cat_id] = str(cat.get("color", "#89b4fa"))
            labels[cat_id] = str(cat.get("label", cat_id.title()))
        return colors, labels

    def get_slideshow_payload(self) -> dict[str, Any]:
        self.poll_changes()

        products = self.cache.get_products()
        product_set = {p["entry_id"] for p in products}

        cfg = (
            self._slideshow_preview
            if self._slideshow_preview is not None
            else self.store.get(ConfigStore.SLIDESHOW)
        )
        max_slides = max(1, min(20, int(cfg.get("maxSlides", 10))))
        slides = [
            eid for eid in cfg.get("slides", [])
            if isinstance(eid, str) and eid in product_set
        ]

        cat_colors, cat_labels = self._slideshow_category_info()

        camel_products = [
            {
                "entryId": p["entry_id"],
                "slug": p["slug"],
                "brand": p["brand"],
                "model": p["model"],
                "category": p["category"],
                "overall": p["overall"],
                "releaseDate": p["release_date"],
                "imagePath": p["image_path"],
                "imageCount": p["image_count"],
                "hasDeal": p["has_deal"],
            }
            for p in products
        ]

        total = len(products)
        filled = len(slides)
        return {
            "products": camel_products,
            "slides": slides,
            "maxSlides": max_slides,
            "categoryColors": cat_colors,
            "categoryLabels": cat_labels,
            "statusRight": f"{total} products \u00b7 {filled} assigned",
            "version": self._mtimes.get(ConfigStore.SLIDESHOW, 0.0),
        }

    def preview_slideshow(self, payload: dict[str, Any]) -> dict[str, Any]:
        max_slides = max(1, min(20, int(payload.get("maxSlides", 10))))
        slides = payload.get("slides", [])
        if not isinstance(slides, list):
            slides = []
        slides = [str(s) for s in slides if isinstance(s, str)]

        self._slideshow_preview = {
            "maxSlides": max_slides,
            "slides": slides,
        }
        return {
            "shell": self.get_shell_payload(),
            "panel": self.get_slideshow_payload(),
        }

    def save_slideshow(self, payload: dict[str, Any]) -> dict[str, Any]:
        max_slides = max(1, min(20, int(payload.get("maxSlides", 10))))
        slides = payload.get("slides", [])
        if not isinstance(slides, list):
            slides = []
        slides = [str(s) for s in slides if isinstance(s, str)]

        data = {"maxSlides": max_slides, "slides": slides}
        self.store.save(ConfigStore.SLIDESHOW, data)
        self._slideshow_preview = None
        self.snapshot()

        saved_at = datetime.now().strftime("%H:%M:%S")
        n = len(slides)
        return {
            "savedAt": saved_at,
            "message": f"Saved {n} slide{'s' if n != 1 else ''} (max {max_slides}) at {saved_at}",
            "shell": self.get_shell_payload(),
            "panel": self.get_slideshow_payload(),
        }

    # ── Image Defaults panel ─────────────────────────────────────────────

    CANONICAL_VIEWS = [
        "feature-image", "top", "left", "right", "sangle", "angle",
        "front", "rear", "bot", "img", "shape-side", "shape-top",
    ]

    def _image_defaults_category_info(self) -> tuple[dict[str, str], dict[str, str]]:
        cats_cfg = self.store.get(ConfigStore.CATEGORIES)
        categories = cats_cfg.get("categories", [])
        colors: dict[str, str] = {}
        labels: dict[str, str] = {}
        for cat in categories:
            if not isinstance(cat, dict):
                continue
            cat_id = str(cat.get("id", "")).strip().lower()
            if not cat_id:
                continue
            colors[cat_id] = str(cat.get("color", "#89b4fa"))
            labels[cat_id] = str(cat.get("label", cat_id.title()))
        return colors, labels

    def _build_scanner_data(
        self,
        view_counts: dict[str, dict[str, int]],
        product_view_counts: dict[str, int],
    ) -> dict[str, Any]:
        canonical_set = set(self.CANONICAL_VIEWS)
        scanner: dict[str, Any] = {}

        for category_id, views in view_counts.items():
            total = product_view_counts.get(category_id, 0)
            view_stats = []
            for view, count in sorted(views.items(), key=lambda x: -x[1]):
                pct = round(count / total * 100) if total > 0 else 0
                if view not in canonical_set:
                    status = "anomaly"
                elif pct >= 90:
                    status = "common"
                elif pct >= 50:
                    status = "partial"
                else:
                    status = "sparse"
                view_stats.append({
                    "view": view,
                    "count": count,
                    "coveragePct": pct,
                    "status": status,
                    "isCanonical": view in canonical_set,
                })
            scanner[category_id] = {
                "categoryId": category_id,
                "productCount": total,
                "views": view_stats,
            }

        return scanner

    def _build_category_pills(
        self,
        config_categories: dict[str, Any],
        product_view_counts: dict[str, int],
        cat_colors: dict[str, str],
        cat_labels: dict[str, str],
    ) -> list[dict[str, Any]]:
        site_colors = self.store.site_colors or {}
        site_primary = site_colors.get("primary", "#89b4fa")
        pills = [{
            "id": "__defaults__",
            "label": "Defaults",
            "color": site_primary,
            "productCount": sum(product_view_counts.values()),
        }]
        for cat_id in config_categories:
            pills.append({
                "id": cat_id,
                "label": cat_labels.get(cat_id, cat_id.title()),
                "color": cat_colors.get(cat_id, site_primary),
                "productCount": product_view_counts.get(cat_id, 0),
            })
        return pills

    def get_image_defaults_payload(self) -> dict[str, Any]:
        self.poll_changes()

        cfg = (
            self._image_defaults_preview
            if self._image_defaults_preview is not None
            else self.store.get(ConfigStore.IMAGE_DEFAULTS)
        )

        defaults = cfg.get("defaults", {})
        categories = cfg.get("categories", {})

        view_counts, product_view_counts = self.cache.get_view_counts()
        cat_colors, cat_labels = self._image_defaults_category_info()

        scanner = self._build_scanner_data(view_counts, product_view_counts)
        pills = self._build_category_pills(
            categories, product_view_counts, cat_colors, cat_labels,
        )

        total_products = sum(product_view_counts.values())
        total_views = sum(
            len(views) for views in view_counts.values()
        )

        return {
            "defaults": copy.deepcopy(defaults),
            "categories": copy.deepcopy(categories),
            "scanner": scanner,
            "categoryPills": pills,
            "canonicalViews": list(self.CANONICAL_VIEWS),
            "categoryColors": cat_colors,
            "categoryLabels": cat_labels,
            "statusRight": f"{total_products} products \u00b7 {total_views} views scanned",
            "version": self._mtimes.get(ConfigStore.IMAGE_DEFAULTS, 0.0),
        }

    def preview_image_defaults(self, payload: dict[str, Any]) -> dict[str, Any]:
        defaults = payload.get("defaults", {})
        categories = payload.get("categories", {})
        if not isinstance(defaults, dict):
            defaults = {}
        if not isinstance(categories, dict):
            categories = {}

        self._image_defaults_preview = {
            "defaults": defaults,
            "categories": categories,
        }
        return {
            "shell": self.get_shell_payload(),
            "panel": self.get_image_defaults_payload(),
        }

    def save_image_defaults(self, payload: dict[str, Any]) -> dict[str, Any]:
        defaults = payload.get("defaults", {})
        categories = payload.get("categories", {})
        if not isinstance(defaults, dict):
            defaults = {}
        if not isinstance(categories, dict):
            categories = {}

        data = {"defaults": defaults, "categories": categories}
        self.store.save(ConfigStore.IMAGE_DEFAULTS, data)
        self._image_defaults_preview = None
        self.snapshot()

        saved_at = datetime.now().strftime("%H:%M:%S")
        n_cats = len([c for c in categories.values() if c])
        return {
            "savedAt": saved_at,
            "message": f"Saved image defaults ({n_cats} category override{'s' if n_cats != 1 else ''}) at {saved_at}",
            "shell": self.get_shell_payload(),
            "panel": self.get_image_defaults_payload(),
        }

    def _load_index_hero_items(
        self,
    ) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], list[dict[str, Any]], dict[str, dict[str, Any]]]:
        content_dir = self.project_root / "src" / "content"
        images_dir = self.project_root / "public" / "images"

        articles = load_index_articles(
            content_dir,
            images_dir,
            self.store.active_content_cats,
        )
        brands = load_index_brands(content_dir, images_dir)

        if self.store.brand_categories:
            for brand in brands:
                override_categories = self.store.brand_categories.get(brand["key"])
                if override_categories is not None:
                    brand["categories"] = list(override_categories)

        return (
            articles,
            {article["key"]: article for article in articles},
            brands,
            {brand["key"]: brand for brand in brands},
        )

    @staticmethod
    def _empty_index_overrides() -> dict[str, dict[str, list[str]]]:
        return {type_key: {} for type_key in INDEX_TYPES}

    def _sanitize_index_overrides(
        self,
        raw_overrides: Any,
        article_keys_by_type: dict[str, set[str]],
        brand_keys: set[str],
    ) -> dict[str, dict[str, list[str]]]:
        sanitized = self._empty_index_overrides()
        if not isinstance(raw_overrides, dict):
            return sanitized

        for type_key in INDEX_TYPES:
            raw_type_map = raw_overrides.get(type_key, {})
            if not isinstance(raw_type_map, dict):
                continue

            valid_keys = brand_keys if type_key == "brands" else article_keys_by_type.get(type_key, set())
            for category_key, keys in raw_type_map.items():
                normalized_category = str(category_key or INDEX_ALL_KEY).strip().lower() or INDEX_ALL_KEY
                if not isinstance(keys, list):
                    continue

                cleaned: list[str] = []
                for key_value in keys:
                    key = str(key_value or "").strip()
                    if key in valid_keys and key not in cleaned:
                        cleaned.append(key)
                if cleaned:
                    sanitized[type_key][normalized_category] = cleaned

        return sanitized

    def _index_state_from_store(
        self,
        article_keys_by_type: dict[str, set[str]],
        brand_keys: set[str],
    ) -> dict[str, Any]:
        cfg = self.store.get(ConfigStore.CONTENT)
        overrides = self._sanitize_index_overrides(
            cfg.get("indexHeroes", {}),
            article_keys_by_type,
            brand_keys,
        )
        return {
            "activeType": INDEX_TYPES[0],
            "activeCategory": INDEX_ALL_KEY,
            "overrides": overrides,
        }

    def _current_index_state(
        self,
        article_keys_by_type: dict[str, set[str]],
        brand_keys: set[str],
    ) -> dict[str, Any]:
        if self._index_heroes_preview is not None:
            preview = self._index_heroes_preview
            return {
                "activeType": preview["activeType"],
                "activeCategory": preview["activeCategory"],
                "overrides": {
                    type_key: {
                        category: list(keys)
                        for category, keys in preview["overrides"].get(type_key, {}).items()
                    }
                    for type_key in INDEX_TYPES
                },
            }
        return self._index_state_from_store(article_keys_by_type, brand_keys)

    def _sanitize_index_payload(
        self,
        payload: dict[str, Any],
        article_keys_by_type: dict[str, set[str]],
        brand_keys: set[str],
    ) -> dict[str, Any]:
        active_type = str(payload.get("activeType", INDEX_TYPES[0]) or "").strip().lower()
        if active_type not in INDEX_TYPES:
            active_type = INDEX_TYPES[0]

        active_category = str(payload.get("activeCategory", INDEX_ALL_KEY) or "").strip().lower()
        if not active_category:
            active_category = INDEX_ALL_KEY

        overrides = self._sanitize_index_overrides(
            payload.get("overrides", {}),
            article_keys_by_type,
            brand_keys,
        )

        return {
            "activeType": active_type,
            "activeCategory": active_category,
            "overrides": overrides,
        }

    def _eligible_index_articles(
        self,
        articles: list[dict[str, Any]],
        excluded: set[str],
        type_key: str,
    ) -> list[dict[str, Any]]:
        return [
            article for article in articles
            if article["collection"] == type_key
            and article["has_hero"]
            and article["full_article"] is not False
            and not article["draft"]
            and article.get("category_active", True)
            and article["key"] not in excluded
        ]

    def _serialize_index_article(
        self,
        article: dict[str, Any],
        pinned: set[str],
        badges: dict[str, str],
    ) -> dict[str, Any]:
        category_id = str(article.get("category", "") or "").strip().lower()
        return {
            "key": article["key"],
            "type": article["collection"],
            "title": article["title"],
            "category": category_id,
            "categoryLabel": self.store.cat_labels.get(category_id, category_id.title()) if category_id else "",
            "categoryColor": self.store.cat_colors.get(
                category_id,
                INDEX_COLORS.get(article["collection"], self.store.site_accent),
            ),
            "categories": [category_id] if category_id else [],
            "dateText": format_index_date(article),
            "sortDate": article.get("sort_date", "") or "",
            "isPinned": article["key"] in pinned,
            "badge": badges.get(article["key"], ""),
        }

    def _serialize_index_brand(self, brand: dict[str, Any]) -> dict[str, Any]:
        categories = [
            str(category).strip().lower()
            for category in (brand.get("categories") or [])
            if str(category).strip()
        ]
        return {
            "key": brand["key"],
            "type": "brands",
            "title": brand.get("display_name", brand.get("slug", "")),
            "category": "",
            "categoryLabel": "",
            "categoryColor": INDEX_COLORS.get("brands", self.store.site_accent),
            "categories": categories,
            "dateText": "",
            "sortDate": brand.get("sort_date", "") or "",
            "isPinned": False,
            "badge": "",
        }

    def _index_categories_for_type(
        self,
        type_key: str,
        articles: list[dict[str, Any]],
        brands: list[dict[str, Any]],
        excluded: set[str],
    ) -> list[dict[str, Any]]:
        counts: dict[str, int] = {}

        if type_key == "brands":
            eligible_brands = [brand for brand in brands if brand.get("publish", True)]
            for brand in eligible_brands:
                for category in brand.get("categories", []) or []:
                    category_key = str(category or "").strip().lower()
                    if category_key:
                        counts[category_key] = counts.get(category_key, 0) + 1
            total = len(eligible_brands)
        else:
            eligible_articles = self._eligible_index_articles(articles, excluded, type_key)
            for article in eligible_articles:
                category_key = str(article.get("category", "") or "").strip().lower()
                if category_key:
                    counts[category_key] = counts.get(category_key, 0) + 1
            total = len(eligible_articles)

        type_color = INDEX_COLORS.get(type_key, self.store.site_accent)
        # WHY: "All" uses the site accent color, not the type color.
        # Specific categories use their own category color.
        categories = [{
            "key": INDEX_ALL_KEY,
            "label": "All",
            "count": total,
            "color": self.store.site_accent,
        }]
        for category_key in sorted(counts):
            categories.append({
                "key": category_key,
                "label": self.store.cat_labels.get(category_key, category_key.title()),
                "count": counts[category_key],
                "color": self.store.cat_colors.get(category_key, type_color),
            })
        return categories

    def get_index_heroes_payload(self) -> dict[str, Any]:
        self.poll_changes()

        articles, article_map, brands, brand_map = self._load_index_hero_items()
        article_keys_by_type = {
            type_key: {
                article_key for article_key, article in article_map.items()
                if article.get("collection") == type_key
            }
            for type_key in INDEX_ARTICLE_TYPES
        }
        brand_keys = set(brand_map.keys())
        state = self._current_index_state(article_keys_by_type, brand_keys)

        if self._content_preview is not None:
            pinned = set(self._content_preview["pinned"])
            badges = dict(self._content_preview["badges"])
            excluded = set(self._content_preview["excluded"])
        else:
            content_cfg = self.store.get(ConfigStore.CONTENT)
            pinned = {
                str(key).strip()
                for key in content_cfg.get("pinned", [])
                if isinstance(key, str)
            }
            badges = {
                str(key).strip(): str(value).strip()
                for key, value in content_cfg.get("badges", {}).items()
                if isinstance(key, str) and str(value).strip()
            }
            excluded = {
                str(key).strip()
                for key in content_cfg.get("excluded", [])
                if isinstance(key, str)
            }

        categories = {
            type_key: self._index_categories_for_type(type_key, articles, brands, excluded)
            for type_key in INDEX_TYPES
        }
        types = [{
            "key": type_key,
            "label": INDEX_LABELS[type_key],
            "color": INDEX_COLORS[type_key],
            "slotCount": INDEX_HERO_SLOTS[type_key],
        } for type_key in INDEX_TYPES]

        pools: dict[str, list[dict[str, Any]]] = {}
        slots: dict[str, list[dict[str, Any] | None]] = {}

        for type_key in INDEX_TYPES:
            overrides_all = state["overrides"].get(type_key, {}).get(INDEX_ALL_KEY, [])
            override_set = set(overrides_all)
            slot_count = INDEX_HERO_SLOTS[type_key]

            if type_key == "brands":
                eligible_brands = [brand for brand in brands if brand.get("publish", True)]
                pool_brands = [
                    brand for brand in sorted(
                        eligible_brands,
                        key=lambda brand: str(brand.get("display_name", "")).lower(),
                    )
                    if brand["key"] not in override_set
                ]
                pools[type_key] = [self._serialize_index_brand(brand) for brand in pool_brands]

                selected = select_index_brand_algorithm(
                    eligible_brands,
                    "",
                    self.store.cat_ids,
                    overrides=overrides_all if overrides_all else None,
                )
                serialized_slots = [self._serialize_index_brand(brand) for brand in selected[:slot_count]]
            else:
                eligible_articles = self._eligible_index_articles(articles, excluded, type_key)
                by_key = {article["key"]: article for article in eligible_articles}

                manual: list[dict[str, Any]] = []
                used = set()
                for key in overrides_all:
                    article = by_key.get(key)
                    if article and key not in used:
                        manual.append(article)
                        used.add(key)

                remaining = [article for article in eligible_articles if article["key"] not in used]
                auto = select_index_algorithm(
                    remaining,
                    pinned,
                    None,
                    num_slots=slot_count,
                )
                combined = [*manual, *auto][:slot_count]
                serialized_slots = [
                    self._serialize_index_article(article, pinned, badges)
                    for article in combined
                ]

                pool_articles = [article for article in eligible_articles if article["key"] not in override_set]
                pool_articles.sort(key=lambda article: article["title"].lower())
                pool_articles.sort(key=lambda article: article.get("sort_date", "") or "", reverse=True)
                pools[type_key] = [
                    self._serialize_index_article(article, pinned, badges)
                    for article in pool_articles
                ]

            while len(serialized_slots) < slot_count:
                serialized_slots.append(None)
            slots[type_key] = serialized_slots

        active_type = state["activeType"] if state["activeType"] in INDEX_TYPES else INDEX_TYPES[0]
        active_category = state["activeCategory"] or INDEX_ALL_KEY
        category_keys = {category["key"] for category in categories.get(active_type, [])}
        if active_category not in category_keys:
            active_category = INDEX_ALL_KEY

        if active_type == "brands":
            status_right = f"{len(brands)} brands · {len(articles)} articles"
        else:
            type_total = len([
                article for article in articles
                if article["collection"] == active_type
            ])
            status_right = f"{len(articles)} articles · {type_total} {INDEX_LABELS[active_type]}"

        return {
            "types": types,
            "activeType": active_type,
            "activeCategory": active_category,
            "categories": categories,
            "pools": pools,
            "slots": slots,
            "overrides": state["overrides"],
            "statusRight": status_right,
            "version": self._mtimes.get(ConfigStore.CONTENT, 0.0),
        }

    def preview_index_heroes(self, payload: dict[str, Any]) -> dict[str, Any]:
        articles, article_map, brands, brand_map = self._load_index_hero_items()
        article_keys_by_type = {
            type_key: {
                article_key for article_key, article in article_map.items()
                if article.get("collection") == type_key
            }
            for type_key in INDEX_ARTICLE_TYPES
        }
        brand_keys = set(brand_map.keys())
        self._index_heroes_preview = self._sanitize_index_payload(
            payload,
            article_keys_by_type,
            brand_keys,
        )
        return {
            "shell": self.get_shell_payload(),
            "panel": self.get_index_heroes_payload(),
        }

    def save_index_heroes(self, payload: dict[str, Any]) -> dict[str, Any]:
        articles, article_map, brands, brand_map = self._load_index_hero_items()
        article_keys_by_type = {
            type_key: {
                article_key for article_key, article in article_map.items()
                if article.get("collection") == type_key
            }
            for type_key in INDEX_ARTICLE_TYPES
        }
        brand_keys = set(brand_map.keys())
        state = self._sanitize_index_payload(
            payload,
            article_keys_by_type,
            brand_keys,
        )

        existing = dict(self.store.get(ConfigStore.CONTENT))
        existing["indexHeroes"] = build_index_heroes_config(state["overrides"])
        self.store.save(ConfigStore.CONTENT, existing)
        self._index_heroes_preview = None
        self.snapshot()

        saved_at = datetime.now().strftime("%H:%M:%S")
        override_count = sum(
            len(category_map)
            for category_map in state["overrides"].values()
        )
        return {
            "savedAt": saved_at,
            "message": f"Saved ({override_count} hero override groups) at {saved_at}",
            "shell": self.get_shell_payload(),
            "panel": self.get_index_heroes_payload(),
        }


    # ── Navbar panel ──────────────────────────────────────────────────────

    def _current_navbar_section_order(self) -> dict[str, list[str]]:
        if self._navbar_preview_section_order is not None:
            return copy.deepcopy(self._navbar_preview_section_order)
        raw = self.store.get(ConfigStore.NAV_SECTIONS)
        if isinstance(raw, dict):
            return {
                str(k): [str(v) for v in vs] if isinstance(vs, list) else []
                for k, vs in raw.items()
            }
        return {}

    def get_navbar_payload(self) -> dict[str, Any]:
        self.poll_changes()

        content_dir = self.project_root / "src" / "content"
        guides = load_navbar_guides(content_dir / "guides")
        brands = load_navbar_brands(content_dir / "brands")
        games = load_navbar_games(content_dir / "games")

        section_order = self._current_navbar_section_order()

        # Apply brand_categories transient overrides
        brand_cat_overrides = self.store.brand_categories or {}
        if brand_cat_overrides:
            for brand in brands:
                override = brand_cat_overrides.get(brand["filename"])
                if override is not None:
                    brand["categories"] = list(override)

        # Group guides by category → section
        guide_sections: dict[str, list[dict[str, Any]]] = {}
        for category_id in self.store.cat_ids:
            category_guides = [g for g in guides if g["category"] == category_id]
            sections_for_cat = section_order.get(category_id, [])
            section_map: dict[str, list[dict[str, Any]]] = {
                name: [] for name in sections_for_cat
            }
            section_map["Unassigned"] = []

            for guide in category_guides:
                navbar_list = guide.get("navbar", [])
                section = (
                    navbar_list[0]
                    if isinstance(navbar_list, list) and navbar_list
                    else ""
                )
                if section and section in section_map:
                    section_map[section].append({
                        "slug": guide["filename"],
                        "category": guide["category"],
                        "guide": guide["guide"],
                        "title": guide["title"],
                        "section": section,
                    })
                else:
                    section_map["Unassigned"].append({
                        "slug": guide["filename"],
                        "category": guide["category"],
                        "guide": guide["guide"],
                        "title": guide["title"],
                        "section": "",
                    })

            guide_sections[category_id] = [
                {"name": name, "items": sorted(items, key=lambda i: i["guide"].lower())}
                for name, items in section_map.items()
            ]

        # Serialize brands
        brand_items = sorted(
            [
                {
                    "slug": brand["filename"],
                    "displayName": brand["displayName"],
                    "categories": brand.get("categories", []) or [],
                    "navbar": brand.get("navbar", []) or [],
                }
                for brand in brands
            ],
            key=lambda b: b["displayName"].lower(),
        )

        # Serialize games
        game_items = sorted(
            [
                {
                    "slug": game["filename"],
                    "game": game["game"],
                    "title": game["title"],
                    "navbar": bool(game.get("navbar", False)),
                }
                for game in games
            ],
            key=lambda g: g["game"].lower(),
        )

        # Hub categories (read-only)
        hubs = []
        for cat in self.store.categories:
            cat_id = cat.get("id", "")
            product = cat.get("product", {})
            hubs.append({
                "id": cat_id,
                "label": cat.get("label", cat_id.title()),
                "color": self.store.cat_colors.get(cat_id, self.store.site_accent),
                "productActive": bool(product.get("production", False)),
                "viteActive": bool(product.get("vite", False)),
            })

        guide_count = len(guides)
        brand_count = len(brands)
        game_count = len(games)
        active_games = sum(1 for g in game_items if g["navbar"])

        return {
            "guideSections": guide_sections,
            "sectionOrder": section_order,
            "brands": brand_items,
            "games": game_items,
            "hubs": hubs,
            "categoryColors": dict(self.store.cat_colors),
            "categoryLabels": dict(self.store.cat_labels),
            "statusRight": (
                f"{guide_count} guides · {brand_count} brands · "
                f"{game_count} games ({active_games} active)"
            ),
            "version": self._mtimes.get(ConfigStore.NAV_SECTIONS, 0.0),
        }

    def preview_navbar(self, payload: dict[str, Any]) -> dict[str, Any]:
        section_order = payload.get("sectionOrder")
        if section_order is not None and isinstance(section_order, dict):
            sanitized = {
                str(k): [str(v) for v in vs] if isinstance(vs, list) else []
                for k, vs in section_order.items()
            }
            self.store.preview(ConfigStore.NAV_SECTIONS, sanitized)
            self._navbar_preview_section_order = sanitized

        for change in payload.get("brandChanges", []):
            if not isinstance(change, dict):
                continue
            slug = str(change.get("slug", "")).strip()
            if slug:
                cats = change.get("categories", [])
                self.store.brand_categories[slug] = (
                    [str(c) for c in cats] if isinstance(cats, list) else []
                )

        return {
            "shell": self.get_shell_payload(),
            "panel": self.get_navbar_payload(),
        }

    def save_navbar(self, payload: dict[str, Any]) -> dict[str, Any]:
        content_dir = self.project_root / "src" / "content"

        # 1. Save section order
        section_order = payload.get("sectionOrder")
        if section_order is not None and isinstance(section_order, dict):
            sanitized = {
                str(k): [str(v) for v in vs] if isinstance(vs, list) else []
                for k, vs in section_order.items()
            }
            self.store.save(ConfigStore.NAV_SECTIONS, sanitized)

        # 2. Apply guide changes
        guide_map = {
            g["filename"]: g["path"]
            for g in load_navbar_guides(content_dir / "guides")
        }
        for change in payload.get("guideChanges", []):
            if not isinstance(change, dict):
                continue
            slug = str(change.get("slug", "")).strip()
            path = guide_map.get(slug)
            if path and path.is_file():
                navbar = change.get("navbar", [])
                write_navbar_list_field(path, "navbar", navbar if isinstance(navbar, list) else [])

        # 3. Apply brand changes
        brand_map = {
            b["filename"]: b["path"]
            for b in load_navbar_brands(content_dir / "brands")
        }
        for change in payload.get("brandChanges", []):
            if not isinstance(change, dict):
                continue
            slug = str(change.get("slug", "")).strip()
            path = brand_map.get(slug)
            if path and path.is_file():
                cats = change.get("categories", [])
                write_navbar_list_field(
                    path, "categories", cats if isinstance(cats, list) else []
                )
                navbar = change.get("navbar", [])
                write_navbar_list_field(
                    path, "navbar", navbar if isinstance(navbar, list) else []
                )

        # 4. Apply game changes
        game_map = {
            g["filename"]: g["path"]
            for g in load_navbar_games(content_dir / "games")
        }
        for change in payload.get("gameChanges", []):
            if not isinstance(change, dict):
                continue
            slug = str(change.get("slug", "")).strip()
            path = game_map.get(slug)
            if path and path.is_file():
                navbar = bool(change.get("navbar", False))
                write_navbar_list_field(path, "navbar", navbar)

        # 5. Apply renames
        all_maps = {
            "guides": guide_map,
            "brands": brand_map,
            "games": game_map,
        }
        for rename in payload.get("renames", []):
            if not isinstance(rename, dict):
                continue
            collection = str(rename.get("collection", "")).strip()
            slug = str(rename.get("slug", "")).strip()
            field = str(rename.get("field", "")).strip()
            value = str(rename.get("value", "")).strip()
            path_map = all_maps.get(collection, {})
            path = path_map.get(slug)
            if path and path.is_file() and field and value:
                write_navbar_scalar_field(path, field, value)

        # 6. Invalidate
        self.store.brand_categories = {}
        self._navbar_preview_section_order = None
        self.snapshot()

        saved_at = datetime.now().strftime("%H:%M:%S")
        change_count = (
            len(payload.get("guideChanges", []))
            + len(payload.get("brandChanges", []))
            + len(payload.get("gameChanges", []))
            + len(payload.get("renames", []))
        )
        section_saved = section_order is not None
        return {
            "savedAt": saved_at,
            "message": (
                f"Saved navbar ({change_count} changes"
                f"{', section order' if section_saved else ''}) at {saved_at}"
            ),
            "shell": self.get_shell_payload(),
            "panel": self.get_navbar_payload(),
        }


    def get_cache_cdn_payload(self) -> dict[str, Any]:
        self.poll_changes()

        from panels.cache_cdn import normalize_cache_cdn_config

        raw = (
            self._cache_cdn_preview
            if self._cache_cdn_preview is not None
            else self.store.get(ConfigStore.CACHE_CDN)
        )
        config = normalize_cache_cdn_config(raw)

        n_targets = len(config.get("targets", []))
        n_page_types = len(config.get("pageTypes", {}))

        return {
            "config": config,
            "statusRight": f"{n_page_types} page types \u00b7 {n_targets} targets",
            "version": self._mtimes.get(ConfigStore.CACHE_CDN, 0.0),
        }

    def preview_cache_cdn(self, payload: dict[str, Any]) -> dict[str, Any]:
        from panels.cache_cdn import normalize_cache_cdn_config

        config = payload.get("config", {})
        if not isinstance(config, dict):
            config = {}

        self._cache_cdn_preview = normalize_cache_cdn_config(config)
        return {
            "shell": self.get_shell_payload(),
            "panel": self.get_cache_cdn_payload(),
        }

    def save_cache_cdn(self, payload: dict[str, Any]) -> dict[str, Any]:
        from panels.cache_cdn import normalize_cache_cdn_config

        config = payload.get("config", {})
        if not isinstance(config, dict):
            config = {}

        data = normalize_cache_cdn_config(config)
        self.store.save(ConfigStore.CACHE_CDN, data)
        self._cache_cdn_preview = None
        self.snapshot()

        saved_at = datetime.now().strftime("%H:%M:%S")
        n_targets = len(data.get("targets", []))
        return {
            "savedAt": saved_at,
            "message": f"Saved cache-cdn.json ({n_targets} target{'s' if n_targets != 1 else ''}) at {saved_at}",
            "shell": self.get_shell_payload(),
            "panel": self.get_cache_cdn_payload(),
        }


    # ── Ads panel ────────────────────────────────────────────────────

    def get_ads_payload(self) -> dict[str, Any]:
        self.poll_changes()

        from panels.ads import (
            DEFAULT_REGISTRY,
            DEFAULT_INLINE,
            DEFAULT_SPONSORS,
            PUBLIC_ADS_ENABLED_KEY,
            read_env_bool,
            read_text_file,
        )

        if self._ads_preview is not None:
            registry = self._ads_preview.get("registry", copy.deepcopy(DEFAULT_REGISTRY))
            inline = self._ads_preview.get("inline", copy.deepcopy(DEFAULT_INLINE))
            sponsors = self._ads_preview.get("sponsors", copy.deepcopy(DEFAULT_SPONSORS))
            ads_enabled = self._ads_preview.get("adsEnabled", False)
        else:
            registry = self.store.get(ConfigStore.ADS_REGISTRY) or copy.deepcopy(DEFAULT_REGISTRY)
            inline = self.store.get(ConfigStore.INLINE_ADS) or copy.deepcopy(DEFAULT_INLINE)
            sponsors = self.store.get(ConfigStore.SPONSORS) or copy.deepcopy(DEFAULT_SPONSORS)
            env_path = self.project_root / ".env"
            ads_enabled = read_env_bool(
                read_text_file(env_path),
                PUBLIC_ADS_ENABLED_KEY,
                default=False,
            )

        positions = registry.get("positions", {})
        n_positions = len(positions)
        n_enabled = sum(1 for p in positions.values() if p.get("display"))
        n_collections = sum(
            1 for c in inline.get("collections", {}).values() if c.get("enabled")
        )

        max_version = max(
            self._mtimes.get(ConfigStore.ADS_REGISTRY, 0.0),
            self._mtimes.get(ConfigStore.INLINE_ADS, 0.0),
            self._mtimes.get(ConfigStore.SPONSORS, 0.0),
        )

        return {
            "registry": registry,
            "inline": inline,
            "sponsors": sponsors,
            "adsEnabled": ads_enabled,
            "statusRight": f"{n_enabled}/{n_positions} positions · {n_collections} collections",
            "version": max_version,
        }

    def preview_ads(self, payload: dict[str, Any]) -> dict[str, Any]:
        registry = payload.get("registry", {})
        inline = payload.get("inline", {})
        sponsors = payload.get("sponsors", {})
        ads_enabled = payload.get("adsEnabled", False)

        self._ads_preview = {
            "registry": registry if isinstance(registry, dict) else {},
            "inline": inline if isinstance(inline, dict) else {},
            "sponsors": sponsors if isinstance(sponsors, dict) else {},
            "adsEnabled": bool(ads_enabled),
        }
        return {
            "shell": self.get_shell_payload(),
            "panel": self.get_ads_payload(),
        }

    def save_ads(self, payload: dict[str, Any]) -> dict[str, Any]:
        from panels.ads import (
            PUBLIC_ADS_ENABLED_KEY,
            read_text_file,
            upsert_env_value,
        )

        registry = payload.get("registry", {})
        inline = payload.get("inline", {})
        sponsors = payload.get("sponsors", {})
        ads_enabled = payload.get("adsEnabled", False)

        if isinstance(registry, dict):
            self.store.save(ConfigStore.ADS_REGISTRY, registry)
        if isinstance(inline, dict):
            self.store.save(ConfigStore.INLINE_ADS, inline)
        if isinstance(sponsors, dict):
            self.store.save(ConfigStore.SPONSORS, sponsors)

        env_path = self.project_root / ".env"
        env_source = read_text_file(env_path)
        new_env = upsert_env_value(
            env_source,
            PUBLIC_ADS_ENABLED_KEY,
            "true" if ads_enabled else "false",
        )
        env_path.write_text(new_env, encoding="utf-8")

        self._ads_preview = None
        self.snapshot()

        saved_at = datetime.now().strftime("%H:%M:%S")
        n_positions = len(registry.get("positions", {}))
        return {
            "savedAt": saved_at,
            "message": f"Saved ads config ({n_positions} position{'s' if n_positions != 1 else ''}) at {saved_at}",
            "shell": self.get_shell_payload(),
            "panel": self.get_ads_payload(),
        }

    def scan_ads_positions(self) -> dict[str, Any]:
        from panels.ads import scan_all_positions

        src_dir = self.project_root / "src"
        results = scan_all_positions(src_dir)

        registry = self.store.get(ConfigStore.ADS_REGISTRY) or {}
        positions = registry.get("positions", {})
        inline_cfg = self.store.get(ConfigStore.INLINE_ADS) or {}
        collections = inline_cfg.get("collections", {})

        found_positions: set[str] = set()
        rows: list[dict[str, Any]] = []
        for rel_path, line_no, position, _line_text in results:
            pdata = positions.get(position, {})
            rows.append({
                "file": rel_path,
                "line": line_no,
                "position": position,
                "provider": pdata.get("provider", "\u2014"),
                "display": "ON" if pdata.get("display", True) else "OFF",
            })
            found_positions.add(position)

        all_names = set(positions.keys())
        orphans = sorted(all_names - found_positions)

        enabled_colls = [c for c, v in collections.items()
                         if isinstance(v, dict) and v.get("enabled")]
        disabled_colls = [c for c, v in collections.items()
                          if not (isinstance(v, dict) and v.get("enabled"))]

        return {
            "rows": rows,
            "orphans": orphans,
            "enabledCollections": enabled_colls,
            "disabledCollections": disabled_colls,
        }


runtime = ConfigRuntime(_PROJECT_ROOT)
