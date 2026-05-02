"""
Content panel — editorial dashboard for home page slot management.

Manages a 15-slot editorial dashboard with pinned/badge/publish controls.
Reads article frontmatter from src/content/ (read-only).
Reads/writes config/data/content.json via ConfigStore.
"""

import json
import tkinter as tk
from tkinter import ttk
from datetime import datetime
from pathlib import Path

from lib.shared import (
    C, F, Toggle, FlatBtn, Tip, HoverTooltip, HoverListbox,
    darken,
)
from lib.config_store import ConfigStore


# ── Constants ────────────────────────────────────────────────────────────────

COLLECTIONS = ["reviews", "guides", "news", "brands", "games"]
NUM_SLOTS = 15

# Dashboard grid layout — matches HBS index.handlebars structure
# Each row: (row_index, [(slot_num, col_start, col_span), ...], row_weight)
GRID_ROWS = [
    (0, [(1, 0, 12)], 3),                                          # Hero
    (1, [(2, 0, 4), (3, 4, 4), (4, 8, 4)], 2),                    # 3 medium
    (2, [(5, 0, 12)], 2),                                           # Feature
    (3, [(6, 0, 4), (7, 4, 4), (8, 8, 4)], 2),                    # 3 medium
    (4, [(9, 0, 4), (10, 4, 4), (11, 8, 4)], 2),                  # 3 medium
    (5, [(12, 0, 3), (13, 3, 3), (14, 6, 3), (15, 9, 3)], 1.5),  # 4 small
]
ROW_LABELS = {0: "Hero", 2: "Feature", 5: "Latest"}

# Collection display config
COLL_COLORS = {
    "reviews": C.BLUE,
    "guides": C.GREEN,
    "news": C.PEACH,
    "brands": C.MAUVE,
    "games": C.YELLOW,
}
COLL_LABELS = {
    "reviews": "Reviews",
    "guides": "Guides",
    "news": "News",
    "brands": "Brands",
    "games": "Games",
}
COLL_SHORT = {
    "reviews": "REV",
    "guides": "GDE",
    "news": "NEW",
    "brands": "BRD",
    "games": "GME",
}

# WHY: production input to buildDashboard/sortByPinnedThenDate is
# [...taggedReviews, ...taggedGuides, ...taggedNews], each pre-sorted by
# datePublished desc. Stable-sort tie-breaking depends on this input order.
COLL_PRIORITY = {"reviews": 0, "guides": 1, "news": 2, "brands": 3, "games": 4}

# Feed label sort order — matches top-to-bottom page position
FEED_ORDER = {
    "Dash": 0, "News F": 1, "Games": 2, "Rev H": 3, "Rev": 4,
    "Guide H": 5, "Guides": 6, "News L": 7, "News C": 8,
}

# Feed legend — label, color, tooltip description for the feed guide
FEED_LEGEND = [
    ("Dash", C.BLUE,
     "Dashboard  \u00b7  15 slots\n"
     "Sort: max(datePublished, dateUpdated) \u2014 newest first\n"
     "Pins: No \u2014 use manual slot overrides instead\n"
     "Override: 6 manual slots in content.json, 9 auto-filled by date\n"
     "Collections: Reviews, Guides, News only"),
    ("News F", C.PEACH,
     "News Feed Sidebar  \u00b7  3 items\n"
     "Sort: datePublished only \u2014 newest published first\n"
     "Pins: No \u2014 pure chronological, latest content feed\n"
     "Shows genuinely new articles, ignores dateUpdated"),
    ("Games", C.YELLOW,
     "Game Gear Picks  \u00b7  all games\n"
     "Sort: pinned first, then max(datePublished, dateUpdated)\n"
     "Pins: Yes \u2014 pinned games float to front\n"
     "Separate collection, never in Dashboard"),
    ("Rev H", C.SAPPHIRE,
     "Featured Reviews Hero  \u00b7  1 item\n"
     "The hero is the first review after pin+date sort\n"
     "Sort: pinned first, then max(datePublished, dateUpdated)\n"
     "Pins: Yes \u2014 a pinned review becomes the hero\n"
     "Deduped: excludes articles already in Dashboard"),
    ("Rev", C.SAPPHIRE,
     "Featured Reviews  \u00b7  remaining reviews\n"
     "All reviews after the hero, in pin+date order\n"
     "Sort: pinned first, then max(datePublished, dateUpdated)\n"
     "Pins: Yes \u2014 pinned reviews float to front\n"
     "Deduped: excludes articles already in Dashboard"),
    ("Guide H", C.GREEN,
     "Highlighted Guides Hero  \u00b7  1 item\n"
     "The hero is the first guide after pin+date sort\n"
     "Sort: pinned first, then max(datePublished, dateUpdated)\n"
     "Pins: Yes \u2014 a pinned guide becomes the hero\n"
     "Deduped: excludes articles already in Dashboard"),
    ("Guides", C.GREEN,
     "Highlighted Guides  \u00b7  remaining guides\n"
     "All guides after the hero, in pin+date order\n"
     "Sort: pinned first, then max(datePublished, dateUpdated)\n"
     "Pins: Yes \u2014 pinned guides float to front\n"
     "Deduped: excludes articles already in Dashboard"),
    ("News L & C", C.PEACH,
     "Latest News  \u00b7  top 4 (L) + up to 16 more (C)\n"
     "News L = top 2x2 grid (items 1-4)\n"
     "News C = continued feed below (items 5-20)\n"
     "Sort: pinned first, then max(datePublished, dateUpdated)\n"
     "Pins: Yes \u2014 pinned news float to front\n"
     "Deduped: excludes articles already in Dashboard\n"
     "An article in News F can also appear in News L & C"),
]

# WHY: NOT_ON_PAGE must be larger than any real position so articles without
# a feed sort to the bottom when sorting by the Feed column.
NOT_ON_PAGE = 9999

C.SAPPHIRE = "#74c7ec"  # WHY: ensure SAPPHIRE is on C for feed legend


# ── Data Helpers (pure functions, no tkinter) ────────────────────────────────

def date_ts(iso) -> float:
    """Parse ISO date string to timestamp, 0 if empty/invalid."""
    if not iso:
        return 0.0
    try:
        return datetime.strptime(str(iso)[:10], "%Y-%m-%d").timestamp()
    except (ValueError, IndexError):
        return 0.0


def production_order(articles: list[dict]) -> list[dict]:
    """Sort to match production's input order.

    Production merges [...reviews, ...guides, ...news], each pre-sorted by
    datePublished desc from content-filter.mjs. This function replicates that
    order so stable-sort tie-breaking in buildDashboard and sortByPinnedThenDate
    produces the same results as production.
    """
    return sorted(articles, key=lambda a: (
        COLL_PRIORITY.get(a["collection"], 9),
        -date_ts(a.get("date_published", "")),
    ))


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


def pinned_then_date(articles: list[dict], pinned: set) -> list[dict]:
    """Sort: pinned first (newest within pinned), then unpinned newest-first.

    Mirrors production sortByPinnedThenDate() in dashboard-filter.mjs.
    Input MUST be in production_order so stable-sort tie-breaking matches.
    """
    return sorted(articles, key=lambda a: (
        0 if a["key"] in pinned else 1,
        -date_ts(a["sort_date"]),
    ))


def simulate_feeds(articles: list[dict], simulated_slots: list,
                   excluded: set, pinned: set | None = None
                   ) -> dict[str, dict]:
    """Compute which home page feed(s) each article appears in.

    Mirrors the actual TSX index.astro data flow:
      Dashboard > News F sidebar > Games > Featured Reviews >
      Highlighted Guides > Latest News (News L + News C).

    Returns { article_key: { "labels": [str], "pos": int } }.
    """
    pinned = pinned or set()
    result: dict[str, dict] = {}
    claimed: set[str] = set()
    pos = 0

    dashboard_keys: set[str] = {s["key"] for s in simulated_slots if s}

    eligible = [
        a for a in articles
        if a["full_article"] is not False
        and not a["draft"]
        and a["has_hero"]
        and a["key"] not in excluded
        and a.get("category_active", True)
    ]

    def _set(key: str, label: str):
        entry = result.get(key)
        if entry is None:
            result[key] = {"labels": [label], "pos": pos}
        else:
            entry["labels"].append(label)
            if pos < entry["pos"]:
                entry["pos"] = pos

    def _claim(key: str, label: str):
        if key not in claimed:
            _set(key, label)
            claimed.add(key)

    # 1. Dashboard
    for slot in simulated_slots:
        if slot:
            _claim(slot["key"], "Dash")
        pos += 1

    # 2. News Feed sidebar — top 3 news by datePublished
    news_all = [a for a in eligible if a["collection"] == "news"]
    news_all.sort(key=lambda a: a.get("date_published", "") or "", reverse=True)
    for a in news_all[:3]:
        _set(a["key"], "News F")
        pos += 1

    # 3. Games — own section, pinned-then-date
    games_eligible = production_order(
        [a for a in eligible if a["collection"] == "games"])
    games_sorted = pinned_then_date(games_eligible, pinned)
    for a in games_sorted:
        _claim(a["key"], "Games")
        pos += 1

    # 4. Featured Reviews — deduped against dashboard, pinned-then-date
    avail_reviews = production_order(
        [a for a in eligible
         if a["collection"] == "reviews"
         and a["key"] not in dashboard_keys])
    avail_reviews = pinned_then_date(avail_reviews, pinned)
    if avail_reviews:
        _claim(avail_reviews[0]["key"], "Rev H")
        pos += 1
        for a in avail_reviews[1:]:
            _claim(a["key"], "Rev")
            pos += 1

    # 5. Highlighted Guides — deduped against dashboard, pinned-then-date
    avail_guides = production_order(
        [a for a in eligible
         if a["collection"] == "guides"
         and a["key"] not in dashboard_keys])
    avail_guides = pinned_then_date(avail_guides, pinned)
    if avail_guides:
        _claim(avail_guides[0]["key"], "Guide H")
        pos += 1
        for a in avail_guides[1:]:
            _claim(a["key"], "Guides")
            pos += 1

    # 6. Latest News — deduped against dashboard only (not News F)
    avail_news = production_order(
        [a for a in eligible
         if a["collection"] == "news"
         and a["key"] not in dashboard_keys])
    avail_news = pinned_then_date(avail_news, pinned)
    for i, a in enumerate(avail_news[:20]):
        _set(a["key"], "News L" if i < 4 else "News C")
        pos += 1

    return result


def simulate_dashboard(articles: list[dict], manual_slots: dict,
                       excluded: set) -> list:
    """Run production algorithm: manual overrides first, then auto-fill by date.

    Returns NUM_SLOTS-length list (dict or None for empty slots).
    """
    article_map = {a["key"]: a for a in articles}

    # WHY: production dashboard only uses reviews + guides + news
    dashboard_collections = {"reviews", "guides", "news"}
    eligible = [
        a for a in articles
        if a["collection"] in dashboard_collections
        and a["full_article"] is not False
        and not a["draft"]
        and a["has_hero"]
        and a["key"] not in excluded
        and a.get("category_active", True)
    ]

    slots: list = [None] * NUM_SLOTS
    used: set = set()

    # Place manual overrides (slot_num is 1-indexed)
    for slot_num, key in manual_slots.items():
        if not (1 <= slot_num <= NUM_SLOTS):
            continue
        art = article_map.get(key)
        if art and key not in excluded:
            slots[slot_num - 1] = art
            used.add(key)

    # Sort remaining eligible by date descending
    remaining = production_order([a for a in eligible if a["key"] not in used])
    remaining.sort(key=lambda a: a["sort_date"], reverse=True)

    # Fill empty slots
    ri = 0
    for i in range(NUM_SLOTS):
        if slots[i] is None and ri < len(remaining):
            slots[i] = remaining[ri]
            used.add(remaining[ri]["key"])
            ri += 1

    return slots


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
    """Scan all 5 content dirs, parse frontmatter, build article dicts."""
    articles = []
    for collection in COLLECTIONS:
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

            # WHY: hero in frontmatter OR image folder exists on disk
            has_hero = bool(hero_img) or (images_dir / collection / eid).is_dir()

            # WHY: articles without a category field (brands, games) default
            # to active — matches content-filter.mjs Rule 3 behavior.
            category_active = _is_content_active(
                category, active_content_cats) if category else True

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
                "path": path,
            })
    return articles


def _is_content_active(cat_id: str, active_content_cats: set) -> bool:
    """Vite mode: production=true OR vite=true (GUI is a dev tool)."""
    return cat_id in active_content_cats


def build_config(article_map: dict, manual_slots: dict, pinned: set,
                 badges: dict, excluded: set) -> dict:
    """Build config dict from in-memory state."""
    slots = {}
    for num, key in manual_slots.items():
        art = article_map.get(key)
        if art:
            slots[str(num)] = {
                "collection": art["collection"],
                "id": art["entry_id"],
            }
    return {
        "slots": slots,
        "pinned": sorted(pinned),
        "badges": dict(sorted(badges.items())),
        "excluded": sorted(excluded),
    }


# ── Panel Class ──────────────────────────────────────────────────────────────

class ContentPanel(tk.Frame):
    """Content dashboard panel for the mega-app notebook."""

    SORT_OPTIONS = [
        ("Date", "sort_date"),
        ("Published", "date_published"),
        ("Updated", "date_updated"),
        ("Pinned", "pinned"),
        ("Badge", "badge"),
    ]

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

        # Load config from store
        cfg = app.store.get(ConfigStore.CONTENT)
        self._manual_slots: dict[int, str] = {}
        for slot_str, slot_val in cfg.get("slots", {}).items():
            try:
                num = int(slot_str)
                key = f"{slot_val['collection']}:{slot_val['id']}"
                if key in self._article_map:
                    self._manual_slots[num] = key
            except (ValueError, KeyError):
                pass
        self._pinned: set[str] = set(cfg.get("pinned", []))
        self._badges: dict[str, str] = dict(cfg.get("badges", {}))
        self._excluded: set[str] = set(cfg.get("excluded", []))

        # Snapshot for dirty tracking
        self._original = self._snapshot()

        # Simulation result
        self._simulated: list = []

        # Filter/search state
        self._search_var = tk.StringVar(value="")
        self._coll_filter = "all"
        self._coll_pills: list[tk.Frame] = []
        self._search_after_id = None

        # Drag state
        self._drag_src: str | None = None
        self._drag_key: str | None = None
        self._drag_ghost: tk.Toplevel | None = None
        self._drag_slot_num: int | None = None

        # Grid card widgets
        self._slot_cards: dict[int, tk.Frame] = {}
        self._highlighted_card: int | None = None

        # Scrollable canvases for type tabs
        self._scrollable_canvases: list[tk.Canvas] = []

        # Pool Treeview state
        self._pool_tree: ttk.Treeview | None = None
        self._pool_iid_map: dict[str, dict] = {}
        self._pool_sort_col: str = "date"
        self._pool_sort_asc: bool = False

        # Type tab sort state
        self._type_sort: dict[str, str] = {}
        self._type_inner: dict[str, tk.Frame] = {}
        self._type_canvas: dict[str, tk.Canvas] = {}
        self._sort_pills: dict[str, dict] = {}

        # Build internal notebook for Homepage + type tabs
        self._setup_styles()
        self._inner_notebook = ttk.Notebook(self, style="Content.TNotebook")
        self._inner_notebook.pack(fill="both", expand=True)
        self._build_dashboard_tab()
        for coll in COLLECTIONS:
            self._build_type_tab(coll)

        # Bind mousewheel
        self.bind_all("<MouseWheel>", self._global_mousewheel)

        # Subscribe to config changes
        app.store.subscribe(ConfigStore.CONTENT, self._on_external_change)
        # WHY: CATEGORIES subscription removed — mega-app dispatches centrally
        # to avoid refreshing hidden panels

        # Run initial simulation
        self._simulate_and_refresh()

        # Status bar
        total = len(self.all_articles)
        eligible = len(self._get_eligible())
        disabled = sum(1 for a in self.all_articles
                       if not a.get("category_active", True))
        app.set_status_right(
            f"{total} articles  \u00b7  {eligible} eligible  \u00b7  "
            f"{disabled} disabled  \u00b7  {NUM_SLOTS} slots")

    def _snapshot(self) -> str:
        config = build_config(self._article_map, self._manual_slots,
                              self._pinned, self._badges, self._excluded)
        return json.dumps(config, sort_keys=True)

    def has_changes(self) -> bool:
        return self._snapshot() != self._original

    def save(self) -> bool:
        """Save content data via ConfigStore. Returns True if saved."""
        if not self.has_changes():
            self._app.toast.show("No changes to save", C.OVERLAY0)
            return False
        try:
            data = build_config(self._article_map, self._manual_slots,
                                self._pinned, self._badges, self._excluded)
            # WHY: Preserve keys owned by other panels (e.g. indexHeroes)
            existing = dict(self._app.store.get(ConfigStore.CONTENT))
            existing.update(data)
            self._app.watcher.pause()
            self._app.store.save(ConfigStore.CONTENT, existing)
            self._app.watcher.snapshot()
            self._app.watcher.resume()

            self._original = self._snapshot()
            self._app.update_changes_badge()

            now = datetime.now().strftime("%H:%M:%S")
            manual = len(self._manual_slots)
            pinned = len(self._pinned)
            excluded = len(self._excluded)
            badges = len(self._badges)
            self._app.toast.show(
                f"Saved ({manual} manual, {pinned} pinned, "
                f"{excluded} excluded, {badges} badges) at {now}",
                C.GREEN)
            self._app.set_status(
                f"Last saved at {now}  \u00b7  Ctrl+S to save")
            return True
        except Exception as e:
            self._app.toast.show(f"Error: {e}", C.RED)
            return False

    def refresh(self):
        """Reload config from ConfigStore (after external change)."""
        cfg = self._app.store.get(ConfigStore.CONTENT)
        self._manual_slots = {}
        for slot_str, slot_val in cfg.get("slots", {}).items():
            try:
                num = int(slot_str)
                key = f"{slot_val['collection']}:{slot_val['id']}"
                if key in self._article_map:
                    self._manual_slots[num] = key
            except (ValueError, KeyError):
                pass
        self._pinned = set(cfg.get("pinned", []))
        self._badges = dict(cfg.get("badges", {}))
        self._excluded = set(cfg.get("excluded", []))
        self._original = self._snapshot()
        self._simulate_and_refresh()
        self._app.update_changes_badge()

    def _on_external_change(self):
        """Refresh only if Content-owned data changed in store.
        WHY: Index Heroes shares ConfigStore.CONTENT — its save fires this
        callback too, but only changes indexHeroes. Without this guard,
        Content's unsaved pin/badge/slot changes would be wiped."""
        cfg = self._app.store.get(ConfigStore.CONTENT)
        store_owned = {
            "slots": cfg.get("slots", {}),
            "pinned": sorted(cfg.get("pinned", [])),
            "badges": dict(sorted(cfg.get("badges", {}).items())),
            "excluded": sorted(cfg.get("excluded", [])),
        }
        if json.dumps(store_owned, sort_keys=True) == self._original:
            return
        self.refresh()

    def _on_categories_change(self):
        """Refresh when category colors/flags change."""
        # Re-check category active flags
        for art in self.all_articles:
            cat = art.get("category", "")
            if cat:
                art["category_active"] = _is_content_active(
                    cat, self._app.store.active_content_cats)
        self._simulate_and_refresh()

    def _get_eligible(self) -> list[dict]:
        return [
            a for a in self.all_articles
            if a["full_article"] is not False
            and not a["draft"]
            and a["has_hero"]
            and a["key"] not in self._excluded
            and a.get("category_active", True)
        ]

    # -- Styles ---------------------------------------------------------------
    def _setup_styles(self):
        s = ttk.Style()
        # Inner notebook tabs
        s.configure("Content.TNotebook", background=C.MANTLE, borderwidth=0)
        s.configure("Content.TNotebook.Tab",
                     background=C.SURFACE1, foreground=C.OVERLAY0,
                     padding=[28, 12], borderwidth=0, font=F.BODY_BOLD,
                     focuscolor=C.SURFACE1)
        s.map("Content.TNotebook.Tab",
              background=[("selected", C.SURFACE0), ("active", C.SURFACE2)],
              foreground=[("selected", C.TEXT), ("active", C.SUBTEXT1)])
        # Pool Treeview
        s.configure("Pool.Treeview",
                     background=C.SURFACE0,
                     foreground=C.SUBTEXT1,
                     fieldbackground=C.SURFACE0,
                     font=F.MONO,
                     rowheight=22,
                     borderwidth=0)
        s.configure("Pool.Treeview.Heading",
                     background=C.SURFACE1,
                     foreground=C.OVERLAY0,
                     font=F.MONO_SMALL,
                     borderwidth=0,
                     relief="flat")
        s.map("Pool.Treeview",
              background=[("selected", C.BLUE)],
              foreground=[("selected", C.CRUST)])
        s.map("Pool.Treeview.Heading",
              background=[("active", C.SURFACE2)])

        # Drop-highlight variant
        s.configure("PoolDrop.Treeview",
                     background=C.DROP,
                     foreground=C.SUBTEXT1,
                     fieldbackground=C.DROP,
                     font=F.MONO,
                     rowheight=22,
                     borderwidth=0)

    # -- Global Mousewheel ----------------------------------------------------
    def _global_mousewheel(self, event):
        for canvas in self._scrollable_canvases:
            try:
                if not canvas.winfo_ismapped():
                    continue
                cx, cy = canvas.winfo_rootx(), canvas.winfo_rooty()
                cw, ch = canvas.winfo_width(), canvas.winfo_height()
                if cx <= event.x_root <= cx + cw and cy <= event.y_root <= cy + ch:
                    canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
                    return
            except tk.TclError:
                pass

    # ========================================================================
    # DASHBOARD TAB
    # ========================================================================
    def _build_dashboard_tab(self):
        frame = tk.Frame(self._inner_notebook, bg=C.MANTLE)
        self._inner_notebook.add(frame, text="  Homepage  ")

        # Toolbar: filter pills + search
        bar = tk.Frame(frame, bg=C.MANTLE)
        bar.pack(fill="x", padx=16, pady=(12, 0))

        # Filter pills
        pill_row = tk.Frame(bar, bg=C.MANTLE)
        pill_row.pack(side="left")
        accent = self._app.store.site_accent
        self._make_coll_pill(pill_row, "all", "All", accent)
        for coll in COLLECTIONS:
            color = COLL_COLORS.get(coll, accent)
            label = COLL_LABELS.get(coll, coll.title())
            self._make_coll_pill(pill_row, coll, label, color)

        # Search
        search_frame = tk.Frame(bar, bg=C.MANTLE)
        search_frame.pack(side="right")
        tk.Label(search_frame, text="\U0001f50d", bg=C.MANTLE, fg=C.OVERLAY0,
                 font=F.BODY).pack(side="left", padx=(0, 4))
        self._search_entry = tk.Entry(
            search_frame, textvariable=self._search_var,
            bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
            font=F.BODY, relief="flat", bd=0,
            highlightthickness=1, highlightcolor=C.BLUE,
            highlightbackground=C.SURFACE2, width=25)
        self._search_entry.pack(side="left", ipady=4)
        def _debounced_search(*a):
            if self._search_after_id:
                self.after_cancel(self._search_after_id)
            self._search_after_id = self.after(300, self._refresh_pool)
        self._search_var.trace_add("write", _debounced_search)

        # Feed guide
        feed_bar = tk.Frame(frame, bg=C.MANTLE)
        feed_bar.pack(fill="x", padx=16, pady=(6, 0))
        tk.Label(feed_bar, text="Feeds", bg=C.MANTLE, fg=C.OVERLAY0,
                 font=F.SMALL).pack(side="left", padx=(0, 6))
        for feed_label, feed_color, feed_tip in FEED_LEGEND:
            pill = tk.Frame(feed_bar, bg=C.SURFACE1, padx=1, pady=1)
            pill.pack(side="left", padx=2)
            lbl = tk.Label(pill, text=feed_label, bg=C.SURFACE1,
                           fg=feed_color, font=F.TINY, padx=6, pady=2,
                           cursor="question_arrow")
            lbl.pack()
            HoverTooltip(lbl, feed_tip, delay=250)

        # Main panels
        panel_frame = tk.Frame(frame, bg=C.MANTLE)
        panel_frame.pack(fill="both", expand=True, padx=16, pady=(8, 0))

        # Left: Article Pool
        self._pool_frame = tk.Frame(panel_frame, bg=C.SURFACE0,
                                    highlightthickness=1,
                                    highlightbackground=C.CARD_BORDER)
        self._pool_frame.pack(side="left", fill="both", padx=(0, 8))
        self._pool_frame.configure(width=650)
        self._pool_frame.pack_propagate(False)

        # Build pool UI structure once
        self._build_pool_ui()

        # Right: Dashboard Grid
        self._slots_frame = tk.Frame(panel_frame, bg=C.MANTLE)
        self._slots_frame.pack(side="right", fill="both", expand=True,
                               padx=(8, 0))

    def _make_coll_pill(self, parent, coll_id: str, label: str, color: str):
        pill = tk.Frame(parent, bg=C.MANTLE, cursor="hand2")
        pill.pack(side="left", padx=2)

        if coll_id != "all":
            dot = tk.Canvas(pill, width=10, height=10, highlightthickness=0,
                            bg=C.MANTLE)
            dot.pack(side="left", padx=(8, 4), pady=8)
            dot.create_oval(1, 1, 9, 9, fill=color, outline="")
        else:
            dot = None

        lbl = tk.Label(pill, text=label, fg=C.SUBTEXT0, bg=C.MANTLE,
                       font=F.BODY_BOLD, padx=4, pady=8)
        lbl.pack(side="left", padx=(0 if dot else 8, 8))

        pill._coll = coll_id
        pill._color = color
        pill._dot = dot
        pill._lbl = lbl
        self._coll_pills.append(pill)

        def click(e, c=coll_id):
            self._coll_filter = c
            self._sync_coll_pills()
            self._refresh_pool()

        def enter(e, p=pill):
            if p._coll != self._coll_filter:
                widgets = [p, p._lbl] + ([p._dot] if p._dot else [])
                for w in widgets:
                    w.configure(bg=C.SURFACE1)

        def leave(e):
            self._sync_coll_pills()

        for w in [pill, lbl] + ([dot] if dot else []):
            w.bind("<Button-1>", click)
            w.bind("<Enter>", enter)
            w.bind("<Leave>", leave)

        self._sync_coll_pills()

    def _sync_coll_pills(self):
        active = self._coll_filter
        for p in self._coll_pills:
            is_active = p._coll == active
            bg = C.SURFACE2 if is_active else C.MANTLE
            fg = p._color if is_active else C.SUBTEXT0
            widgets = [p, p._lbl] + ([p._dot] if p._dot else [])
            for w in widgets:
                w.configure(bg=bg)
            p._lbl.configure(fg=fg)

    # -- Simulation ----------------------------------------------------------
    def _simulate_and_refresh(self):
        self._simulated = simulate_dashboard(
            self.all_articles, self._manual_slots, self._excluded)
        self._refresh_pool()
        self._refresh_slots()

    # -- Pool (left panel) ---------------------------------------------------
    def _build_pool_ui(self):
        """One-time creation of pool header + treeview. Data filled by _refresh_pool."""
        accent = self._app.store.site_accent
        self._pool_accent_bar = tk.Frame(self._pool_frame, bg=accent, height=3)
        self._pool_accent_bar.pack(fill="x")

        hdr = tk.Frame(self._pool_frame, bg=C.SURFACE0)
        hdr.pack(fill="x", padx=12, pady=(10, 2))
        tk.Label(hdr, text="Article Pool", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(side="left")
        self._pool_hdr_lbl = tk.Label(hdr, text="", bg=C.SURFACE0,
                                       fg=C.OVERLAY0, font=F.TINY)
        self._pool_hdr_lbl.pack(side="right")

        # Treeview
        tree_frame = tk.Frame(self._pool_frame, bg=C.SURFACE0)
        tree_frame.pack(fill="both", expand=True, padx=4, pady=(2, 8))

        cols = ("pin", "title", "feed", "cat", "date", "type")
        tree = ttk.Treeview(tree_frame, style="Pool.Treeview",
                            columns=cols, show="headings", selectmode="browse")
        scrollbar = tk.Scrollbar(tree_frame, orient="vertical",
                                 command=tree.yview,
                                 bg=C.SURFACE1, troughcolor=C.BASE,
                                 highlightthickness=0, bd=0)
        tree.configure(yscrollcommand=scrollbar.set)

        col_defs = [
            ("pin",   "",       50,  "center"),
            ("title", "Title",  220, "w"),
            ("feed",  "Feed",   65,  "center"),
            ("cat",   "Cat",    70,  "center"),
            ("date",  "Date",   80,  "center"),
            ("type",  "Type",   42,  "center"),
        ]
        self._pool_col_defs = col_defs
        for col_id, heading, width, anchor in col_defs:
            tree.heading(col_id, text=heading,
                         command=lambda c=col_id: self._sort_pool(c))
            tree.column(col_id, width=width, minwidth=width, anchor=anchor,
                        stretch=(col_id == "title"))

        # Static collection color tags
        for coll, coll_hex in COLL_COLORS.items():
            tree.tag_configure(f"coll_{coll}", foreground=coll_hex)

        tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        self._pool_tree = tree

        tree.bind("<ButtonPress-1>", self._pool_drag_start)
        tree.bind("<B1-Motion>", self._drag_motion)
        tree.bind("<ButtonRelease-1>", self._drag_drop)
        tree.bind("<Double-Button-1>", self._pool_dblclick)

    def _refresh_pool(self):
        """Update pool data in-place (clear rows, re-insert)."""
        tree = self._pool_tree
        tree.delete(*tree.get_children())

        # Update accent bar color
        self._pool_accent_bar.configure(bg=self._app.store.site_accent)

        eligible = self._get_eligible()
        search = self._search_var.get().strip().lower()
        coll_filter = self._coll_filter

        visible = []
        for a in eligible:
            if coll_filter != "all" and a["collection"] != coll_filter:
                continue
            if search and search not in a["title"].lower():
                continue
            visible.append(a)

        visible = self._apply_pool_sort(visible)

        self._pool_hdr_lbl.configure(
            text=f"{len(eligible)} eligible \u00b7 {len(visible)} shown")

        # Update sort arrows in headings
        for col_id, heading, _, _ in self._pool_col_defs:
            display_heading = heading
            if col_id == self._pool_sort_col and heading:
                arrow = "\u25b2" if self._pool_sort_asc else "\u25bc"
                display_heading = f"{heading} {arrow}"
            tree.heading(col_id, text=display_heading)

        feeds = simulate_feeds(self.all_articles, self._simulated,
                               self._excluded, self._pinned)

        # Update category color tags (may change via categories panel)
        cat_colors = self._app.store.cat_colors
        for cat_id, cat_hex in cat_colors.items():
            tree.tag_configure(f"cat_{cat_id}", foreground=cat_hex)

        assigned_keys = {s["key"] for s in self._simulated if s}
        manual_keys = set(self._manual_slots.values())
        self._pool_iid_map = {}

        cat_labels = self._app.store.cat_labels

        for a in visible:
            feed_info = feeds.get(a["key"])
            if feed_info and feed_info["labels"]:
                labels = sorted(feed_info["labels"],
                                key=lambda l: FEED_ORDER.get(l, 99))
                feed_label = labels[0]
            else:
                feed_label = ""
            is_pinned = a["key"] in self._pinned
            is_locked = a["key"] in manual_keys

            cat = a.get("category", "")
            if cat and cat in cat_colors:
                tag = f"cat_{cat}"
            else:
                tag = f"coll_{a['collection']}"

            cat_label_text = cat_labels.get(cat, "") if cat else ""

            pin_lock = ""
            if is_pinned:
                pin_lock += "\U0001f4cc"
            if is_locked:
                pin_lock += "\U0001f512"

            title = a["title"]
            if len(title) > 35:
                title = title[:32] + "..."

            iid = tree.insert("", "end", values=(
                pin_lock,
                title,
                feed_label,
                cat_label_text,
                fmt_date(a),
                COLL_SHORT.get(a["collection"], "???"),
            ), tags=(tag,))

            self._pool_iid_map[iid] = a

    def _apply_pool_sort(self, articles: list[dict]) -> list[dict]:
        col = self._pool_sort_col
        asc = self._pool_sort_asc
        rev = not asc

        if col == "pin":
            return sorted(articles, key=lambda a: a["key"] not in self._pinned,
                          reverse=rev)
        elif col == "title":
            return sorted(articles, key=lambda a: a["title"].lower(),
                          reverse=rev)
        elif col == "feed":
            feeds = simulate_feeds(self.all_articles, self._simulated,
                                   self._excluded, self._pinned)
            def feed_key(a):
                fi = feeds.get(a["key"])
                if not fi:
                    return NOT_ON_PAGE
                return fi["pos"]
            return sorted(articles, key=feed_key, reverse=rev)
        elif col == "cat":
            return sorted(articles,
                          key=lambda a: a.get("category", "") or "",
                          reverse=rev)
        elif col == "date":
            return sorted(articles, key=lambda a: a["sort_date"] or "",
                          reverse=rev)
        elif col == "type":
            return sorted(articles, key=lambda a: a["collection"],
                          reverse=rev)
        return sorted(articles, key=lambda a: a["sort_date"] or "",
                      reverse=True)

    def _sort_pool(self, col: str):
        if col == self._pool_sort_col:
            self._pool_sort_asc = not self._pool_sort_asc
        else:
            self._pool_sort_col = col
            self._pool_sort_asc = col in ("title", "feed", "cat")
        self._refresh_pool()

    # -- Slots (visual grid) -------------------------------------------------
    def _refresh_slots(self):
        for w in self._slots_frame.winfo_children():
            w.destroy()
        self._slot_cards.clear()

        hdr = tk.Frame(self._slots_frame, bg=C.MANTLE)
        hdr.pack(fill="x", pady=(0, 4))
        tk.Label(hdr, text="Dashboard Layout", bg=C.MANTLE, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(side="left")

        has_manual = bool(self._manual_slots)
        reset_btn = FlatBtn(hdr, text="Reset All",
                            command=self._reset_all_slots,
                            bg=C.MANTLE,
                            hover_bg=C.SURFACE1 if has_manual else C.MANTLE,
                            fg=C.PEACH if has_manual else C.SURFACE2,
                            font=F.TINY, padx=6, pady=1)
        reset_btn.pack(side="left", padx=(12, 0))
        if not has_manual:
            reset_btn.configure(state="disabled")

        manual_count = len(self._manual_slots)
        filled_count = sum(1 for s in self._simulated if s is not None)
        auto_count = filled_count - manual_count
        tk.Label(
            hdr,
            text=f"\U0001f512 {manual_count} manual  \u00b7  "
                 f"\U0001f4c5 {max(0, auto_count)} auto  \u00b7  "
                 f"{NUM_SLOTS} slots",
            bg=C.MANTLE, fg=C.OVERLAY0, font=F.TINY).pack(side="right")

        # 12-column grid
        grid = tk.Frame(self._slots_frame, bg=C.MANTLE)
        grid.pack(fill="both", expand=True)
        for col in range(12):
            grid.columnconfigure(col, weight=1, uniform="gridcol")
        for row_idx, slots_in_row, row_weight in GRID_ROWS:
            grid.rowconfigure(row_idx, weight=int(row_weight * 10),
                              uniform="gridrow")

        for row_idx, slots_in_row, _ in GRID_ROWS:
            for slot_num, col_start, col_span in slots_in_row:
                card = self._build_slot_card(grid, slot_num)
                card.grid(row=row_idx, column=col_start,
                          columnspan=col_span, sticky="nsew",
                          padx=3, pady=3)
                self._slot_cards[slot_num] = card

    def _build_slot_card(self, parent, slot_num: int) -> tk.Frame:
        idx = slot_num - 1
        art = self._simulated[idx] if idx < len(self._simulated) else None
        is_manual = slot_num in self._manual_slots
        is_empty = art is None

        cat_colors = self._app.store.cat_colors
        cat_labels = self._app.store.cat_labels
        cat = art.get("category", "") if art else ""
        coll = art["collection"] if art else ""
        card_color = cat_colors.get(cat) if cat else None
        if not card_color and coll:
            card_color = COLL_COLORS.get(coll)
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
        inner.pack(fill="both", expand=True, padx=6, pady=4)

        # Top row
        top = tk.Frame(inner, bg=card_bg)
        top.pack(fill="x")

        slot_label = f"{slot_num}"
        if is_manual:
            icon_text = f"{slot_label}  \U0001f512"
            icon_fg = C.BLUE
        elif art:
            icon_text = f"{slot_label}  \U0001f4c5"
            icon_fg = C.OVERLAY0
        else:
            icon_text = f"{slot_label}"
            icon_fg = C.SURFACE2

        tk.Label(top, text=icon_text, bg=card_bg, fg=icon_fg,
                 font=F.TINY).pack(side="left")

        if art:
            art_key = art["key"]
            if art_key in self._pinned:
                tk.Label(top, text="\U0001f4cc", bg=card_bg, fg=C.GREEN,
                         font=F.TINY).pack(side="left", padx=(4, 0))
            badge_text = self._badges.get(art_key, "")
            if badge_text:
                tk.Label(top, text=badge_text, bg=C.SURFACE1, fg=C.YELLOW,
                         font=F.TINY, padx=3).pack(side="left", padx=(4, 0))

        if is_manual:
            rm = FlatBtn(top, text="\u00d7",
                         command=lambda n=slot_num: self._remove_slot(n),
                         bg=card_bg, hover_bg=C.SURFACE1, fg=C.RED,
                         font=("Segoe UI", 9), padx=3, pady=0)
            rm.pack(side="right")

        if art:
            if cat and cat in cat_colors:
                badge_color = cat_colors[cat]
                badge_label = cat_labels.get(cat, cat.title())
            else:
                badge_color = COLL_COLORS.get(art["collection"],
                                              self._app.store.site_accent)
                badge_label = COLL_LABELS.get(art["collection"],
                                              art["collection"].title())

            title = art["title"]
            title_lbl = tk.Label(inner, text=title, bg=card_bg, fg=C.TEXT,
                                 font=F.SMALL, anchor="nw", justify="left",
                                 wraplength=1)
            title_lbl.pack(fill="both", expand=True, anchor="nw")

            def _on_inner_configure(e, lbl=title_lbl):
                new_wrap = max(60, e.width - 16)
                if lbl.cget("wraplength") != new_wrap:
                    lbl.configure(wraplength=new_wrap)
            inner.bind("<Configure>", _on_inner_configure)

            bot = tk.Frame(inner, bg=card_bg)
            bot.pack(fill="x", side="bottom")
            tk.Label(bot, text=badge_label, bg=badge_color, fg=C.CRUST,
                     font=F.TINY, padx=4, pady=0).pack(side="left")
            date_str = fmt_date(art)
            if date_str and date_str != "\u2014":
                tk.Label(bot, text=date_str, bg=card_bg, fg=C.OVERLAY0,
                         font=F.TINY).pack(side="right")
        else:
            tk.Label(inner, text="Drop article here", bg=card_bg,
                     fg=C.SURFACE2, font=F.TINY,
                     anchor="center").pack(fill="both", expand=True)

        self._bind_card_events(card, slot_num)
        return card

    def _bind_card_events(self, widget, slot_num: int):
        widget.bind("<ButtonPress-1>",
                    lambda e, n=slot_num: self._card_drag_start(e, n))
        widget.bind("<B1-Motion>", self._drag_motion)
        widget.bind("<ButtonRelease-1>", self._drag_drop)
        for child in widget.winfo_children():
            if isinstance(child, FlatBtn):
                continue
            self._bind_card_events(child, slot_num)

    # -- Slot Operations ----------------------------------------------------
    def _assign_to_slot(self, key: str, slot_num: int | None = None):
        if slot_num is None:
            for i in range(1, NUM_SLOTS + 1):
                if i not in self._manual_slots:
                    slot_num = i
                    break
        if slot_num is None:
            self._app.toast.show("All slots have manual overrides",
                                 C.PEACH, 2000)
            return
        existing = [n for n, k in self._manual_slots.items() if k == key]
        for n in existing:
            del self._manual_slots[n]
        self._manual_slots[slot_num] = key
        self._on_data_change()

    def _remove_slot(self, slot_num: int):
        if slot_num in self._manual_slots:
            del self._manual_slots[slot_num]
            self._on_data_change()

    def _reset_all_slots(self):
        if not self._manual_slots:
            return
        self._manual_slots.clear()
        self._on_data_change()
        self._app.toast.show("All manual overrides cleared", C.GREEN, 2000)

    def _on_data_change(self):
        self._simulate_and_refresh()
        self._app.update_changes_badge()
        self._app.store.notify("content_editorial")

    # -- Pool double-click ---------------------------------------------------
    def _pool_dblclick(self, event):
        self._drag_cleanup()
        tree = self._pool_tree
        if not tree:
            return
        iid = tree.identify_row(event.y)
        if not iid or iid not in self._pool_iid_map:
            return
        self._assign_to_slot(self._pool_iid_map[iid]["key"])

    # ========================================================================
    # DRAG-AND-DROP
    # ========================================================================
    def _pool_drag_start(self, event):
        tree = self._pool_tree
        if not tree:
            return
        iid = tree.identify_row(event.y)
        if not iid or iid not in self._pool_iid_map:
            return
        art = self._pool_iid_map[iid]
        if art["key"] in self._manual_slots.values():
            return
        tree.selection_set(iid)
        self._drag_src = "pool"
        self._drag_key = art["key"]

    def _card_drag_start(self, event, slot_num: int):
        if slot_num not in self._manual_slots:
            return
        self._drag_src = "card"
        self._drag_key = self._manual_slots[slot_num]
        self._drag_slot_num = slot_num

    def _drag_motion(self, event):
        if not self._drag_key:
            return
        if not self._drag_ghost:
            art = self._article_map.get(self._drag_key)
            if not art:
                return
            coll_color = COLL_COLORS.get(art["collection"],
                                         self._app.store.site_accent)
            title = art["title"]
            if len(title) > 40:
                title = title[:37] + "..."
            g = tk.Toplevel(self)
            g.overrideredirect(True)
            g.attributes("-alpha", 0.9)
            g.configure(bg=coll_color)
            tk.Label(g, text=f"  {title}  ", bg=coll_color, fg=C.CRUST,
                     font=F.BODY_BOLD, padx=8, pady=4).pack()
            self._drag_ghost = g
        self._drag_ghost.geometry(
            f"+{event.x_root + 14}+{event.y_root - 10}")
        self._highlight_drop_target(event.x_root, event.y_root)

    def _drag_drop(self, event):
        if not self._drag_key:
            self._drag_cleanup()
            return

        target_slot = self._slot_card_at(event.x_root, event.y_root)
        over_pool = self._is_over_pool(event.x_root, event.y_root)
        dropped = False

        if self._drag_src == "pool" and target_slot is not None:
            if self._drag_key not in self._manual_slots.values():
                self._manual_slots[target_slot] = self._drag_key
                dropped = True

        elif self._drag_src == "card" and target_slot is not None:
            src_num = self._drag_slot_num
            dst_num = target_slot
            if (src_num and src_num != dst_num
                    and src_num in self._manual_slots):
                key = self._manual_slots.pop(src_num)
                if dst_num in self._manual_slots:
                    old_key = self._manual_slots.pop(dst_num)
                    self._manual_slots[src_num] = old_key
                self._manual_slots[dst_num] = key
                dropped = True

        elif self._drag_src == "card" and over_pool:
            src_num = self._drag_slot_num
            if src_num and src_num in self._manual_slots:
                del self._manual_slots[src_num]
                dropped = True

        self._drag_cleanup()
        if dropped:
            self._on_data_change()

    def _slot_card_at(self, x, y) -> int | None:
        for slot_num, card in self._slot_cards.items():
            try:
                cx, cy = card.winfo_rootx(), card.winfo_rooty()
                cw, ch = card.winfo_width(), card.winfo_height()
                if cx <= x <= cx + cw and cy <= y <= cy + ch:
                    return slot_num
            except tk.TclError:
                pass
        return None

    def _is_over_pool(self, x, y) -> bool:
        try:
            tree = self._pool_tree
            if not tree:
                return False
            tx, ty = tree.winfo_rootx(), tree.winfo_rooty()
            return (tx <= x <= tx + tree.winfo_width()
                    and ty <= y <= ty + tree.winfo_height())
        except (tk.TclError, AttributeError):
            return False

    def _highlight_drop_target(self, x, y):
        self._clear_highlight()
        slot_num = self._slot_card_at(x, y)
        if slot_num is not None and slot_num in self._slot_cards:
            card = self._slot_cards[slot_num]
            card.configure(highlightbackground=C.BLUE, highlightthickness=3)
            self._highlighted_card = slot_num
        elif self._is_over_pool(x, y):
            try:
                if self._pool_tree:
                    self._pool_tree.configure(style="PoolDrop.Treeview")
            except (tk.TclError, AttributeError):
                pass

    def _clear_highlight(self):
        if self._highlighted_card and self._highlighted_card in self._slot_cards:
            card = self._slot_cards[self._highlighted_card]
            try:
                idx = self._highlighted_card - 1
                art = self._simulated[idx] if idx < len(self._simulated) else None
                is_manual = self._highlighted_card in self._manual_slots
                cat_colors = self._app.store.cat_colors
                cat = art.get("category", "") if art else ""
                coll = art["collection"] if art else ""
                restore_color = cat_colors.get(cat) if cat else None
                if not restore_color and coll:
                    restore_color = COLL_COLORS.get(coll)
                if art is None:
                    card.configure(highlightbackground=C.SURFACE1,
                                   highlightthickness=2)
                elif is_manual:
                    card.configure(highlightbackground=restore_color or C.BLUE,
                                   highlightthickness=2)
                else:
                    card.configure(
                        highlightbackground=restore_color or C.SURFACE2,
                        highlightthickness=2)
            except tk.TclError:
                pass
        self._highlighted_card = None
        try:
            if self._pool_tree:
                self._pool_tree.configure(style="Pool.Treeview")
        except (tk.TclError, AttributeError):
            pass

    def _drag_cleanup(self):
        if self._drag_ghost:
            self._drag_ghost.destroy()
            self._drag_ghost = None
        self._drag_src = None
        self._drag_key = None
        self._drag_slot_num = None
        self._clear_highlight()

    # ========================================================================
    # TYPE TABS
    # ========================================================================
    def _build_type_tab(self, collection: str):
        frame = tk.Frame(self._inner_notebook, bg=C.MANTLE)
        label = COLL_LABELS.get(collection, collection.title())
        self._inner_notebook.add(frame, text=f"  {label}  ")
        self._type_sort[collection] = "sort_date"

        top = tk.Frame(frame, bg=C.MANTLE)
        top.pack(fill="x", padx=16, pady=(12, 0))
        color = COLL_COLORS.get(collection, self._app.store.site_accent)

        coll_articles = [a for a in self.all_articles
                         if a["collection"] == collection]
        tk.Label(top, text=f"{label.upper()} ({len(coll_articles)} articles)",
                 bg=C.MANTLE, fg=color, font=F.HEADING).pack(side="left")

        sort_frame = tk.Frame(top, bg=C.MANTLE)
        sort_frame.pack(side="right")
        tk.Label(sort_frame, text="Sort:", bg=C.MANTLE, fg=C.OVERLAY0,
                 font=F.SMALL).pack(side="left", padx=(0, 6))

        pill_btns = {}
        for pill_label, sort_key in self.SORT_OPTIONS:
            is_active = (sort_key == "sort_date")
            btn = FlatBtn(sort_frame, text=pill_label,
                          command=lambda sk=sort_key, c=collection:
                              self._change_type_sort(c, sk),
                          bg=C.BLUE if is_active else C.SURFACE1,
                          hover_bg=C.SAPPHIRE if is_active else C.SURFACE2,
                          fg=C.CRUST if is_active else C.SUBTEXT0,
                          font=F.TINY, padx=8, pady=2)
            btn.pack(side="left", padx=2)
            pill_btns[sort_key] = btn
        self._sort_pills[collection] = pill_btns

        # Scrollable area
        container = tk.Frame(frame, bg=C.MANTLE)
        container.pack(fill="both", expand=True)

        canvas = tk.Canvas(container, bg=C.MANTLE, highlightthickness=0)
        scrollbar = tk.Scrollbar(container, orient="vertical",
                                 command=canvas.yview,
                                 bg=C.SURFACE1, troughcolor=C.BASE,
                                 highlightthickness=0, bd=0)
        inner = tk.Frame(canvas, bg=C.MANTLE)
        inner.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas_win = canvas.create_window((0, 0), window=inner, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        def _on_canvas_resize(e):
            canvas.itemconfigure(canvas_win, width=e.width)
        canvas.bind("<Configure>", _on_canvas_resize)

        canvas.pack(side="left", fill="both", expand=True, padx=(16, 0),
                    pady=(12, 0))
        scrollbar.pack(side="right", fill="y", padx=(0, 4), pady=(12, 0))

        self._scrollable_canvases.append(canvas)
        self._type_inner[collection] = inner
        self._type_canvas[collection] = canvas

        self._rebuild_type_cards(collection)

    def _change_type_sort(self, collection: str, sort_key: str):
        self._type_sort[collection] = sort_key
        for sk, btn in self._sort_pills.get(collection, {}).items():
            if sk == sort_key:
                btn.configure(bg=C.BLUE, fg=C.CRUST)
                btn._bg = C.BLUE
                btn._hover = C.SAPPHIRE
            else:
                btn.configure(bg=C.SURFACE1, fg=C.SUBTEXT0)
                btn._bg = C.SURFACE1
                btn._hover = C.SURFACE2
        self._rebuild_type_cards(collection)

    def _sort_type_articles(self, articles: list[dict],
                            sort_key: str) -> list[dict]:
        if sort_key == "pinned":
            return sorted(articles, key=lambda a: (
                a["key"] not in self._pinned,
                a["sort_date"] or "",
            ), reverse=False)
        elif sort_key == "badge":
            return sorted(articles, key=lambda a: (
                a["key"] not in self._badges,
                a["sort_date"] or "",
            ), reverse=False)
        elif sort_key in ("sort_date", "date_published", "date_updated"):
            return sorted(articles, key=lambda a: a.get(sort_key, "") or "",
                          reverse=True)
        return articles

    def _rebuild_type_cards(self, collection: str):
        inner = self._type_inner.get(collection)
        if not inner:
            return
        for w in inner.winfo_children():
            w.destroy()

        coll_articles = [a for a in self.all_articles
                         if a["collection"] == collection]
        sort_key = self._type_sort.get(collection, "sort_date")
        sorted_articles = self._sort_type_articles(coll_articles, sort_key)

        for i, art in enumerate(sorted_articles):
            self._build_article_card(inner, art, i, collection)

        canvas = self._type_canvas.get(collection)
        if canvas:
            canvas.yview_moveto(0)

    def _build_article_card(self, parent, article: dict, idx: int,
                            collection: str):
        key = article["key"]
        cat = article["category"]
        cat_colors = self._app.store.cat_colors
        cat_labels = self._app.store.cat_labels
        cat_color = cat_colors.get(cat, COLL_COLORS.get(collection,
                                                         C.OVERLAY0))
        cat_active = article.get("category_active", True)

        border_color = C.SURFACE1 if not cat_active else C.CARD_BORDER
        title_fg = C.OVERLAY0 if not cat_active else C.TEXT

        card = tk.Frame(parent, bg=C.SURFACE0,
                        highlightthickness=1,
                        highlightbackground=border_color)
        card.pack(fill="x", padx=(0, 8), pady=3)

        tk.Frame(card, bg=cat_color, width=4).pack(side="left", fill="y")

        inner = tk.Frame(card, bg=C.SURFACE0)
        inner.pack(side="left", fill="both", expand=True, padx=10, pady=6)

        # Row 1: title + category pill + indicators
        row1 = tk.Frame(inner, bg=C.SURFACE0)
        row1.pack(fill="x")

        title = article["title"]
        if len(title) > 55:
            title = title[:52] + "..."
        tk.Label(row1, text=title, bg=C.SURFACE0, fg=title_fg,
                 font=F.BODY_BOLD, anchor="w").pack(side="left")

        if cat:
            tk.Label(row1, text=cat, bg=C.SURFACE1, fg=cat_color,
                     font=F.TINY, padx=6, pady=1).pack(side="right",
                                                        padx=(8, 0))
            if not cat_active:
                tk.Label(row1, text="[category off]", bg=C.SURFACE0,
                         fg=C.SURFACE2, font=F.TINY).pack(side="right",
                                                           padx=(4, 0))

        if key in self._pinned:
            tk.Label(row1, text="\U0001f4cc Pinned", bg=C.SURFACE0,
                     fg=C.GREEN, font=F.TINY).pack(side="right", padx=(8, 0))

        badge_val = self._badges.get(key, "")
        if badge_val:
            tk.Label(row1, text=f"\u2605 {badge_val}", bg=C.SURFACE1,
                     fg=C.YELLOW, font=F.TINY, padx=4).pack(side="right",
                                                              padx=(8, 0))

        # Row 2: Date
        row_dates = tk.Frame(inner, bg=C.SURFACE0)
        row_dates.pack(fill="x", pady=(2, 0))
        tk.Label(row_dates, text=fmt_date(article), bg=C.SURFACE0,
                 fg=C.OVERLAY0, font=F.TINY).pack(side="left")

        # Row 3: Publish + Pin + Badge
        row3 = tk.Frame(inner, bg=C.SURFACE0)
        row3.pack(fill="x", pady=(4, 0))

        is_published = key not in self._excluded
        pub_frame = tk.Frame(row3, bg=C.SURFACE0)
        pub_frame.pack(side="left", padx=(0, 16))
        tk.Label(pub_frame, text="Publish:", bg=C.SURFACE0, fg=C.SUBTEXT0,
                 font=F.SMALL).pack(side="left", padx=(0, 4))
        Toggle(pub_frame, initial=is_published,
               on_toggle=lambda v, k=key: self._on_publish_toggle(k, v),
               bg=C.SURFACE0).pack(side="left")

        is_pinned = key in self._pinned
        pin_frame = tk.Frame(row3, bg=C.SURFACE0)
        pin_frame.pack(side="left", padx=(0, 16))
        tk.Label(pin_frame, text="Pin:", bg=C.SURFACE0, fg=C.SUBTEXT0,
                 font=F.SMALL).pack(side="left", padx=(0, 4))
        Toggle(pin_frame, initial=is_pinned,
               on_toggle=lambda v, k=key: self._on_pin_toggle(k, v),
               bg=C.SURFACE0).pack(side="left")

        badge_frame = tk.Frame(row3, bg=C.SURFACE0)
        badge_frame.pack(side="left", padx=(0, 8))
        tk.Label(badge_frame, text="Badge:", bg=C.SURFACE0, fg=C.SUBTEXT0,
                 font=F.SMALL).pack(side="left", padx=(0, 4))
        badge_var = tk.StringVar(value=self._badges.get(key, ""))
        tk.Entry(badge_frame, textvariable=badge_var,
                 bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
                 font=F.SMALL, relief="flat", bd=0,
                 highlightthickness=1, highlightcolor=C.BLUE,
                 highlightbackground=C.SURFACE2, width=18).pack(side="left")
        badge_var.trace_add(
            "write",
            lambda *a, k=key, v=badge_var: self._on_badge_change(k, v))

    # -- Type Tab Callbacks --------------------------------------------------
    def _on_publish_toggle(self, key: str, is_on: bool):
        if is_on:
            self._excluded.discard(key)
        else:
            self._excluded.add(key)
            to_remove = [n for n, k in self._manual_slots.items() if k == key]
            for n in to_remove:
                del self._manual_slots[n]
        self._on_data_change()

    def _on_pin_toggle(self, key: str, is_on: bool):
        if is_on:
            self._pinned.add(key)
        else:
            self._pinned.discard(key)
        self._refresh_slots()
        self._app.update_changes_badge()
        self._app.store.notify("content_editorial")

    def _on_badge_change(self, key: str, var: tk.StringVar):
        text = var.get().strip()
        if text:
            self._badges[key] = text
        else:
            self._badges.pop(key, None)
        self._app.update_changes_badge()
        self._app.store.notify("content_editorial")
