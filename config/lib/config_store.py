"""
config_store.py — Centralized reactive data layer for EG Config Manager.

All panels read from here instead of loading JSON files directly.
Panels subscribe to keys. When data changes (via save or file watch),
subscribers are notified and can refresh their UI.
"""

import json
from pathlib import Path
from typing import Any


class ConfigStore:
    """Single source of truth for all config data."""

    # Keys
    CATEGORIES = "categories"
    CONTENT = "content"
    SLIDESHOW = "slideshow"
    HUB_TOOLS = "hub_tools"
    NAV_SECTIONS = "nav_sections"
    IMAGE_DEFAULTS = "image_defaults"
    ADS_REGISTRY = "ads_registry"
    INLINE_ADS = "inline_ads"
    SPONSORS = "sponsors"
    CACHE_CDN = "cache_cdn"
    SETTINGS = "settings"

    def __init__(self, root: Path):
        self._root = root
        self._subscribers: dict[str, list] = {}
        self._data: dict[str, Any] = {}
        self._paths: dict[str, Path] = {}
        self._setup_paths()

        # In-memory cross-panel state (no file backing, cleared on save)
        self.brand_categories: dict[str, list[str]] = {}  # slug → categories overrides

        # Derived state (rebuilt from categories)
        self.site_colors: dict[str, str] = {"primary": "#89b4fa", "secondary": "#89b4fa"}
        self.site_accent: str = "#89b4fa"
        self.categories: list[dict] = []
        self.cat_colors: dict[str, str] = {}
        self.cat_labels: dict[str, str] = {}
        self.cat_ids: list[str] = []
        self.active_product_cats: set[str] = set()
        self.active_content_cats: set[str] = set()

        self.reload_all()

    def _setup_paths(self):
        d = self._root / "config" / "data"
        self._paths = {
            self.CATEGORIES:     d / "categories.json",
            self.CONTENT:        d / "content.json",
            self.SLIDESHOW:      d / "slideshow.json",
            self.HUB_TOOLS:      d / "hub-tools.json",
            self.NAV_SECTIONS:   d / "navbar-guide-sections.json",
            self.IMAGE_DEFAULTS: d / "image-defaults.json",
            self.ADS_REGISTRY:   d / "ads-registry.json",
            self.INLINE_ADS:     d / "inline-ads-config.json",
            self.SPONSORS:       d / "direct-sponsors.json",
            self.CACHE_CDN:      d / "cache-cdn.json",
            self.SETTINGS:       d / "settings.json",
        }

    def _load_json(self, path: Path) -> Any:
        if path.is_file():
            return json.loads(path.read_text(encoding="utf-8"))
        return {}

    def reload(self, key: str) -> bool:
        """Reload a single config from disk.

        Returns True if data changed and subscribers were notified.
        Returns False if data was identical (no-op).
        """
        if key not in self._paths:
            return False
        new_data = self._load_json(self._paths[key])
        old_data = self._data.get(key)
        if new_data == old_data:
            return False
        self._data[key] = new_data
        self._rebuild_derived(key)
        self.notify(key)
        return True

    def _reload_without_notify(self, key: str):
        """Load data without notifying subscribers. Used during bulk reload."""
        if key in self._paths:
            self._data[key] = self._load_json(self._paths[key])

    def reload_all(self):
        """Reload all configs from disk and notify all subscribers."""
        for key in self._paths:
            self._reload_without_notify(key)
        self._rebuild_derived(self.CATEGORIES)
        self._notify_all()

    def _rebuild_derived(self, key: str):
        """Recompute derived state from raw data."""
        if key == self.CATEGORIES:
            raw = self._data.get(self.CATEGORIES, {})
            cats = raw.get("categories", [])
            self.site_colors = raw.get("siteColors",
                {"primary": "#89b4fa", "secondary": "#89b4fa"})
            self.site_accent = self.site_colors.get("primary", "#89b4fa")
            self.categories = cats
            self.cat_colors = {c["id"]: c.get("color", self.site_accent)
                               for c in cats}
            self.cat_labels = {c["id"]: c.get("label", c["id"].title())
                               for c in cats}
            self.cat_ids = [c["id"] for c in cats]
            self.active_product_cats = {
                c["id"] for c in cats
                if c.get("product", {}).get("production")
                or c.get("product", {}).get("vite")}
            self.active_content_cats = {
                c["id"] for c in cats
                if c.get("content", {}).get("production")
                or c.get("content", {}).get("vite")}

    # ── Subscribe / Notify ──────────────────────────────────────────────────

    def subscribe(self, key: str, callback):
        """Register a callback for changes to a specific config key."""
        self._subscribers.setdefault(key, []).append(callback)

    def unsubscribe(self, key: str, callback):
        """Remove a callback for a specific config key."""
        if key in self._subscribers:
            self._subscribers[key] = [
                cb for cb in self._subscribers[key] if cb is not callback]

    def notify(self, key: str):
        """Fire all callbacks registered for a key."""
        for cb in self._subscribers.get(key, []):
            cb()

    def _notify_all(self):
        """Fire all subscribers for all keys."""
        notified = set()
        for key in self._paths:
            for cb in self._subscribers.get(key, []):
                if cb not in notified:
                    cb()
                    notified.add(cb)

    # ── Accessors ───────────────────────────────────────────────────────────

    def get(self, key: str) -> Any:
        """Get the current data for a key."""
        return self._data.get(key, {})

    def path_for(self, key: str) -> Path | None:
        """Get the filesystem path for a config key."""
        return self._paths.get(key)

    # ── Preview (live in-memory propagation) ─────────────────────────────────

    def preview(self, key: str, data: Any):
        """Update in-memory state and notify subscribers WITHOUT writing to disk.

        Used for live cross-panel propagation before save. Panels subscribed
        to this key will see the new data via get() and derived state
        (cat_colors, site_accent, etc.) immediately.
        """
        self._data[key] = data
        self._rebuild_derived(key)
        self.notify(key)

    # ── Save ────────────────────────────────────────────────────────────────

    def save(self, key: str, data: Any):
        """Write data to disk, update internal state, notify subscribers."""
        path = self._paths.get(key)
        if not path:
            raise ValueError(f"No path for key: {key}")
        path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8")
        self._data[key] = data
        self._rebuild_derived(key)
        self.notify(key)
