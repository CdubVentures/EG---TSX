#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
slideshow-manager.py -- GUI for managing the home page slideshow queue.

Lets you drag products into an ordered slideshow, with search, category
filtering, sort options, and auto-fill fallback.

Reads product data from src/content/data-products/.
Reads/writes config/data/slideshow.json.
Reads config/data/categories.json for category colors.

Matches the Catppuccin Mocha theme used by all config tools.
"""

import ctypes
import json
import random
import sys
import tkinter as tk
from tkinter import ttk, messagebox
from pathlib import Path
from datetime import datetime

# Windows DPI awareness — must be called before any Tk window creation
if sys.platform == "win32":
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        pass

# -- Paths -------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
CATEGORIES_JSON = ROOT / "config" / "data" / "categories.json"
SLIDESHOW_JSON = ROOT / "config" / "data" / "slideshow.json"
DATA_PRODUCTS = ROOT / "src" / "content" / "data-products"


# -- Design System (shared with all config tools) ---------------------------
class C:
    """Color tokens — Catppuccin Mocha palette."""
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
    MONO_BOLD = ("Consolas", 10, "bold")
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


def _darken(hex_color: str, factor: float = 0.7) -> str:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"#{int(r*factor):02x}{int(g*factor):02x}{int(b*factor):02x}"


ACCENT = _load_site_accent()
ACCENT_HOVER = _darken(ACCENT)
CAT_COLORS = _load_cat_colors()
CAT_LABELS = _load_cat_labels()


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
    """Hover tooltip — attach to any widget."""

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


# -- Product Loading ---------------------------------------------------------
def _parse_release_date(raw: str) -> tuple[int, int]:
    """Parse 'MM/YYYY' → (year, month) for sorting. Returns (0, 0) on failure."""
    if not raw or not isinstance(raw, str):
        return (0, 0)
    raw = raw.strip()
    parts = raw.split("/")
    if len(parts) == 2:
        try:
            m, y = int(parts[0]), int(parts[1])
            return (y, m)
        except ValueError:
            pass
    # Try bare year
    try:
        return (int(raw), 0)
    except ValueError:
        return (0, 0)


_PLACEHOLDER_DOMAINS = {"dasad.com", "dasd.com", ""}


def _has_deal_link(data: dict) -> bool:
    """Check if any alink_* field has a real (non-placeholder) URL."""
    for key in ("alink_amazon", "alink_bestbuy", "alink_newegg",
                "alink_walmart", "alink_brand"):
        val = str(data.get(key, "")).strip()
        if val and val not in _PLACEHOLDER_DOMAINS and val.startswith("http"):
            return True
    return False


def load_products() -> list[dict]:
    """Scan data-products and build the eligible product list."""
    products = []
    if not DATA_PRODUCTS.is_dir():
        return products

    for json_path in sorted(DATA_PRODUCTS.rglob("*.json")):
        try:
            data = json.loads(json_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue

        # Build entry ID matching Astro glob loader format:
        # glob({ base: 'src/content/data-products' }) joins path segments
        # with hyphens and drops the category prefix.
        # e.g. mouse/razer/viper-v3-pro.json → "razer-viper-v3-pro"
        rel = json_path.relative_to(DATA_PRODUCTS)
        parts = rel.with_suffix("").parts  # (category, brand-folder, product-slug)
        if len(parts) != 3:
            continue
        entry_id = "-".join(parts[1:])  # brand-product (matches Astro entry.id)

        category = data.get("category", parts[0])
        brand = data.get("brand", "")
        model = data.get("model", "")
        slug = data.get("slug", parts[2])
        overall_raw = data.get("overall", "")
        release_date = str(data.get("release_date", ""))
        image_path = data.get("imagePath", "")

        # Parse overall score
        try:
            overall = float(overall_raw)
        except (ValueError, TypeError):
            overall = 0.0

        # Count media images
        media = data.get("media", {})
        image_count = len(media.get("images", []))

        # Eligibility: must have numeric overall > 0 AND media images
        if overall <= 0 or image_count == 0:
            continue

        has_deal = _has_deal_link(data)

        products.append({
            "entry_id": entry_id,
            "slug": slug,
            "brand": brand,
            "model": model,
            "category": category,
            "overall": overall,
            "release_date": release_date,
            "release_sort": _parse_release_date(release_date),
            "image_path": image_path,
            "image_count": image_count,
            "has_deal": has_deal,
        })

    return products


def load_slideshow_config() -> dict:
    """Load the slideshow config from JSON."""
    if SLIDESHOW_JSON.is_file():
        try:
            return json.loads(SLIDESHOW_JSON.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {"maxSlides": 10, "slides": []}


def save_slideshow_config(data: dict):
    """Write the slideshow config to JSON."""
    SLIDESHOW_JSON.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8"
    )


# -- Main Application -------------------------------------------------------
class SlideshowManager(tk.Tk):

    def __init__(self):
        super().__init__()
        self.title("EG Slideshow Manager")
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
        self.all_products = load_products()
        self.config_data = load_slideshow_config()
        self._original = json.dumps(self.config_data, sort_keys=True)

        # WHY: build a lookup map for entry_id → product
        self._product_map: dict[str, dict] = {
            p["entry_id"]: p for p in self.all_products
        }

        # Resolve queue from config
        self.queue: list[str] = []  # ordered entry IDs
        for eid in self.config_data.get("slides", []):
            if eid in self._product_map:
                self.queue.append(eid)

        self.max_slides = self.config_data.get("maxSlides", 10)

        # Filter/sort state
        self._search_var = tk.StringVar(value="")
        self._cat_filter = "all"
        self._sort_key = "score"  # score | release | brand | model
        self._cat_pills: list[tk.Frame] = []

        # Drag state
        self._drag_src: str | None = None  # "pool" or "queue"
        self._drag_entry_id: str | None = None
        self._drag_ghost: tk.Toplevel | None = None
        self._drag_queue_idx: int | None = None  # for queue reorder

        self._setup_styles()
        self._build_header()
        self._build_toolbar()
        self._build_panels()
        self._build_status_bar()
        self.toast = Toast(self)

        self.bind_all("<Control-s>", lambda e: self._save())
        self.protocol("WM_DELETE_WINDOW", self._on_close)

        self._refresh_pool()
        self._refresh_queue()

    def _setup_styles(self):
        s = ttk.Style(self)
        s.theme_use("clam")
        s.configure("TFrame", background=C.MANTLE)

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
        tk.Label(inner, text="  Slideshow Manager", bg=C.CRUST, fg=C.TEXT,
                 font=("Segoe UI", 14)).pack(side="left")
        tk.Label(inner, text=f"  \u00b7  {ROOT.name}", bg=C.CRUST, fg=C.OVERLAY0,
                 font=F.BODY).pack(side="left", padx=(4, 0))
        self.save_btn = FlatBtn(inner, text="  Save  ", command=self._save,
                                bg=ACCENT, fg=C.CRUST, hover_bg=ACCENT_HOVER,
                                font=F.BODY_BOLD)
        self.save_btn.pack(side="right", pady=4)
        self.changes_lbl = tk.Label(inner, text="", bg=C.CRUST, fg=C.PEACH, font=F.SMALL)
        self.changes_lbl.pack(side="right", padx=8)

    # -- Toolbar (search + category pills + sort) ----------------------------
    def _build_toolbar(self):
        bar = tk.Frame(self, bg=C.MANTLE)
        bar.pack(fill="x", padx=16, pady=(12, 0))

        # Search
        search_frame = tk.Frame(bar, bg=C.MANTLE)
        search_frame.pack(side="left")
        tk.Label(search_frame, text="\U0001f50d", bg=C.MANTLE, fg=C.OVERLAY0,
                 font=F.BODY).pack(side="left", padx=(0, 4))
        self._search_entry = tk.Entry(search_frame, textvariable=self._search_var,
                                      bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
                                      font=F.BODY, relief="flat", bd=0,
                                      highlightthickness=1, highlightcolor=C.BLUE,
                                      highlightbackground=C.SURFACE2, width=25)
        self._search_entry.pack(side="left", ipady=4)
        self._search_var.trace_add("write", lambda *a: self._refresh_pool())

        # Category pills
        pill_row = tk.Frame(bar, bg=C.MANTLE)
        pill_row.pack(side="left", padx=(24, 0))

        # "All" pill
        self._make_pill(pill_row, "all", "All", ACCENT)

        # Per-category pills (only categories that have products on disk)
        product_cats = sorted(set(p["category"] for p in self.all_products))
        for cat in product_cats:
            color = CAT_COLORS.get(cat, ACCENT)
            label = CAT_LABELS.get(cat, cat.title())
            self._make_pill(pill_row, cat, label, color)

        # Sort dropdown
        sort_frame = tk.Frame(bar, bg=C.MANTLE)
        sort_frame.pack(side="right")
        tk.Label(sort_frame, text="Sort:", bg=C.MANTLE, fg=C.OVERLAY0,
                 font=F.SMALL).pack(side="left", padx=(0, 6))
        self._sort_var = tk.StringVar(value="Score")
        sort_menu = tk.OptionMenu(
            sort_frame, self._sort_var,
            "Score", "Release Date", "Brand", "Model",
            command=self._on_sort_change,
        )
        sort_menu.configure(bg=C.SURFACE1, fg=C.TEXT, font=F.SMALL,
                            activebackground=C.SURFACE2, activeforeground=C.TEXT,
                            highlightthickness=0, bd=0, relief="flat",
                            indicatoron=True)
        sort_menu["menu"].configure(bg=C.SURFACE1, fg=C.TEXT, font=F.SMALL,
                                     activebackground=C.BLUE, activeforeground=C.CRUST,
                                     bd=0, relief="flat")
        sort_menu.pack(side="left")

    def _make_pill(self, parent, cat_id: str, label: str, color: str):
        pill = tk.Frame(parent, bg=C.MANTLE, cursor="hand2")
        pill.pack(side="left", padx=2)

        if cat_id != "all":
            dot = tk.Canvas(pill, width=10, height=10, highlightthickness=0, bg=C.MANTLE)
            dot.pack(side="left", padx=(8, 4), pady=8)
            dot.create_oval(1, 1, 9, 9, fill=color, outline="")
        else:
            dot = None

        lbl = tk.Label(pill, text=label, fg=C.SUBTEXT0, bg=C.MANTLE,
                       font=F.BODY_BOLD, padx=4, pady=8)
        lbl.pack(side="left", padx=(0 if dot else 8, 8))

        pill._cat = cat_id
        pill._color = color
        pill._dot = dot
        pill._lbl = lbl
        self._cat_pills.append(pill)

        def click(e, c=cat_id):
            self._cat_filter = c
            self._sync_pills()
            self._refresh_pool()
        def enter(e, p=pill):
            if p._cat != self._cat_filter:
                widgets = [p, p._lbl] + ([p._dot] if p._dot else [])
                for w in widgets:
                    w.configure(bg=C.SURFACE1)
        def leave(e):
            self._sync_pills()

        for w in [pill, lbl] + ([dot] if dot else []):
            w.bind("<Button-1>", click)
            w.bind("<Enter>", enter)
            w.bind("<Leave>", leave)

        self._sync_pills()

    def _sync_pills(self):
        active = self._cat_filter
        for p in self._cat_pills:
            is_active = p._cat == active
            bg = C.SURFACE2 if is_active else C.MANTLE
            fg = p._color if is_active else C.SUBTEXT0
            widgets = [p, p._lbl] + ([p._dot] if p._dot else [])
            for w in widgets:
                w.configure(bg=bg)
            p._lbl.configure(fg=fg)

    def _on_sort_change(self, selection):
        mapping = {
            "Score": "score",
            "Release Date": "release",
            "Brand": "brand",
            "Model": "model",
        }
        self._sort_key = mapping.get(selection, "score")
        self._refresh_pool()

    # -- Main Panels (Pool + Queue) ------------------------------------------
    def _build_panels(self):
        self._panel_frame = tk.Frame(self, bg=C.MANTLE)
        self._panel_frame.pack(fill="both", expand=True, padx=16, pady=(8, 0))

        # Left: Product Pool
        self._pool_frame = tk.Frame(self._panel_frame, bg=C.SURFACE0,
                                     highlightthickness=1,
                                     highlightbackground=C.CARD_BORDER)
        self._pool_frame.pack(side="left", fill="both", expand=True, padx=(0, 8))

        # Right: Slideshow Queue
        self._queue_frame = tk.Frame(self._panel_frame, bg=C.SURFACE0,
                                      highlightthickness=1,
                                      highlightbackground=C.CARD_BORDER)
        self._queue_frame.pack(side="right", fill="both", padx=(8, 0))
        self._queue_frame.configure(width=420)
        self._queue_frame.pack_propagate(False)

    # -- Pool ----------------------------------------------------------------
    def _refresh_pool(self):
        for w in self._pool_frame.winfo_children():
            w.destroy()

        # Header
        tk.Frame(self._pool_frame, bg=ACCENT, height=3).pack(fill="x")
        hdr = tk.Frame(self._pool_frame, bg=C.SURFACE0)
        hdr.pack(fill="x", padx=12, pady=(10, 2))
        tk.Label(hdr, text="Product Pool", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(side="left")

        # Filter and sort
        search = self._search_var.get().strip().lower()
        cat_filter = self._cat_filter

        visible = []
        for p in self.all_products:
            # Category filter
            if cat_filter != "all" and p["category"] != cat_filter:
                continue
            # Search filter
            if search:
                haystack = f"{p['brand']} {p['model']}".lower()
                if search not in haystack:
                    continue
            visible.append(p)

        # Sort
        if self._sort_key == "score":
            visible.sort(key=lambda p: -p["overall"])
        elif self._sort_key == "release":
            visible.sort(key=lambda p: (-p["release_sort"][0], -p["release_sort"][1]))
        elif self._sort_key == "brand":
            visible.sort(key=lambda p: p["brand"].lower())
        elif self._sort_key == "model":
            visible.sort(key=lambda p: p["model"].lower())

        # Counts
        total_eligible = len(self.all_products)
        self._pool_count_lbl = tk.Label(hdr, text=f"{total_eligible} eligible \u00b7 {len(visible)} shown",
                                        bg=C.SURFACE0, fg=C.OVERLAY0, font=F.TINY)
        self._pool_count_lbl.pack(side="right")

        # Column headers: Product | Score | Released | $
        col_hdr = tk.Label(self._pool_frame,
                           text="   Product                                Score    Released    $",
                           bg=C.SURFACE0, fg=C.OVERLAY0, font=F.MONO_SMALL,
                           anchor="w")
        col_hdr.pack(fill="x", padx=12, pady=(4, 0))

        # Listbox (monospace for column alignment)
        lb = HoverListbox(self._pool_frame, bg=C.SURFACE0, fg=C.SUBTEXT1,
                          selectbackground=C.BLUE, selectforeground=C.CRUST,
                          font=F.MONO, activestyle="none", relief="flat",
                          bd=0, highlightthickness=0,
                          hover_bg=C.SURFACE1, item_bg=C.SURFACE0)
        lb.pack(fill="both", expand=True, padx=12, pady=(2, 12))

        self._pool_items = visible
        queue_set = set(self.queue)

        for i, p in enumerate(visible):
            in_queue = p["entry_id"] in queue_set
            score_str = f"{p['overall']:.1f}"
            name = f"{p['brand']} {p['model']}"
            if len(name) > 38:
                name = name[:35] + "..."
            date_str = p["release_date"] if p["release_date"] else "\u2014"
            deal = "$" if p["has_deal"] else " "
            display = f"   {name:<38}    {score_str:>5}    {date_str:>7}    {deal}"
            lb.insert("end", display)

            if in_queue:
                lb.itemconfigure(i, fg=C.SURFACE2)
            elif p["has_deal"]:
                lb.itemconfigure(i, fg=C.GREEN)

        lb._items = visible
        self._pool_lb = lb

        # Bindings
        lb.bind("<ButtonPress-1>", self._pool_drag_start)
        lb.bind("<B1-Motion>", self._drag_motion)
        lb.bind("<ButtonRelease-1>", self._drag_drop)
        lb.bind("<Double-Button-1>", self._pool_dblclick)

    # -- Queue ---------------------------------------------------------------
    def _refresh_queue(self):
        for w in self._queue_frame.winfo_children():
            w.destroy()

        # Header bar
        tk.Frame(self._queue_frame, bg=ACCENT, height=3).pack(fill="x")
        hdr = tk.Frame(self._queue_frame, bg=C.SURFACE0)
        hdr.pack(fill="x", padx=12, pady=(10, 2))
        tk.Label(hdr, text="Slideshow Queue", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(side="left")

        # Controls row
        ctrl = tk.Frame(self._queue_frame, bg=C.SURFACE0)
        ctrl.pack(fill="x", padx=12, pady=(4, 4))

        # Max slides spinner
        tk.Label(ctrl, text="Slots:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL).pack(side="left", padx=(0, 4))
        self._max_var = tk.IntVar(value=self.max_slides)
        spin = tk.Spinbox(ctrl, from_=1, to=20, width=3,
                          textvariable=self._max_var,
                          bg=C.SURFACE1, fg=C.TEXT, font=F.BODY,
                          buttonbackground=C.SURFACE2,
                          insertbackground=C.TEXT,
                          relief="flat", bd=0,
                          highlightthickness=1, highlightcolor=C.BLUE,
                          highlightbackground=C.SURFACE2,
                          command=self._on_max_change)
        spin.pack(side="left", padx=(0, 12))
        spin.bind("<Return>", lambda e: self._on_max_change())

        # Auto-fill button
        autofill_btn = FlatBtn(ctrl, text="Auto-fill", command=self._auto_fill,
                               bg=C.SURFACE1, hover_bg=C.SURFACE2, font=F.SMALL)
        autofill_btn.pack(side="left", padx=(0, 4))
        Tip(autofill_btn, "Fill empty slots: deal links first, then by\n"
                          "release date (newest). Score \u2265 8.0, max 3/cat")

        # Clear all button
        clear_btn = FlatBtn(ctrl, text="Clear All", command=self._clear_all,
                            bg=C.SURFACE1, hover_bg=C.SURFACE2, fg=C.RED, font=F.SMALL)
        clear_btn.pack(side="left", padx=(0, 4))

        # Slot count
        filled = len(self.queue)
        self._queue_count_lbl = tk.Label(ctrl, text=f"{filled}/{self.max_slides} slots filled",
                                          bg=C.SURFACE0, fg=C.OVERLAY0, font=F.TINY)
        self._queue_count_lbl.pack(side="right")

        # Column headers: # | Product | Score | Released | $
        q_col_hdr = tk.Label(self._queue_frame,
                             text="    #   Product                      Score    Released    $",
                             bg=C.SURFACE0, fg=C.OVERLAY0, font=F.MONO_SMALL,
                             anchor="w")
        q_col_hdr.pack(fill="x", padx=12, pady=(4, 0))

        # Queue listbox (numbered slots)
        queue_container = tk.Frame(self._queue_frame, bg=C.SURFACE0)
        queue_container.pack(fill="both", expand=True, padx=12, pady=(2, 12))

        lb = HoverListbox(queue_container, bg=C.SURFACE0, fg=C.SUBTEXT1,
                          selectbackground=C.BLUE, selectforeground=C.CRUST,
                          font=F.MONO, activestyle="none", relief="flat",
                          bd=0, highlightthickness=0,
                          hover_bg=C.SURFACE1, item_bg=C.SURFACE0)
        lb.pack(side="left", fill="both", expand=True)

        # WHY: build numbered slot display
        self._queue_display_items: list[str | None] = []  # entry_id or None

        for i in range(self.max_slides):
            pos = f"{i+1:>2}."
            if i < len(self.queue):
                eid = self.queue[i]
                p = self._product_map.get(eid)
                if p:
                    score_str = f"{p['overall']:.1f}"
                    name = f"{p['brand']} {p['model']}"
                    if len(name) > 24:
                        name = name[:21] + "..."
                    date_str = p["release_date"] if p["release_date"] else "\u2014"
                    deal = "$" if p["has_deal"] else " "
                    lb.insert("end", f"  {pos}  {name:<24}    {score_str:>5}    {date_str:>7}    {deal}")
                    self._queue_display_items.append(eid)
                    if p["has_deal"]:
                        lb.itemconfigure(i, fg=C.GREEN)
                else:
                    lb.insert("end", f"  {pos}  (unknown: {eid})")
                    self._queue_display_items.append(eid)
            else:
                lb.insert("end", f"  {pos}  \u2014")
                lb.itemconfigure(i, fg=C.SURFACE2)
                self._queue_display_items.append(None)

        self._queue_lb = lb

        # Queue bindings
        lb.bind("<ButtonPress-1>", self._queue_drag_start)
        lb.bind("<B1-Motion>", self._drag_motion)
        lb.bind("<ButtonRelease-1>", self._drag_drop)
        lb.bind("<Delete>", self._queue_delete_key)
        lb.bind("<BackSpace>", self._queue_delete_key)
        lb.bind("<Up>", self._queue_move_up)
        lb.bind("<Down>", self._queue_move_down)

        # Buttons column (× remove)
        btn_col = tk.Frame(queue_container, bg=C.SURFACE0)
        btn_col.pack(side="right", fill="y")

        for i in range(self.max_slides):
            if i < len(self.queue):
                rm = FlatBtn(btn_col, text="\u00d7",
                             command=lambda idx=i: self._remove_from_queue(idx),
                             bg=C.SURFACE0, hover_bg=C.SURFACE1, fg=C.RED,
                             font=("Segoe UI", 11), padx=4, pady=1)
                rm.pack(fill="x")
            else:
                # Spacer for empty slots
                tk.Label(btn_col, text=" ", bg=C.SURFACE0,
                         font=("Segoe UI", 11), padx=4, pady=1).pack(fill="x")

        self._update_status()

    # -- Queue Operations ----------------------------------------------------
    def _add_to_queue(self, entry_id: str):
        """Add a product to the bottom of the queue."""
        if entry_id in self.queue:
            self.toast.show("Already in queue", C.OVERLAY0, 2000)
            return
        if len(self.queue) >= self.max_slides:
            self.toast.show(f"Queue full ({self.max_slides} slots)", C.PEACH, 2000)
            return
        self.queue.append(entry_id)
        self._mark_changed()
        self._refresh_pool()
        self._refresh_queue()

    def _remove_from_queue(self, idx: int):
        """Remove a product from the queue at the given index."""
        if 0 <= idx < len(self.queue):
            self.queue.pop(idx)
            self._mark_changed()
            self._refresh_pool()
            self._refresh_queue()

    def _clear_all(self):
        """Clear the entire queue."""
        if not self.queue:
            return
        self.queue.clear()
        self._mark_changed()
        self._refresh_pool()
        self._refresh_queue()
        self.toast.show("Queue cleared", C.OVERLAY0, 2000)

    def _on_max_change(self):
        """Handle max slides spinner change."""
        try:
            new_max = self._max_var.get()
        except tk.TclError:
            return
        new_max = max(1, min(20, new_max))
        self._max_var.set(new_max)
        self.max_slides = new_max
        # Trim queue if it exceeds new max
        if len(self.queue) > self.max_slides:
            self.queue = self.queue[:self.max_slides]
        self._mark_changed()
        self._refresh_queue()

    def _auto_fill(self):
        """Fill empty slots sorted by release_date desc, score >= 8, max 3 per category."""
        try:
            self._auto_fill_inner()
        except Exception as exc:
            self.toast.show(f"Auto-fill error: {exc}", C.RED, 5000)

    def _auto_fill_inner(self):
        MIN_SCORE = 8.0
        MAX_PER_CAT = 3

        remaining = self.max_slides - len(self.queue)
        if remaining <= 0:
            self.toast.show("Queue is already full", C.OVERLAY0, 2000)
            return

        queue_set = set(self.queue)

        # Filter: not already queued, score >= 8
        eligible = [
            p for p in self.all_products
            if p["entry_id"] not in queue_set
            and p["overall"] >= MIN_SCORE
        ]

        if not eligible:
            self.toast.show("No eligible products (score \u2265 8.0)", C.OVERLAY0, 2000)
            return

        # WHY: products with deal links sort first (revenue), then by release
        # date descending (newest), then score as tiebreaker
        eligible.sort(key=lambda p: (
            0 if p["has_deal"] else 1,
            -p["release_sort"][0],
            -p["release_sort"][1],
            -p["overall"],
        ))

        # Greedy fill: up to MAX_PER_CAT per category
        cat_counts = {}
        added = 0

        for p in eligible:
            if added >= remaining:
                break
            cat = p["category"]
            if cat_counts.get(cat, 0) >= MAX_PER_CAT:
                continue
            self.queue.append(p["entry_id"])
            queue_set.add(p["entry_id"])
            cat_counts[cat] = cat_counts.get(cat, 0) + 1
            added += 1

        if added > 0:
            self._mark_changed()
            self._refresh_pool()
            self._refresh_queue()
            self.toast.show(f"Auto-filled {added} slot{'s' if added != 1 else ''}", C.GREEN, 2500)
        else:
            self.toast.show("No eligible products (score \u2265 8.0)", C.OVERLAY0, 2000)

    # -- Pool double-click / >> button ---------------------------------------
    def _pool_dblclick(self, event):
        """Double-click a pool item to add to queue."""
        self._drag_cleanup()
        lb = event.widget
        idx = lb.nearest(event.y)
        if idx < 0 or idx >= lb.size() or lb.bbox(idx) is None:
            return
        if idx < len(self._pool_items):
            self._add_to_queue(self._pool_items[idx]["entry_id"])

    # -- Queue keyboard operations -------------------------------------------
    def _queue_delete_key(self, event):
        """Delete key removes selected item from queue."""
        sel = self._queue_lb.curselection()
        if not sel:
            return
        idx = sel[0]
        if idx < len(self.queue):
            self._remove_from_queue(idx)

    def _queue_move_up(self, event):
        """Move selected queue item up."""
        sel = self._queue_lb.curselection()
        if not sel:
            return "break"
        idx = sel[0]
        if idx > 0 and idx < len(self.queue):
            self.queue[idx], self.queue[idx-1] = self.queue[idx-1], self.queue[idx]
            self._mark_changed()
            self._refresh_queue()
            self._queue_lb.selection_set(idx - 1)
            self._queue_lb.see(idx - 1)
        return "break"

    def _queue_move_down(self, event):
        """Move selected queue item down."""
        sel = self._queue_lb.curselection()
        if not sel:
            return "break"
        idx = sel[0]
        if idx < len(self.queue) - 1:
            self.queue[idx], self.queue[idx+1] = self.queue[idx+1], self.queue[idx]
            self._mark_changed()
            self._refresh_queue()
            self._queue_lb.selection_set(idx + 1)
            self._queue_lb.see(idx + 1)
        return "break"

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
        product = self._pool_items[idx]
        if product["entry_id"] in self.queue:
            return  # already in queue, don't start drag
        lb.selection_clear(0, "end")
        lb.selection_set(idx)
        self._drag_src = "pool"
        self._drag_entry_id = product["entry_id"]
        # WHY: ghost deferred to first motion (same as navbar-manager)

    def _queue_drag_start(self, event):
        """Start dragging from the queue (for reorder)."""
        lb = event.widget
        idx = lb.nearest(event.y)
        if idx < 0 or idx >= lb.size() or lb.bbox(idx) is None:
            return
        if idx >= len(self.queue):
            return  # empty slot
        lb.selection_clear(0, "end")
        lb.selection_set(idx)
        self._drag_src = "queue"
        self._drag_entry_id = self.queue[idx]
        self._drag_queue_idx = idx

    def _drag_motion(self, event):
        """Update drag ghost position (shared by pool and queue drags)."""
        if not self._drag_entry_id:
            return
        # Create ghost on first motion (deferred from drag_start)
        if not self._drag_ghost:
            HoverListbox._global_drag = True
            p = self._product_map.get(self._drag_entry_id)
            if not p:
                return
            cat_color = CAT_COLORS.get(p["category"], ACCENT)
            name = f"{p['brand']} {p['model']}"
            g = tk.Toplevel(self)
            g.overrideredirect(True)
            g.attributes("-alpha", 0.9)
            g.configure(bg=cat_color)
            tk.Label(g, text=f"  {name}  ", bg=cat_color, fg=C.CRUST,
                     font=F.BODY_BOLD, padx=8, pady=4).pack()
            self._drag_ghost = g
        self._drag_ghost.geometry(f"+{event.x_root + 14}+{event.y_root - 10}")

        # Highlight drop target
        self._pool_lb.configure(bg=C.SURFACE0)
        self._queue_lb.configure(bg=C.SURFACE0)
        tgt = self._lb_at(event.x_root, event.y_root)
        if tgt:
            tgt.configure(bg=C.DROP)

    def _drag_drop(self, event):
        """Handle drop (pool → queue or queue reorder)."""
        if not self._drag_entry_id:
            self._drag_cleanup()
            return

        tgt = self._lb_at(event.x_root, event.y_root)
        dropped = False

        if self._drag_src == "pool" and tgt == self._queue_lb:
            # Pool → Queue: add at drop position
            drop_idx = tgt.nearest(event.y) if tgt.size() > 0 else 0
            if drop_idx > len(self.queue):
                drop_idx = len(self.queue)
            if self._drag_entry_id not in self.queue and len(self.queue) < self.max_slides:
                self.queue.insert(drop_idx, self._drag_entry_id)
                dropped = True
            elif self._drag_entry_id in self.queue:
                self.toast.show("Already in queue", C.OVERLAY0, 2000)
            else:
                self.toast.show(f"Queue full ({self.max_slides} slots)", C.PEACH, 2000)

        elif self._drag_src == "queue" and tgt == self._queue_lb:
            # Queue → Queue: reorder
            drop_idx = tgt.nearest(event.y)
            if drop_idx >= len(self.queue):
                drop_idx = len(self.queue) - 1
            src_idx = self._drag_queue_idx
            if src_idx is not None and src_idx != drop_idx and 0 <= drop_idx < len(self.queue):
                item = self.queue.pop(src_idx)
                self.queue.insert(drop_idx, item)
                dropped = True

        elif self._drag_src == "queue" and tgt == self._pool_lb:
            # Queue → Pool: remove from queue
            src_idx = self._drag_queue_idx
            if src_idx is not None and 0 <= src_idx < len(self.queue):
                self.queue.pop(src_idx)
                dropped = True

        self._drag_cleanup()
        if dropped:
            self._mark_changed()
            self._refresh_pool()
            self._refresh_queue()

    def _lb_at(self, x, y) -> tk.Listbox | None:
        """Find which listbox is under the cursor."""
        for lb in [self._pool_lb, self._queue_lb]:
            try:
                lx, ly = lb.winfo_rootx(), lb.winfo_rooty()
                if lx <= x <= lx + lb.winfo_width() and ly <= y <= ly + lb.winfo_height():
                    return lb
            except tk.TclError:
                pass
        return None

    def _drag_cleanup(self):
        """Clean up all drag state."""
        if self._drag_ghost:
            self._drag_ghost.destroy()
            self._drag_ghost = None
        self._drag_src = None
        self._drag_entry_id = None
        self._drag_queue_idx = None
        HoverListbox._global_drag = False
        try:
            self._pool_lb.configure(bg=C.SURFACE0)
            self._queue_lb.configure(bg=C.SURFACE0)
        except (tk.TclError, AttributeError):
            pass

    # -- Status Bar ----------------------------------------------------------
    def _build_status_bar(self):
        bar = tk.Frame(self, bg=C.CRUST, height=32)
        bar.pack(fill="x", side="bottom")
        bar.pack_propagate(False)
        self.status_var = tk.StringVar(value="  Ready  \u00b7  Ctrl+S to save")
        tk.Label(bar, textvariable=self.status_var, bg=C.CRUST, fg=C.OVERLAY0,
                 font=F.TINY, padx=20).pack(side="left", fill="y")
        self._status_right = tk.Label(bar, text="", bg=C.CRUST, fg=C.SURFACE2,
                                       font=F.TINY, padx=20)
        self._status_right.pack(side="right", fill="y")
        self._update_status()

    def _update_status(self):
        """Update the status bar counts."""
        filled = len(self.queue)
        total = len(self.all_products)
        self._status_right.configure(
            text=f"{total} eligible products  \u00b7  {filled} assigned"
        )

    # -- Change tracking + Save ----------------------------------------------
    def _mark_changed(self):
        """Rebuild config_data from in-memory state and update badge."""
        self.config_data = {
            "maxSlides": self.max_slides,
            "slides": list(self.queue),
        }
        self._update_badge()

    def _update_badge(self):
        current = json.dumps(self.config_data, sort_keys=True)
        if current != self._original:
            self.changes_lbl.configure(text="unsaved changes", fg=C.PEACH)
        else:
            self.changes_lbl.configure(text="", fg=C.GREEN)

    def _save(self):
        current = json.dumps(self.config_data, sort_keys=True)
        if current == self._original:
            self.toast.show("No changes to save", C.OVERLAY0)
            return
        try:
            save_slideshow_config(self.config_data)
            self._original = current
            self._update_badge()
            now = datetime.now().strftime("%H:%M:%S")
            n = len(self.queue)
            self.toast.show(
                f"Saved {n} slide{'s' if n != 1 else ''} (max {self.max_slides}) at {now}",
                C.GREEN
            )
            self.status_var.set(f"  Last saved at {now}  \u00b7  Ctrl+S to save")
        except Exception as e:
            self.toast.show(f"Error: {e}", C.RED)

    # -- Close ---------------------------------------------------------------
    def _on_close(self):
        current = json.dumps(self.config_data, sort_keys=True)
        if current != self._original:
            if not messagebox.askyesno(
                    "Unsaved Changes",
                    "You have unsaved changes.\n\nExit without saving?",
                    parent=self):
                return
        self.destroy()


if __name__ == "__main__":
    app = SlideshowManager()
    app.mainloop()
