"""
Index Heroes panel — editorial hero selection for /reviews, /news, /guides, /brands pages.

3-slot hero dashboard for article types (reviews/news/guides),
6-slot dashboard for brands, with per-category overrides.
Reads article/brand frontmatter from src/content/ (read-only).
Reads/writes config/data/content.json via ConfigStore (indexHeroes key).
"""

import json
import re
import tkinter as tk
from tkinter import ttk
from datetime import datetime
from pathlib import Path

from lib.shared import (
    C, F, FlatBtn, HoverTooltip,
    darken,
)
from lib.config_store import ConfigStore


# ── Constants ────────────────────────────────────────────────────────────────

INDEX_TYPES = ["reviews", "news", "guides", "brands"]
INDEX_LABELS = {"reviews": "Reviews", "news": "News", "guides": "Guides", "brands": "Brands"}
INDEX_COLORS = {"reviews": C.BLUE, "news": C.PEACH, "guides": C.GREEN, "brands": C.MAUVE}
HERO_SLOTS = {"reviews": 3, "news": 3, "guides": 3, "brands": 6}
ARTICLE_TYPES = {"reviews", "news", "guides"}
ALL_KEY = "_all"


# ── Data Helpers (pure functions, no tkinter) ────────────────────────────────

def date_ts(iso) -> float:
    """Parse ISO date string to timestamp, 0 if empty/invalid."""
    if not iso:
        return 0.0
    try:
        return datetime.strptime(str(iso)[:10], "%Y-%m-%d").timestamp()
    except (ValueError, IndexError):
        return 0.0


def fmt_date(article: dict) -> str:
    """Format date as MM-DD-YY with 'p' (published) or 'u' (updated) suffix."""
    dp = article.get("date_published", "") or ""
    du = article.get("date_updated", "") or ""
    if du and du >= dp:
        iso = du
        suffix = "u"
    elif dp:
        iso = dp
        suffix = "p"
    else:
        return "\u2014"
    try:
        d = datetime.strptime(iso[:10], "%Y-%m-%d")
        return f"{d.strftime('%m-%d-%y')} {suffix}"
    except (ValueError, IndexError):
        return "\u2014"


def parse_frontmatter(path: Path) -> dict:
    """Read YAML frontmatter between --- delimiters."""
    import yaml
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
        parts = text.split("---", 2)
        if len(parts) < 3:
            return {}
        return yaml.safe_load(parts[1]) or {}
    except Exception:
        return {}


def entry_id(filepath: Path, content_dir: Path) -> str:
    """Derive slug-folder entry ID (strip /index)."""
    rel = filepath.relative_to(content_dir)
    parts = rel.with_suffix("").parts
    if parts and parts[-1] == "index":
        if len(parts) == 1:
            return ""
        return "/".join(parts[:-1])
    return "/".join(parts)


def load_articles(content_dir: Path, images_dir: Path,
                  active_content_cats: set) -> list[dict]:
    """Scan reviews, news, guides content dirs, build article dicts."""
    articles = []
    for collection in ARTICLE_TYPES:
        cdir = content_dir / collection
        if not cdir.is_dir():
            continue
        for path in sorted(cdir.rglob("*")):
            if path.suffix not in (".md", ".mdx") or not path.is_file():
                continue
            fm = parse_frontmatter(path)
            if not fm:
                continue
            eid = entry_id(path, cdir)
            if not eid:
                continue

            key = f"{collection}:{eid}"
            title = fm.get("title", eid)
            date_pub = str(fm.get("datePublished", "") or "")
            date_upd = str(fm.get("dateUpdated", "") or "")
            sort_date = max(date_pub, date_upd)
            category = str(fm.get("category", "") or "")
            hero_img = fm.get("hero", "")
            full_article = fm.get("publish", True)
            draft = fm.get("draft", False)
            has_hero = bool(hero_img) or (images_dir / collection / eid).is_dir()

            category_active = category in active_content_cats if category else True

            articles.append({
                "key": key,
                "collection": collection,
                "entry_id": eid,
                "title": title,
                "date_published": date_pub,
                "date_updated": date_upd,
                "sort_date": sort_date,
                "category": category,
                "has_hero": has_hero,
                "full_article": full_article,
                "draft": draft,
                "category_active": category_active,
            })
    return articles


def load_brands(content_dir: Path, images_dir: Path) -> list[dict]:
    """Scan src/content/brands/*/index.md, return brand dicts."""
    brands = []
    brands_dir = content_dir / "brands"
    if not brands_dir.is_dir():
        return brands
    for path in sorted(brands_dir.rglob("*")):
        if path.suffix not in (".md", ".mdx") or not path.is_file():
            continue
        fm = parse_frontmatter(path)
        if not fm:
            continue
        eid = entry_id(path, brands_dir)
        if not eid:
            continue
        slug = eid
        display_name = fm.get("displayName", "") or fm.get("brand", slug)
        categories = fm.get("categories", [])
        if isinstance(categories, str):
            categories = [categories]
        publish = fm.get("publish", True)
        i_dashboard = str(fm.get("iDashboard", "") or "")
        i_filtered = str(fm.get("iFilteredDashboard", "") or "")
        # WHY: max(datePublished, dateUpdated) — same as article sort_date logic
        date_pub = str(fm.get("datePublished", "") or "")
        date_upd = str(fm.get("dateUpdated", "") or "")
        sort_date = max(date_pub, date_upd)
        logo_dir = images_dir / "brands" / slug
        has_logo = logo_dir.is_dir() and any(logo_dir.glob("brand-logo-*"))

        brands.append({
            "key": slug,
            "slug": slug,
            "display_name": display_name,
            "categories": categories if isinstance(categories, list) else [],
            "publish": publish is not False,
            "iDashboard": i_dashboard,
            "iFilteredDashboard": i_filtered,
            "sort_date": sort_date,
            "has_logo": has_logo,
        })
    return brands


# ── Brand dashboard selector (date-based, mirrors JS selectBrandDashboard) ───
# WHY: Same algorithm as articles — overrides → iDashboard → date sort → diversity.

def _primary_cat(brand: dict, categories: list) -> str:
    """Get first matching category from preferred order."""
    cats = brand.get("categories", [])
    if not cats:
        return ""
    for cat in categories:
        if cat in cats:
            return cat
    return cats[0]


def select_brand_algorithm(brands, category_slug, categories,
                           overrides=None):
    """Date-based brand selector — matches JS selectBrandDashboard exactly.
    Priority: overrides → iDashboard/iFilteredDashboard → date desc → diversity."""
    if not brands:
        return []
    cat = (category_slug or "").strip().lower()
    eligible = [b for b in brands if not cat or cat in (b.get("categories") or [])]
    if not eligible:
        return []

    result = []
    used = set()

    # Step 1: Config overrides (highest priority)
    if overrides:
        for slug in overrides:
            if len(result) >= 6:
                break
            match = next((b for b in eligible if b["slug"] == slug), None)
            if match and match["slug"] not in used:
                result.append(match)
                used.add(match["slug"])
        if len(result) >= 6:
            return result

    # Step 2: iDashboard / iFilteredDashboard pins
    pinned_slots = [None] * 6
    if not cat:
        for b in eligible:
            idash = str(b.get("iDashboard") or "").strip().lower()
            if not idash or b["slug"] in used:
                continue
            m = re.match(r'^all_([1-6])$', idash)
            if m:
                slot = int(m.group(1)) - 1
                if pinned_slots[slot] is None:
                    pinned_slots[slot] = b
    else:
        for b in eligible:
            ifd = str(b.get("iFilteredDashboard") or "").strip().lower()
            if not ifd or b["slug"] in used:
                continue
            m = re.match(r'^([a-z0-9_-]+)_([1-6])$', ifd)
            if m and m.group(1) == cat:
                slot = int(m.group(2)) - 1
                if pinned_slots[slot] is None:
                    pinned_slots[slot] = b

    for b in pinned_slots:
        if b is None or b["slug"] in used:
            continue
        if len(result) >= 6:
            break
        result.append(b)
        used.add(b["slug"])

    if len(result) >= 6:
        return result

    # Step 3: Sort remaining by date descending (newest first), slug A-Z as tie-breaker
    pool = [b for b in eligible if b["slug"] not in used]
    pool.sort(key=lambda b: b["slug"])  # secondary: slug A-Z
    pool.sort(key=lambda b: b.get("sort_date") or "", reverse=True)  # primary: date desc
    unpinned = pool

    # Step 4: Fill with category diversity (all-view) or simple fill (category view)
    if not cat:
        used_cats = {_primary_cat(b, categories) for b in result}

        # First pass: prefer brands from unseen categories
        for b in unpinned:
            if len(result) >= 6:
                break
            pc = _primary_cat(b, categories)
            if pc not in used_cats:
                result.append(b)
                used.add(b["slug"])
                used_cats.add(pc)

        # Second pass: fill remaining from any category
        for b in unpinned:
            if len(result) >= 6:
                break
            if b["slug"] in used:
                continue
            result.append(b)
            used.add(b["slug"])
    else:
        for b in unpinned:
            if len(result) >= 6:
                break
            result.append(b)
            used.add(b["slug"])

    return result[:6]


def select_algorithm(articles: list[dict], pinned: set,
                     category_slug: str | None = None,
                     num_slots: int = 3) -> list[dict]:
    """Pure algorithm: pinned first -> date -> category diversity. Returns up to num_slots."""
    eligible = [
        a for a in articles
        if a["has_hero"]
        and a["full_article"] is not False
        and not a["draft"]
        and a.get("category_active", True)
    ]
    if category_slug:
        eligible = [a for a in eligible if a["category"] == category_slug]

    # Separate pinned from unpinned
    pinned_items = [a for a in eligible if a["key"] in pinned]
    pinned_keys = {a["key"] for a in pinned_items}
    unpinned = sorted(
        [a for a in eligible if a["key"] not in pinned_keys],
        key=lambda a: a["sort_date"] or "",
        reverse=True,
    )

    result = []
    used = set()

    # Fill pinned first
    for a in pinned_items:
        if len(result) >= num_slots:
            break
        result.append(a)
        used.add(a["key"])

    # Fill from unpinned with diversity (all-view only)
    use_diversity = not category_slug
    if use_diversity:
        used_cats = {a["category"] for a in result}
        for a in unpinned:
            if len(result) >= num_slots:
                break
            if a["key"] in used:
                continue
            if a["category"] not in used_cats:
                result.append(a)
                used.add(a["key"])
                used_cats.add(a["category"])
        for a in unpinned:
            if len(result) >= num_slots:
                break
            if a["key"] in used:
                continue
            result.append(a)
            used.add(a["key"])
    else:
        for a in unpinned:
            if len(result) >= num_slots:
                break
            if a["key"] in used:
                continue
            result.append(a)
            used.add(a["key"])

    return result


def build_index_heroes(hero_overrides: dict) -> dict:
    """Build indexHeroes section from in-memory state."""
    result = {}
    for type_key in INDEX_TYPES:
        type_data = hero_overrides.get(type_key, {})
        # Only include non-empty category arrays
        result[type_key] = {
            cat_key: list(keys)
            for cat_key, keys in type_data.items()
            if keys
        }
    return result


# ── Panel Class ──────────────────────────────────────────────────────────────

class IndexHeroesPanel(tk.Frame):
    """Index Heroes panel for the mega-app."""

    def __init__(self, parent: tk.Widget, app):
        super().__init__(parent, bg=C.MANTLE)
        self._app = app
        self._project_root = app.store._root
        self._content_dir = self._project_root / "src" / "content"
        self._images_dir = self._project_root / "public" / "images"

        # Load articles from disk
        self.all_articles = load_articles(
            self._content_dir, self._images_dir,
            app.store.active_content_cats)
        self._article_map: dict[str, dict] = {
            a["key"]: a for a in self.all_articles
        }

        # Load brands from disk
        self.all_brands = load_brands(self._content_dir, self._images_dir)
        self._brand_map: dict[str, dict] = {
            b["key"]: b for b in self.all_brands
        }

        # Load config from store
        cfg = app.store.get(ConfigStore.CONTENT)
        self._pinned: set[str] = set(cfg.get("pinned", []))
        self._badges: dict[str, str] = dict(cfg.get("badges", {}))
        self._excluded: set[str] = set(cfg.get("excluded", []))

        # Index heroes: { type: { cat_key: [keys] } }
        raw_heroes = cfg.get("indexHeroes", {})
        self._hero_overrides: dict[str, dict[str, list[str]]] = {}
        for t in INDEX_TYPES:
            self._hero_overrides[t] = {}
            valid_map = self._brand_map if t == "brands" else self._article_map
            for cat_key, keys in raw_heroes.get(t, {}).items():
                valid = [k for k in keys if k in valid_map]
                if valid:
                    self._hero_overrides[t][cat_key] = valid

        # Snapshot for dirty tracking
        self._original = self._snapshot()

        # UI state
        self._active_type = INDEX_TYPES[0]
        self._active_category = ALL_KEY
        self._type_btns: dict[str, tk.Frame] = {}
        self._cat_btns: dict[str, tk.Frame] = {}

        # Drag state
        self._drag_src: str | None = None
        self._drag_key: str | None = None
        self._drag_ghost: tk.Toplevel | None = None

        # Scrollable canvases
        self._scrollable_canvases: list[tk.Canvas] = []

        # Pool mode tracking (for Treeview rebuild on type switch)
        self._pool_mode: str | None = None

        # Build UI
        self._setup_styles()
        self._build_ui()

        # Subscribe to config changes
        app.store.subscribe(ConfigStore.CONTENT, self._on_external_change)
        app.store.subscribe("brand_categories", self._on_brand_categories_change)
        app.store.subscribe("content_editorial", self._on_content_editorial)

        # Initial refresh
        self._refresh_all()

        # Status
        self._update_status()

    def _is_brand_mode(self) -> bool:
        return self._active_type == "brands"

    def _num_slots(self) -> int:
        return HERO_SLOTS[self._active_type]

    def _update_status(self):
        if self._is_brand_mode():
            total = len(self.all_brands)
            self._app.set_status_right(
                f"{total} brands  \u00b7  "
                f"{len(self.all_articles)} articles")
        else:
            total = len(self.all_articles)
            for_type = len([a for a in self.all_articles
                            if a["collection"] == self._active_type])
            self._app.set_status_right(
                f"{total} articles  \u00b7  "
                f"{for_type} {INDEX_LABELS[self._active_type]}")

    def _snapshot(self) -> str:
        data = build_index_heroes(self._hero_overrides)
        return json.dumps(data, sort_keys=True)

    def has_changes(self) -> bool:
        return self._snapshot() != self._original

    def save(self) -> bool:
        """Save index heroes via ConfigStore. Returns True if saved."""
        if not self.has_changes():
            self._app.toast.show("No changes to save", C.OVERLAY0)
            return False
        try:
            # Read full config, update indexHeroes, save back
            cfg = dict(self._app.store.get(ConfigStore.CONTENT))
            cfg["indexHeroes"] = build_index_heroes(self._hero_overrides)
            self._app.watcher.pause()
            self._app.store.save(ConfigStore.CONTENT, cfg)
            self._app.watcher.snapshot()
            self._app.watcher.resume()

            self._original = self._snapshot()
            self._app.update_changes_badge()
            self._refresh_all()

            now = datetime.now().strftime("%H:%M:%S")
            overrides = sum(
                len(cats) for cats in self._hero_overrides.values())
            self._app.toast.show(
                f"Saved ({overrides} hero overrides) at {now}", C.GREEN)
            return True
        except Exception as e:
            self._app.toast.show(f"Error: {e}", C.RED)
            return False

    def _on_content_editorial(self):
        """Handle Content panel editing pins/badges/excluded (unsaved).

        Syncs in-memory state from Content panel so hero previews stay
        accurate without requiring a tab switch or save.
        """
        content_panel = self._app._panels.get("Content")
        if content_panel and hasattr(content_panel, "_pinned"):
            new_pinned = set(content_panel._pinned)
            new_badges = dict(content_panel._badges)
            new_excluded = set(content_panel._excluded)
        else:
            return  # Content panel not loaded yet, nothing to sync
        if (new_pinned != self._pinned or new_badges != self._badges
                or new_excluded != self._excluded):
            self._pinned = new_pinned
            self._badges = new_badges
            self._excluded = new_excluded
            self._refresh_all()

    def _on_brand_categories_change(self):
        """Handle navbar panel editing brand categories (unsaved).

        Re-reads brands from disk, merges in-memory categories overrides,
        and refreshes the hero preview — but only if we're on the brands tab.
        """
        if self._is_brand_mode():
            self._refresh_all()

    def _on_external_change(self):
        """Handle CONTENT store change (e.g., Content panel saved).
        WHY: Only update shared/read state (pins/badges/excluded).
        Preserve hero_overrides (owned state) if this panel has unsaved changes."""
        cfg = self._app.store.get(ConfigStore.CONTENT)
        self._pinned = set(cfg.get("pinned", []))
        self._badges = dict(cfg.get("badges", {}))
        self._excluded = set(cfg.get("excluded", []))
        if not self.has_changes():
            # No local changes — safe to also sync hero overrides from store
            raw_heroes = cfg.get("indexHeroes", {})
            for t in INDEX_TYPES:
                self._hero_overrides[t] = {}
                valid_map = self._brand_map if t == "brands" else self._article_map
                for cat_key, keys in raw_heroes.get(t, {}).items():
                    valid = [k for k in keys if k in valid_map]
                    if valid:
                        self._hero_overrides[t][cat_key] = valid
            self._original = self._snapshot()
        self._refresh_all()
        self._app.update_changes_badge()

    def _on_tab_change(self):
        """Re-read shared state (pins/badges/excluded) when tab becomes visible.
        WHY: Content panel may have changed these in-memory without saving.
        Read directly from Content panel instance for live sync."""
        content_panel = self._app._panels.get("Content")
        if content_panel and hasattr(content_panel, "_pinned"):
            new_pinned = set(content_panel._pinned)
            new_badges = dict(content_panel._badges)
            new_excluded = set(content_panel._excluded)
        else:
            cfg = self._app.store.get(ConfigStore.CONTENT)
            new_pinned = set(cfg.get("pinned", []))
            new_badges = dict(cfg.get("badges", {}))
            new_excluded = set(cfg.get("excluded", []))
        if (new_pinned != self._pinned or new_badges != self._badges
                or new_excluded != self._excluded):
            self._pinned = new_pinned
            self._badges = new_badges
            self._excluded = new_excluded
            self._refresh_all()

    def _on_categories_change(self):
        """Refresh when category colors/flags change."""
        for art in self.all_articles:
            cat = art.get("category", "")
            if cat:
                art["category_active"] = cat in self._app.store.active_content_cats
        self._refresh_all()

    # ── Styles ────────────────────────────────────────────────────────────

    def _setup_styles(self):
        s = ttk.Style()
        s.configure("IndexPool.Treeview",
                     background=C.SURFACE0,
                     foreground=C.SUBTEXT1,
                     fieldbackground=C.SURFACE0,
                     font=F.MONO,
                     rowheight=24,
                     borderwidth=0)
        s.configure("IndexPool.Treeview.Heading",
                     background=C.SURFACE1,
                     foreground=C.OVERLAY0,
                     font=F.MONO_SMALL,
                     borderwidth=0,
                     relief="flat")
        s.map("IndexPool.Treeview",
              background=[("selected", C.BLUE)],
              foreground=[("selected", C.CRUST)])

    # ── Build UI ──────────────────────────────────────────────────────────

    def _build_ui(self):
        # Type tabs across the top
        type_bar = tk.Frame(self, bg=C.MANTLE)
        type_bar.pack(fill="x", padx=16, pady=(12, 0))

        tk.Label(type_bar, text="Index Page Heroes",
                 bg=C.MANTLE, fg=C.TEXT,
                 font=F.HEADING).pack(side="left", padx=(0, 20))

        for t in INDEX_TYPES:
            self._build_type_btn(type_bar, t)

        # Explanation
        info_bar = tk.Frame(self, bg=C.MANTLE)
        info_bar.pack(fill="x", padx=16, pady=(6, 0))
        self._info_lbl = tk.Label(
            info_bar,
            text=self._info_text(),
            bg=C.MANTLE, fg=C.OVERLAY0, font=F.SMALL,
        )
        self._info_lbl.pack(side="left")

        # Main content: category sidebar + hero slots + article pool
        self._main = tk.Frame(self, bg=C.MANTLE)
        self._main.pack(fill="both", expand=True, padx=16, pady=(8, 16))

        # Category sidebar (left)
        self._cat_sidebar = tk.Frame(self._main, bg=C.SURFACE0, width=160,
                                      highlightthickness=1,
                                      highlightbackground=C.CARD_BORDER)
        self._cat_sidebar.pack(side="left", fill="y", padx=(0, 8))
        self._cat_sidebar.pack_propagate(False)

        # Center: hero slots + pool
        center = tk.Frame(self._main, bg=C.MANTLE)
        center.pack(side="left", fill="both", expand=True)

        # Hero slots (top)
        self._slots_frame = tk.Frame(center, bg=C.MANTLE)
        self._slots_frame.pack(fill="x", pady=(0, 8))

        # Article/brand pool (bottom)
        self._pool_frame = tk.Frame(center, bg=C.SURFACE0,
                                     highlightthickness=1,
                                     highlightbackground=C.CARD_BORDER)
        self._pool_frame.pack(fill="both", expand=True)

        self._build_pool_ui()

    def _info_text(self) -> str:
        if self._is_brand_mode():
            return ("Select up to 6 hero brands for the top of /brands/. "
                    "Empty = auto-fill (iDashboard pins, then daily rotation).")
        return ("Select 3 hero articles for the top of each index page. "
                "Empty = auto-fill (pinned first, then newest).")

    def _build_type_btn(self, parent, type_key: str):
        color = INDEX_COLORS[type_key]
        label = INDEX_LABELS[type_key]

        btn = tk.Frame(parent, bg=C.SURFACE1, cursor="hand2",
                       padx=2, pady=2)
        btn.pack(side="left", padx=3)

        lbl = tk.Label(btn, text=f"  {label}  ", bg=C.SURFACE1,
                       fg=C.SUBTEXT0, font=F.BODY_BOLD, cursor="hand2")
        lbl.pack()

        btn._type = type_key
        btn._color = color
        btn._lbl = lbl
        self._type_btns[type_key] = btn

        def click(e, t=type_key):
            self._active_type = t
            self._active_category = ALL_KEY
            self._sync_type_btns()
            self._info_lbl.configure(text=self._info_text())
            self._refresh_all()
            self._update_status()

        for w in (btn, lbl):
            w.bind("<Button-1>", click)

    def _sync_type_btns(self):
        for t, btn in self._type_btns.items():
            is_active = t == self._active_type
            bg = C.SURFACE0 if is_active else C.SURFACE1
            fg = btn._color if is_active else C.SUBTEXT0
            btn.configure(bg=bg)
            btn._lbl.configure(bg=bg, fg=fg)

    # ── Category Sidebar ──────────────────────────────────────────────────

    def _refresh_cat_sidebar(self):
        for w in self._cat_sidebar.winfo_children():
            w.destroy()
        self._cat_btns.clear()

        accent = INDEX_COLORS[self._active_type]

        # Accent bar at top
        tk.Frame(self._cat_sidebar, bg=accent, height=3).pack(fill="x")

        tk.Label(self._cat_sidebar, text="Category",
                 bg=C.SURFACE0, fg=C.TEXT, font=F.BODY_BOLD,
                 ).pack(fill="x", padx=12, pady=(10, 6))

        cat_ids = self._app.store.cat_ids
        cat_labels = self._app.store.cat_labels

        if self._is_brand_mode():
            # Brand mode: count by categories membership
            brands = self._get_eligible_brands()
            all_count = len(brands)
            self._build_cat_btn(ALL_KEY, f"All ({all_count})", accent)
            for cat_id in cat_ids:
                cat_brands = [b for b in brands if cat_id in b["categories"]]
                if not cat_brands:
                    continue
                label = cat_labels.get(cat_id, cat_id.title())
                cat_color = self._app.store.cat_colors.get(cat_id, accent)
                self._build_cat_btn(cat_id, f"{label} ({len(cat_brands)})",
                                    cat_color)
        else:
            # Article mode: count by category field
            type_arts = self._get_type_articles()
            all_count = len(type_arts)
            self._build_cat_btn(ALL_KEY, f"All ({all_count})", accent)
            for cat_id in cat_ids:
                cat_arts = [a for a in type_arts if a["category"] == cat_id]
                if not cat_arts:
                    continue
                label = cat_labels.get(cat_id, cat_id.title())
                cat_color = self._app.store.cat_colors.get(cat_id, accent)
                self._build_cat_btn(cat_id, f"{label} ({len(cat_arts)})",
                                    cat_color)

        self._sync_cat_btns()

    def _build_cat_btn(self, cat_key: str, label: str, color: str):
        btn = tk.Frame(self._cat_sidebar, bg=C.SURFACE0, cursor="hand2")
        btn.pack(fill="x", padx=6, pady=1)

        # Indicator
        indicator = tk.Frame(btn, bg=C.SURFACE0, width=3)
        indicator.pack(side="left", fill="y")

        lbl = tk.Label(btn, text=label, bg=C.SURFACE0,
                       fg=C.SUBTEXT0, font=F.SMALL,
                       anchor="w", cursor="hand2", padx=8, pady=6)
        lbl.pack(side="left", fill="x", expand=True)

        btn._cat = cat_key
        btn._color = color
        btn._indicator = indicator
        btn._lbl = lbl
        self._cat_btns[cat_key] = btn

        def click(e, c=cat_key):
            self._active_category = c
            self._sync_cat_btns()
            self._refresh_slots()
            self._refresh_pool()

        for w in (btn, indicator, lbl):
            w.bind("<Button-1>", click)
            w.bind("<Enter>",
                   lambda e, b=btn: self._cat_hover(b, True))
            w.bind("<Leave>",
                   lambda e, b=btn: self._cat_hover(b, False))

    def _cat_hover(self, btn, entering: bool):
        if btn._cat == self._active_category:
            return
        bg = C.SURFACE1 if entering else C.SURFACE0
        for w in (btn, btn._indicator, btn._lbl):
            w.configure(bg=bg)

    def _sync_cat_btns(self):
        for cat_key, btn in self._cat_btns.items():
            is_active = cat_key == self._active_category
            bg = C.SURFACE1 if is_active else C.SURFACE0
            fg = btn._color if is_active else C.SUBTEXT0
            ind_bg = btn._color if is_active else C.SURFACE0
            btn.configure(bg=bg)
            btn._indicator.configure(bg=ind_bg)
            btn._lbl.configure(bg=bg, fg=fg)

    # ── Data ──────────────────────────────────────────────────────────────

    def _get_type_articles(self) -> list[dict]:
        """Get eligible articles for the active type."""
        return [
            a for a in self.all_articles
            if a["collection"] == self._active_type
            and a["has_hero"]
            and a["full_article"] is not False
            and not a["draft"]
            and a["key"] not in self._excluded
            and a.get("category_active", True)
        ]

    def _reload_brands(self):
        """Re-read brand frontmatter from disk (29 files, instant).

        Merges any in-memory categories overrides from the navbar panel
        (store.brand_categories) on top of disk data so cross-panel edits
        propagate to the brand hero preview without saving.
        """
        self.all_brands = load_brands(self._content_dir, self._images_dir)
        # Apply unsaved categories edits from the navbar panel
        overrides = self._app.store.brand_categories
        if overrides:
            for b in self.all_brands:
                if b["key"] in overrides:
                    b["categories"] = list(overrides[b["key"]])
        self._brand_map = {b["key"]: b for b in self.all_brands}

    def _get_eligible_brands(self) -> list[dict]:
        """Get all publishable brands (re-reads disk for live changes)."""
        self._reload_brands()
        return [b for b in self.all_brands if b["publish"]]

    def _get_filtered_brands(self) -> list[dict]:
        """Get brands for active category, sorted A-Z."""
        brands = self._get_eligible_brands()
        if self._active_category != ALL_KEY:
            brands = [b for b in brands
                      if self._active_category in b["categories"]]
        return sorted(brands, key=lambda b: b["display_name"].lower())

    def _get_filtered_articles(self) -> list[dict]:
        """Get articles for active type + category."""
        arts = self._get_type_articles()
        if self._active_category != ALL_KEY:
            arts = [a for a in arts if a["category"] == self._active_category]
        return sorted(arts, key=lambda a: a["sort_date"] or "", reverse=True)

    def _get_current_overrides(self) -> list[str]:
        """Get override keys for active type + category."""
        t = self._active_type
        cat = self._active_category
        return list(self._hero_overrides.get(t, {}).get(cat, []))

    def _get_current_heroes(self) -> list[dict | None]:
        """Get hero items for current type+category.
        Uses overrides if set, otherwise algorithm."""
        overrides = self._get_current_overrides()
        num_slots = self._num_slots()

        if self._is_brand_mode():
            brands = self._get_eligible_brands()
            cat = self._active_category if self._active_category != ALL_KEY else ""
            categories = self._app.store.cat_ids

            # WHY: Single pass — mirrors JS selectBrandDashboard() exactly.
            # Overrides → iDashboard → date sort → diversity, all handled internally.
            return select_brand_algorithm(
                brands, cat, categories,
                overrides=overrides if overrides else None)
        else:
            # Article mode
            cat_slug = self._active_category if self._active_category != ALL_KEY else None
            if overrides:
                result = []
                for key in overrides:
                    art = self._article_map.get(key)
                    if art:
                        result.append(art)
                if len(result) < num_slots:
                    used = {a["key"] for a in result}
                    eligible = self._get_filtered_articles()
                    algo = select_algorithm(
                        [a for a in eligible if a["key"] not in used],
                        self._pinned, cat_slug, num_slots=num_slots)
                    for a in algo:
                        if len(result) >= num_slots:
                            break
                        if a["key"] not in used:
                            result.append(a)
                            used.add(a["key"])
                return result[:num_slots]
            else:
                eligible = self._get_filtered_articles()
                return select_algorithm(eligible, self._pinned, cat_slug,
                                        num_slots=num_slots)

    def _compute_brand_autofill(self) -> list[dict]:
        """Compute what pure auto-fill (no config overrides) would produce for brands."""
        brands = self._get_eligible_brands()
        cat = self._active_category if self._active_category != ALL_KEY else ""
        categories = self._app.store.cat_ids
        return select_brand_algorithm(brands, cat, categories)

    # ── Refresh ───────────────────────────────────────────────────────────

    def _refresh_all(self):
        self._sync_type_btns()
        self._refresh_cat_sidebar()
        self._refresh_slots()
        self._refresh_pool()

    # ── Hero Slots ─────────────────────────────────────────────────────────

    def _refresh_slots(self):
        for w in self._slots_frame.winfo_children():
            w.destroy()

        overrides = self._get_current_overrides()
        heroes = self._get_current_heroes()
        has_overrides = bool(overrides)
        num_slots = self._num_slots()

        # Compute auto-fill for brand tooltips
        brand_autofill = None
        if self._is_brand_mode():
            brand_autofill = self._compute_brand_autofill()

        if self._is_brand_mode():
            eligible_count = len(self._get_filtered_brands())
        else:
            eligible_count = len(self._get_filtered_articles())

        # Header
        hdr = tk.Frame(self._slots_frame, bg=C.MANTLE)
        hdr.pack(fill="x", pady=(0, 6))

        cat_label = self._active_category
        if cat_label == ALL_KEY:
            cat_label = "All"
        else:
            cat_label = self._app.store.cat_labels.get(cat_label, cat_label.title())

        type_label = INDEX_LABELS[self._active_type]
        tk.Label(
            hdr,
            text=f"{type_label} \u203a {cat_label} Heroes",
            bg=C.MANTLE, fg=C.TEXT, font=F.BODY_BOLD,
        ).pack(side="left")

        # Mode indicator
        if has_overrides:
            mode_text = f"\U0001f512 {len(overrides)} manual"
            mode_fg = C.BLUE
        else:
            mode_text = f"\U0001f4c5 auto ({min(eligible_count, num_slots)} / {eligible_count})"
            mode_fg = C.OVERLAY0

        tk.Label(hdr, text=mode_text, bg=C.MANTLE, fg=mode_fg,
                 font=F.TINY).pack(side="left", padx=(12, 0))

        # Clear button
        if has_overrides:
            clear_btn = FlatBtn(
                hdr, text="Clear Overrides",
                command=self._clear_overrides,
                bg=C.MANTLE, hover_bg=C.SURFACE1,
                fg=C.PEACH, font=F.TINY, padx=6, pady=1)
            clear_btn.pack(side="right")

        # Threshold warning
        min_needed = num_slots if self._is_brand_mode() else num_slots
        if eligible_count < min_needed:
            item_word = "brand" if self._is_brand_mode() else "article"
            tk.Label(
                hdr,
                text=f"\u26a0 Only {eligible_count} {item_word}{'s' if eligible_count != 1 else ''}"
                     f" \u2014 hero section will not display (needs {min_needed})",
                bg=C.MANTLE, fg=C.PEACH, font=F.TINY,
            ).pack(side="right", padx=(0, 8))

        # Grid: 3 cols, 1 or 2 rows
        grid = tk.Frame(self._slots_frame, bg=C.MANTLE)
        grid.pack(fill="x")
        cols = min(num_slots, 3)
        for col in range(cols):
            grid.columnconfigure(col, weight=1, uniform="herocol")

        num_rows = (num_slots + cols - 1) // cols
        for row in range(num_rows):
            grid.rowconfigure(row, weight=1, minsize=120)

        # Slot labels
        if self._is_brand_mode():
            slot_labels = [f"Slot {i + 1}" for i in range(num_slots)]
        else:
            slot_labels = ["Hero", "Side 1", "Side 2"]

        for i in range(num_slots):
            art = heroes[i] if i < len(heroes) else None
            is_manual = has_overrides and i < len(overrides)

            # Auto-fill tooltip for brands
            tooltip_text = None
            if self._is_brand_mode() and brand_autofill is not None:
                af_brand = brand_autofill[i] if i < len(brand_autofill) else None
                af_name = af_brand["display_name"] if af_brand else "—"
                if is_manual:
                    tooltip_text = f"Manual override \u2014 auto-fill would show: {af_name}"
                else:
                    sd = art.get("sort_date", "") if art else ""
                    tooltip_text = f"Auto-filled by date sort (date: {sd})" if sd else "Auto-filled by date sort"

            slot_text = slot_labels[i] if i < len(slot_labels) else f"Slot {i + 1}"
            card = self._build_hero_card(grid, i, art, is_manual, slot_text,
                                         tooltip_text=tooltip_text)
            card.grid(row=i // cols, column=i % cols,
                      sticky="nsew", padx=4, pady=2)

    def _build_hero_card(self, parent, slot_idx: int,
                         art: dict | None, is_manual: bool,
                         slot_text: str = "",
                         tooltip_text: str | None = None) -> tk.Frame:
        is_brand = self._is_brand_mode()
        is_empty = art is None

        if is_brand:
            # Brand cards: use type accent color
            card_color = INDEX_COLORS["brands"]
        else:
            cat_colors = self._app.store.cat_colors
            cat = art.get("category", "") if art else ""
            card_color = cat_colors.get(cat) if cat else None
            if not card_color and art:
                card_color = INDEX_COLORS.get(art["collection"])

        if is_empty:
            card_bg = C.BASE
            border_color = C.SURFACE1
        elif is_manual:
            card_bg = C.SURFACE0
            border_color = card_color or C.BLUE
        else:
            card_bg = C.SURFACE0
            border_color = card_color or C.SURFACE2

        card = tk.Frame(parent, bg=card_bg,
                        highlightthickness=2,
                        highlightbackground=border_color)

        inner = tk.Frame(card, bg=card_bg)
        inner.pack(fill="both", expand=True, padx=8, pady=6)

        # Top row: slot label + icons
        top = tk.Frame(inner, bg=card_bg)
        top.pack(fill="x")

        if is_manual:
            icon_text = f"{slot_text}  \U0001f512"
            icon_fg = C.BLUE
        elif art:
            icon_text = f"{slot_text}  \U0001f4c5"
            icon_fg = C.OVERLAY0
        else:
            icon_text = slot_text
            icon_fg = C.SURFACE2

        tk.Label(top, text=icon_text, bg=card_bg, fg=icon_fg,
                 font=F.TINY).pack(side="left")

        if not is_brand and art:
            art_key = art["key"]
            # Pin icon
            if art_key in self._pinned:
                tk.Label(top, text="\U0001f4cc", bg=card_bg, fg=C.GREEN,
                         font=F.TINY).pack(side="left", padx=(4, 0))
            # Badge
            badge_text = self._badges.get(art_key, "")
            if badge_text:
                tk.Label(top, text=badge_text, bg=C.SURFACE1, fg=C.YELLOW,
                         font=F.TINY, padx=3).pack(side="left", padx=(4, 0))

        if is_brand and art:
            # Logo indicator
            has_logo = art.get("has_logo", False)
            logo_text = "\u2713 logo" if has_logo else "\u2717 no logo"
            logo_fg = C.GREEN if has_logo else C.OVERLAY0
            tk.Label(top, text=logo_text, bg=card_bg, fg=logo_fg,
                     font=F.TINY).pack(side="left", padx=(4, 0))

        # Remove button (manual only)
        if is_manual:
            rm = FlatBtn(top, text="\u00d7",
                         command=lambda i=slot_idx: self._remove_override(i),
                         bg=card_bg, hover_bg=C.SURFACE1, fg=C.RED,
                         font=("Segoe UI", 9), padx=3, pady=0)
            rm.pack(side="right")

        if art:
            if is_brand:
                # Brand display: name + categories
                name = art.get("display_name", art.get("slug", ""))
                title_lbl = tk.Label(inner, text=name, bg=card_bg,
                                     fg=C.TEXT, font=F.SMALL, anchor="nw",
                                     justify="left", wraplength=1)
                title_lbl.pack(fill="both", expand=True, anchor="nw")

                def _on_cfg(e, lbl=title_lbl):
                    new_wrap = max(60, e.width - 16)
                    if lbl.cget("wraplength") != new_wrap:
                        lbl.configure(wraplength=new_wrap)
                inner.bind("<Configure>", _on_cfg)

                bot = tk.Frame(inner, bg=card_bg)
                bot.pack(fill="x", side="bottom")
                # Category pills
                brand_cats = art.get("categories", [])
                cat_text = ", ".join(c.title() for c in brand_cats) if brand_cats else "—"
                tk.Label(bot, text=cat_text, bg=card_bg, fg=C.OVERLAY0,
                         font=F.TINY).pack(side="left")
            else:
                # Article display: title + category badge + date
                cat_colors = self._app.store.cat_colors
                cat_labels = self._app.store.cat_labels
                cat = art.get("category", "")
                if cat and cat in cat_colors:
                    badge_color = cat_colors[cat]
                    badge_label = cat_labels.get(cat, cat.title())
                else:
                    badge_color = INDEX_COLORS.get(art["collection"],
                                                   self._app.store.site_accent)
                    badge_label = INDEX_LABELS.get(art["collection"],
                                                   art["collection"].title())

                title_lbl = tk.Label(inner, text=art["title"], bg=card_bg,
                                     fg=C.TEXT, font=F.SMALL, anchor="nw",
                                     justify="left", wraplength=1)
                title_lbl.pack(fill="both", expand=True, anchor="nw")

                def _on_cfg(e, lbl=title_lbl):
                    new_wrap = max(60, e.width - 16)
                    if lbl.cget("wraplength") != new_wrap:
                        lbl.configure(wraplength=new_wrap)
                inner.bind("<Configure>", _on_cfg)

                bot = tk.Frame(inner, bg=card_bg)
                bot.pack(fill="x", side="bottom")
                tk.Label(bot, text=badge_label, bg=badge_color, fg=C.CRUST,
                         font=F.TINY, padx=4).pack(side="left")
                date_str = fmt_date(art)
                if date_str and date_str != "\u2014":
                    tk.Label(bot, text=date_str, bg=card_bg, fg=C.OVERLAY0,
                             font=F.TINY).pack(side="right")
        else:
            item_word = "brand" if is_brand else "article"
            tk.Label(inner, text=f"Drop {item_word} here\nor double-click in pool",
                     bg=card_bg, fg=C.SURFACE2, font=F.TINY,
                     anchor="center", justify="center",
                     ).pack(fill="both", expand=True)

        # Tooltip
        if tooltip_text:
            HoverTooltip(card, tooltip_text)

        # Bind drag events
        self._bind_card_events(card, slot_idx)
        return card

    def _bind_card_events(self, widget, slot_idx: int):
        widget.bind("<ButtonPress-1>",
                    lambda e, i=slot_idx: self._card_drag_start(e, i))
        widget.bind("<B1-Motion>", self._drag_motion)
        widget.bind("<ButtonRelease-1>", self._drag_drop)
        for child in widget.winfo_children():
            if isinstance(child, FlatBtn):
                continue
            self._bind_card_events(child, slot_idx)

    # ── Pool (article/brand list) ─────────────────────────────────────────

    def _build_pool_ui(self):
        accent = INDEX_COLORS[self._active_type]
        self._pool_accent = tk.Frame(self._pool_frame, bg=accent, height=3)
        self._pool_accent.pack(fill="x")

        hdr = tk.Frame(self._pool_frame, bg=C.SURFACE0)
        hdr.pack(fill="x", padx=12, pady=(10, 2))
        self._pool_title_lbl = tk.Label(
            hdr, text="Available Articles", bg=C.SURFACE0, fg=C.TEXT,
            font=F.BODY_BOLD)
        self._pool_title_lbl.pack(side="left")
        self._pool_count_lbl = tk.Label(hdr, text="", bg=C.SURFACE0,
                                         fg=C.OVERLAY0, font=F.TINY)
        self._pool_count_lbl.pack(side="right")

        self._tree_frame = tk.Frame(self._pool_frame, bg=C.SURFACE0)
        self._tree_frame.pack(fill="both", expand=True, padx=4, pady=(2, 8))

        self._pool_tree = None
        self._pool_scrollbar = None
        self._rebuild_pool_tree()

    def _rebuild_pool_tree(self):
        """Destroy and recreate the Treeview for the current mode."""
        is_brand = self._is_brand_mode()
        new_mode = "brand" if is_brand else "article"

        if self._pool_tree is not None:
            self._pool_tree.destroy()
        if self._pool_scrollbar is not None:
            self._pool_scrollbar.destroy()

        if is_brand:
            cols = ("name", "categories", "iDash", "logo")
            col_defs = [
                ("name",       "Brand",      200, "w"),
                ("categories", "Categories", 180, "w"),
                ("iDash",      "iDash",       80, "center"),
                ("logo",       "Logo",        50, "center"),
            ]
            self._pool_title_lbl.configure(text="Available Brands")
        else:
            cols = ("pin", "title", "cat", "date", "badge")
            col_defs = [
                ("pin",   "\U0001f4cc", 40,  "center"),
                ("title", "Title",      300, "w"),
                ("cat",   "Category",   90,  "center"),
                ("date",  "Date",       85,  "center"),
                ("badge", "Badge",      90,  "center"),
            ]
            self._pool_title_lbl.configure(text="Available Articles")

        tree = ttk.Treeview(self._tree_frame, style="IndexPool.Treeview",
                            columns=cols, show="headings",
                            selectmode="browse")
        scrollbar = tk.Scrollbar(self._tree_frame, orient="vertical",
                                 command=tree.yview,
                                 bg=C.SURFACE1, troughcolor=C.BASE,
                                 highlightthickness=0, bd=0)
        tree.configure(yscrollcommand=scrollbar.set)

        for col_id, heading, width, anchor in col_defs:
            tree.heading(col_id, text=heading)
            tree.column(col_id, width=width, minwidth=width, anchor=anchor,
                        stretch=(col_id in ("title", "name")))

        if not is_brand:
            # Collection color tags (static fallback)
            for coll, coll_hex in INDEX_COLORS.items():
                tree.tag_configure(f"coll_{coll}", foreground=coll_hex)

        tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        self._pool_tree = tree
        self._pool_scrollbar = scrollbar
        self._pool_mode = new_mode

        tree.bind("<ButtonPress-1>", self._pool_drag_start)
        tree.bind("<B1-Motion>", self._drag_motion)
        tree.bind("<ButtonRelease-1>", self._drag_drop)
        tree.bind("<Double-Button-1>", self._pool_dblclick)

    def _refresh_pool(self):
        # Check if mode changed — rebuild tree if needed
        expected_mode = "brand" if self._is_brand_mode() else "article"
        if self._pool_mode != expected_mode:
            self._rebuild_pool_tree()

        tree = self._pool_tree
        tree.delete(*tree.get_children())

        # Update accent
        accent = INDEX_COLORS[self._active_type]
        self._pool_accent.configure(bg=accent)

        # Exclude items already in hero slots (manual overrides only)
        overrides = set(self._get_current_overrides())
        self._pool_iid_map = {}

        if self._is_brand_mode():
            brands = self._get_filtered_brands()
            pool_brands = [b for b in brands if b["key"] not in overrides]

            for b in pool_brands:
                cats = ", ".join(c.title() for c in b["categories"]) if b["categories"] else "\u2014"
                idash = b.get("iDashboard", "") or ""
                ifd = b.get("iFilteredDashboard", "")
                dash_text = idash or ifd or "\u2014"
                logo = "\u2713" if b["has_logo"] else "\u2717"

                iid = tree.insert("", "end", values=(
                    b["display_name"],
                    cats,
                    dash_text,
                    logo,
                ))
                self._pool_iid_map[iid] = b

            self._pool_count_lbl.configure(
                text=f"{len(pool_brands)} available  \u00b7  "
                     f"{len(overrides)} in hero")
        else:
            # Update category color tags (may change via categories panel)
            cat_colors = self._app.store.cat_colors
            for cat_id, cat_hex in cat_colors.items():
                tree.tag_configure(f"cat_{cat_id}", foreground=cat_hex)

            articles = self._get_filtered_articles()
            pool_arts = [a for a in articles if a["key"] not in overrides]

            cat_labels = self._app.store.cat_labels

            for a in pool_arts:
                pin_icon = "\U0001f4cc" if a["key"] in self._pinned else ""
                cat_lbl = cat_labels.get(a["category"], a["category"].title()) if a["category"] else ""
                badge = self._badges.get(a["key"], "")

                cat = a.get("category", "")
                if cat and cat in cat_colors:
                    tag = f"cat_{cat}"
                else:
                    tag = f"coll_{a['collection']}"

                iid = tree.insert("", "end", values=(
                    pin_icon,
                    a["title"],
                    cat_lbl,
                    fmt_date(a),
                    badge,
                ), tags=(tag,))
                self._pool_iid_map[iid] = a

            self._pool_count_lbl.configure(
                text=f"{len(pool_arts)} available  \u00b7  "
                     f"{len(overrides)} in hero")

    # ── Slot Operations ───────────────────────────────────────────────────

    def _assign_to_slot(self, key: str, slot_idx: int | None = None):
        """Assign an article/brand key to a hero slot."""
        t = self._active_type
        cat = self._active_category
        num_slots = self._num_slots()
        overrides = list(self._hero_overrides.get(t, {}).get(cat, []))

        # Remove if already present
        overrides = [k for k in overrides if k != key]

        if slot_idx is not None and slot_idx < num_slots:
            # Insert at specific position
            while len(overrides) < slot_idx:
                overrides.append("")
            overrides.insert(slot_idx, key)
            overrides = [k for k in overrides if k][:num_slots]
        else:
            # Append
            if len(overrides) >= num_slots:
                self._app.toast.show(
                    f"All {num_slots} hero slots are filled", C.PEACH)
                return
            overrides.append(key)

        if t not in self._hero_overrides:
            self._hero_overrides[t] = {}
        self._hero_overrides[t][cat] = overrides
        self._on_data_change()

    def _remove_override(self, slot_idx: int):
        """Remove an override at a specific slot index."""
        t = self._active_type
        cat = self._active_category
        overrides = list(self._hero_overrides.get(t, {}).get(cat, []))
        if slot_idx < len(overrides):
            overrides.pop(slot_idx)
        if overrides:
            self._hero_overrides[t][cat] = overrides
        else:
            self._hero_overrides.get(t, {}).pop(cat, None)
        self._on_data_change()

    def _clear_overrides(self):
        """Clear all overrides for current type+category."""
        t = self._active_type
        cat = self._active_category
        self._hero_overrides.get(t, {}).pop(cat, None)
        self._on_data_change()
        self._app.toast.show("Overrides cleared \u2014 using auto-fill", C.GREEN)

    def _on_data_change(self):
        self._refresh_slots()
        self._refresh_pool()
        self._app.update_changes_badge()

    # ── Pool Double-Click ─────────────────────────────────────────────────

    def _pool_dblclick(self, event):
        self._drag_cleanup()
        tree = self._pool_tree
        iid = tree.identify_row(event.y)
        if not iid or iid not in self._pool_iid_map:
            return
        art = self._pool_iid_map[iid]
        self._assign_to_slot(art["key"])

    # ── Drag and Drop ─────────────────────────────────────────────────────

    def _pool_drag_start(self, event):
        tree = self._pool_tree
        iid = tree.identify_row(event.y)
        if not iid or iid not in self._pool_iid_map:
            return
        art = self._pool_iid_map[iid]
        self._drag_src = "pool"
        self._drag_key = art["key"]
        title = art.get("display_name", art.get("title", art["key"]))
        self._create_ghost(event, title)

    def _card_drag_start(self, event, slot_idx: int):
        overrides = self._get_current_overrides()
        if slot_idx >= len(overrides):
            return
        key = overrides[slot_idx]
        item_map = self._brand_map if self._is_brand_mode() else self._article_map
        art = item_map.get(key)
        if not art:
            return
        self._drag_src = f"slot:{slot_idx}"
        self._drag_key = key
        title = art.get("display_name", art.get("title", key))
        self._create_ghost(event, title)

    def _create_ghost(self, event, title: str):
        if self._drag_ghost:
            self._drag_ghost.destroy()
        ghost = tk.Toplevel(self)
        ghost.overrideredirect(True)
        ghost.attributes("-alpha", 0.85)
        ghost.configure(bg=C.SURFACE2)
        lbl = tk.Label(ghost, text=title[:50], bg=C.SURFACE2, fg=C.TEXT,
                       font=F.SMALL, padx=8, pady=4)
        lbl.pack()
        ghost.geometry(f"+{event.x_root + 10}+{event.y_root + 10}")
        self._drag_ghost = ghost

    def _drag_motion(self, event):
        if self._drag_ghost:
            self._drag_ghost.geometry(
                f"+{event.x_root + 10}+{event.y_root + 10}")

    def _drag_drop(self, event):
        if not self._drag_key:
            self._drag_cleanup()
            return

        key = self._drag_key
        src = self._drag_src

        # Check if dropped on a hero slot
        drop_slot = self._find_slot_at(event.x_root, event.y_root)

        if drop_slot is not None:
            if src and src.startswith("slot:"):
                # Reorder: remove from old position, insert at new
                old_idx = int(src.split(":")[1])
                self._remove_override(old_idx)
                self._assign_to_slot(key, drop_slot)
            else:
                # From pool to slot
                self._assign_to_slot(key, drop_slot)
        elif src and src.startswith("slot:"):
            # Dragged card out of slots — check if dropped on pool
            pool_x = self._pool_frame.winfo_rootx()
            pool_y = self._pool_frame.winfo_rooty()
            pool_w = self._pool_frame.winfo_width()
            pool_h = self._pool_frame.winfo_height()
            if (pool_x <= event.x_root <= pool_x + pool_w
                    and pool_y <= event.y_root <= pool_y + pool_h):
                old_idx = int(src.split(":")[1])
                self._remove_override(old_idx)

        self._drag_cleanup()

    def _find_slot_at(self, x_root: int, y_root: int) -> int | None:
        """Find which hero slot card is under the cursor."""
        cols = min(self._num_slots(), 3)
        for w in self._slots_frame.winfo_children():
            if not isinstance(w, tk.Frame):
                continue
            # Check grid children (the actual card frames)
            for child in w.winfo_children():
                if not isinstance(child, tk.Frame):
                    continue
                try:
                    cx = child.winfo_rootx()
                    cy = child.winfo_rooty()
                    cw = child.winfo_width()
                    ch = child.winfo_height()
                    if cx <= x_root <= cx + cw and cy <= y_root <= cy + ch:
                        info = child.grid_info()
                        if "column" in info:
                            row = int(info.get("row", 0))
                            col = int(info["column"])
                            return row * cols + col
                except tk.TclError:
                    pass
        return None

    def _drag_cleanup(self):
        if self._drag_ghost:
            self._drag_ghost.destroy()
            self._drag_ghost = None
        self._drag_src = None
        self._drag_key = None
