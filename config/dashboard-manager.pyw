#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dashboard-manager.pyw -- GUI for managing the home page editorial dashboard.

Manages a 15-slot editorial dashboard with pinned/badge/publish controls.
Reads article frontmatter from src/content/ (read-only).
Reads/writes config/data/dashboard.json.
Reads config/data/categories.json for category colors.

Matches the Catppuccin Mocha theme used by all config tools.
"""

import ctypes
import json
import sys
import tkinter as tk
from tkinter import ttk, messagebox
from pathlib import Path
from datetime import datetime

# Windows DPI awareness â€” must be called before any Tk window creation
if sys.platform == "win32":
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        pass

# -- Paths -------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
CATEGORIES_JSON = ROOT / "config" / "data" / "categories.json"
DASHBOARD_JSON = ROOT / "config" / "data" / "dashboard.json"
CONTENT = ROOT / "src" / "content"
IMAGES = ROOT / "public" / "images"

COLLECTIONS = ["reviews", "guides", "news", "brands", "games"]
NUM_SLOTS = 15

# Dashboard grid layout â€” matches HBS index.handlebars structure
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


# -- Design System (shared with all config tools) ---------------------------
class C:
    """Color tokens â€” Catppuccin Mocha palette."""
    BASE = "#11111b"
    MANTLE = "#181825"
    CRUST = "#0d0d12"
    SURFACE0 = "#1e1e2e"
    SURFACE1 = "#313244"
    SURFACE2 = "#45475a"
    OVERLAY0 = "#6c7086"
    OVERLAY1 = "#7f849c"
    TEXT = "#cdd6f4"
    SUBTEXT1 = "#bac2de"
    SUBTEXT0 = "#a6adc8"
    BLUE = "#89b4fa"
    SAPPHIRE = "#74c7ec"
    GREEN = "#a6e3a1"
    PEACH = "#fab387"
    RED = "#f38ba8"
    MAUVE = "#cba6f7"
    TEAL = "#94e2d5"
    YELLOW = "#f9e2af"
    DROP = "#2a2b3d"
    CARD_BORDER = "#252538"


class F:
    """Font tokens."""
    TITLE = ("Segoe UI", 18, "bold")
    HEADING = ("Segoe UI", 13, "bold")
    SUBHEADING = ("Segoe UI", 11)
    BODY = ("Segoe UI", 10)
    BODY_BOLD = ("Segoe UI", 10, "bold")
    SMALL = ("Segoe UI", 9)
    TINY = ("Segoe UI", 8)
    MONO = ("Consolas", 10)
    MONO_SMALL = ("Consolas", 9)


# -- SSOT: read from categories.json ----------------------------------------
def _load_site_accent():
    if CATEGORIES_JSON.is_file():
        data = json.loads(CATEGORIES_JSON.read_text(encoding="utf-8"))
        sc = data.get("siteColors", {})
        return sc.get("primary", "#89b4fa")
    return "#89b4fa"


def _load_cat_colors():
    if CATEGORIES_JSON.is_file():
        data = json.loads(CATEGORIES_JSON.read_text(encoding="utf-8"))
        return {c["id"]: c["color"] for c in data.get("categories", [])}
    return {}


def _load_cat_labels():
    if CATEGORIES_JSON.is_file():
        data = json.loads(CATEGORIES_JSON.read_text(encoding="utf-8"))
        return {c["id"]: c.get("label", c["id"].title()) for c in data.get("categories", [])}
    return {}


def _load_content_flags() -> dict[str, dict[str, bool]]:
    """Read content production/vite flags from categories.json.

    Returns { cat_id: { "production": bool, "vite": bool } }.
    """
    if CATEGORIES_JSON.is_file():
        data = json.loads(CATEGORIES_JSON.read_text(encoding="utf-8"))
        return {
            c["id"]: c.get("content", {"production": False, "vite": False})
            for c in data.get("categories", [])
        }
    return {}


def _is_content_active(cat_id: str) -> bool:
    """Vite mode: production=true OR vite=true (GUI is a dev tool)."""
    flags = CONTENT_FLAGS.get(cat_id, {})
    return flags.get("production", False) or flags.get("vite", False)


def _darken(hex_color: str, factor: float = 0.7) -> str:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"#{int(r*factor):02x}{int(g*factor):02x}{int(b*factor):02x}"


ACCENT = _load_site_accent()
ACCENT_HOVER = _darken(ACCENT)
CAT_COLORS = _load_cat_colors()
CAT_LABELS = _load_cat_labels()
CONTENT_FLAGS = _load_content_flags()

# Collection-level colors and labels (for dashboard filter pills + type tabs)
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


# -- Dark Title Bar ----------------------------------------------------------
def dark_title_bar(window):
    if sys.platform != "win32":
        return
    try:
        window.update_idletasks()
        hwnd = ctypes.windll.user32.GetParent(window.winfo_id())
        val = ctypes.c_int(1)
        ctypes.windll.dwmapi.DwmSetWindowAttribute(
            hwnd, 20, ctypes.byref(val), ctypes.sizeof(val))
    except Exception:
        pass


# -- Custom Widgets ----------------------------------------------------------
class FlatBtn(tk.Label):
    """Flat button with hover and press feedback."""

    def __init__(self, parent, text, command=None, bg=C.SURFACE1, fg=C.TEXT,
                 hover_bg=C.SURFACE2, font=None, **kw):
        padx = kw.pop("padx", 14)
        pady = kw.pop("pady", 6)
        super().__init__(parent, text=text, bg=bg, fg=fg,
                         font=font or F.SMALL, padx=padx, pady=pady, cursor="hand2")
        self._bg, self._hover = bg, hover_bg
        self._cmd = command
        self._inside = False
        self.bind("<Enter>", self._on_enter)
        self.bind("<Leave>", self._on_leave)
        self.bind("<ButtonPress-1>", self._on_press)
        self.bind("<ButtonRelease-1>", self._on_release)

    def _on_enter(self, e):
        self._inside = True
        self.configure(bg=self._hover)

    def _on_leave(self, e):
        self._inside = False
        self.configure(bg=self._bg)

    def _on_press(self, e):
        self.configure(bg=self._bg)

    def _on_release(self, e):
        if self._inside:
            self.configure(bg=self._hover)
            if self._cmd:
                self._cmd()
        else:
            self.configure(bg=self._bg)


class Toast:
    """Temporary notification overlay."""

    def __init__(self, parent):
        self._p = parent
        self._lbl = tk.Label(parent, text="", fg=C.BASE,
                             font=F.BODY_BOLD, padx=28, pady=12)
        self._id = None

    def show(self, msg, color=C.GREEN, ms=3500):
        self._lbl.configure(text=f"  {msg}  ", bg=color)
        self._lbl.place(relx=0.5, rely=1.0, anchor="s", y=-48)
        self._lbl.lift()
        if self._id:
            self._p.after_cancel(self._id)
        self._id = self._p.after(ms, self._hide)

    def _hide(self):
        self._lbl.place_forget()
        self._id = None


class Tip:
    """Hover tooltip â€” attach to any widget."""

    def __init__(self, widget, text: str):
        self._w = widget
        self._text = text
        self._tw: tk.Toplevel | None = None
        # WHY: add="+" preserves existing bindings (e.g. FlatBtn hover state)
        widget.bind("<Enter>", self._show, add="+")
        widget.bind("<Leave>", self._hide, add="+")

    def _show(self, e):
        x = self._w.winfo_rootx() + self._w.winfo_width() // 2
        y = self._w.winfo_rooty() + self._w.winfo_height() + 4
        self._tw = tw = tk.Toplevel(self._w)
        tw.wm_overrideredirect(True)
        tw.configure(bg=C.SURFACE2)
        lbl = tk.Label(tw, text=self._text, bg=C.SURFACE1, fg=C.TEXT,
                       font=F.TINY, padx=8, pady=4, wraplength=280, justify="left")
        lbl.pack(padx=1, pady=1)
        tw.wm_geometry(f"+{x}+{y}")

    def _hide(self, e):
        if self._tw:
            self._tw.destroy()
            self._tw = None


class HoverListbox(tk.Listbox):
    """Listbox with per-row hover highlighting."""
    _global_drag = False

    def __init__(self, parent, **kw):
        hover_bg = kw.pop("hover_bg", C.SURFACE1)
        item_bg = kw.pop("item_bg", C.SURFACE0)
        super().__init__(parent, **kw)
        self._hover_bg = hover_bg
        self._item_bg = item_bg
        self._hover_idx = -1
        self.bind("<Motion>", self._on_hover)
        self.bind("<Leave>", self._on_unhover)

    def _on_hover(self, e):
        if HoverListbox._global_drag:
            return
        idx = self.nearest(e.y)
        if idx == self._hover_idx:
            return
        self._clear_hover()
        if 0 <= idx < self.size() and self.bbox(idx):
            self._hover_idx = idx
            self.itemconfigure(idx, bg=self._hover_bg)

    def _on_unhover(self, e):
        self._clear_hover()

    def _clear_hover(self):
        if 0 <= self._hover_idx < self.size():
            self.itemconfigure(self._hover_idx, bg=self._item_bg)
        self._hover_idx = -1


class Toggle(tk.Canvas):
    """iOS-style pill toggle switch."""
    W, H = 38, 20

    def __init__(self, parent, initial=False, on_toggle=None, **kw):
        bg = kw.pop("bg", C.SURFACE0)
        super().__init__(parent, width=self.W, height=self.H,
                         highlightthickness=0, bd=0, bg=bg)
        self._on = initial
        self._cb = on_toggle
        self._draw()
        self.bind("<Button-1>", self._click)
        self.configure(cursor="hand2")

    def _draw(self):
        self.delete("all")
        w, h = self.W, self.H
        r = h // 2
        tc = C.GREEN if self._on else C.SURFACE2
        self.create_arc(0, 0, h, h, start=90, extent=180, fill=tc, outline=tc)
        self.create_arc(w - h, 0, w, h, start=-90, extent=180, fill=tc, outline=tc)
        self.create_rectangle(r, 0, w - r, h, fill=tc, outline=tc)
        pad, tr = 3, r - 3
        cx = w - r if self._on else r
        self.create_oval(cx - tr, r - tr, cx + tr, r + tr,
                         fill="#ffffff" if self._on else C.OVERLAY0, outline="")

    def _click(self, e=None):
        self._on = not self._on
        self._draw()
        if self._cb:
            self._cb(self._on)

    def get(self):
        return self._on

    def set(self, v):
        self._on = bool(v)
        self._draw()


# -- Data Loading ------------------------------------------------------------
def _parse_frontmatter(path: Path) -> dict:
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


def _entry_id(filepath: Path, content_dir: Path) -> str:
    """Derive slug-folder entry ID (strip /index)."""
    rel = filepath.relative_to(content_dir)
    parts = rel.with_suffix("").parts
    if parts and parts[-1] == "index":
        if len(parts) == 1:
            return ""
        return "/".join(parts[:-1])
    return "/".join(parts)


def load_articles() -> list[dict]:
    """Scan all 5 content dirs, parse frontmatter, build article dicts."""
    articles = []
    for collection in COLLECTIONS:
        cdir = CONTENT / collection
        if not cdir.is_dir():
            continue
        for path in sorted(cdir.rglob("*")):
            if path.suffix not in (".md", ".mdx") or not path.is_file():
                continue
            fm = _parse_frontmatter(path)
            if not fm:
                continue
            eid = _entry_id(path, cdir)
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
            has_hero = bool(hero_img) or (IMAGES / collection / eid).is_dir()

            # WHY: articles without a category field (brands, games) default
            # to active â€” matches content-filter.mjs Rule 3 behavior.
            category_active = _is_content_active(category) if category else True

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


def load_dashboard_config() -> dict:
    """Load dashboard config from JSON."""
    if DASHBOARD_JSON.is_file():
        try:
            return json.loads(DASHBOARD_JSON.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {"slots": {}, "pinned": [], "badges": {}, "excluded": []}


def save_dashboard_config(data: dict):
    """Write dashboard config to JSON."""
    DASHBOARD_JSON.parent.mkdir(parents=True, exist_ok=True)
    DASHBOARD_JSON.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8"
    )


# -- Production Algorithm ---------------------------------------------------
def simulate_dashboard(articles: list[dict], manual_slots: dict,
                       excluded: set) -> list:
    """Run production algorithm: manual overrides first, then auto-fill by date.

    Returns NUM_SLOTS-length list (dict or None for empty slots).
    """
    article_map = {a["key"]: a for a in articles}

    # WHY: same eligibility as index.astro will use
    eligible = [
        a for a in articles
        if a["full_article"] is not False
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
    remaining = [a for a in eligible if a["key"] not in used]
    remaining.sort(key=lambda a: a["sort_date"], reverse=True)

    # Fill empty slots
    ri = 0
    for i in range(NUM_SLOTS):
        if slots[i] is None and ri < len(remaining):
            slots[i] = remaining[ri]
            used.add(remaining[ri]["key"])
            ri += 1

    return slots


# -- Main Application -------------------------------------------------------
class DashboardManager(tk.Tk):

    def __init__(self):
        super().__init__()
        self.title("EG Dashboard Manager")
        sw, sh = self.winfo_screenwidth(), self.winfo_screenheight()
        win_w, win_h = 1536, 864
        self.geometry(f"{win_w}x{win_h}+{(sw-win_w)//2}+{(sh-win_h)//2}")
        self.configure(bg=C.MANTLE)
        self.minsize(960, 640)

        dark_title_bar(self)
        try:
            ico = tk.PhotoImage(width=1, height=1)
            ico.put(ACCENT)
            self._icon = ico.zoom(32, 32)
            self.iconphoto(True, self._icon)
        except Exception:
            pass

        # Load data
        self.all_articles = load_articles()
        self._article_map: dict[str, dict] = {
            a["key"]: a for a in self.all_articles
        }

        # Load config
        cfg = load_dashboard_config()
        self._manual_slots: dict[int, str] = {}  # slot_num (1-indexed) â†’ key
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

        self._original = self._snapshot()

        # Simulation result
        self._simulated: list = []

        # Filter/search state for dashboard tab
        self._search_var = tk.StringVar(value="")
        self._coll_filter = "all"
        self._coll_pills: list[tk.Frame] = []

        # Drag state
        self._drag_src: str | None = None  # "pool" or "card"
        self._drag_key: str | None = None
        self._drag_ghost: tk.Toplevel | None = None
        self._drag_slot_num: int | None = None  # source slot for card drags

        # Grid card widgets (slot_num â†’ frame) for DnD target detection
        self._slot_cards: dict[int, tk.Frame] = {}
        self._highlighted_card: int | None = None

        # Scrollable canvases for type tabs (for global mousewheel)
        self._scrollable_canvases: list[tk.Canvas] = []

        # Type tab sort state + rebuildable inner frames
        self._type_sort: dict[str, str] = {}  # collection â†’ sort key
        self._type_inner: dict[str, tk.Frame] = {}  # collection â†’ cards container
        self._type_canvas: dict[str, tk.Canvas] = {}  # collection â†’ canvas

        self._setup_styles()
        self._build_header()
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(fill="both", expand=True, padx=0, pady=0)
        self._build_dashboard_tab()
        for coll in COLLECTIONS:
            self._build_type_tab(coll)
        self._build_status_bar()
        self.toast = Toast(self)

        self.bind_all("<Control-s>", lambda e: self._save())
        self.bind_all("<MouseWheel>", self._global_mousewheel)
        self.protocol("WM_DELETE_WINDOW", self._on_close)

        self._simulate_and_refresh()

    def _setup_styles(self):
        s = ttk.Style(self)
        s.theme_use("clam")
        s.configure("TNotebook", background=C.MANTLE, borderwidth=0,
                     tabmargins=[4, 8, 4, 0])
        s.configure("TNotebook.Tab",
                     background=C.SURFACE1, foreground=C.OVERLAY0,
                     padding=[28, 12], borderwidth=0, font=F.BODY_BOLD,
                     focuscolor=C.SURFACE1)
        s.map("TNotebook.Tab",
              background=[("selected", C.SURFACE0), ("active", C.SURFACE2)],
              foreground=[("selected", C.TEXT), ("active", C.SUBTEXT1)])
        s.configure("TFrame", background=C.MANTLE)

    # -- Snapshot / Config ---------------------------------------------------
    def _snapshot(self) -> str:
        """Serialize current config state for change detection."""
        return json.dumps(self._build_config(), sort_keys=True)

    def _build_config(self) -> dict:
        """Build config dict from in-memory state."""
        slots = {}
        for num, key in self._manual_slots.items():
            art = self._article_map.get(key)
            if art:
                slots[str(num)] = {
                    "collection": art["collection"],
                    "id": art["entry_id"],
                }
        return {
            "slots": slots,
            "pinned": sorted(self._pinned),
            "badges": dict(sorted(self._badges.items())),
            "excluded": sorted(self._excluded),
        }

    # -- Header --------------------------------------------------------------
    def _build_header(self):
        hdr = tk.Frame(self, bg=C.CRUST, height=56)
        hdr.pack(fill="x")
        hdr.pack_propagate(False)
        tk.Frame(hdr, bg=ACCENT, height=2).pack(fill="x", side="bottom")
        inner = tk.Frame(hdr, bg=C.CRUST)
        inner.pack(fill="both", expand=True, padx=20)
        tk.Label(inner, text="EG", bg=C.CRUST, fg=ACCENT,
                 font=("Segoe UI", 18, "bold")).pack(side="left")
        tk.Label(inner, text="  Dashboard Manager", bg=C.CRUST, fg=C.TEXT,
                 font=("Segoe UI", 14)).pack(side="left")
        tk.Label(inner, text=f"  \u00b7  {ROOT.name}", bg=C.CRUST, fg=C.OVERLAY0,
                 font=F.BODY).pack(side="left", padx=(4, 0))
        self.save_btn = FlatBtn(inner, text="  Save  ", command=self._save,
                                bg=ACCENT, fg=C.CRUST, hover_bg=ACCENT_HOVER,
                                font=F.BODY_BOLD)
        self.save_btn.pack(side="right", pady=4)
        self.changes_lbl = tk.Label(inner, text="", bg=C.CRUST, fg=C.PEACH,
                                    font=F.SMALL)
        self.changes_lbl.pack(side="right", padx=8)

    # -- Status Bar ----------------------------------------------------------
    def _build_status_bar(self):
        bar = tk.Frame(self, bg=C.CRUST, height=32)
        bar.pack(fill="x", side="bottom")
        bar.pack_propagate(False)
        self.status_var = tk.StringVar(value="  Ready  \u00b7  Ctrl+S to save")
        tk.Label(bar, textvariable=self.status_var, bg=C.CRUST, fg=C.OVERLAY0,
                 font=F.TINY, padx=20).pack(side="left", fill="y")
        total = len(self.all_articles)
        eligible = len(self._get_eligible())
        disabled = sum(1 for a in self.all_articles if not a.get("category_active", True))
        self._status_right = tk.Label(
            bar,
            text=f"{total} articles  \u00b7  {eligible} eligible  \u00b7  "
                 f"{disabled} disabled  \u00b7  {NUM_SLOTS} slots",
            bg=C.CRUST, fg=C.SURFACE2, font=F.TINY, padx=20)
        self._status_right.pack(side="right", fill="y")

    def _get_eligible(self) -> list[dict]:
        """Return eligible articles (same criteria as production algorithm)."""
        return [
            a for a in self.all_articles
            if a["full_article"] is not False
            and not a["draft"]
            and a["has_hero"]
            and a["key"] not in self._excluded
            and a.get("category_active", True)
        ]

    # -- Global Mousewheel ---------------------------------------------------
    def _global_mousewheel(self, event):
        """Scroll whichever type-tab canvas is under the cursor."""
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
        frame = ttk.Frame(self.notebook)
        self.notebook.add(frame, text="  Dashboard  ")

        # Toolbar: filter pills + search
        bar = tk.Frame(frame, bg=C.MANTLE)
        bar.pack(fill="x", padx=16, pady=(12, 0))

        # Filter pills
        pill_row = tk.Frame(bar, bg=C.MANTLE)
        pill_row.pack(side="left")
        self._make_coll_pill(pill_row, "all", "All", ACCENT)
        for coll in COLLECTIONS:
            color = COLL_COLORS.get(coll, ACCENT)
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
        self._search_var.trace_add("write", lambda *a: self._refresh_pool())

        # Main panels â€” pool (left, narrow) + visual grid (right, wide)
        panel_frame = tk.Frame(frame, bg=C.MANTLE)
        panel_frame.pack(fill="both", expand=True, padx=16, pady=(8, 0))

        # Left: Article Pool (fixed width)
        self._pool_frame = tk.Frame(panel_frame, bg=C.SURFACE0,
                                    highlightthickness=1,
                                    highlightbackground=C.CARD_BORDER)
        self._pool_frame.pack(side="left", fill="both", padx=(0, 8))
        self._pool_frame.configure(width=400)
        self._pool_frame.pack_propagate(False)

        # Right: Dashboard Grid (expands to fill)
        self._slots_frame = tk.Frame(panel_frame, bg=C.MANTLE)
        self._slots_frame.pack(side="right", fill="both", expand=True, padx=(8, 0))

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
        """Run production algorithm and refresh both dashboard panels."""
        self._simulated = simulate_dashboard(
            self.all_articles, self._manual_slots, self._excluded
        )
        self._refresh_pool()
        self._refresh_slots()

    # -- Pool (left panel) ---------------------------------------------------
    def _refresh_pool(self):
        for w in self._pool_frame.winfo_children():
            w.destroy()

        tk.Frame(self._pool_frame, bg=ACCENT, height=3).pack(fill="x")
        hdr = tk.Frame(self._pool_frame, bg=C.SURFACE0)
        hdr.pack(fill="x", padx=12, pady=(10, 2))
        tk.Label(hdr, text="Article Pool", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(side="left")

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

        # Sort by date descending
        visible.sort(key=lambda a: a["sort_date"], reverse=True)

        # Counts
        tk.Label(hdr, text=f"{len(eligible)} eligible \u00b7 {len(visible)} shown",
                 bg=C.SURFACE0, fg=C.OVERLAY0, font=F.TINY).pack(side="right")

        # Column headers
        col_hdr = tk.Label(
            self._pool_frame,
            text="   Title                                    Date        Type",
            bg=C.SURFACE0, fg=C.OVERLAY0, font=F.MONO_SMALL, anchor="w")
        col_hdr.pack(fill="x", padx=12, pady=(4, 0))

        # Listbox
        lb = HoverListbox(self._pool_frame, bg=C.SURFACE0, fg=C.SUBTEXT1,
                          selectbackground=C.BLUE, selectforeground=C.CRUST,
                          font=F.MONO, activestyle="none", relief="flat",
                          bd=0, highlightthickness=0,
                          hover_bg=C.SURFACE1, item_bg=C.SURFACE0)
        lb.pack(fill="both", expand=True, padx=12, pady=(2, 12))

        # Track which keys are in simulated slots
        assigned_keys = {s["key"] for s in self._simulated if s}

        self._pool_items = visible
        for i, a in enumerate(visible):
            in_slots = a["key"] in assigned_keys
            title = a["title"]
            if len(title) > 38:
                title = title[:35] + "..."
            date_str = a["sort_date"][:10] if a["sort_date"] else "\u2014"
            coll_short = COLL_SHORT.get(a["collection"], "???")
            display = f"   {title:<38}  {date_str:>10}  {coll_short}"
            lb.insert("end", display)
            if in_slots:
                lb.itemconfigure(i, fg=C.SURFACE2)

        lb._items = visible
        self._pool_lb = lb

        # Bindings
        lb.bind("<ButtonPress-1>", self._pool_drag_start)
        lb.bind("<B1-Motion>", self._drag_motion)
        lb.bind("<ButtonRelease-1>", self._drag_drop)
        lb.bind("<Double-Button-1>", self._pool_dblclick)

    # -- Slots (visual grid matching HBS dashboard layout) --------------------
    def _refresh_slots(self):
        for w in self._slots_frame.winfo_children():
            w.destroy()
        self._slot_cards.clear()

        # Header
        hdr = tk.Frame(self._slots_frame, bg=C.MANTLE)
        hdr.pack(fill="x", pady=(0, 4))
        tk.Label(hdr, text="Dashboard Layout", bg=C.MANTLE, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(side="left")

        # Reset All button â€” always visible, clears all manual overrides
        has_manual = bool(self._manual_slots)
        reset_btn = FlatBtn(hdr, text="Reset All",
                            command=self._reset_all_slots,
                            bg=C.MANTLE, hover_bg=C.SURFACE1 if has_manual else C.MANTLE,
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
            grid.rowconfigure(row_idx, weight=int(row_weight * 10), uniform="gridrow")

        for row_idx, slots_in_row, _ in GRID_ROWS:
            for slot_num, col_start, col_span in slots_in_row:
                card = self._build_slot_card(grid, slot_num)
                card.grid(row=row_idx, column=col_start, columnspan=col_span,
                          sticky="nsew", padx=3, pady=3)
                self._slot_cards[slot_num] = card

    def _build_slot_card(self, parent, slot_num: int) -> tk.Frame:
        """Build a single visual slot card for the dashboard grid."""
        idx = slot_num - 1
        art = self._simulated[idx] if idx < len(self._simulated) else None
        is_manual = slot_num in self._manual_slots
        is_empty = art is None

        # Card frame
        if is_empty:
            card_bg = C.BASE
            border_color = C.SURFACE1
        elif is_manual:
            card_bg = C.SURFACE0
            border_color = C.BLUE
        else:
            card_bg = C.SURFACE0
            border_color = C.SURFACE2

        card = tk.Frame(parent, bg=card_bg,
                        highlightthickness=2, highlightbackground=border_color)

        inner = tk.Frame(card, bg=card_bg)
        inner.pack(fill="both", expand=True, padx=6, pady=4)

        # Top row: slot number + icon + remove button
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

        # Pin / badge indicators next to slot number
        if art:
            art_key = art["key"]
            if art_key in self._pinned:
                tk.Label(top, text="\U0001f4cc", bg=card_bg, fg=C.GREEN,
                         font=F.TINY).pack(side="left", padx=(4, 0))
            badge_text = self._badges.get(art_key, "")
            if badge_text:
                tk.Label(top, text=badge_text, bg=C.SURFACE1, fg=C.YELLOW,
                         font=F.TINY, padx=3).pack(side="left", padx=(4, 0))

        # Remove button for manual slots
        if is_manual:
            rm = FlatBtn(top, text="\u00d7",
                         command=lambda n=slot_num: self._remove_slot(n),
                         bg=card_bg, hover_bg=C.SURFACE1, fg=C.RED,
                         font=("Segoe UI", 9), padx=3, pady=0)
            rm.pack(side="right")

        # Title (wrapped) â€” wraplength set dynamically on <Configure>
        if art:
            coll_color = COLL_COLORS.get(art["collection"], ACCENT)
            title = art["title"]
            title_lbl = tk.Label(inner, text=title, bg=card_bg, fg=C.TEXT,
                                 font=F.SMALL, anchor="nw", justify="left",
                                 wraplength=1)
            title_lbl.pack(fill="both", expand=True, anchor="nw")

            # WHY: dynamically size wraplength to card width so titles wrap properly
            def _on_inner_configure(e, lbl=title_lbl):
                new_wrap = max(60, e.width - 16)
                if lbl.cget("wraplength") != new_wrap:
                    lbl.configure(wraplength=new_wrap)
            inner.bind("<Configure>", _on_inner_configure)

            # Bottom: collection badge + date (newest of published/updated)
            bot = tk.Frame(inner, bg=card_bg)
            bot.pack(fill="x", side="bottom")
            coll_label = COLL_LABELS.get(art["collection"], art["collection"].title())
            tk.Label(bot, text=coll_label, bg=coll_color, fg=C.CRUST,
                     font=F.TINY, padx=4, pady=0).pack(side="left")
            date_str = art["sort_date"][:10] if art["sort_date"] else ""
            if date_str:
                tk.Label(bot, text=date_str, bg=card_bg, fg=C.OVERLAY0,
                         font=F.TINY).pack(side="right")
        else:
            tk.Label(inner, text="Drop article here", bg=card_bg,
                     fg=C.SURFACE2, font=F.TINY,
                     anchor="center").pack(fill="both", expand=True)

        # Bind drag events on card and all children
        self._bind_card_events(card, slot_num)
        return card

    def _bind_card_events(self, widget, slot_num: int):
        """Recursively bind drag events on a card and all its children.
        WHY: skip FlatBtn widgets so their command callbacks fire normally.
        """
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
        """Assign an article to a manual slot."""
        if slot_num is None:
            for i in range(1, NUM_SLOTS + 1):
                if i not in self._manual_slots:
                    slot_num = i
                    break
        if slot_num is None:
            self.toast.show("All slots have manual overrides", C.PEACH, 2000)
            return
        # WHY: allow re-assigning same key to different slot (move)
        existing = [n for n, k in self._manual_slots.items() if k == key]
        for n in existing:
            del self._manual_slots[n]
        self._manual_slots[slot_num] = key
        self._on_data_change()

    def _remove_slot(self, slot_num: int):
        """Remove a manual override by slot number."""
        if slot_num in self._manual_slots:
            del self._manual_slots[slot_num]
            self._on_data_change()

    def _reset_all_slots(self):
        """Clear all manual overrides â€” dashboard reverts to pure date-fill."""
        if not self._manual_slots:
            return
        self._manual_slots.clear()
        self._on_data_change()
        self.toast.show("All manual overrides cleared", C.GREEN, 2000)

    def _on_data_change(self):
        """Resimulate and refresh after any data change."""
        self._simulate_and_refresh()
        self._update_badge()

    # -- Pool double-click ---------------------------------------------------
    def _pool_dblclick(self, event):
        """Double-click a pool item to assign to first empty slot."""
        self._drag_cleanup()
        lb = event.widget
        idx = lb.nearest(event.y)
        if idx < 0 or idx >= lb.size() or lb.bbox(idx) is None:
            return
        if idx < len(self._pool_items):
            self._assign_to_slot(self._pool_items[idx]["key"])

    # ========================================================================
    # DRAG-AND-DROP
    # ========================================================================

    def _pool_drag_start(self, event):
        """Start dragging from the pool."""
        lb = event.widget
        idx = lb.nearest(event.y)
        if idx < 0 or idx >= lb.size() or lb.bbox(idx) is None:
            return
        if idx >= len(self._pool_items):
            return
        art = self._pool_items[idx]
        if art["key"] in self._manual_slots.values():
            return
        lb.selection_clear(0, "end")
        lb.selection_set(idx)
        self._drag_src = "pool"
        self._drag_key = art["key"]

    def _card_drag_start(self, event, slot_num: int):
        """Start dragging from a grid card (manual slots only)."""
        if slot_num not in self._manual_slots:
            return
        self._drag_src = "card"
        self._drag_key = self._manual_slots[slot_num]
        self._drag_slot_num = slot_num

    def _drag_motion(self, event):
        """Update drag ghost position (shared by pool and card drags)."""
        if not self._drag_key:
            return
        if not self._drag_ghost:
            HoverListbox._global_drag = True
            art = self._article_map.get(self._drag_key)
            if not art:
                return
            coll_color = COLL_COLORS.get(art["collection"], ACCENT)
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
        self._drag_ghost.geometry(f"+{event.x_root + 14}+{event.y_root - 10}")
        self._highlight_drop_target(event.x_root, event.y_root)

    def _drag_drop(self, event):
        """Handle drop (pool->card, card->pool, card->card)."""
        if not self._drag_key:
            self._drag_cleanup()
            return

        target_slot = self._slot_card_at(event.x_root, event.y_root)
        over_pool = self._is_over_pool(event.x_root, event.y_root)
        dropped = False

        if self._drag_src == "pool" and target_slot is not None:
            # Pool -> Grid card: assign to that slot
            if self._drag_key not in self._manual_slots.values():
                self._manual_slots[target_slot] = self._drag_key
                dropped = True

        elif self._drag_src == "card" and target_slot is not None:
            # Card -> Card: swap/move
            src_num = self._drag_slot_num
            dst_num = target_slot
            if src_num and src_num != dst_num and src_num in self._manual_slots:
                key = self._manual_slots.pop(src_num)
                if dst_num in self._manual_slots:
                    old_key = self._manual_slots.pop(dst_num)
                    self._manual_slots[src_num] = old_key
                self._manual_slots[dst_num] = key
                dropped = True

        elif self._drag_src == "card" and over_pool:
            # Card -> Pool: remove manual override
            src_num = self._drag_slot_num
            if src_num and src_num in self._manual_slots:
                del self._manual_slots[src_num]
                dropped = True

        self._drag_cleanup()
        if dropped:
            self._on_data_change()

    def _slot_card_at(self, x, y) -> int | None:
        """Find which grid slot card is under screen coordinates."""
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
        """Check if screen coordinates are over the pool listbox."""
        try:
            lb = self._pool_lb
            lx, ly = lb.winfo_rootx(), lb.winfo_rooty()
            return lx <= x <= lx + lb.winfo_width() and ly <= y <= ly + lb.winfo_height()
        except (tk.TclError, AttributeError):
            return False

    def _highlight_drop_target(self, x, y):
        """Highlight the drop target during drag."""
        self._clear_highlight()
        slot_num = self._slot_card_at(x, y)
        if slot_num is not None and slot_num in self._slot_cards:
            card = self._slot_cards[slot_num]
            card.configure(highlightbackground=C.BLUE, highlightthickness=3)
            self._highlighted_card = slot_num
        elif self._is_over_pool(x, y):
            try:
                self._pool_lb.configure(bg=C.DROP)
            except (tk.TclError, AttributeError):
                pass

    def _clear_highlight(self):
        """Reset all drag highlights."""
        if self._highlighted_card and self._highlighted_card in self._slot_cards:
            card = self._slot_cards[self._highlighted_card]
            try:
                # Restore original border
                idx = self._highlighted_card - 1
                art = self._simulated[idx] if idx < len(self._simulated) else None
                is_manual = self._highlighted_card in self._manual_slots
                if art is None:
                    card.configure(highlightbackground=C.SURFACE1, highlightthickness=2)
                elif is_manual:
                    card.configure(highlightbackground=C.BLUE, highlightthickness=2)
                else:
                    card.configure(highlightbackground=C.SURFACE2, highlightthickness=2)
            except tk.TclError:
                pass
        self._highlighted_card = None
        try:
            self._pool_lb.configure(bg=C.SURFACE0)
        except (tk.TclError, AttributeError):
            pass

    def _drag_cleanup(self):
        """Clean up all drag state."""
        if self._drag_ghost:
            self._drag_ghost.destroy()
            self._drag_ghost = None
        self._drag_src = None
        self._drag_key = None
        self._drag_slot_num = None
        HoverListbox._global_drag = False
        self._clear_highlight()

    # ========================================================================
    # TYPE TABS (Reviews, Guides, News, Brands, Games)
    # ========================================================================

    SORT_OPTIONS = [
        ("Date", "sort_date"),
        ("Published", "date_published"),
        ("Updated", "date_updated"),
        ("Pinned", "pinned"),
        ("Badge", "badge"),
    ]

    def _build_type_tab(self, collection: str):
        """Build a per-collection tab with scrollable article cards."""
        frame = ttk.Frame(self.notebook)
        label = COLL_LABELS.get(collection, collection.title())
        self.notebook.add(frame, text=f"  {label}  ")
        self._type_sort[collection] = "sort_date"

        # Header with sort pills
        top = tk.Frame(frame, bg=C.MANTLE)
        top.pack(fill="x", padx=16, pady=(12, 0))
        color = COLL_COLORS.get(collection, ACCENT)

        coll_articles = [a for a in self.all_articles
                         if a["collection"] == collection]
        tk.Label(top, text=f"{label.upper()} ({len(coll_articles)} articles)",
                 bg=C.MANTLE, fg=color, font=F.HEADING).pack(side="left")

        # Sort pills
        sort_frame = tk.Frame(top, bg=C.MANTLE)
        sort_frame.pack(side="right")
        tk.Label(sort_frame, text="Sort:", bg=C.MANTLE, fg=C.OVERLAY0,
                 font=F.SMALL).pack(side="left", padx=(0, 6))

        pill_btns = {}
        for pill_label, sort_key in self.SORT_OPTIONS:
            is_active = (sort_key == "sort_date")
            btn = FlatBtn(sort_frame, text=pill_label,
                          command=lambda sk=sort_key, c=collection: self._change_type_sort(c, sk),
                          bg=C.BLUE if is_active else C.SURFACE1,
                          hover_bg=C.SAPPHIRE if is_active else C.SURFACE2,
                          fg=C.CRUST if is_active else C.SUBTEXT0,
                          font=F.TINY, padx=8, pady=2)
            btn.pack(side="left", padx=2)
            pill_btns[sort_key] = btn
        # WHY: store pill refs so _change_type_sort can update active state
        if not hasattr(self, "_sort_pills"):
            self._sort_pills = {}
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
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
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

        # Build article cards with default sort
        self._rebuild_type_cards(collection)

    def _change_type_sort(self, collection: str, sort_key: str):
        """Change sort order for a type tab and rebuild cards."""
        self._type_sort[collection] = sort_key
        # Update pill active states
        for sk, btn in self._sort_pills.get(collection, {}).items():
            if sk == sort_key:
                btn.configure(bg=C.BLUE, fg=C.CRUST)
                btn._bg = C.BLUE
                btn._hover_bg = C.SAPPHIRE
            else:
                btn.configure(bg=C.SURFACE1, fg=C.SUBTEXT0)
                btn._bg = C.SURFACE1
                btn._hover_bg = C.SURFACE2
        self._rebuild_type_cards(collection)

    def _sort_type_articles(self, articles: list[dict], sort_key: str) -> list[dict]:
        """Sort articles for a type tab by the given key."""
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
        """Rebuild article cards for a type tab with current sort."""
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

        # Reset scroll position
        canvas = self._type_canvas.get(collection)
        if canvas:
            canvas.yview_moveto(0)

    def _build_article_card(self, parent, article: dict, idx: int,
                            collection: str):
        """Build a single article card with publish/pin toggles and badge entry."""
        key = article["key"]
        cat = article["category"]
        cat_color = CAT_COLORS.get(cat, COLL_COLORS.get(collection, C.OVERLAY0))
        cat_active = article.get("category_active", True)

        # Dimmed styling for disabled-category articles
        border_color = C.SURFACE1 if not cat_active else C.CARD_BORDER
        title_fg = C.OVERLAY0 if not cat_active else C.TEXT

        card = tk.Frame(parent, bg=C.SURFACE0,
                        highlightthickness=1,
                        highlightbackground=border_color)
        card.pack(fill="x", padx=(0, 8), pady=3)

        # Category accent bar
        tk.Frame(card, bg=cat_color, width=4).pack(side="left", fill="y")

        inner = tk.Frame(card, bg=C.SURFACE0)
        inner.pack(side="left", fill="both", expand=True, padx=10, pady=6)

        # Row 1: title + category pill + pin/badge indicators
        row1 = tk.Frame(inner, bg=C.SURFACE0)
        row1.pack(fill="x")

        title = article["title"]
        if len(title) > 55:
            title = title[:52] + "..."
        tk.Label(row1, text=title, bg=C.SURFACE0, fg=title_fg,
                 font=F.BODY_BOLD, anchor="w").pack(side="left")

        # Category pill + disabled indicator
        if cat:
            tk.Label(row1, text=cat, bg=C.SURFACE1, fg=cat_color,
                     font=F.TINY, padx=6, pady=1).pack(side="right", padx=(8, 0))
            if not cat_active:
                tk.Label(row1, text="[category off]", bg=C.SURFACE0,
                         fg=C.SURFACE2, font=F.TINY).pack(side="right", padx=(4, 0))

        # Pin indicator
        if key in self._pinned:
            tk.Label(row1, text="\U0001f4cc Pinned", bg=C.SURFACE0, fg=C.GREEN,
                     font=F.TINY).pack(side="right", padx=(8, 0))

        # Badge indicator
        badge_val = self._badges.get(key, "")
        if badge_val:
            tk.Label(row1, text=f"\u2605 {badge_val}", bg=C.SURFACE1, fg=C.YELLOW,
                     font=F.TINY, padx=4).pack(side="right", padx=(8, 0))

        # Row 2: Both dates
        row_dates = tk.Frame(inner, bg=C.SURFACE0)
        row_dates.pack(fill="x", pady=(2, 0))
        date_pub = article["date_published"][:10] if article["date_published"] else "\u2014"
        date_upd = article["date_updated"][:10] if article["date_updated"] else "\u2014"
        tk.Label(row_dates, text=f"Published: {date_pub}", bg=C.SURFACE0,
                 fg=C.OVERLAY0, font=F.TINY).pack(side="left", padx=(0, 16))
        tk.Label(row_dates, text=f"Updated: {date_upd}", bg=C.SURFACE0,
                 fg=C.OVERLAY0, font=F.TINY).pack(side="left")

        # Row 3: Publish toggle + Pin toggle + Badge entry
        row3 = tk.Frame(inner, bg=C.SURFACE0)
        row3.pack(fill="x", pady=(4, 0))

        # Publish toggle (NOT excluded = published)
        is_published = key not in self._excluded
        pub_frame = tk.Frame(row3, bg=C.SURFACE0)
        pub_frame.pack(side="left", padx=(0, 16))
        tk.Label(pub_frame, text="Publish:", bg=C.SURFACE0, fg=C.SUBTEXT0,
                 font=F.SMALL).pack(side="left", padx=(0, 4))
        Toggle(pub_frame, initial=is_published,
               on_toggle=lambda v, k=key: self._on_publish_toggle(k, v),
               bg=C.SURFACE0).pack(side="left")

        # Pin toggle
        is_pinned = key in self._pinned
        pin_frame = tk.Frame(row3, bg=C.SURFACE0)
        pin_frame.pack(side="left", padx=(0, 16))
        tk.Label(pin_frame, text="Pin:", bg=C.SURFACE0, fg=C.SUBTEXT0,
                 font=F.SMALL).pack(side="left", padx=(0, 4))
        Toggle(pin_frame, initial=is_pinned,
               on_toggle=lambda v, k=key: self._on_pin_toggle(k, v),
               bg=C.SURFACE0).pack(side="left")

        # Badge entry
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
        """Toggle publish state (excluded list)."""
        if is_on:
            self._excluded.discard(key)
        else:
            self._excluded.add(key)
            # Also remove from manual slots if excluded
            to_remove = [n for n, k in self._manual_slots.items() if k == key]
            for n in to_remove:
                del self._manual_slots[n]
        self._on_data_change()

    def _on_pin_toggle(self, key: str, is_on: bool):
        """Toggle pin state."""
        if is_on:
            self._pinned.add(key)
        else:
            self._pinned.discard(key)
        # WHY: refresh dashboard cards so pin indicator updates
        self._refresh_slots()
        self._update_badge()

    def _on_badge_change(self, key: str, var: tk.StringVar):
        """Update badge text."""
        text = var.get().strip()
        if text:
            self._badges[key] = text
        else:
            self._badges.pop(key, None)
        self._update_badge()

    # -- Change Tracking + Save ----------------------------------------------
    def _update_badge(self):
        current = self._snapshot()
        if current != self._original:
            self.changes_lbl.configure(text="unsaved changes", fg=C.PEACH)
        else:
            self.changes_lbl.configure(text="", fg=C.GREEN)

    def _save(self):
        current = self._snapshot()
        if current == self._original:
            self.toast.show("No changes to save", C.OVERLAY0)
            return
        try:
            data = self._build_config()
            save_dashboard_config(data)
            self._original = current
            self._update_badge()
            now = datetime.now().strftime("%H:%M:%S")
            manual = len(self._manual_slots)
            pinned = len(self._pinned)
            excluded = len(self._excluded)
            badges = len(self._badges)
            self.toast.show(
                f"Saved ({manual} manual, {pinned} pinned, "
                f"{excluded} excluded, {badges} badges) at {now}",
                C.GREEN)
            self.status_var.set(f"  Last saved at {now}  \u00b7  Ctrl+S to save")
        except Exception as e:
            self.toast.show(f"Error: {e}", C.RED)

    # -- Close ---------------------------------------------------------------
    def _on_close(self):
        current = self._snapshot()
        if current != self._original:
            if not messagebox.askyesno(
                    "Unsaved Changes",
                    "You have unsaved changes.\n\nExit without saving?",
                    parent=self):
                return
        self.destroy()


if __name__ == "__main__":
    import yaml
    app = DashboardManager()
    app.mainloop()
