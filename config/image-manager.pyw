#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
image-manager.pyw -- GUI for managing per-category product image defaults.

Auto-scans all 366 product JSON files to discover views per category,
then lets you edit defaultImageView, listThumbKeyBase, headerGame,
viewPriority (drag reorder), viewMeta (objectFit + labels), and
imageDisplayOptions.

Reads product data from src/content/data-products/.
Reads/writes config/data/image-defaults.json.
Reads config/data/categories.json for category colors.

Matches the Catppuccin Mocha theme used by all config tools.
"""

import ctypes
import json
import sys
import tkinter as tk
from tkinter import ttk, messagebox
from pathlib import Path
from collections import defaultdict

# Windows DPI awareness — must be called before any Tk window creation
if sys.platform == "win32":
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        pass

# -- Paths -------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
CATEGORIES_JSON = ROOT / "config" / "data" / "categories.json"
IMAGE_DEFAULTS_JSON = ROOT / "config" / "data" / "image-defaults.json"
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

# Canonical view names (TSX convention)
CANONICAL_VIEWS = {
    "feature-image", "top", "left", "right", "sangle", "angle",
    "front", "rear", "bot", "img", "shape-side", "shape-top",
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
    """Hover tooltip — attach to any widget."""

    def __init__(self, widget, text: str):
        self._w = widget
        self._text = text
        self._tw: tk.Toplevel | None = None
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


# -- Product Scanning --------------------------------------------------------
def scan_product_views() -> dict[str, dict[str, int]]:
    """Scan all product JSONs, count views per category.

    Returns: {category: {view_name: count}}
    """
    result = defaultdict(lambda: defaultdict(int))
    product_counts = defaultdict(int)

    if not DATA_PRODUCTS.is_dir():
        return dict(result)

    for json_path in sorted(DATA_PRODUCTS.rglob("*.json")):
        try:
            data = json.loads(json_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue

        category = data.get("category", "")
        media = data.get("media", {})
        images = media.get("images", [])

        if not category or not images:
            continue

        product_counts[category] += 1
        seen_views = set()
        for img in images:
            view = img.get("view", "")
            if view and view not in seen_views:
                seen_views.add(view)
                result[category][view] += 1

    return dict(result), dict(product_counts)


def load_image_defaults() -> dict:
    """Load the image defaults config from JSON."""
    if IMAGE_DEFAULTS_JSON.is_file():
        try:
            return json.loads(IMAGE_DEFAULTS_JSON.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {
        "defaults": {
            "defaultImageView": ["top", "left", "feature-image", "sangle"],
            "listThumbKeyBase": ["left", "top", "sangle"],
            "coverImageView": ["feature-image", "sangle", "angle", "top", "left"],
            "headerGame": ["left", "top"],
            "viewPriority": ["feature-image", "top", "left", "right", "sangle",
                             "angle", "front", "rear", "bot", "img"],
            "imageDisplayOptions": [],
            "viewMeta": {},
        },
        "categories": {},
    }


def save_image_defaults(data: dict):
    """Write the image defaults config to JSON."""
    IMAGE_DEFAULTS_JSON.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8"
    )


# -- Main Application -------------------------------------------------------
class ImageManager(tk.Tk):

    def __init__(self):
        super().__init__()
        self.title("EG Image Defaults")
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
        self.config_data = load_image_defaults()
        self._original = json.dumps(self.config_data, sort_keys=True)

        # Scan products
        scan_result = scan_product_views()
        self.view_counts = scan_result[0]    # {category: {view: count}}
        self.product_counts = scan_result[1]  # {category: total_products}

        # Current category
        self._active_cat = "mouse"
        self._cat_pills: list[tk.Frame] = []

        # Drag state for viewPriority reorder
        self._drag_idx: int | None = None

        self._setup_styles()
        self._build_header()
        self._build_category_pills()
        self._build_panels()
        self._build_status_bar()

        # Toast overlay
        self.toast = Toast(self)

        # Keyboard shortcut
        self.bind("<Control-s>", lambda e: self._save())

        # Track unsaved changes
        self.protocol("WM_DELETE_WINDOW", self._on_close)

        self._refresh_all()

    def _setup_styles(self):
        style = ttk.Style()
        style.theme_use("clam")
        style.configure(".", background=C.MANTLE, foreground=C.TEXT,
                         fieldbackground=C.SURFACE0, borderwidth=0)
        style.configure("TCombobox", fieldbackground=C.SURFACE0,
                         background=C.SURFACE1, foreground=C.TEXT,
                         arrowcolor=C.SUBTEXT0, selectbackground=C.SURFACE2,
                         selectforeground=C.TEXT)
        style.map("TCombobox",
                  fieldbackground=[("readonly", C.SURFACE0)],
                  selectbackground=[("readonly", C.SURFACE0)],
                  selectforeground=[("readonly", C.TEXT)])

    # ── Header ─────────────────────────────────────────────────────────────
    def _build_header(self):
        hdr = tk.Frame(self, bg=C.BASE, height=52)
        hdr.pack(fill="x")
        hdr.pack_propagate(False)

        inner = tk.Frame(hdr, bg=C.BASE)
        inner.pack(fill="both", expand=True, padx=16)

        # Left: title
        tk.Label(inner, text="EG", font=F.TITLE, fg=ACCENT,
                 bg=C.BASE).pack(side="left")
        tk.Label(inner, text="   Image Defaults", font=F.HEADING,
                 fg=C.TEXT, bg=C.BASE).pack(side="left")
        tk.Label(inner, text="  —  EG - TSX", font=F.SMALL,
                 fg=C.OVERLAY0, bg=C.BASE).pack(side="left")

        # Right: change indicator + save
        self._changes_lbl = tk.Label(inner, text="", font=F.TINY,
                                      fg=C.YELLOW, bg=C.BASE)
        self._changes_lbl.pack(side="right", padx=(0, 8))

        self._save_btn = FlatBtn(inner, text="Save", command=self._save,
                                  bg=C.SURFACE1, hover_bg=C.SURFACE2,
                                  font=F.BODY_BOLD, padx=20, pady=4)
        self._save_btn.pack(side="right", padx=(0, 12))
        Tip(self._save_btn, "Save to config/data/image-defaults.json (Ctrl+S)")

        # Accent bar
        tk.Frame(self, bg=ACCENT, height=2).pack(fill="x")

    # ── Category Pills ─────────────────────────────────────────────────────
    def _build_category_pills(self):
        pill_bar = tk.Frame(self, bg=C.MANTLE)
        pill_bar.pack(fill="x", padx=20, pady=(12, 4))

        # Get categories from config
        cats = list(self.config_data.get("categories", {}).keys())
        if not cats:
            cats = ["mouse", "keyboard", "monitor"]

        for cat in cats:
            color = CAT_COLORS.get(cat, C.OVERLAY0)
            label_text = CAT_LABELS.get(cat, cat.title())
            count = self.product_counts.get(cat, 0)

            pill = tk.Frame(pill_bar, bg=C.SURFACE0, padx=0, pady=0,
                           highlightthickness=2, highlightbackground=C.SURFACE1)
            pill.pack(side="left", padx=(0, 8))

            # Color indicator
            tk.Frame(pill, bg=color, width=4).pack(side="left", fill="y")

            inner = tk.Frame(pill, bg=C.SURFACE0)
            inner.pack(side="left", padx=(8, 12), pady=6)

            lbl = tk.Label(inner, text=f"{label_text}", font=F.BODY_BOLD,
                          fg=C.TEXT, bg=C.SURFACE0)
            lbl.pack(side="left")
            cnt = tk.Label(inner, text=f"  ({count})", font=F.SMALL,
                          fg=C.OVERLAY0, bg=C.SURFACE0)
            cnt.pack(side="left")

            # Click handler
            for widget in (pill, inner, lbl, cnt):
                widget.bind("<Button-1>", lambda e, c=cat: self._select_category(c))
                widget.configure(cursor="hand2")

            self._cat_pills.append((cat, pill))

        # "defaults" tab
        pill = tk.Frame(pill_bar, bg=C.SURFACE0, padx=0, pady=0,
                       highlightthickness=2, highlightbackground=C.SURFACE1)
        pill.pack(side="left", padx=(16, 0))
        tk.Frame(pill, bg=C.OVERLAY0, width=4).pack(side="left", fill="y")
        inner = tk.Frame(pill, bg=C.SURFACE0)
        inner.pack(side="left", padx=(8, 12), pady=6)
        lbl = tk.Label(inner, text="Defaults (Global)", font=F.BODY_BOLD,
                      fg=C.TEXT, bg=C.SURFACE0)
        lbl.pack(side="left")
        for widget in (pill, inner, lbl):
            widget.bind("<Button-1>", lambda e: self._select_category("__defaults__"))
            widget.configure(cursor="hand2")
        self._cat_pills.append(("__defaults__", pill))

    def _select_category(self, cat: str):
        self._active_cat = cat
        self._refresh_all()

    def _update_pill_highlight(self):
        for cat, pill in self._cat_pills:
            if cat == self._active_cat:
                color = CAT_COLORS.get(cat, ACCENT)
                if cat == "__defaults__":
                    color = ACCENT
                pill.configure(highlightbackground=color)
            else:
                pill.configure(highlightbackground=C.SURFACE1)

    # ── Main Panels ────────────────────────────────────────────────────────
    def _build_panels(self):
        self._panel_frame = tk.Frame(self, bg=C.MANTLE)
        self._panel_frame.pack(fill="both", expand=True, padx=20, pady=(8, 0))

        # Left: View Scanner
        self._build_scanner_panel()

        # Right: Defaults Editor
        self._build_editor_panel()

    def _build_scanner_panel(self):
        left = tk.Frame(self._panel_frame, bg=C.SURFACE0, highlightthickness=1,
                        highlightbackground=C.CARD_BORDER)
        left.pack(side="left", fill="both", expand=True, padx=(0, 8))

        # Header
        hdr = tk.Frame(left, bg=C.SURFACE0)
        hdr.pack(fill="x", padx=12, pady=(10, 4))
        tk.Label(hdr, text="View Scanner", font=F.HEADING, fg=C.TEXT,
                bg=C.SURFACE0).pack(side="left")

        self._scanner_subtitle = tk.Label(hdr, text="", font=F.SMALL,
                                           fg=C.OVERLAY0, bg=C.SURFACE0)
        self._scanner_subtitle.pack(side="left", padx=(8, 0))

        # Table header
        table_hdr = tk.Frame(left, bg=C.SURFACE1)
        table_hdr.pack(fill="x", padx=12, pady=(4, 0))
        cols = [("View", 180), ("Count", 70), ("% Products", 80), ("Status", 80)]
        for label_text, w in cols:
            tk.Label(table_hdr, text=label_text, font=F.SMALL, fg=C.SUBTEXT0,
                    bg=C.SURFACE1, width=w // 8, anchor="w").pack(side="left", padx=4, pady=4)

        # Scrollable list
        list_frame = tk.Frame(left, bg=C.SURFACE0)
        list_frame.pack(fill="both", expand=True, padx=12, pady=(0, 12))

        canvas = tk.Canvas(list_frame, bg=C.SURFACE0, highlightthickness=0)
        scrollbar = tk.Scrollbar(list_frame, orient="vertical", command=canvas.yview)
        self._scanner_inner = tk.Frame(canvas, bg=C.SURFACE0)

        self._scanner_inner.bind("<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=self._scanner_inner, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Bind mousewheel
        def _on_mousewheel(e):
            canvas.yview_scroll(int(-1 * (e.delta / 120)), "units")
        canvas.bind_all("<MouseWheel>", _on_mousewheel)

        self._scanner_canvas = canvas

    def _build_editor_panel(self):
        right = tk.Frame(self._panel_frame, bg=C.SURFACE0, highlightthickness=1,
                         highlightbackground=C.CARD_BORDER)
        right.pack(side="right", fill="both", expand=True, padx=(8, 0))

        # Scrollable
        canvas = tk.Canvas(right, bg=C.SURFACE0, highlightthickness=0)
        scrollbar = tk.Scrollbar(right, orient="vertical", command=canvas.yview)
        self._editor_inner = tk.Frame(canvas, bg=C.SURFACE0)

        self._editor_inner.bind("<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=self._editor_inner, anchor="nw", tags="inner")

        # Make inner frame expand to canvas width
        def _resize_inner(e):
            canvas.itemconfigure("inner", width=e.width)
        canvas.bind("<Configure>", _resize_inner)

        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        def _on_mousewheel(e):
            canvas.yview_scroll(int(-1 * (e.delta / 120)), "units")
        canvas.bind("<MouseWheel>", _on_mousewheel)
        self._editor_inner.bind("<MouseWheel>", _on_mousewheel)

        self._editor_canvas = canvas

    # ── Status Bar ─────────────────────────────────────────────────────────
    def _build_status_bar(self):
        bar = tk.Frame(self, bg=C.BASE, height=28)
        bar.pack(fill="x", side="bottom")
        bar.pack_propagate(False)

        self._status_lbl = tk.Label(bar, text="Ready", font=F.TINY,
                                     fg=C.OVERLAY0, bg=C.BASE, anchor="w")
        self._status_lbl.pack(side="left", padx=12)

        tk.Label(bar, text="Ctrl+S to save", font=F.TINY,
                fg=C.OVERLAY0, bg=C.BASE).pack(side="right", padx=12)

    # ── Refresh ────────────────────────────────────────────────────────────
    def _refresh_all(self):
        self._update_pill_highlight()
        self._refresh_scanner()
        self._refresh_editor()
        self._update_changes()

    def _get_resolved(self) -> dict:
        """Get resolved defaults for active category (merges overrides)."""
        defaults = self.config_data["defaults"]
        categories = self.config_data.get("categories", {})

        if self._active_cat == "__defaults__":
            return dict(defaults)

        cat_overrides = categories.get(self._active_cat, {})
        resolved = dict(defaults)
        resolved.update(cat_overrides)

        # Deep merge viewMeta
        resolved["viewMeta"] = dict(defaults.get("viewMeta", {}))
        if "viewMeta" in cat_overrides:
            for view, meta in cat_overrides["viewMeta"].items():
                resolved["viewMeta"][view] = {
                    **resolved["viewMeta"].get(view, {}), **meta
                }

        return resolved

    def _refresh_scanner(self):
        """Rebuild the view scanner table."""
        for w in self._scanner_inner.winfo_children():
            w.destroy()

        cat = self._active_cat
        if cat == "__defaults__":
            # Show aggregate across all categories
            views = defaultdict(int)
            total_products = sum(self.product_counts.values())
            for cat_views in self.view_counts.values():
                for view, count in cat_views.items():
                    views[view] += count
            self._scanner_subtitle.configure(
                text=f"All categories — {total_products} products total")
        else:
            views = dict(self.view_counts.get(cat, {}))
            total_products = self.product_counts.get(cat, 0)
            label = CAT_LABELS.get(cat, cat.title())
            self._scanner_subtitle.configure(
                text=f"{label} — {total_products} products")

        if not views:
            tk.Label(self._scanner_inner, text="No product data found.",
                    font=F.BODY, fg=C.OVERLAY0, bg=C.SURFACE0).pack(pady=20)
            return

        # Sort by count descending
        sorted_views = sorted(views.items(), key=lambda x: -x[1])

        for i, (view, count) in enumerate(sorted_views):
            bg = C.SURFACE0 if i % 2 == 0 else C.MANTLE
            row = tk.Frame(self._scanner_inner, bg=bg)
            row.pack(fill="x")

            # View name
            is_canonical = view in CANONICAL_VIEWS
            fg = C.TEXT if is_canonical else C.RED
            tk.Label(row, text=view, font=F.MONO, fg=fg, bg=bg,
                    width=22, anchor="w").pack(side="left", padx=(8, 4), pady=3)

            # Count
            tk.Label(row, text=str(count), font=F.MONO, fg=C.SUBTEXT0, bg=bg,
                    width=8, anchor="e").pack(side="left", padx=4, pady=3)

            # Percentage
            pct = (count / total_products * 100) if total_products > 0 else 0
            pct_text = f"{pct:.0f}%"
            tk.Label(row, text=pct_text, font=F.MONO, fg=C.SUBTEXT0, bg=bg,
                    width=10, anchor="e").pack(side="left", padx=4, pady=3)

            # Status
            if not is_canonical:
                status_text = "ANOMALY"
                status_fg = C.RED
            elif pct >= 90:
                status_text = "common"
                status_fg = C.GREEN
            elif pct >= 50:
                status_text = "partial"
                status_fg = C.YELLOW
            else:
                status_text = "sparse"
                status_fg = C.PEACH

            tk.Label(row, text=status_text, font=F.SMALL, fg=status_fg, bg=bg,
                    width=10, anchor="w").pack(side="left", padx=4, pady=3)

    def _refresh_editor(self):
        """Rebuild the defaults editor panel."""
        for w in self._editor_inner.winfo_children():
            w.destroy()

        editing_defaults = self._active_cat == "__defaults__"
        resolved = self._get_resolved()

        # Header
        if editing_defaults:
            title = "Global Defaults"
            subtitle = "These apply to all categories unless overridden."
        else:
            label = CAT_LABELS.get(self._active_cat, self._active_cat.title())
            title = f"{label} Overrides"
            subtitle = "Empty = inherit from global defaults."

        tk.Label(self._editor_inner, text=title, font=F.HEADING,
                fg=C.TEXT, bg=C.SURFACE0).pack(anchor="w", padx=12, pady=(10, 0))
        tk.Label(self._editor_inner, text=subtitle, font=F.SMALL,
                fg=C.OVERLAY0, bg=C.SURFACE0).pack(anchor="w", padx=12, pady=(0, 8))

        # Available views for dropdowns
        if self._active_cat == "__defaults__":
            available_views = list(CANONICAL_VIEWS - {"shape-side", "shape-top"})
        else:
            cat_views = self.view_counts.get(self._active_cat, {})
            available_views = [v for v in cat_views if v in CANONICAL_VIEWS]
        available_views.sort()

        # ── Helper: views sorted by coverage % (descending) ─────────────────
        cat_for_scanner = self._active_cat if self._active_cat != "__defaults__" else None
        if cat_for_scanner:
            view_counts_cat = self.view_counts.get(cat_for_scanner, {})
            total = self.product_counts.get(cat_for_scanner, 1) or 1
        else:
            view_counts_cat = defaultdict(int)
            for cv in self.view_counts.values():
                for v, c in cv.items():
                    view_counts_cat[v] += c
            total = sum(self.product_counts.values()) or 1

        def coverage_sorted(exclude=None):
            """Return available_views sorted by coverage %, excluding given set."""
            ex = set(exclude or [])
            filtered = [v for v in available_views if v not in ex]
            filtered.sort(key=lambda v: view_counts_cat.get(v, 0), reverse=True)
            return filtered

        def coverage_pct(view):
            return int(view_counts_cat.get(view, 0) / total * 100)

        # ── Section: Contain Defaults ─────────────────────────────────────
        section = tk.Frame(self._editor_inner, bg=C.SURFACE0)
        section.pack(fill="x", padx=12, pady=(4, 8))

        tk.Label(section, text="Contain Defaults", font=F.BODY_BOLD,
                fg=C.SAPPHIRE, bg=C.SURFACE0).pack(anchor="w", pady=(0, 6))

        # ── defaultImageView: 1 primary dropdown + grayed fallbacks ───────
        self._build_fallback_row(
            section, "defaultImageView:",
            resolved.get("defaultImageView", ["top"]),
            available_views, coverage_sorted, coverage_pct,
            primary_count=1, field_key="defaultImageView",
            tip="Primary contain view for product images (vault, cards). Fallbacks auto-sorted by coverage %."
        )

        # ── listThumbKeyBase: 1 primary dropdown + grayed fallbacks ───────
        self._build_fallback_row(
            section, "listThumbKeyBase:",
            resolved.get("listThumbKeyBase", ["left"]),
            available_views, coverage_sorted, coverage_pct,
            primary_count=1, field_key="listThumbKeyBase",
            tip="Primary contain view for list thumbnails. Fallbacks auto-sorted by coverage %."
        )

        # ── headerGame: 2 primary dropdowns + grayed fallback rows ────────
        self._build_fallback_row(
            section, "headerGame:",
            resolved.get("headerGame", ["left", "top"]),
            available_views, coverage_sorted, coverage_pct,
            primary_count=2, field_key="headerGame",
            tip="Two primary contain views for game header images. Backups auto-sorted by coverage %."
        )

        # ── Section: Cover Defaults ───────────────────────────────────────
        sep_cover = tk.Frame(self._editor_inner, bg=C.SURFACE1, height=1)
        sep_cover.pack(fill="x", padx=12, pady=8)

        section_cover = tk.Frame(self._editor_inner, bg=C.SURFACE0)
        section_cover.pack(fill="x", padx=12, pady=(0, 8))

        tk.Label(section_cover, text="Cover Defaults", font=F.BODY_BOLD,
                fg=C.PEACH, bg=C.SURFACE0).pack(anchor="w", pady=(0, 6))

        # ── coverImageView: 1 primary dropdown + grayed fallbacks ─────────
        self._build_fallback_row(
            section_cover, "coverImageView:",
            resolved.get("coverImageView", ["feature-image"]),
            available_views, coverage_sorted, coverage_pct,
            primary_count=1, field_key="coverImageView",
            tip="Primary cover view for slideshows and hero images. Fallbacks auto-sorted by coverage %."
        )

        # ── Section: View Priority ─────────────────────────────────────────
        sep = tk.Frame(self._editor_inner, bg=C.SURFACE1, height=1)
        sep.pack(fill="x", padx=12, pady=8)

        section2 = tk.Frame(self._editor_inner, bg=C.SURFACE0)
        section2.pack(fill="x", padx=12, pady=(0, 8))

        hdr = tk.Frame(section2, bg=C.SURFACE0)
        hdr.pack(fill="x", pady=(0, 4))
        tk.Label(hdr, text="View Priority", font=F.BODY_BOLD,
                fg=C.SAPPHIRE, bg=C.SURFACE0).pack(side="left")
        tk.Label(hdr, text="  (drag to reorder)", font=F.SMALL,
                fg=C.OVERLAY0, bg=C.SURFACE0).pack(side="left")

        priority = list(resolved.get("viewPriority", []))
        self._priority_listbox = tk.Listbox(
            section2, font=F.MONO, bg=C.SURFACE1, fg=C.TEXT,
            selectbackground=C.SURFACE2, selectforeground=C.TEXT,
            highlightthickness=1, highlightbackground=C.SURFACE2,
            height=min(len(priority) + 1, 12), width=35,
            activestyle="none"
        )
        for i, view in enumerate(priority):
            self._priority_listbox.insert("end", f"  {i+1}. {view}")
        self._priority_listbox.pack(anchor="w", pady=2)

        # Drag-to-reorder bindings
        self._priority_listbox.bind("<Button-1>", self._prio_drag_start)
        self._priority_listbox.bind("<B1-Motion>", self._prio_drag_motion)
        self._priority_listbox.bind("<ButtonRelease-1>", self._prio_drag_end)

        # Move up/down buttons
        btn_row = tk.Frame(section2, bg=C.SURFACE0)
        btn_row.pack(anchor="w", pady=4)
        FlatBtn(btn_row, text="Move Up", command=self._prio_move_up,
               font=F.SMALL, padx=10, pady=3).pack(side="left", padx=(0, 4))
        FlatBtn(btn_row, text="Move Down", command=self._prio_move_down,
               font=F.SMALL, padx=10, pady=3).pack(side="left", padx=(0, 4))

        if not editing_defaults:
            FlatBtn(btn_row, text="Reset to Defaults", command=self._prio_reset,
                   font=F.SMALL, fg=C.PEACH, padx=10, pady=3).pack(side="left", padx=(12, 0))

        # ── Section: View Meta ─────────────────────────────────────────────
        sep2 = tk.Frame(self._editor_inner, bg=C.SURFACE1, height=1)
        sep2.pack(fill="x", padx=12, pady=8)

        section3 = tk.Frame(self._editor_inner, bg=C.SURFACE0)
        section3.pack(fill="x", padx=12, pady=(0, 12))

        tk.Label(section3, text="View Meta", font=F.BODY_BOLD,
                fg=C.SAPPHIRE, bg=C.SURFACE0).pack(anchor="w", pady=(0, 4))

        # Table header
        meta_hdr = tk.Frame(section3, bg=C.SURFACE1)
        meta_hdr.pack(fill="x", pady=(0, 2))
        for label_text, w in [("View", 18), ("Fit", 8), ("Label", 16), ("Short", 10)]:
            tk.Label(meta_hdr, text=label_text, font=F.SMALL, fg=C.SUBTEXT0,
                    bg=C.SURFACE1, width=w, anchor="w").pack(side="left", padx=2, pady=3)

        # viewMeta rows
        view_meta = resolved.get("viewMeta", {})
        self._meta_widgets = {}

        for view in priority:
            meta = view_meta.get(view, {"objectFit": "contain", "label": view, "labelShort": view[:4]})
            bg = C.SURFACE0
            row = tk.Frame(section3, bg=bg)
            row.pack(fill="x", pady=1)

            # View name
            tk.Label(row, text=view, font=F.MONO_SMALL, fg=C.TEXT, bg=bg,
                    width=18, anchor="w").pack(side="left", padx=2)

            # objectFit toggle
            fit_var = tk.StringVar(value=meta.get("objectFit", "contain"))
            fit_btn = tk.Label(row, textvariable=fit_var, font=F.MONO_SMALL,
                             fg=C.GREEN if fit_var.get() == "contain" else C.PEACH,
                             bg=C.SURFACE1, width=8, cursor="hand2", padx=4, pady=2)
            fit_btn.pack(side="left", padx=2)
            fit_btn.bind("<Button-1>", lambda e, v=fit_var, b=fit_btn, vw=view:
                        self._toggle_fit(v, b, vw))
            Tip(fit_btn, "Click to toggle contain/cover")

            # Label
            label_var = tk.StringVar(value=meta.get("label", ""))
            label_entry = tk.Entry(row, textvariable=label_var, font=F.MONO_SMALL,
                                  bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
                                  highlightthickness=0, width=16)
            label_entry.pack(side="left", padx=2)
            label_entry.bind("<FocusOut>",
                           lambda e, vw=view, v=label_var: self._set_meta_field(vw, "label", v.get()))
            label_entry.bind("<Return>",
                           lambda e, vw=view, v=label_var: self._set_meta_field(vw, "label", v.get()))

            # Short label
            short_var = tk.StringVar(value=meta.get("labelShort", ""))
            short_entry = tk.Entry(row, textvariable=short_var, font=F.MONO_SMALL,
                                  bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
                                  highlightthickness=0, width=10)
            short_entry.pack(side="left", padx=2)
            short_entry.bind("<FocusOut>",
                           lambda e, vw=view, v=short_var: self._set_meta_field(vw, "labelShort", v.get()))
            short_entry.bind("<Return>",
                           lambda e, vw=view, v=short_var: self._set_meta_field(vw, "labelShort", v.get()))

            self._meta_widgets[view] = {
                "fit_var": fit_var, "fit_btn": fit_btn,
                "label_var": label_var, "short_var": short_var,
            }

    # ── Field setters ──────────────────────────────────────────────────────
    def _get_target(self) -> dict:
        """Get the dict to write into (defaults or category overrides)."""
        if self._active_cat == "__defaults__":
            return self.config_data["defaults"]
        cats = self.config_data.setdefault("categories", {})
        return cats.setdefault(self._active_cat, {})

    def _set_field(self, key: str, value):
        target = self._get_target()
        target[key] = value
        self._update_changes()

    def _build_fallback_row(self, parent, label_text, current_val,
                            available_views, coverage_sorted_fn, coverage_pct_fn,
                            primary_count, field_key, tip):
        """Build a row with primary dropdown(s) + grayed-out auto fallbacks.

        primary_count=1: one dropdown, fallbacks beside it in a row
        primary_count=2: two dropdowns side-by-side, fallbacks in rows below
        """
        val = list(current_val) if isinstance(current_val, list) else [current_val]
        primaries = val[:primary_count]
        while len(primaries) < primary_count:
            primaries.append(available_views[0] if available_views else "top")

        container = tk.Frame(parent, bg=C.SURFACE0)
        container.pack(fill="x", pady=(2, 6))

        # Label row
        top_row = tk.Frame(container, bg=C.SURFACE0)
        top_row.pack(fill="x")

        lbl = tk.Label(top_row, text=label_text, font=F.MONO, fg=C.TEXT,
                       bg=C.SURFACE0, width=22, anchor="w")
        lbl.pack(side="left")
        Tip(lbl, tip)

        # Primary dropdown(s)
        combo_vars = []
        for i in range(primary_count):
            prim_var = tk.StringVar(value=primaries[i])
            combo = ttk.Combobox(top_row, textvariable=prim_var,
                                 values=available_views,
                                 state="readonly", width=14)
            combo.pack(side="left", padx=(0, 6))
            combo_vars.append(prim_var)
            combo.bind("<<ComboboxSelected>>",
                       lambda e, fk=field_key, cvs=combo_vars: self._on_fallback_primary_change(fk, cvs, coverage_sorted_fn))

        # Fallback display (grayed out, auto-populated)
        fallback_frame = tk.Frame(container, bg=C.SURFACE0)
        fallback_frame.pack(fill="x", padx=(0, 0), pady=(2, 0))

        # Store references so we can rebuild fallbacks on primary change
        self._fallback_state = getattr(self, '_fallback_state', {})
        self._fallback_state[field_key] = {
            "combo_vars": combo_vars,
            "fallback_frame": fallback_frame,
            "coverage_sorted_fn": coverage_sorted_fn,
            "coverage_pct_fn": coverage_pct_fn,
            "primary_count": primary_count,
        }

        # Initial render of fallbacks
        self._render_fallbacks(field_key)

    def _render_fallbacks(self, field_key):
        """Render grayed-out fallback labels for a field."""
        state = self._fallback_state[field_key]
        frame = state["fallback_frame"]
        combo_vars = state["combo_vars"]
        coverage_sorted_fn = state["coverage_sorted_fn"]
        coverage_pct_fn = state["coverage_pct_fn"]
        primary_count = state["primary_count"]

        # Clear existing
        for w in frame.winfo_children():
            w.destroy()

        # Get primary selections
        primaries = [v.get() for v in combo_vars]
        fallbacks = coverage_sorted_fn(exclude=primaries)

        if not fallbacks:
            return

        # Indent to align with dropdowns (past the 22-char label)
        row = tk.Frame(frame, bg=C.SURFACE0)
        row.pack(fill="x")

        spacer = tk.Label(row, text="", font=F.MONO, bg=C.SURFACE0, width=22)
        spacer.pack(side="left")

        tk.Label(row, text="Fallbacks:", font=F.TINY,
                fg=C.OVERLAY0, bg=C.SURFACE0).pack(side="left", padx=(0, 6))

        for i, view in enumerate(fallbacks):
            pct = coverage_pct_fn(view)
            tag = tk.Label(row, text=f"{view} ({pct}%)", font=F.MONO_SMALL,
                          fg=C.OVERLAY0, bg=C.SURFACE1, padx=6, pady=1)
            tag.pack(side="left", padx=(0, 4))
            Tip(tag, f"Fallback {i+1}: {view} — {pct}% coverage")

    def _on_fallback_primary_change(self, field_key, combo_vars, coverage_sorted_fn):
        """When a primary dropdown changes, update the stored array and re-render fallbacks."""
        primaries = [v.get() for v in combo_vars]
        fallbacks = coverage_sorted_fn(exclude=primaries)
        full_chain = primaries + fallbacks
        self._set_field(field_key, full_chain)
        self._render_fallbacks(field_key)

    def _toggle_fit(self, var: tk.StringVar, btn: tk.Label, view: str):
        current = var.get()
        new_val = "cover" if current == "contain" else "contain"
        var.set(new_val)
        btn.configure(fg=C.GREEN if new_val == "contain" else C.PEACH)
        self._set_meta_field(view, "objectFit", new_val)

    def _set_meta_field(self, view: str, field: str, value: str):
        target = self._get_target()
        vm = target.setdefault("viewMeta", {})
        entry = vm.setdefault(view, {})
        entry[field] = value
        self._update_changes()

    # ── Priority reorder ───────────────────────────────────────────────────
    def _get_current_priority(self) -> list[str]:
        """Extract view names from listbox."""
        items = self._priority_listbox.get(0, "end")
        return [item.strip().split(". ", 1)[-1] for item in items]

    def _save_priority(self, priority: list[str]):
        target = self._get_target()
        target["viewPriority"] = priority
        self._update_changes()

    def _prio_drag_start(self, e):
        self._drag_idx = self._priority_listbox.nearest(e.y)

    def _prio_drag_motion(self, e):
        if self._drag_idx is None:
            return
        target_idx = self._priority_listbox.nearest(e.y)
        if target_idx != self._drag_idx:
            # Swap items
            item = self._priority_listbox.get(self._drag_idx)
            self._priority_listbox.delete(self._drag_idx)
            self._priority_listbox.insert(target_idx, item)
            self._priority_listbox.selection_set(target_idx)
            self._drag_idx = target_idx

    def _prio_drag_end(self, e):
        if self._drag_idx is not None:
            priority = self._get_current_priority()
            # Renumber
            self._priority_listbox.delete(0, "end")
            for i, view in enumerate(priority):
                self._priority_listbox.insert("end", f"  {i+1}. {view}")
            self._save_priority(priority)
        self._drag_idx = None

    def _prio_move_up(self):
        sel = self._priority_listbox.curselection()
        if not sel or sel[0] == 0:
            return
        idx = sel[0]
        priority = self._get_current_priority()
        priority[idx - 1], priority[idx] = priority[idx], priority[idx - 1]
        self._priority_listbox.delete(0, "end")
        for i, view in enumerate(priority):
            self._priority_listbox.insert("end", f"  {i+1}. {view}")
        self._priority_listbox.selection_set(idx - 1)
        self._save_priority(priority)

    def _prio_move_down(self):
        sel = self._priority_listbox.curselection()
        if not sel:
            return
        idx = sel[0]
        priority = self._get_current_priority()
        if idx >= len(priority) - 1:
            return
        priority[idx], priority[idx + 1] = priority[idx + 1], priority[idx]
        self._priority_listbox.delete(0, "end")
        for i, view in enumerate(priority):
            self._priority_listbox.insert("end", f"  {i+1}. {view}")
        self._priority_listbox.selection_set(idx + 1)
        self._save_priority(priority)

    def _prio_reset(self):
        """Reset category priority to global defaults."""
        target = self._get_target()
        if "viewPriority" in target:
            del target["viewPriority"]
        self._refresh_all()

    # ── Change tracking ────────────────────────────────────────────────────
    def _has_changes(self) -> bool:
        current = json.dumps(self.config_data, sort_keys=True)
        return current != self._original

    def _update_changes(self):
        if self._has_changes():
            self._changes_lbl.configure(text="● unsaved changes")
            self._status_lbl.configure(text="Modified — press Ctrl+S to save")
        else:
            self._changes_lbl.configure(text="")
            self._status_lbl.configure(text="Ready")

    # ── Save ───────────────────────────────────────────────────────────────
    def _save(self):
        try:
            save_image_defaults(self.config_data)
            self._original = json.dumps(self.config_data, sort_keys=True)
            self._update_changes()
            self.toast.show("Saved image-defaults.json", C.GREEN)
            self._status_lbl.configure(text="Saved successfully")
        except Exception as ex:
            self.toast.show(f"Save failed: {ex}", C.RED)
            self._status_lbl.configure(text=f"Error: {ex}")

    # ── Close ──────────────────────────────────────────────────────────────
    def _on_close(self):
        if self._has_changes():
            resp = messagebox.askyesnocancel(
                "Unsaved Changes",
                "You have unsaved changes. Save before closing?")
            if resp is None:
                return  # Cancel
            if resp:
                self._save()
        self.destroy()


# -- Entry Point -------------------------------------------------------------
if __name__ == "__main__":
    app = ImageManager()
    app.mainloop()
