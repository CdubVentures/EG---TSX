"""
Hub Tools panel — manages hub sidebar tools per category.

Each product category has multiple tool links (Hub, Database, Versus, Radar,
Shapes) displayed on the home page sidebar, /hubs/ index, and hub pages.
Configures: title, url, description, subtitle, SVG icon, hero image,
navbar visibility, enabled state, and /hubs/ dashboard slot assignments.
"""

import json
import re
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from pathlib import Path
from datetime import datetime
from textwrap import shorten

from lib.shared import C, F, FlatBtn, Tip, HoverListbox, darken, dark_title_bar
from lib.config_store import ConfigStore

# -- Constants ---------------------------------------------------------------

TOOL_TYPES = ["hub", "database", "versus", "radar", "shapes"]

TOOL_TYPE_LABELS = {
    "hub": "Hub",
    "database": "Database",
    "versus": "Versus",
    "radar": "Radars",
    "shapes": "Shapes",
}

DEFAULT_TOOLTIPS = {
    "database": "Structured lists you can filter and sort to find the best fit.",
    "hub": "The main landing pages for each category\u2014start here to explore everything in one place.",
    "radar": "Visual scorecards that summarize strengths and weaknesses at a glance.",
    "shapes": "A visual catalogue of shapes/profiles to help understand fit and ergonomics.",
    "versus": "Side\u2011by\u2011side comparisons to quickly see what\u2019s different and what wins.",
}

DEFAULT_URLS = {
    "hub": "/hubs/{cat}",
    "database": "/hubs/{cat}?view=list",
    "versus": "/hubs/{cat}?compare=stats",
    "radar": "/hubs/{cat}?compare=radar",
    "shapes": "/hubs/{cat}?compare=shapes",
}

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


# -- Pure data helpers (no tkinter) ------------------------------------------

def is_product_active(cat: dict) -> bool:
    """True if this category's product flags are enabled (production OR vite)."""
    product = cat.get("product", {})
    return product.get("production", False) or product.get("vite", False)


def make_default_tool(category_id: str, tool_type: str) -> dict:
    """Create a default tool entry for a category + tool type."""
    desc = (DEFAULT_DESCRIPTIONS.get(category_id, {}).get(tool_type)
            or f"Explore {category_id} {tool_type}")
    subtitle = (DEFAULT_SUBTITLES.get(category_id, {}).get(tool_type)
                or f"{category_id.capitalize()} {TOOL_TYPE_LABELS.get(tool_type, tool_type)}")
    hero = f"/images/tools/{category_id}/{tool_type}/hero-img" if tool_type == "hub" else ""
    return {
        "tool": tool_type,
        "title": TOOL_TYPE_LABELS.get(tool_type, tool_type.capitalize()),
        "description": desc,
        "subtitle": subtitle,
        "url": DEFAULT_URLS.get(tool_type, f"/hubs/{category_id}").replace("{cat}", category_id),
        "svg": "",
        "enabled": True,
        "navbar": tool_type == "hub",
        "hero": hero,
    }


def ensure_defaults(data: dict, categories: list[dict]) -> dict:
    """Ensure every category has entries for all tool types."""
    for cat in categories:
        cat_id = cat["id"]
        active = is_product_active(cat)
        if cat_id not in data:
            data[cat_id] = []
        existing_tools = {t["tool"] for t in data[cat_id]}
        for tool_type in TOOL_TYPES:
            if tool_type not in existing_tools:
                entry = make_default_tool(cat_id, tool_type)
                if not active:
                    entry["enabled"] = False
                elif tool_type == "shapes" and cat_id != "mouse":
                    entry["enabled"] = False
                data[cat_id].append(entry)
        order = {t: i for i, t in enumerate(TOOL_TYPES)}
        data[cat_id].sort(key=lambda t: order.get(t["tool"], 99))
    return data


def build_config(data: dict) -> dict:
    """Build the saveable config dict from panel state."""
    return dict(data)


def _scan_content_only_cats(root: Path) -> set[str]:
    """Scan filesystem: categories that have articles but NO data-products folder."""
    content = root / "src" / "content"
    dp = content / "data-products"
    product_dirs: set[str] = set()
    if dp.is_dir():
        product_dirs = {d.name for d in dp.iterdir() if d.is_dir()}

    article_cats: set[str] = set()
    for dirname in ("reviews", "guides", "news"):
        d = content / dirname
        if not d.is_dir():
            continue
        for f in d.rglob("*"):
            if f.suffix in (".md", ".mdx") and f.is_file():
                try:
                    text = f.read_text(encoding="utf-8", errors="replace")
                    parts = text.split("---", 2)
                    if len(parts) >= 3:
                        for line in parts[1].splitlines():
                            m = re.match(r"^category:\s*(.+)", line)
                            if m:
                                article_cats.add(m.group(1).strip().strip("'\""))
                                break
                except Exception:
                    pass

    return article_cats - product_dirs


# -- SVG Preview Drawing -----------------------------------------------------

def _draw_hub(c, clr):
    c.create_oval(13, 3, 19, 9, outline=clr, width=1.5)
    c.create_oval(3, 13, 9, 19, outline=clr, width=1.5)
    c.create_oval(16, 16, 22, 22, outline=clr, width=1.5)
    c.create_line(8, 8, 14, 6, fill=clr, width=1)
    c.create_line(8, 14, 14, 6, fill=clr, width=1)
    c.create_line(8, 14, 17, 17, fill=clr, width=1)

def _draw_database(c, clr):
    c.create_oval(4, 2, 20, 8, outline=clr, width=1.5)
    c.create_line(4, 5, 4, 19, fill=clr, width=1.5)
    c.create_line(20, 5, 20, 19, fill=clr, width=1.5)
    c.create_arc(4, 16, 20, 22, start=180, extent=180, style="arc", outline=clr, width=1.5)
    c.create_arc(4, 10, 20, 16, start=180, extent=180, style="arc", outline=clr, width=1.5)

def _draw_versus(c, clr):
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

    def __init__(self, parent, initial_svg: str = "", title_text: str = "Edit SVG",
                 root_path: Path | None = None):
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
        self._root_path = root_path
        self.result = None

        hdr = tk.Frame(self, bg=C.SURFACE0)
        hdr.pack(fill="x", padx=16, pady=(12, 8))
        tk.Label(hdr, text="Paste SVG markup below:", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY).pack(side="left")
        FlatBtn(hdr, text="Load .svg file", command=self._load_file,
                bg=C.SURFACE1, hover_bg=C.SURFACE2, font=F.SMALL).pack(side="right")

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

        info = tk.Frame(self, bg=C.SURFACE0)
        info.pack(fill="x", padx=16, pady=(0, 4))
        tk.Label(info, text="SVG must use fill='currentColor' for theme compatibility",
                 bg=C.SURFACE0, fg=C.OVERLAY0, font=F.TINY).pack(side="left")
        self._char_lbl = tk.Label(info, text="0 chars", bg=C.SURFACE0,
                                  fg=C.OVERLAY0, font=F.TINY)
        self._char_lbl.pack(side="right")
        self._text.bind("<<Modified>>", self._on_modified)
        self._text.bind("<KeyRelease>", lambda e: self._update_count())

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
        init_dir = str(self._root_path / "public" / "images") if self._root_path else None
        path = filedialog.askopenfilename(
            parent=self, title="Select SVG file",
            filetypes=[("SVG files", "*.svg"), ("All files", "*.*")],
            initialdir=init_dir)
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


# -- Panel -------------------------------------------------------------------

class HubToolsPanel(tk.Frame):
    """Hub Tools panel for the mega-app notebook."""

    def __init__(self, parent: tk.Widget, app):
        super().__init__(parent, bg=C.MANTLE)
        self._app = app
        self._project_root = app.store._root

        # Scan for content-only categories (via shared cache)
        self._content_only = app.cache.get_content_only_cats()

        # Load categories (excluding content-only)
        self._product_cats = [c for c in app.store.categories
                              if c["id"] not in self._content_only]
        self._selected_cat = self._product_cats[0]["id"] if self._product_cats else ""
        self._card_widgets: list[dict] = []

        # Load hub tools data
        raw = app.store.get(ConfigStore.HUB_TOOLS)
        self._data = ensure_defaults(dict(raw) if raw else {}, self._product_cats)
        self._original = json.dumps(self._data, sort_keys=True)

        # Drag state for Index tab
        self._drag_src: tk.Listbox | None = None
        self._drag_idx: int | None = None
        self._drag_item: dict | None = None
        self._drag_ghost: tk.Toplevel | None = None
        self._index_lbs: list[tk.Listbox] = []
        self._index_filter = "all"

        # Internal notebook (Home + Index tabs)
        self._setup_styles()
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(fill="both", expand=True)
        self._build_home_tab()
        self._build_index_tab()

        # Subscribe to changes
        app.store.subscribe(ConfigStore.HUB_TOOLS, self._on_external_change)
        # WHY: CATEGORIES subscription removed — mega-app dispatches centrally
        # to avoid refreshing hidden panels

    def save(self) -> bool:
        current = json.dumps(self._data, sort_keys=True)
        if current == self._original:
            self._app.toast.show("No changes to save", C.OVERLAY0)
            return False
        try:
            self._app.watcher.pause()
            self._app.store.save(ConfigStore.HUB_TOOLS, self._data)
            self._app.watcher.snapshot()
            self._app.watcher.resume()
            self._original = current
            self._app.update_changes_badge()
            now = datetime.now().strftime("%H:%M:%S")
            total = sum(len(v) for k, v in self._data.items() if not k.startswith("_"))
            self._app.toast.show(f"Saved {total} tools at {now}", C.GREEN)
            self._app.set_status(f"Last saved at {now}  \u00b7  Ctrl+S to save")
            self._app.set_status_right(
                f"{total} tools across {len(self._product_cats)} categories")
            return True
        except Exception as e:
            self._app.watcher.resume()
            self._app.toast.show(f"Error: {e}", C.RED)
            return False

    def has_changes(self) -> bool:
        current = json.dumps(self._data, sort_keys=True)
        return current != self._original

    def refresh(self):
        raw = self._app.store.get(ConfigStore.HUB_TOOLS)
        self._data = ensure_defaults(dict(raw) if raw else {}, self._product_cats)
        self._original = json.dumps(self._data, sort_keys=True)
        self._rebuild_tool_cards()
        self._refresh_index()
        self._app.update_changes_badge()

    def _on_external_change(self):
        self.refresh()

    def _on_categories_change(self):
        # WHY: _content_only is cached from init — filesystem structure
        # doesn't change during a GUI session
        self._product_cats = [c for c in self._app.store.categories
                              if c["id"] not in self._content_only]
        self._data = ensure_defaults(self._data, self._product_cats)
        if self._selected_cat not in {c["id"] for c in self._product_cats}:
            self._selected_cat = self._product_cats[0]["id"] if self._product_cats else ""
        self._rebuild_tool_cards()
        self._update_sidebar_badges()
        self._refresh_index()

    def _setup_styles(self):
        s = ttk.Style()
        s.configure("HubTools.TNotebook", background=C.MANTLE, borderwidth=0)
        s.configure("HubTools.TNotebook.Tab",
                     background=C.SURFACE1, foreground=C.OVERLAY0,
                     padding=[28, 12], borderwidth=0, font=F.BODY_BOLD,
                     focuscolor=C.SURFACE1)
        s.map("HubTools.TNotebook.Tab",
              background=[("selected", C.SURFACE0), ("active", C.SURFACE2)],
              foreground=[("selected", C.TEXT), ("active", C.SUBTEXT1)])

    def _update_badge(self):
        self._app.update_changes_badge()

    def _get_cat_color(self) -> str:
        for cat in self._product_cats:
            if cat["id"] == self._selected_cat:
                return cat.get("color", C.BLUE)
        return C.BLUE

    def _get_cat_color_by_id(self, cat_id: str) -> str:
        for cat in self._product_cats:
            if cat["id"] == cat_id:
                return cat.get("color", C.BLUE)
        return C.OVERLAY0

    # -- Home Tab ------------------------------------------------------------

    def _build_home_tab(self):
        frame = tk.Frame(self.notebook, bg=C.MANTLE)
        self.notebook.add(frame, text="  Home  ")
        body = tk.Frame(frame, bg=C.MANTLE)
        body.pack(fill="both", expand=True)

        # Left sidebar: category tabs
        self._sidebar = sidebar = tk.Frame(body, bg=C.BASE, width=200)
        sidebar.pack(side="left", fill="y", padx=(16, 0), pady=(12, 0))
        sidebar.pack_propagate(False)

        self._build_sidebar_contents()

        # Right content: scrollable tool cards
        self._content_frame = tk.Frame(body, bg=C.MANTLE)
        self._content_frame.pack(side="left", fill="both", expand=True, padx=(12, 0))

        self._build_tool_cards_area()
        self._select_category(self._selected_cat)

    def _build_sidebar_contents(self):
        sidebar = self._sidebar
        tk.Label(sidebar, text="CATEGORIES", bg=C.BASE, fg=C.OVERLAY0,
                 font=F.TINY).pack(fill="x", padx=12, pady=(12, 8))

        self._cat_btns: dict[str, tk.Label] = {}
        for cat in self._product_cats:
            cat_id = cat["id"]
            color = cat.get("color", C.BLUE)
            active = is_product_active(cat)
            btn_frame = tk.Frame(sidebar, bg=C.BASE)
            btn_frame.pack(fill="x", padx=4, pady=1)

            accent_color = color if active else C.SURFACE2
            accent = tk.Frame(btn_frame, bg=accent_color, width=3)
            accent.pack(side="left", fill="y")

            text_fg = C.TEXT if active else C.OVERLAY0
            lbl = tk.Label(btn_frame, text=f"  {cat_id.upper()}",
                           bg=C.BASE, fg=text_fg, font=F.BODY_BOLD,
                           anchor="w", padx=8, pady=8, cursor="hand2")
            lbl.pack(side="left", fill="both", expand=True)
            lbl.bind("<Button-1>", lambda e, cid=cat_id: self._select_category(cid))
            self._cat_btns[cat_id] = lbl

            tool_count = len([t for t in self._data.get(cat_id, []) if t.get("enabled", True)])
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

    def _build_tool_cards_area(self):
        container = self._content_frame
        self._cards_canvas = tk.Canvas(container, bg=C.MANTLE, highlightthickness=0)
        scrollbar = tk.Scrollbar(container, orient="vertical",
                                 command=self._cards_canvas.yview,
                                 bg=C.SURFACE1, troughcolor=C.BASE,
                                 highlightthickness=0, bd=0)
        self._cards_inner = tk.Frame(self._cards_canvas, bg=C.MANTLE)
        self._cards_inner.bind(
            "<Configure>",
            lambda e: self._cards_canvas.configure(scrollregion=self._cards_canvas.bbox("all")))
        self._canvas_win = self._cards_canvas.create_window(
            (0, 0), window=self._cards_inner, anchor="nw")
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
        self._selected_cat = cat_id
        for cid, lbl in self._cat_btns.items():
            if cid == cat_id:
                lbl.configure(bg=C.SURFACE0, fg=C.TEXT)
            else:
                lbl.configure(bg=C.BASE, fg=C.SUBTEXT0)
        self._rebuild_tool_cards()

    def _rebuild_tool_cards(self):
        for w in self._cards_inner.winfo_children():
            w.destroy()
        self._card_widgets = []

        cat_id = self._selected_cat
        tools = self._data.get(cat_id, [])
        color = self._get_cat_color()

        header = tk.Frame(self._cards_inner, bg=C.MANTLE)
        header.pack(fill="x", pady=(0, 8))
        tk.Label(header, text=f"{cat_id.upper()} TOOLS",
                 bg=C.MANTLE, fg=color, font=F.HEADING).pack(side="left")
        tk.Label(header, text=f"  {len([t for t in tools if t.get('enabled', True)])} enabled",
                 bg=C.MANTLE, fg=C.OVERLAY0, font=F.SMALL).pack(side="left", pady=(2, 0))
        FlatBtn(header, text="+ Add Tool", command=self._add_tool,
                bg=C.SURFACE1, hover_bg=C.SURFACE2, font=F.SMALL).pack(side="right")

        for i, tool in enumerate(tools):
            self._build_tool_card(i, tool, color)

    def _build_tool_card(self, idx: int, tool: dict, cat_color: str):
        enabled = tool.get("enabled", True)
        tool_type = tool.get("tool", "unknown")

        card = tk.Frame(self._cards_inner, bg=C.SURFACE0,
                        highlightthickness=1, highlightbackground=C.CARD_BORDER)
        card.pack(fill="x", pady=4, padx=(0, 8))

        accent_color = cat_color if enabled else C.SURFACE2
        accent = tk.Frame(card, bg=accent_color, width=4)
        accent.pack(side="left", fill="y")

        inner = tk.Frame(card, bg=C.SURFACE0)
        inner.pack(side="left", fill="both", expand=True, padx=12, pady=10)

        # Row 1: Icon + Title + Badge + SVG status + Actions
        row1 = tk.Frame(inner, bg=C.SURFACE0)
        row1.pack(fill="x")

        icon_canvas = tk.Canvas(row1, width=24, height=24,
                                highlightthickness=0, bg=C.SURFACE0)
        icon_canvas.pack(side="left", padx=(0, 8))
        draw_tool_icon(icon_canvas, tool_type, cat_color if enabled else C.OVERLAY0)

        title_var = tk.StringVar(value=tool.get("title", ""))
        title_entry = tk.Entry(row1, textvariable=title_var, bg=C.SURFACE1, fg=C.TEXT,
                               insertbackground=C.TEXT, font=F.HEADING, relief="flat", bd=0,
                               highlightthickness=1, highlightcolor=C.BLUE,
                               highlightbackground=C.SURFACE2, width=15)
        title_entry.pack(side="left", padx=(0, 8))

        badge = tk.Label(row1, text=tool_type.upper(), bg=C.SURFACE1, fg=C.OVERLAY0,
                         font=F.TINY, padx=6, pady=2)
        badge.pack(side="left", padx=(0, 8))

        has_svg = bool(tool.get("svg", "").strip())
        svg_status_text = "SVG" if has_svg else "NO SVG"
        svg_status_color = C.GREEN if has_svg else C.RED
        svg_status = tk.Label(row1, text=svg_status_text, bg=C.SURFACE0,
                              fg=svg_status_color, font=F.TINY)
        svg_status.pack(side="left", padx=(0, 8))

        actions = tk.Frame(row1, bg=C.SURFACE0)
        actions.pack(side="right")

        del_btn = FlatBtn(actions, text="\u00d7", command=lambda i=idx: self._delete_tool(i),
                          bg=C.SURFACE0, hover_bg=C.SURFACE1, fg=C.RED,
                          font=("Segoe UI", 14), padx=4, pady=0)
        del_btn.pack(side="right", padx=(4, 0))
        Tip(del_btn, "Delete this tool entry")

        if idx < len(self._data.get(self._selected_cat, [])) - 1:
            down_btn = FlatBtn(actions, text="\u25bc", command=lambda i=idx: self._move_tool(i, 1),
                               bg=C.SURFACE0, hover_bg=C.SURFACE1, fg=C.OVERLAY0,
                               font=F.SMALL, padx=4, pady=2)
            down_btn.pack(side="right")

        if idx > 0:
            up_btn = FlatBtn(actions, text="\u25b2", command=lambda i=idx: self._move_tool(i, -1),
                             bg=C.SURFACE0, hover_bg=C.SURFACE1, fg=C.OVERLAY0,
                             font=F.SMALL, padx=4, pady=2)
            up_btn.pack(side="right")

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
        tk.Entry(row2, textvariable=url_var, bg=C.SURFACE1, fg=C.TEXT,
                 insertbackground=C.TEXT, font=F.BODY, relief="flat", bd=0,
                 highlightthickness=1, highlightcolor=C.BLUE,
                 highlightbackground=C.SURFACE2).pack(side="left", fill="x", expand=True, padx=(4, 0))

        # Row 3: Description
        row3 = tk.Frame(inner, bg=C.SURFACE0)
        row3.pack(fill="x", pady=(4, 0))
        tk.Label(row3, text="Description:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL, width=10, anchor="w").pack(side="left")
        desc_var = tk.StringVar(value=tool.get("description", ""))
        tk.Entry(row3, textvariable=desc_var, bg=C.SURFACE1, fg=C.TEXT,
                 insertbackground=C.TEXT, font=F.BODY, relief="flat", bd=0,
                 highlightthickness=1, highlightcolor=C.BLUE,
                 highlightbackground=C.SURFACE2).pack(side="left", fill="x", expand=True, padx=(4, 0))

        # Row 4: Subtitle
        row4 = tk.Frame(inner, bg=C.SURFACE0)
        row4.pack(fill="x", pady=(4, 0))
        tk.Label(row4, text="Subtitle:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL, width=10, anchor="w").pack(side="left")
        subtitle_var = tk.StringVar(value=tool.get("subtitle", ""))
        tk.Entry(row4, textvariable=subtitle_var, bg=C.SURFACE1, fg=C.TEXT,
                 insertbackground=C.TEXT, font=F.BODY, relief="flat", bd=0,
                 highlightthickness=1, highlightcolor=C.BLUE,
                 highlightbackground=C.SURFACE2).pack(side="left", fill="x", expand=True, padx=(4, 0))

        # Row 5: Hero Image + Navbar toggle
        row5a = tk.Frame(inner, bg=C.SURFACE0)
        row5a.pack(fill="x", pady=(4, 0))
        tk.Label(row5a, text="Hero Image:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL, width=10, anchor="w").pack(side="left")
        hero_var = tk.StringVar(value=tool.get("hero", ""))
        hero_entry = tk.Entry(row5a, textvariable=hero_var, bg=C.SURFACE1, fg=C.TEXT,
                              insertbackground=C.TEXT, font=F.BODY, relief="flat", bd=0,
                              highlightthickness=1, highlightcolor=C.BLUE,
                              highlightbackground=C.SURFACE2, width=40)
        hero_entry.pack(side="left", padx=(4, 8))
        Tip(hero_entry, "Hero image base path for /hubs/ dashboard cards.\n"
                        "e.g. /images/tools/mouse/hub/hero-img\n"
                        "Size suffix (_xl, _l, etc.) added automatically.")

        nav_val = tool.get("navbar", False)
        nav_frame = tk.Frame(row5a, bg=C.SURFACE0)
        nav_frame.pack(side="left", padx=(8, 0))
        tk.Label(nav_frame, text="Navbar:", bg=C.SURFACE0, fg=C.SUBTEXT0,
                 font=F.TINY).pack(side="left", padx=(0, 4))
        nav_canvas = tk.Canvas(nav_frame, width=38, height=20,
                               highlightthickness=0, bd=0, bg=C.SURFACE0)
        nav_canvas.pack(side="left")
        self._draw_toggle(nav_canvas, nav_val)
        nav_canvas.configure(cursor="hand2")
        nav_canvas.bind("<Button-1>",
                        lambda e, i=idx, nc=nav_canvas: self._toggle_field(i, "navbar", nc))
        Tip(nav_canvas, "Show this tool in the main navigation bar")

        # Row 6: SVG actions
        row5 = tk.Frame(inner, bg=C.SURFACE0)
        row5.pack(fill="x", pady=(6, 0))
        tk.Label(row5, text="SVG Icon:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL, width=10, anchor="w").pack(side="left")

        FlatBtn(row5, text="Edit SVG",
                command=lambda i=idx: self._edit_svg(i),
                bg=C.SURFACE1, hover_bg=C.SURFACE2, font=F.SMALL).pack(side="left", padx=(4, 8))

        svg_raw = tool.get("svg", "")
        svg_preview_text = shorten(svg_raw, width=60, placeholder="...") if svg_raw else "(no SVG set)"
        svg_preview = tk.Label(row5, text=svg_preview_text, bg=C.SURFACE0,
                               fg=C.OVERLAY0 if svg_raw else C.RED,
                               font=F.TINY, anchor="w")
        svg_preview.pack(side="left", fill="x", expand=True)

        # Bind entry changes to data model
        def _on_change(*args, field=None, var=None, i=idx):
            self._data[self._selected_cat][i][field] = var.get()
            self._update_badge()

        title_var.trace_add("write", lambda *a: _on_change(field="title", var=title_var, i=idx))
        url_var.trace_add("write", lambda *a: _on_change(field="url", var=url_var, i=idx))
        desc_var.trace_add("write", lambda *a: _on_change(field="description", var=desc_var, i=idx))
        subtitle_var.trace_add("write", lambda *a: _on_change(field="subtitle", var=subtitle_var, i=idx))
        hero_var.trace_add("write", lambda *a: _on_change(field="hero", var=hero_var, i=idx))

        self._card_widgets.append({
            "card": card, "title_var": title_var, "url_var": url_var,
            "desc_var": desc_var, "subtitle_var": subtitle_var,
            "hero_var": hero_var, "icon_canvas": icon_canvas, "accent": accent,
            "svg_status": svg_status, "svg_preview": svg_preview,
            "enable_canvas": enable_canvas, "nav_canvas": nav_canvas,
        })

    def _draw_toggle(self, canvas: tk.Canvas, is_on: bool):
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
        tool = self._data[self._selected_cat][idx]
        new_val = not tool.get("enabled", True)
        tool["enabled"] = new_val
        self._draw_toggle(canvas, new_val)
        self._update_badge()
        self._rebuild_tool_cards()
        self._update_sidebar_badges()

    def _toggle_field(self, idx: int, field: str, canvas: tk.Canvas):
        tool = self._data[self._selected_cat][idx]
        new_val = not tool.get(field, False)
        tool[field] = new_val
        self._draw_toggle(canvas, new_val)
        self._update_badge()

    def _edit_svg(self, idx: int):
        tool = self._data[self._selected_cat][idx]
        title = tool.get("title", "Tool")
        editor = SvgEditor(self.winfo_toplevel(), initial_svg=tool.get("svg", ""),
                           title_text=f"SVG for {self._selected_cat}/{title}",
                           root_path=self._project_root)
        self.winfo_toplevel().wait_window(editor)
        if editor.result is not None:
            tool["svg"] = editor.result
            self._update_badge()
            self._rebuild_tool_cards()

    def _delete_tool(self, idx: int):
        tool = self._data[self._selected_cat][idx]
        title = tool.get("title", "Tool")
        if messagebox.askyesno(
                "Delete Tool",
                f"Delete '{title}' from {self._selected_cat}?",
                parent=self.winfo_toplevel()):
            self._data[self._selected_cat].pop(idx)
            self._update_badge()
            self._rebuild_tool_cards()
            self._update_sidebar_badges()

    def _move_tool(self, idx: int, direction: int):
        tools = self._data[self._selected_cat]
        new_idx = idx + direction
        if 0 <= new_idx < len(tools):
            tools[idx], tools[new_idx] = tools[new_idx], tools[idx]
            self._update_badge()
            self._rebuild_tool_cards()

    def _add_tool(self):
        cat_id = self._selected_cat
        existing_tools = {t["tool"] for t in self._data.get(cat_id, [])}
        top = self.winfo_toplevel()

        dlg = tk.Toplevel(top)
        dlg.title("Add Tool")
        dlg.configure(bg=C.SURFACE0)
        dlg.resizable(False, False)
        top.update_idletasks()
        w, h = 360, 340
        x = top.winfo_x() + (top.winfo_width() - w) // 2
        y = top.winfo_y() + (top.winfo_height() - h) // 2
        dlg.geometry(f"{w}x{h}+{x}+{y}")
        dlg.transient(top)
        dlg.grab_set()
        dark_title_bar(dlg)

        body = tk.Frame(dlg, bg=C.SURFACE0)
        body.pack(fill="both", expand=True, padx=20, pady=16)

        tk.Label(body, text="Select tool type:", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(anchor="w", pady=(0, 8))

        selected_type = tk.StringVar(value="")

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

        tk.Frame(body, bg=C.SURFACE2, height=1).pack(fill="x", pady=(8, 8))
        custom_frame = tk.Frame(body, bg=C.SURFACE0)
        custom_frame.pack(fill="x")
        tk.Label(custom_frame, text="Or custom:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL).pack(side="left")
        custom_var = tk.StringVar()
        tk.Entry(custom_frame, textvariable=custom_var,
                 bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
                 font=F.BODY, relief="flat", bd=0,
                 highlightthickness=1, highlightcolor=C.BLUE,
                 highlightbackground=C.SURFACE2, width=20).pack(side="left", padx=(8, 0))

        def do_add():
            tt = custom_var.get().strip().lower() or selected_type.get()
            if not tt:
                dlg.destroy()
                return
            if tt in existing_tools:
                self._app.toast.show(f"'{tt}' already exists for {cat_id}", C.PEACH)
                dlg.destroy()
                return
            entry = make_default_tool(cat_id, tt)
            self._data[cat_id].append(entry)
            dlg.destroy()
            self._update_badge()
            self._rebuild_tool_cards()
            self._update_sidebar_badges()

        btn_row = tk.Frame(body, bg=C.SURFACE0)
        btn_row.pack(fill="x", pady=(16, 0))
        FlatBtn(btn_row, text="Cancel", command=dlg.destroy,
                bg=C.SURFACE1, hover_bg=C.SURFACE2).pack(side="right", padx=(8, 0))
        accent = self._app.store.site_accent
        FlatBtn(btn_row, text="  Add  ", command=do_add,
                bg=accent, fg=C.CRUST, hover_bg=darken(accent),
                font=F.BODY_BOLD).pack(side="right")

    def _edit_tooltips(self):
        top = self.winfo_toplevel()
        dlg = tk.Toplevel(top)
        dlg.title("Shared Tooltips")
        dlg.configure(bg=C.SURFACE0)
        dlg.resizable(True, True)
        top.update_idletasks()
        w, h = 560, 440
        x = top.winfo_x() + (top.winfo_width() - w) // 2
        y = top.winfo_y() + (top.winfo_height() - h) // 2
        dlg.geometry(f"{w}x{h}+{x}+{y}")
        dlg.minsize(400, 300)
        dlg.transient(top)
        dlg.grab_set()
        dark_title_bar(dlg)

        body = tk.Frame(dlg, bg=C.SURFACE0)
        body.pack(fill="both", expand=True, padx=20, pady=16)

        tk.Label(body, text="Tooltip descriptions shown on hover for each tool type.",
                 bg=C.SURFACE0, fg=C.OVERLAY0, font=F.SMALL).pack(anchor="w", pady=(0, 12))

        current_tooltips = self._data.get("_tooltips", dict(DEFAULT_TOOLTIPS))
        tooltip_vars: dict[str, tk.StringVar] = {}

        for tool_type in TOOL_TYPES:
            row = tk.Frame(body, bg=C.SURFACE0)
            row.pack(fill="x", pady=(0, 8))
            tk.Label(row, text=f"{TOOL_TYPE_LABELS.get(tool_type, tool_type)}:",
                     bg=C.SURFACE0, fg=C.TEXT, font=F.BODY_BOLD,
                     width=12, anchor="w").pack(side="left")
            var = tk.StringVar(value=current_tooltips.get(tool_type, ""))
            tk.Entry(row, textvariable=var, bg=C.SURFACE1, fg=C.TEXT,
                     insertbackground=C.TEXT, font=F.BODY, relief="flat", bd=0,
                     highlightthickness=1, highlightcolor=C.BLUE,
                     highlightbackground=C.SURFACE2).pack(side="left", fill="x", expand=True, padx=(8, 0))
            tooltip_vars[tool_type] = var

        def do_save():
            self._data["_tooltips"] = {k: v.get() for k, v in tooltip_vars.items()}
            self._update_badge()
            dlg.destroy()
            self._app.toast.show("Tooltips updated", C.GREEN, 2000)

        def do_reset():
            for k, v in tooltip_vars.items():
                v.set(DEFAULT_TOOLTIPS.get(k, ""))

        btn_row = tk.Frame(body, bg=C.SURFACE0)
        btn_row.pack(fill="x", pady=(16, 0))
        FlatBtn(btn_row, text="Reset Defaults", command=do_reset,
                bg=C.SURFACE1, hover_bg=C.SURFACE2, font=F.SMALL).pack(side="left")
        FlatBtn(btn_row, text="Cancel", command=dlg.destroy,
                bg=C.SURFACE1, hover_bg=C.SURFACE2).pack(side="right", padx=(8, 0))
        accent = self._app.store.site_accent
        FlatBtn(btn_row, text="  OK  ", command=do_save,
                bg=accent, fg=C.CRUST, hover_bg=darken(accent),
                font=F.BODY_BOLD).pack(side="right")

    def _update_sidebar_badges(self):
        for w in self._sidebar.winfo_children():
            w.destroy()
        self._build_sidebar_contents()
        # Re-highlight current selection
        for cid, lbl in self._cat_btns.items():
            if cid == self._selected_cat:
                lbl.configure(bg=C.SURFACE0, fg=C.TEXT)

    # -- Index Tab -----------------------------------------------------------

    def _build_index_tab(self):
        frame = tk.Frame(self.notebook, bg=C.MANTLE)
        self.notebook.add(frame, text="  Index  ")

        top = tk.Frame(frame, bg=C.MANTLE)
        top.pack(fill="x", padx=16, pady=(12, 0))
        tk.Label(top, text="/hubs/ Dashboard Slots", bg=C.MANTLE, fg=C.TEXT,
                 font=F.HEADING).pack(side="left")
        tk.Label(top, text="  Drag tools into slots to set featured order  "
                           "\u00b7  Empty slots auto-fill at build time",
                 bg=C.MANTLE, fg=C.OVERLAY0, font=F.SMALL).pack(side="left", padx=(8, 0))

        body = tk.Frame(frame, bg=C.MANTLE)
        body.pack(fill="both", expand=True, padx=0, pady=(4, 0))

        # Left sidebar: view selector
        sidebar = tk.Frame(body, bg=C.BASE, width=160)
        sidebar.pack(side="left", fill="y", padx=(16, 0), pady=(8, 8))
        sidebar.pack_propagate(False)

        tk.Label(sidebar, text="VIEW", bg=C.BASE, fg=C.OVERLAY0,
                 font=F.TINY).pack(fill="x", padx=12, pady=(12, 8))

        self._index_view_btns: dict[str, tk.Label] = {}
        views = [("all", "All Tools")] + [
            (t, TOOL_TYPE_LABELS.get(t, t)) for t in TOOL_TYPES]
        for vid, vlabel in views:
            btn_frame = tk.Frame(sidebar, bg=C.BASE)
            btn_frame.pack(fill="x", padx=4, pady=1)
            lbl = tk.Label(btn_frame, text=f"  {vlabel}",
                           bg=C.BASE, fg=C.TEXT, font=F.BODY_BOLD,
                           anchor="w", padx=8, pady=6, cursor="hand2")
            lbl.pack(fill="both", expand=True)
            lbl.bind("<Button-1>", lambda e, v=vid: self._set_index_view(v))
            self._index_view_btns[vid] = lbl

        tk.Frame(sidebar, bg=C.SURFACE2, height=1).pack(fill="x", padx=12, pady=(16, 8))
        tk.Label(sidebar, text="Each view has its own\n6 dashboard slots.\n\n"
                               "Delete/Backspace\nremoves from slot.",
                 bg=C.BASE, fg=C.OVERLAY0, font=F.TINY,
                 justify="left").pack(fill="x", padx=12, pady=(0, 4))

        # Right content: slots + unassigned
        self._index_area = tk.Frame(body, bg=C.MANTLE)
        self._index_area.pack(side="left", fill="both", expand=True, padx=(12, 16), pady=(8, 8))

        self._set_index_view("all")

    def _set_index_view(self, view: str):
        self._index_filter = view
        for vid, lbl in self._index_view_btns.items():
            if vid == view:
                lbl.configure(bg=C.SURFACE0, fg=self._app.store.site_accent)
            else:
                lbl.configure(bg=C.BASE, fg=C.SUBTEXT0)
        self._refresh_index()

    def _refresh_index(self):
        for w in self._index_area.winfo_children():
            w.destroy()
        self._index_lbs = []

        view = self._index_filter
        index_data = self._data.get("_index", {})
        assigned_keys = index_data.get(view, [])

        pool: list[dict] = []
        for cat_id in [c["id"] for c in self._product_cats]:
            for tool in self._data.get(cat_id, []):
                if view != "all" and tool.get("tool") != view:
                    continue
                pool.append({"_cat": cat_id, **tool})

        assigned: list[dict | None] = []
        assigned_set: set[str] = set()
        for key in assigned_keys:
            parts = key.split(":", 1)
            if len(parts) == 2:
                src_cat, src_tool = parts
                found = None
                for t in pool:
                    if t["_cat"] == src_cat and t.get("tool") == src_tool:
                        found = t
                        break
                assigned.append(found)
                if found:
                    assigned_set.add(key)
            else:
                assigned.append(None)

        while len(assigned) < 6:
            assigned.append(None)

        unassigned = [t for t in pool
                      if f"{t['_cat']}:{t.get('tool', '')}" not in assigned_set]

        split = tk.Frame(self._index_area, bg=C.MANTLE)
        split.pack(fill="both", expand=True)

        left = tk.Frame(split, bg=C.MANTLE)
        left.pack(side="left", fill="both", expand=True)

        slots_grid = tk.Frame(left, bg=C.MANTLE)
        slots_grid.pack(fill="both", expand=True)
        for c in range(3):
            slots_grid.columnconfigure(c, weight=1)
        for r in range(2):
            slots_grid.rowconfigure(r, weight=1)

        for i in range(6):
            r, c = divmod(i, 3)
            tool = assigned[i] if i < len(assigned) else None
            self._build_slot(slots_grid, i, tool, r, c)

        sep = tk.Frame(split, bg=C.SURFACE2, width=2)
        sep.pack(side="left", fill="y", padx=12, pady=8)

        right = tk.Frame(split, bg=C.MANTLE, width=240)
        right.pack(side="right", fill="y")
        right.pack_propagate(False)
        self._build_pool(right, unassigned)

    def _build_slot(self, parent, slot_idx: int, tool: dict | None, row: int, col: int):
        has_tool = tool is not None
        is_disabled = has_tool and not tool.get("enabled", True)

        if has_tool:
            cat_id = tool["_cat"]
            color = C.SURFACE2 if is_disabled else self._get_cat_color_by_id(cat_id)
        else:
            color = C.SURFACE2

        card = tk.Frame(parent, bg=C.SURFACE0,
                        highlightthickness=1, highlightbackground=C.CARD_BORDER)
        card.grid(row=row, column=col, padx=6, pady=6, sticky="nsew")

        tk.Frame(card, bg=color, height=3).pack(fill="x")

        hdr = tk.Frame(card, bg=C.SURFACE0)
        hdr.pack(fill="x", padx=12, pady=(8, 4))
        tk.Label(hdr, text=f"Slot {slot_idx + 1}",
                 bg=C.SURFACE0, fg=C.OVERLAY0, font=F.TINY).pack(side="left")

        if has_tool:
            rm_btn = FlatBtn(hdr, text="\u00d7",
                             command=lambda si=slot_idx: self._slot_remove(si),
                             bg=C.SURFACE0, hover_bg=C.SURFACE1, fg=C.RED,
                             font=("Segoe UI", 12), padx=4, pady=0)
            rm_btn.pack(side="right")
            Tip(rm_btn, "Remove from this slot")

        inner = tk.Frame(card, bg=C.SURFACE0)
        inner.pack(fill="both", expand=True, padx=12, pady=(0, 10))

        if has_tool:
            cat_id = tool["_cat"]
            tool_type = tool.get("tool", "?")
            title = tool.get("title", "")
            text_fg = C.OVERLAY0 if is_disabled else C.TEXT

            cat_row = tk.Frame(inner, bg=C.SURFACE0)
            cat_row.pack(anchor="w", fill="x")
            tk.Label(cat_row, text=cat_id.upper(), bg=C.SURFACE0,
                     fg=color, font=F.BODY_BOLD).pack(side="left")
            if is_disabled:
                tk.Label(cat_row, text="OFF", bg=C.SURFACE2, fg=C.OVERLAY0,
                         font=F.TINY, padx=4, pady=1).pack(side="left", padx=(6, 0))
            tk.Label(inner, text=f"{TOOL_TYPE_LABELS.get(tool_type, tool_type)} \u2014 {title}",
                     bg=C.SURFACE0, fg=text_fg, font=F.BODY).pack(anchor="w")
            desc = tool.get("description", "")
            if desc:
                tk.Label(inner, text=shorten(desc, width=40, placeholder="..."),
                         bg=C.SURFACE0, fg=C.OVERLAY0, font=F.TINY).pack(anchor="w", pady=(2, 0))

            icon = tk.Canvas(inner, width=24, height=24, highlightthickness=0, bg=C.SURFACE0)
            icon.pack(anchor="w", pady=(4, 0))
            draw_tool_icon(icon, tool_type, color)
        else:
            tk.Label(inner, text="(empty)", bg=C.SURFACE0,
                     fg=C.SURFACE2, font=F.BODY).pack(anchor="w", pady=(8, 0))
            tk.Label(inner, text="Drag a tool here\nor auto-fills at build",
                     bg=C.SURFACE0, fg=C.SURFACE2, font=F.TINY).pack(anchor="w", pady=(4, 0))

        card._slot_idx = slot_idx
        card._is_slot = True

    def _build_pool(self, parent, items: list[dict]):
        col = tk.Frame(parent, bg=C.SURFACE0,
                       highlightthickness=1, highlightbackground=C.CARD_BORDER)
        col.pack(fill="both", expand=True, padx=0, pady=4)

        tk.Frame(col, bg=C.OVERLAY0, height=3).pack(fill="x")

        hdr = tk.Frame(col, bg=C.SURFACE0)
        hdr.pack(fill="x", padx=12, pady=(10, 2))
        tk.Label(hdr, text="Unassigned", bg=C.SURFACE0,
                 fg=C.OVERLAY0, font=F.BODY_BOLD).pack(side="left")
        tk.Label(hdr, text=str(len(items)), bg=C.OVERLAY0, fg=C.CRUST,
                 font=F.TINY, padx=6, pady=2).pack(side="left", padx=6)

        lb = HoverListbox(col, bg=C.SURFACE0, fg=C.SUBTEXT1,
                          selectbackground=self._app.store.site_accent,
                          selectforeground=C.CRUST,
                          font=F.BODY, width=28, height=24,
                          activestyle="none", relief="flat", bd=0, highlightthickness=0,
                          hover_bg=C.SURFACE1, item_bg=C.SURFACE0)
        lb.pack(fill="both", expand=True, padx=12, pady=(4, 12))

        for idx, t in enumerate(items):
            cat_id = t["_cat"]
            tool_type = t.get("tool", "?")
            title = t.get("title", "")
            is_off = not t.get("enabled", True)
            suffix = "  (off)" if is_off else ""
            display = f"{cat_id}/{tool_type} \u2014 {title}{suffix}"
            lb.insert("end", display)
            if is_off:
                lb.itemconfigure(idx, fg=C.SURFACE2)

        lb._items = items
        lb._is_unassigned = True
        lb.bind("<ButtonPress-1>", lambda e: self._pool_drag_start(e))
        lb.bind("<B1-Motion>", self._pool_drag_motion)
        lb.bind("<ButtonRelease-1>", self._pool_drag_drop)
        self._index_lbs.append(lb)

    # -- Pool drag-and-drop --------------------------------------------------

    def _pool_drag_start(self, event):
        lb = event.widget
        idx = lb.nearest(event.y)
        if idx < 0 or idx >= lb.size() or lb.bbox(idx) is None:
            return
        HoverListbox._global_drag = True
        lb.selection_clear(0, "end")
        lb.selection_set(idx)
        self._drag_src = lb
        self._drag_idx = idx
        self._drag_item = lb._items[idx]

        tool = self._drag_item
        cat_color = self._get_cat_color_by_id(tool["_cat"])
        name = f"{tool['_cat']}/{tool.get('tool', '?')}"
        g = tk.Toplevel(self.winfo_toplevel())
        g.overrideredirect(True)
        g.attributes("-alpha", 0.9)
        g.configure(bg=cat_color)
        tk.Label(g, text=f"  {name}  ", bg=cat_color, fg=C.CRUST,
                 font=F.BODY_BOLD, padx=8, pady=4).pack()
        g.geometry(f"+{event.x_root + 14}+{event.y_root - 10}")
        self._drag_ghost = g

    def _pool_drag_motion(self, event):
        if not self._drag_ghost or not self._drag_item:
            return
        self._drag_ghost.geometry(f"+{event.x_root + 14}+{event.y_root - 10}")

    def _pool_drag_drop(self, event):
        if not self._drag_item or not self._drag_src:
            self._pool_drag_cleanup()
            return

        slot_idx = self._slot_at(event.x_root, event.y_root)
        if slot_idx is not None:
            tool = self._drag_item
            tool_key = f"{tool['_cat']}:{tool.get('tool', '')}"
            view = self._index_filter
            index_data = self._data.setdefault("_index", {})
            slots = index_data.setdefault(view, [])

            if tool_key not in slots:
                while len(slots) < slot_idx:
                    slots.append("")
                if slot_idx < len(slots):
                    if slots[slot_idx] == "":
                        slots[slot_idx] = tool_key
                    else:
                        slots.insert(slot_idx, tool_key)
                else:
                    slots.append(tool_key)
                self._update_badge()

        self._pool_drag_cleanup()
        self._refresh_index()

    def _pool_drag_cleanup(self):
        if self._drag_ghost:
            self._drag_ghost.destroy()
            self._drag_ghost = None
        self._drag_src = self._drag_idx = self._drag_item = None
        HoverListbox._global_drag = False

    def _slot_at(self, x, y) -> int | None:
        for widget in self._index_area.winfo_children():
            for child in widget.winfo_children():
                for sub in child.winfo_children():
                    if hasattr(sub, 'grid_slaves'):
                        for card in sub.winfo_children():
                            if hasattr(card, '_is_slot') and card._is_slot:
                                try:
                                    cx, cy = card.winfo_rootx(), card.winfo_rooty()
                                    cw, ch = card.winfo_width(), card.winfo_height()
                                    if cx <= x <= cx + cw and cy <= y <= cy + ch:
                                        return card._slot_idx
                                except tk.TclError:
                                    pass
        return None

    def _slot_remove(self, slot_idx: int):
        view = self._index_filter
        index_data = self._data.get("_index", {})
        slots = index_data.get(view, [])
        if slot_idx < len(slots):
            slots.pop(slot_idx)
            while slots and slots[-1] == "":
                slots.pop()
            index_data[view] = slots
            self._update_badge()
            self._refresh_index()
