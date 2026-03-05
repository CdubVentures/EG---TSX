#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
hub-tools-manager.py -- GUI for managing hub sidebar tools per category.

Each product category (mouse, keyboard, monitor) has multiple tool links
(Hub, Database, Shapes, Versus, Radars) displayed in the home page sidebar
and hub pages. This tool lets you configure: label, url, description,
subtitle, and SVG icon for each tool entry.

Reads/writes config/hub-tools.json.
Reads config/categories.json for category list and colors.

Matches the Catppuccin Mocha theme used by category-manager.py and navbar-manager.py.
"""

import ctypes
import json
import sys
import tkinter as tk
from tkinter import messagebox, filedialog
from pathlib import Path
from datetime import datetime
from textwrap import shorten

# Windows DPI awareness — must be called before any Tk window creation
if sys.platform == "win32":
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        pass

# -- Paths -------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
CATEGORIES_JSON = ROOT / "config" / "categories.json"
HUB_TOOLS_JSON = ROOT / "config" / "hub-tools.json"


# -- Design System (shared with category-manager / navbar-manager) -----------
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
        widget.bind("<Enter>", self._show)
        widget.bind("<Leave>", self._hide)

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


# -- Data I/O ---------------------------------------------------------------
# WHY: Tool types used across HBS. 5 tools × N categories.
TOOL_TYPES = ["hub", "database", "versus", "radar", "shapes"]

TOOL_TYPE_LABELS = {
    "hub": "Hub",
    "database": "Database",
    "versus": "Versus",
    "radar": "Radars",
    "shapes": "Shapes",
}

# WHY: Default tooltip descriptions (shared across all tools in HBS)
DEFAULT_TOOLTIPS = {
    "database": "Structured lists you can filter and sort to find the best fit.",
    "hub": "The main landing pages for each category\u2014start here to explore everything in one place.",
    "radar": "Visual scorecards that summarize strengths and weaknesses at a glance.",
    "shapes": "A visual catalogue of shapes/profiles to help understand fit and ergonomics.",
    "versus": "Side\u2011by\u2011side comparisons to quickly see what\u2019s different and what wins.",
}

# WHY: Default URL patterns per tool type
DEFAULT_URLS = {
    "hub": "/hubs/{cat}",
    "database": "/hubs/{cat}?view=list",
    "versus": "/hubs/{cat}?compare=stats",
    "radar": "/hubs/{cat}?compare=radar",
    "shapes": "/hubs/{cat}?compare=shapes",
}

# WHY: Default descriptions per tool per category from HBS
DEFAULT_DESCRIPTIONS = {
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
        "shapes": None,  # keyboard has no shapes tool
    },
    "monitor": {
        "hub": "Explore and compare 100s of gaming monitors",
        "database": "Full database of monitors",
        "versus": "Compare up to 8 gaming Monitors side-by-side",
        "radar": "Discover the best Monitor for your needs",
        "shapes": None,  # monitor has no shapes tool
    },
}

# WHY: Default subtitles from HBS
DEFAULT_SUBTITLES = {
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


def load_categories() -> list[dict]:
    """Load categories from categories.json."""
    if CATEGORIES_JSON.is_file():
        data = json.loads(CATEGORIES_JSON.read_text(encoding="utf-8"))
        return data.get("categories", [])
    return []


def get_product_categories() -> list[dict]:
    """Get only categories that have products (product.vite or product.production is true)."""
    cats = load_categories()
    result = []
    for cat in cats:
        prod = cat.get("product", {})
        if prod.get("vite", False) or prod.get("production", False):
            result.append(cat)
    return result


def load_hub_tools() -> dict:
    """Load hub tools config. Returns {category_id: [tool_entries...]}."""
    if HUB_TOOLS_JSON.is_file():
        return json.loads(HUB_TOOLS_JSON.read_text(encoding="utf-8"))
    return {}


def save_hub_tools(data: dict):
    """Save hub tools config to JSON."""
    HUB_TOOLS_JSON.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8"
    )


def make_default_tool(category_id: str, tool_type: str) -> dict:
    """Create a default tool entry for a category + tool type."""
    desc = (DEFAULT_DESCRIPTIONS.get(category_id, {}).get(tool_type)
            or f"Explore {category_id} {tool_type}")
    subtitle = (DEFAULT_SUBTITLES.get(category_id, {}).get(tool_type)
                or f"{category_id.capitalize()} {TOOL_TYPE_LABELS.get(tool_type, tool_type)}")
    return {
        "tool": tool_type,
        "title": TOOL_TYPE_LABELS.get(tool_type, tool_type.capitalize()),
        "description": desc,
        "subtitle": subtitle,
        "url": DEFAULT_URLS.get(tool_type, f"/hubs/{category_id}").replace("{cat}", category_id),
        "svg": "",
        "enabled": True,
    }


def ensure_defaults(data: dict, categories: list[dict]) -> dict:
    """Ensure every product category has entries for all tool types."""
    for cat in categories:
        cat_id = cat["id"]
        if cat_id not in data:
            data[cat_id] = []
        existing_tools = {t["tool"] for t in data[cat_id]}
        for tool_type in TOOL_TYPES:
            if tool_type not in existing_tools:
                entry = make_default_tool(cat_id, tool_type)
                # Shapes only enabled for mouse by default
                if tool_type == "shapes" and cat_id != "mouse":
                    entry["enabled"] = False
                data[cat_id].append(entry)
        # Sort tools by TOOL_TYPES order
        order = {t: i for i, t in enumerate(TOOL_TYPES)}
        data[cat_id].sort(key=lambda t: order.get(t["tool"], 99))
    return data


# -- SVG Preview Drawing -----------------------------------------------------
# WHY: tkinter can't render SVGs natively. We draw simplified tool-type icons.

def _draw_hub(c, clr):
    """Hub = connected nodes (graph)."""
    c.create_oval(13, 3, 19, 9, outline=clr, width=1.5)
    c.create_oval(3, 13, 9, 19, outline=clr, width=1.5)
    c.create_oval(16, 16, 22, 22, outline=clr, width=1.5)
    c.create_line(8, 8, 14, 6, fill=clr, width=1)
    c.create_line(8, 14, 14, 6, fill=clr, width=1)
    c.create_line(8, 14, 17, 17, fill=clr, width=1)

def _draw_database(c, clr):
    """Database = stacked cylinders."""
    c.create_oval(4, 2, 20, 8, outline=clr, width=1.5)
    c.create_line(4, 5, 4, 19, fill=clr, width=1.5)
    c.create_line(20, 5, 20, 19, fill=clr, width=1.5)
    c.create_arc(4, 16, 20, 22, start=180, extent=180, style="arc", outline=clr, width=1.5)
    c.create_arc(4, 10, 20, 16, start=180, extent=180, style="arc", outline=clr, width=1.5)

def _draw_versus(c, clr):
    """Versus = checklist / comparison."""
    c.create_rectangle(2, 2, 22, 22, outline=clr, width=1.5)
    c.create_line(12, 2, 12, 22, fill=clr, width=1)
    c.create_line(5, 7, 7, 9, fill=clr, width=1.5)
    c.create_line(7, 9, 10, 6, fill=clr, width=1.5)
    c.create_line(5, 14, 7, 16, fill=clr, width=1.5)
    c.create_line(7, 16, 10, 13, fill=clr, width=1.5)
    c.create_line(14, 7, 20, 7, fill=clr, width=1.5)
    c.create_line(14, 9, 20, 9, fill=clr, width=1.5)
    c.create_line(14, 14, 20, 14, fill=clr, width=1.5)
    c.create_line(14, 16, 20, 16, fill=clr, width=1.5)

def _draw_radar(c, clr):
    """Radar = pentagon / scorecard."""
    import math
    cx, cy, r = 12, 13, 9
    pts = []
    for i in range(5):
        angle = math.radians(-90 + i * 72)
        pts.extend([cx + r * math.cos(angle), cy + r * math.sin(angle)])
    c.create_polygon(*pts, outline=clr, fill="", width=1.5)
    inner_pts = []
    for i in range(5):
        angle = math.radians(-90 + i * 72)
        ir = r * 0.45
        inner_pts.extend([cx + ir * math.cos(angle), cy + ir * math.sin(angle)])
    c.create_polygon(*inner_pts, outline=clr, fill="", width=1, dash=(2, 2))

def _draw_shapes(c, clr):
    """Shapes = mouse silhouette outline."""
    c.create_oval(5, 2, 19, 22, outline=clr, width=1.5)
    c.create_line(12, 2, 12, 10, fill=clr, width=1)
    c.create_oval(10, 5, 14, 8, outline=clr, width=1)

TOOL_ICON_DRAWERS = {
    "hub": _draw_hub,
    "database": _draw_database,
    "versus": _draw_versus,
    "radar": _draw_radar,
    "shapes": _draw_shapes,
}


def draw_tool_icon(canvas: tk.Canvas, tool_type: str, color: str):
    """Draw a simplified tool-type icon on a 24x24 canvas."""
    canvas.delete("all")
    drawer = TOOL_ICON_DRAWERS.get(tool_type)
    if drawer:
        drawer(canvas, color)
    else:
        canvas.create_text(12, 12, text="?", fill=color, font=("Segoe UI", 9, "bold"))


# -- SVG Editor Dialog -------------------------------------------------------
class SvgEditor(tk.Toplevel):
    """Dialog for editing a tool's SVG markup."""

    def __init__(self, parent, initial_svg: str = "", title_text: str = "Edit SVG"):
        super().__init__(parent)
        self.title(title_text)
        self.configure(bg=C.SURFACE0)
        self.resizable(True, True)
        self.transient(parent)
        self.grab_set()
        parent.update_idletasks()
        w, h = 640, 480
        x = parent.winfo_x() + (parent.winfo_width() - w) // 2
        y = parent.winfo_y() + (parent.winfo_height() - h) // 2
        self.geometry(f"{w}x{h}+{x}+{y}")
        self.minsize(400, 300)
        dark_title_bar(self)

        self.result = None

        # Header
        hdr = tk.Frame(self, bg=C.SURFACE0)
        hdr.pack(fill="x", padx=16, pady=(12, 8))
        tk.Label(hdr, text="Paste SVG markup below:", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY).pack(side="left")

        # Load from file button
        FlatBtn(hdr, text="Load .svg file", command=self._load_file,
                bg=C.SURFACE1, hover_bg=C.SURFACE2, font=F.SMALL).pack(side="right")

        # Text area
        text_frame = tk.Frame(self, bg=C.SURFACE0)
        text_frame.pack(fill="both", expand=True, padx=16, pady=(0, 8))

        self._text = tk.Text(text_frame, bg=C.SURFACE1, fg=C.TEXT,
                             insertbackground=C.TEXT, font=("Consolas", 9),
                             relief="flat", bd=0, wrap="word",
                             highlightthickness=1, highlightcolor=C.BLUE,
                             highlightbackground=C.SURFACE2)
        scroll = tk.Scrollbar(text_frame, orient="vertical", command=self._text.yview,
                              bg=C.SURFACE1, troughcolor=C.BASE,
                              highlightthickness=0, bd=0)
        self._text.configure(yscrollcommand=scroll.set)
        scroll.pack(side="right", fill="y")
        self._text.pack(side="left", fill="both", expand=True)

        if initial_svg:
            self._text.insert("1.0", initial_svg)

        # Info row
        info = tk.Frame(self, bg=C.SURFACE0)
        info.pack(fill="x", padx=16, pady=(0, 4))
        tk.Label(info, text="SVG must use fill='currentColor' for theme compatibility",
                 bg=C.SURFACE0, fg=C.OVERLAY0, font=F.TINY).pack(side="left")

        # Char count
        self._char_lbl = tk.Label(info, text="0 chars", bg=C.SURFACE0,
                                  fg=C.OVERLAY0, font=F.TINY)
        self._char_lbl.pack(side="right")
        self._text.bind("<<Modified>>", self._on_modified)
        self._text.bind("<KeyRelease>", lambda e: self._update_count())

        # Buttons
        btn_row = tk.Frame(self, bg=C.SURFACE0)
        btn_row.pack(fill="x", padx=16, pady=(0, 16))
        FlatBtn(btn_row, text="Cancel", command=self._cancel,
                bg=C.SURFACE1, hover_bg=C.SURFACE2).pack(side="right", padx=(8, 0))
        FlatBtn(btn_row, text="  OK  ", command=self._ok,
                bg=C.BLUE, fg=C.CRUST, hover_bg=C.SAPPHIRE,
                font=F.BODY_BOLD).pack(side="right")
        FlatBtn(btn_row, text="Clear", command=self._clear,
                bg=C.SURFACE1, hover_bg=C.SURFACE2, fg=C.RED).pack(side="left")

        self.bind("<Escape>", lambda e: self._cancel())
        self._update_count()

    def _load_file(self):
        path = filedialog.askopenfilename(
            parent=self,
            title="Select SVG file",
            filetypes=[("SVG files", "*.svg"), ("All files", "*.*")],
            initialdir=str(ROOT / "public" / "images"),
        )
        if path:
            try:
                content = Path(path).read_text(encoding="utf-8")
                self._text.delete("1.0", "end")
                self._text.insert("1.0", content.strip())
                self._update_count()
            except Exception as ex:
                messagebox.showerror("Error", f"Could not read file:\n{ex}", parent=self)

    def _update_count(self):
        content = self._text.get("1.0", "end-1c")
        self._char_lbl.configure(text=f"{len(content)} chars")

    def _on_modified(self, e):
        self._text.edit_modified(False)
        self._update_count()

    def _clear(self):
        self._text.delete("1.0", "end")
        self._update_count()

    def _ok(self):
        self.result = self._text.get("1.0", "end-1c").strip()
        self.destroy()

    def _cancel(self):
        self.result = None
        self.destroy()


# -- Main Application -------------------------------------------------------
class HubToolsManager(tk.Tk):

    def __init__(self):
        super().__init__()
        self.title("EG Hub Tools Manager")
        sw, sh = self.winfo_screenwidth(), self.winfo_screenheight()
        win_w, win_h = 1100, 800
        self.geometry(f"{win_w}x{win_h}+{(sw-win_w)//2}+{(sh-win_h)//2}")
        self.configure(bg=C.MANTLE)
        self.minsize(900, 600)

        dark_title_bar(self)
        try:
            ico = tk.PhotoImage(width=1, height=1)
            ico.put(C.TEAL)
            self._icon = ico.zoom(32, 32)
            self.iconphoto(True, self._icon)
        except Exception:
            pass

        self.product_cats = get_product_categories()
        self.data = ensure_defaults(load_hub_tools(), self.product_cats)
        self._original = json.dumps(self.data, sort_keys=True)
        self._selected_cat = self.product_cats[0]["id"] if self.product_cats else ""
        self._card_widgets: list[dict] = []

        self._build_header()
        self._build_body()
        self._build_status_bar()
        self.toast = Toast(self)
        self.bind_all("<Control-s>", lambda e: self._save())
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    # -- Header --------------------------------------------------------------
    def _build_header(self):
        hdr = tk.Frame(self, bg=C.CRUST, height=58)
        hdr.pack(fill="x")
        hdr.pack_propagate(False)
        tk.Frame(hdr, bg=C.TEAL, height=2).pack(fill="x", side="bottom")
        inner = tk.Frame(hdr, bg=C.CRUST)
        inner.pack(fill="both", expand=True, padx=24)
        tk.Label(inner, text="EG", bg=C.CRUST, fg=C.TEAL,
                 font=("Segoe UI", 20, "bold")).pack(side="left")
        tk.Label(inner, text="  Hub Tools Manager", bg=C.CRUST, fg=C.TEXT,
                 font=("Segoe UI", 14)).pack(side="left")
        tk.Label(inner, text=f"  \u00b7  {ROOT.name}", bg=C.CRUST, fg=C.OVERLAY0,
                 font=F.SMALL).pack(side="left", padx=(4, 0))
        self.save_btn = FlatBtn(inner, text="  Save  ", command=self._save,
                                bg=C.TEAL, fg=C.CRUST, hover_bg=C.SAPPHIRE,
                                font=F.BODY_BOLD)
        self.save_btn.pack(side="right", pady=10)
        self.changes_lbl = tk.Label(inner, text="", bg=C.CRUST, fg=C.PEACH, font=F.SMALL)
        self.changes_lbl.pack(side="right", padx=12)

    # -- Body (sidebar + tool cards) -----------------------------------------
    def _build_body(self):
        body = tk.Frame(self, bg=C.MANTLE)
        body.pack(fill="both", expand=True)

        # Left sidebar: category tabs
        self._sidebar = sidebar = tk.Frame(body, bg=C.BASE, width=200)
        sidebar.pack(side="left", fill="y", padx=(16, 0), pady=(12, 0))
        sidebar.pack_propagate(False)

        tk.Label(sidebar, text="CATEGORIES", bg=C.BASE, fg=C.OVERLAY0,
                 font=F.TINY).pack(fill="x", padx=12, pady=(12, 8))

        self._cat_btns: dict[str, tk.Label] = {}
        for cat in self.product_cats:
            cat_id = cat["id"]
            color = cat.get("color", C.BLUE)
            btn_frame = tk.Frame(sidebar, bg=C.BASE)
            btn_frame.pack(fill="x", padx=4, pady=1)

            accent = tk.Frame(btn_frame, bg=color, width=3)
            accent.pack(side="left", fill="y")

            lbl = tk.Label(btn_frame, text=f"  {cat_id.upper()}",
                           bg=C.BASE, fg=C.TEXT, font=F.BODY_BOLD,
                           anchor="w", padx=8, pady=8, cursor="hand2")
            lbl.pack(side="left", fill="both", expand=True)
            lbl.bind("<Button-1>", lambda e, cid=cat_id: self._select_category(cid))
            self._cat_btns[cat_id] = lbl

            # Tool count badge
            tool_count = len([t for t in self.data.get(cat_id, []) if t.get("enabled", True)])
            badge = tk.Label(btn_frame, text=str(tool_count),
                             bg=C.SURFACE1, fg=C.OVERLAY0, font=F.TINY,
                             padx=6, pady=2)
            badge.pack(side="right", padx=(0, 8))
            badge.bind("<Button-1>", lambda e, cid=cat_id: self._select_category(cid))

        # Tooltips config section
        tk.Frame(sidebar, bg=C.SURFACE2, height=1).pack(fill="x", padx=12, pady=(16, 8))
        tk.Label(sidebar, text="SHARED TOOLTIPS", bg=C.BASE, fg=C.OVERLAY0,
                 font=F.TINY).pack(fill="x", padx=12, pady=(0, 4))

        tooltip_btn = FlatBtn(sidebar, text="Edit Tooltips", command=self._edit_tooltips,
                              bg=C.SURFACE1, hover_bg=C.SURFACE2, font=F.SMALL)
        tooltip_btn.pack(fill="x", padx=12, pady=2)
        Tip(tooltip_btn, "Edit the shared tooltip descriptions\nused across all tool types.")

        # Right content: scrollable tool cards
        self._content_frame = tk.Frame(body, bg=C.MANTLE)
        self._content_frame.pack(side="left", fill="both", expand=True, padx=(12, 0))

        self._build_tool_cards_area()
        self._select_category(self._selected_cat)

    def _build_tool_cards_area(self):
        """Build the scrollable area for tool cards."""
        container = self._content_frame

        self._cards_canvas = tk.Canvas(container, bg=C.MANTLE, highlightthickness=0)
        scrollbar = tk.Scrollbar(container, orient="vertical",
                                 command=self._cards_canvas.yview,
                                 bg=C.SURFACE1, troughcolor=C.BASE,
                                 highlightthickness=0, bd=0)
        self._cards_inner = tk.Frame(self._cards_canvas, bg=C.MANTLE)
        self._cards_inner.bind(
            "<Configure>",
            lambda e: self._cards_canvas.configure(scrollregion=self._cards_canvas.bbox("all"))
        )
        self._canvas_win = self._cards_canvas.create_window(
            (0, 0), window=self._cards_inner, anchor="nw"
        )
        self._cards_canvas.configure(yscrollcommand=scrollbar.set)

        def _on_canvas_resize(e):
            self._cards_canvas.itemconfigure(self._canvas_win, width=e.width)
        self._cards_canvas.bind("<Configure>", _on_canvas_resize)

        self._cards_canvas.pack(side="left", fill="both", expand=True, pady=(12, 0))
        scrollbar.pack(side="right", fill="y", padx=(0, 4), pady=(12, 0))

        def _on_mousewheel(e):
            self._cards_canvas.yview_scroll(int(-1 * (e.delta / 120)), "units")
        self._cards_canvas.bind_all("<MouseWheel>", _on_mousewheel)

    def _select_category(self, cat_id: str):
        """Switch the active category tab and rebuild tool cards."""
        self._selected_cat = cat_id

        # Update tab highlights
        for cid, lbl in self._cat_btns.items():
            if cid == cat_id:
                lbl.configure(bg=C.SURFACE0, fg=C.TEXT)
            else:
                lbl.configure(bg=C.BASE, fg=C.SUBTEXT0)

        self._rebuild_tool_cards()

    def _get_cat_color(self) -> str:
        """Get the color for the currently selected category."""
        for cat in self.product_cats:
            if cat["id"] == self._selected_cat:
                return cat.get("color", C.BLUE)
        return C.BLUE

    def _rebuild_tool_cards(self):
        """Rebuild all tool cards for the selected category."""
        for w in self._cards_inner.winfo_children():
            w.destroy()
        self._card_widgets = []

        cat_id = self._selected_cat
        tools = self.data.get(cat_id, [])
        color = self._get_cat_color()

        # Category header
        header = tk.Frame(self._cards_inner, bg=C.MANTLE)
        header.pack(fill="x", pady=(0, 8))
        tk.Label(header, text=f"{cat_id.upper()} TOOLS",
                 bg=C.MANTLE, fg=color, font=F.HEADING).pack(side="left")
        tk.Label(header, text=f"  {len([t for t in tools if t.get('enabled', True)])} enabled",
                 bg=C.MANTLE, fg=C.OVERLAY0, font=F.SMALL).pack(side="left", pady=(2, 0))

        # Add tool button
        FlatBtn(header, text="+ Add Tool", command=self._add_tool,
                bg=C.SURFACE1, hover_bg=C.SURFACE2, font=F.SMALL).pack(side="right")

        for i, tool in enumerate(tools):
            self._build_tool_card(i, tool, color)

    def _build_tool_card(self, idx: int, tool: dict, cat_color: str):
        """Build a single tool card."""
        enabled = tool.get("enabled", True)
        tool_type = tool.get("tool", "unknown")

        card = tk.Frame(self._cards_inner, bg=C.SURFACE0,
                        highlightthickness=1, highlightbackground=C.CARD_BORDER)
        card.pack(fill="x", pady=4, padx=(0, 8))

        # Left accent bar (uses category color if enabled, dim if disabled)
        accent_color = cat_color if enabled else C.SURFACE2
        accent = tk.Frame(card, bg=accent_color, width=4)
        accent.pack(side="left", fill="y")

        inner = tk.Frame(card, bg=C.SURFACE0)
        inner.pack(side="left", fill="both", expand=True, padx=12, pady=10)

        # Row 1: Icon + Title + Tool type badge + Enabled toggle + Actions
        row1 = tk.Frame(inner, bg=C.SURFACE0)
        row1.pack(fill="x")

        # Tool type icon (24x24)
        icon_canvas = tk.Canvas(row1, width=24, height=24,
                                highlightthickness=0, bg=C.SURFACE0)
        icon_canvas.pack(side="left", padx=(0, 8))
        draw_tool_icon(icon_canvas, tool_type, cat_color if enabled else C.OVERLAY0)

        # Title (editable)
        title_var = tk.StringVar(value=tool.get("title", ""))
        title_entry = tk.Entry(row1, textvariable=title_var, bg=C.SURFACE1, fg=C.TEXT,
                               insertbackground=C.TEXT, font=F.HEADING, relief="flat", bd=0,
                               highlightthickness=1, highlightcolor=C.BLUE,
                               highlightbackground=C.SURFACE2, width=15)
        title_entry.pack(side="left", padx=(0, 8))

        # Tool type badge
        badge = tk.Label(row1, text=tool_type.upper(), bg=C.SURFACE1, fg=C.OVERLAY0,
                         font=F.TINY, padx=6, pady=2)
        badge.pack(side="left", padx=(0, 8))

        # SVG status indicator
        has_svg = bool(tool.get("svg", "").strip())
        svg_status_text = "SVG" if has_svg else "NO SVG"
        svg_status_color = C.GREEN if has_svg else C.RED
        svg_status = tk.Label(row1, text=svg_status_text, bg=C.SURFACE0,
                              fg=svg_status_color, font=F.TINY)
        svg_status.pack(side="left", padx=(0, 8))

        # Right side actions
        actions = tk.Frame(row1, bg=C.SURFACE0)
        actions.pack(side="right")

        # Delete button
        del_btn = FlatBtn(actions, text="\u00d7", command=lambda i=idx: self._delete_tool(i),
                          bg=C.SURFACE0, hover_bg=C.SURFACE1, fg=C.RED,
                          font=("Segoe UI", 14), padx=4, pady=0)
        del_btn.pack(side="right", padx=(4, 0))
        Tip(del_btn, "Delete this tool entry")

        # Move down
        if idx < len(self.data.get(self._selected_cat, [])) - 1:
            down_btn = FlatBtn(actions, text="\u25bc", command=lambda i=idx: self._move_tool(i, 1),
                               bg=C.SURFACE0, hover_bg=C.SURFACE1, fg=C.OVERLAY0,
                               font=F.SMALL, padx=4, pady=2)
            down_btn.pack(side="right")

        # Move up
        if idx > 0:
            up_btn = FlatBtn(actions, text="\u25b2", command=lambda i=idx: self._move_tool(i, -1),
                             bg=C.SURFACE0, hover_bg=C.SURFACE1, fg=C.OVERLAY0,
                             font=F.SMALL, padx=4, pady=2)
            up_btn.pack(side="right")

        # Enabled toggle
        enable_frame = tk.Frame(actions, bg=C.SURFACE0)
        enable_frame.pack(side="right", padx=(0, 12))
        tk.Label(enable_frame, text="Enabled", bg=C.SURFACE0, fg=C.SUBTEXT0,
                 font=F.TINY).pack(side="left", padx=(0, 4))
        enable_canvas = tk.Canvas(enable_frame, width=38, height=20,
                                  highlightthickness=0, bd=0, bg=C.SURFACE0)
        enable_canvas.pack(side="left")
        self._draw_toggle(enable_canvas, enabled)
        enable_canvas.bind("<Button-1>",
                           lambda e, i=idx, ec=enable_canvas: self._toggle_enabled(i, ec))
        enable_canvas.configure(cursor="hand2")

        # Row 2: URL
        row2 = tk.Frame(inner, bg=C.SURFACE0)
        row2.pack(fill="x", pady=(6, 0))
        tk.Label(row2, text="URL:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL, width=10, anchor="w").pack(side="left")
        url_var = tk.StringVar(value=tool.get("url", ""))
        url_entry = tk.Entry(row2, textvariable=url_var, bg=C.SURFACE1, fg=C.TEXT,
                             insertbackground=C.TEXT, font=F.BODY, relief="flat", bd=0,
                             highlightthickness=1, highlightcolor=C.BLUE,
                             highlightbackground=C.SURFACE2)
        url_entry.pack(side="left", fill="x", expand=True, padx=(4, 0))

        # Row 3: Description
        row3 = tk.Frame(inner, bg=C.SURFACE0)
        row3.pack(fill="x", pady=(4, 0))
        tk.Label(row3, text="Description:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL, width=10, anchor="w").pack(side="left")
        desc_var = tk.StringVar(value=tool.get("description", ""))
        desc_entry = tk.Entry(row3, textvariable=desc_var, bg=C.SURFACE1, fg=C.TEXT,
                              insertbackground=C.TEXT, font=F.BODY, relief="flat", bd=0,
                              highlightthickness=1, highlightcolor=C.BLUE,
                              highlightbackground=C.SURFACE2)
        desc_entry.pack(side="left", fill="x", expand=True, padx=(4, 0))

        # Row 4: Subtitle
        row4 = tk.Frame(inner, bg=C.SURFACE0)
        row4.pack(fill="x", pady=(4, 0))
        tk.Label(row4, text="Subtitle:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL, width=10, anchor="w").pack(side="left")
        subtitle_var = tk.StringVar(value=tool.get("subtitle", ""))
        subtitle_entry = tk.Entry(row4, textvariable=subtitle_var, bg=C.SURFACE1, fg=C.TEXT,
                                  insertbackground=C.TEXT, font=F.BODY, relief="flat", bd=0,
                                  highlightthickness=1, highlightcolor=C.BLUE,
                                  highlightbackground=C.SURFACE2)
        subtitle_entry.pack(side="left", fill="x", expand=True, padx=(4, 0))

        # Row 5: SVG actions
        row5 = tk.Frame(inner, bg=C.SURFACE0)
        row5.pack(fill="x", pady=(6, 0))
        tk.Label(row5, text="SVG Icon:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL, width=10, anchor="w").pack(side="left")

        edit_svg_btn = FlatBtn(row5, text="Edit SVG",
                               command=lambda i=idx: self._edit_svg(i),
                               bg=C.SURFACE1, hover_bg=C.SURFACE2, font=F.SMALL)
        edit_svg_btn.pack(side="left", padx=(4, 8))

        svg_preview_text = ""
        svg_raw = tool.get("svg", "")
        if svg_raw:
            svg_preview_text = shorten(svg_raw, width=60, placeholder="...")
        else:
            svg_preview_text = "(no SVG set)"

        svg_preview = tk.Label(row5, text=svg_preview_text, bg=C.SURFACE0,
                               fg=C.OVERLAY0 if svg_raw else C.RED,
                               font=F.TINY, anchor="w")
        svg_preview.pack(side="left", fill="x", expand=True)

        # Bind entry changes to data model
        def _on_change(*args, field=None, var=None, i=idx):
            self.data[self._selected_cat][i][field] = var.get()
            self._update_badge()

        title_var.trace_add("write", lambda *a: _on_change(field="title", var=title_var, i=idx))
        url_var.trace_add("write", lambda *a: _on_change(field="url", var=url_var, i=idx))
        desc_var.trace_add("write", lambda *a: _on_change(field="description", var=desc_var, i=idx))
        subtitle_var.trace_add("write", lambda *a: _on_change(field="subtitle", var=subtitle_var, i=idx))

        self._card_widgets.append({
            "card": card, "title_var": title_var, "url_var": url_var,
            "desc_var": desc_var, "subtitle_var": subtitle_var,
            "icon_canvas": icon_canvas, "accent": accent,
            "svg_status": svg_status, "svg_preview": svg_preview,
            "enable_canvas": enable_canvas,
        })

    def _draw_toggle(self, canvas: tk.Canvas, is_on: bool):
        """Draw an iOS-style toggle on a 38x20 canvas."""
        canvas.delete("all")
        w, h = 38, 20
        r = h // 2
        tc = C.GREEN if is_on else C.SURFACE2
        canvas.create_arc(0, 0, h, h, start=90, extent=180, fill=tc, outline=tc)
        canvas.create_arc(w - h, 0, w, h, start=-90, extent=180, fill=tc, outline=tc)
        canvas.create_rectangle(r, 0, w - r, h, fill=tc, outline=tc)
        pad, tr = 3, r - 3
        cx = w - r if is_on else r
        canvas.create_oval(cx - tr, r - tr, cx + tr, r + tr,
                           fill="#ffffff" if is_on else C.OVERLAY0, outline="")

    def _toggle_enabled(self, idx: int, canvas: tk.Canvas):
        """Toggle a tool's enabled state."""
        tool = self.data[self._selected_cat][idx]
        new_val = not tool.get("enabled", True)
        tool["enabled"] = new_val
        self._draw_toggle(canvas, new_val)
        self._update_badge()
        # Rebuild to update accent color + icon
        self._rebuild_tool_cards()
        self._update_sidebar_badges()

    def _edit_svg(self, idx: int):
        """Open SVG editor dialog for a tool."""
        tool = self.data[self._selected_cat][idx]
        title = tool.get("title", "Tool")
        editor = SvgEditor(self, initial_svg=tool.get("svg", ""),
                           title_text=f"SVG for {self._selected_cat}/{title}")
        self.wait_window(editor)
        if editor.result is not None:
            tool["svg"] = editor.result
            self._update_badge()
            self._rebuild_tool_cards()

    def _delete_tool(self, idx: int):
        """Delete a tool entry after confirmation."""
        tool = self.data[self._selected_cat][idx]
        title = tool.get("title", "Tool")
        if messagebox.askyesno(
                "Delete Tool",
                f"Delete '{title}' from {self._selected_cat}?",
                parent=self):
            self.data[self._selected_cat].pop(idx)
            self._update_badge()
            self._rebuild_tool_cards()
            self._update_sidebar_badges()

    def _move_tool(self, idx: int, direction: int):
        """Move a tool up or down in the list."""
        tools = self.data[self._selected_cat]
        new_idx = idx + direction
        if 0 <= new_idx < len(tools):
            tools[idx], tools[new_idx] = tools[new_idx], tools[idx]
            self._update_badge()
            self._rebuild_tool_cards()

    def _add_tool(self):
        """Add a new tool entry for the current category."""
        cat_id = self._selected_cat
        existing_tools = {t["tool"] for t in self.data.get(cat_id, [])}

        # Show dialog to pick tool type or enter custom
        dlg = tk.Toplevel(self)
        dlg.title("Add Tool")
        dlg.configure(bg=C.SURFACE0)
        dlg.resizable(False, False)
        self.update_idletasks()
        w, h = 360, 340
        x = self.winfo_x() + (self.winfo_width() - w) // 2
        y = self.winfo_y() + (self.winfo_height() - h) // 2
        dlg.geometry(f"{w}x{h}+{x}+{y}")
        dlg.transient(self)
        dlg.grab_set()
        dark_title_bar(dlg)

        body = tk.Frame(dlg, bg=C.SURFACE0)
        body.pack(fill="both", expand=True, padx=20, pady=16)

        tk.Label(body, text="Select tool type:", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(anchor="w", pady=(0, 8))

        selected_type = tk.StringVar(value="")

        # Buttons for each standard tool type
        for tool_type in TOOL_TYPES:
            already = tool_type in existing_tools
            frame = tk.Frame(body, bg=C.SURFACE0)
            frame.pack(fill="x", pady=2)

            rb = tk.Radiobutton(frame, text=f"  {TOOL_TYPE_LABELS.get(tool_type, tool_type)}",
                                variable=selected_type, value=tool_type,
                                bg=C.SURFACE0, fg=C.TEXT if not already else C.OVERLAY0,
                                selectcolor=C.SURFACE1, font=F.BODY,
                                activebackground=C.SURFACE0, activeforeground=C.TEXT,
                                state="normal" if not already else "disabled")
            rb.pack(side="left")

            if already:
                tk.Label(frame, text="(exists)", bg=C.SURFACE0, fg=C.OVERLAY0,
                         font=F.TINY).pack(side="left", padx=(4, 0))

        # Custom type entry
        tk.Frame(body, bg=C.SURFACE2, height=1).pack(fill="x", pady=(8, 8))
        custom_frame = tk.Frame(body, bg=C.SURFACE0)
        custom_frame.pack(fill="x")
        tk.Label(custom_frame, text="Or custom:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL).pack(side="left")
        custom_var = tk.StringVar()
        custom_entry = tk.Entry(custom_frame, textvariable=custom_var,
                                bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
                                font=F.BODY, relief="flat", bd=0,
                                highlightthickness=1, highlightcolor=C.BLUE,
                                highlightbackground=C.SURFACE2, width=20)
        custom_entry.pack(side="left", padx=(8, 0))

        def do_add():
            tool_type = custom_var.get().strip().lower() or selected_type.get()
            if not tool_type:
                dlg.destroy()
                return
            if tool_type in existing_tools:
                self.toast.show(f"'{tool_type}' already exists for {cat_id}", C.PEACH)
                dlg.destroy()
                return
            entry = make_default_tool(cat_id, tool_type)
            self.data[cat_id].append(entry)
            dlg.destroy()
            self._update_badge()
            self._rebuild_tool_cards()
            self._update_sidebar_badges()

        btn_row = tk.Frame(body, bg=C.SURFACE0)
        btn_row.pack(fill="x", pady=(16, 0))
        FlatBtn(btn_row, text="Cancel", command=dlg.destroy,
                bg=C.SURFACE1, hover_bg=C.SURFACE2).pack(side="right", padx=(8, 0))
        FlatBtn(btn_row, text="  Add  ", command=do_add,
                bg=C.TEAL, fg=C.CRUST, hover_bg=C.SAPPHIRE,
                font=F.BODY_BOLD).pack(side="right")

    def _edit_tooltips(self):
        """Edit the shared tooltip descriptions."""
        dlg = tk.Toplevel(self)
        dlg.title("Shared Tooltips")
        dlg.configure(bg=C.SURFACE0)
        dlg.resizable(True, True)
        self.update_idletasks()
        w, h = 560, 440
        x = self.winfo_x() + (self.winfo_width() - w) // 2
        y = self.winfo_y() + (self.winfo_height() - h) // 2
        dlg.geometry(f"{w}x{h}+{x}+{y}")
        dlg.minsize(400, 300)
        dlg.transient(self)
        dlg.grab_set()
        dark_title_bar(dlg)

        body = tk.Frame(dlg, bg=C.SURFACE0)
        body.pack(fill="both", expand=True, padx=20, pady=16)

        tk.Label(body, text="Tooltip descriptions shown on hover for each tool type.",
                 bg=C.SURFACE0, fg=C.OVERLAY0, font=F.SMALL).pack(anchor="w", pady=(0, 12))

        # Load current tooltips from data (or defaults)
        current_tooltips = self.data.get("_tooltips", dict(DEFAULT_TOOLTIPS))
        tooltip_vars: dict[str, tk.StringVar] = {}

        for tool_type in TOOL_TYPES:
            row = tk.Frame(body, bg=C.SURFACE0)
            row.pack(fill="x", pady=(0, 8))
            tk.Label(row, text=f"{TOOL_TYPE_LABELS.get(tool_type, tool_type)}:",
                     bg=C.SURFACE0, fg=C.TEXT, font=F.BODY_BOLD,
                     width=12, anchor="w").pack(side="left")
            var = tk.StringVar(value=current_tooltips.get(tool_type, ""))
            entry = tk.Entry(row, textvariable=var, bg=C.SURFACE1, fg=C.TEXT,
                             insertbackground=C.TEXT, font=F.BODY, relief="flat", bd=0,
                             highlightthickness=1, highlightcolor=C.BLUE,
                             highlightbackground=C.SURFACE2)
            entry.pack(side="left", fill="x", expand=True, padx=(8, 0))
            tooltip_vars[tool_type] = var

        def do_save():
            self.data["_tooltips"] = {k: v.get() for k, v in tooltip_vars.items()}
            self._update_badge()
            dlg.destroy()
            self.toast.show("Tooltips updated", C.GREEN, 2000)

        def do_reset():
            for k, v in tooltip_vars.items():
                v.set(DEFAULT_TOOLTIPS.get(k, ""))

        btn_row = tk.Frame(body, bg=C.SURFACE0)
        btn_row.pack(fill="x", pady=(16, 0))
        FlatBtn(btn_row, text="Reset Defaults", command=do_reset,
                bg=C.SURFACE1, hover_bg=C.SURFACE2, font=F.SMALL).pack(side="left")
        FlatBtn(btn_row, text="Cancel", command=dlg.destroy,
                bg=C.SURFACE1, hover_bg=C.SURFACE2).pack(side="right", padx=(8, 0))
        FlatBtn(btn_row, text="  OK  ", command=do_save,
                bg=C.TEAL, fg=C.CRUST, hover_bg=C.SAPPHIRE,
                font=F.BODY_BOLD).pack(side="right")

    def _update_sidebar_badges(self):
        """Update the tool count badges in the sidebar."""
        # Rebuild sidebar is simpler — just refresh the whole thing
        for w in self._sidebar.winfo_children():
            w.destroy()

        tk.Label(self._sidebar, text="CATEGORIES", bg=C.BASE, fg=C.OVERLAY0,
                 font=F.TINY).pack(fill="x", padx=12, pady=(12, 8))

        self._cat_btns = {}
        for cat in self.product_cats:
            cat_id = cat["id"]
            color = cat.get("color", C.BLUE)
            btn_frame = tk.Frame(self._sidebar, bg=C.BASE)
            btn_frame.pack(fill="x", padx=4, pady=1)

            accent = tk.Frame(btn_frame, bg=color, width=3)
            accent.pack(side="left", fill="y")

            is_selected = cat_id == self._selected_cat
            lbl = tk.Label(btn_frame,
                           text=f"  {cat_id.upper()}",
                           bg=C.SURFACE0 if is_selected else C.BASE,
                           fg=C.TEXT if is_selected else C.SUBTEXT0,
                           font=F.BODY_BOLD,
                           anchor="w", padx=8, pady=8, cursor="hand2")
            lbl.pack(side="left", fill="both", expand=True)
            lbl.bind("<Button-1>", lambda e, cid=cat_id: self._select_category(cid))
            self._cat_btns[cat_id] = lbl

            tool_count = len([t for t in self.data.get(cat_id, []) if t.get("enabled", True)])
            badge = tk.Label(btn_frame, text=str(tool_count),
                             bg=C.SURFACE1, fg=C.OVERLAY0, font=F.TINY,
                             padx=6, pady=2)
            badge.pack(side="right", padx=(0, 8))
            badge.bind("<Button-1>", lambda e, cid=cat_id: self._select_category(cid))

        # Tooltips section
        tk.Frame(self._sidebar, bg=C.SURFACE2, height=1).pack(fill="x", padx=12, pady=(16, 8))
        tk.Label(self._sidebar, text="SHARED TOOLTIPS", bg=C.BASE, fg=C.OVERLAY0,
                 font=F.TINY).pack(fill="x", padx=12, pady=(0, 4))
        tooltip_btn = FlatBtn(self._sidebar, text="Edit Tooltips", command=self._edit_tooltips,
                              bg=C.SURFACE1, hover_bg=C.SURFACE2, font=F.SMALL)
        tooltip_btn.pack(fill="x", padx=12, pady=2)

    # -- Status Bar ----------------------------------------------------------
    def _build_status_bar(self):
        bar = tk.Frame(self, bg=C.CRUST, height=32)
        bar.pack(fill="x", side="bottom")
        bar.pack_propagate(False)
        self.status_var = tk.StringVar(value="  Ready  \u00b7  Ctrl+S to save")
        tk.Label(bar, textvariable=self.status_var, bg=C.CRUST, fg=C.OVERLAY0,
                 font=F.TINY, padx=20).pack(side="left", fill="y")
        total = sum(len(v) for k, v in self.data.items() if not k.startswith("_"))
        self.count_lbl = tk.Label(bar, text=f"{total} tools across {len(self.product_cats)} categories",
                                  bg=C.CRUST, fg=C.SURFACE2, font=F.TINY, padx=20)
        self.count_lbl.pack(side="right", fill="y")

    def _update_badge(self):
        current = json.dumps(self.data, sort_keys=True)
        if current != self._original:
            self.changes_lbl.configure(text="unsaved changes", fg=C.PEACH)
        else:
            self.changes_lbl.configure(text="", fg=C.GREEN)

    # -- Save ----------------------------------------------------------------
    def _save(self):
        current = json.dumps(self.data, sort_keys=True)
        if current == self._original:
            self.toast.show("No changes to save", C.OVERLAY0)
            return
        try:
            save_hub_tools(self.data)
            self._original = current
            self._update_badge()
            now = datetime.now().strftime("%H:%M:%S")
            total = sum(len(v) for k, v in self.data.items() if not k.startswith("_"))
            self.toast.show(f"Saved {total} tools at {now}", C.GREEN)
            self.status_var.set(f"  Last saved at {now}  \u00b7  Ctrl+S to save")
            self.count_lbl.configure(
                text=f"{total} tools across {len(self.product_cats)} categories"
            )
        except Exception as e:
            self.toast.show(f"Error: {e}", C.RED)

    # -- Close ---------------------------------------------------------------
    def _on_close(self):
        current = json.dumps(self.data, sort_keys=True)
        if current != self._original:
            if not messagebox.askyesno(
                    "Unsaved Changes",
                    "You have unsaved changes.\n\nExit without saving?",
                    parent=self):
                return
        self.destroy()


if __name__ == "__main__":
    app = HubToolsManager()
    app.mainloop()
