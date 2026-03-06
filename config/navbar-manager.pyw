#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
navbar-manager.py -- Professional GUI for managing navbar content fields.

Reads/writes YAML frontmatter in .md files under src/content/.
Writes config/data/navbar-guide-sections.json.
"""

import ctypes
import json
import re
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
CONTENT = ROOT / "src" / "content"
SECTIONS_JSON = ROOT / "config" / "data" / "navbar-guide-sections.json"
CATEGORIES_JSON = ROOT / "config" / "data" / "categories.json"

# SSOT: read category IDs from config/data/categories.json
def _load_all_categories() -> list[str]:
    if CATEGORIES_JSON.is_file():
        data = json.loads(CATEGORIES_JSON.read_text(encoding="utf-8"))
        return [c["id"] for c in data.get("categories", [])]
    return ["mouse", "keyboard", "monitor", "headset", "mousepad", "controller",
            "hardware", "game", "gpu", "ai"]

def _load_category_defs() -> list[dict]:
    """Load full category definitions for display-only Hubs tab."""
    if CATEGORIES_JSON.is_file():
        data = json.loads(CATEGORIES_JSON.read_text(encoding="utf-8"))
        return data.get("categories", [])
    return []

ALL_CATEGORIES = _load_all_categories()
ALL_CATEGORY_DEFS = _load_category_defs()

# -- Design System -----------------------------------------------------------
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

# SSOT: read category colors from config/data/categories.json
def _load_cat_colors():
    if CATEGORIES_JSON.is_file():
        data = json.loads(CATEGORIES_JSON.read_text(encoding="utf-8"))
        return {c["id"]: c["color"] for c in data.get("categories", [])}
    return {"mouse": "#00aeff", "keyboard": "#EE8B22", "monitor": "#ff69b4",
            "headset": "#a855f7", "mousepad": "#22c55e", "controller": "#ef4444",
            "hardware": "#a6e3a1", "game": "#f9e2af", "gpu": "#74c7ec", "ai": "#cba6f7"}

CAT_COLORS = _load_cat_colors()

# SSOT: read site accent colors from config/data/categories.json
def _load_site_accent():
    if CATEGORIES_JSON.is_file():
        data = json.loads(CATEGORIES_JSON.read_text(encoding="utf-8"))
        sc = data.get("siteColors", {})
        return sc.get("primary", "#89b4fa")
    return "#89b4fa"

def _darken(hex_color: str, factor: float = 0.7) -> str:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"#{int(r*factor):02x}{int(g*factor):02x}{int(b*factor):02x}"

ACCENT = _load_site_accent()
ACCENT_HOVER = _darken(ACCENT)

class F:
    """Font tokens."""
    TITLE = ("Segoe UI", 18, "bold")
    HEADING = ("Segoe UI", 13, "bold")
    SUBHEADING = ("Segoe UI", 11)
    BODY = ("Segoe UI", 10)
    BODY_BOLD = ("Segoe UI", 10, "bold")
    SMALL = ("Segoe UI", 9)
    TINY = ("Segoe UI", 8)


# -- Slug derivation --------------------------------------------------------
def entry_slug(filepath: Path, content_dir: Path) -> str:
    """Derive entry slug from a content file path.

    Handles both layouts:
      slug-folder: games/apex-legends/index.md  → apex-legends
      flat (legacy): games/apex-legends.md      → apex-legends
      nested:  guides/mouse/my-guide/index.md   → mouse/my-guide
    """
    rel = filepath.relative_to(content_dir)
    without_ext = rel.with_suffix("")
    parts = without_ext.parts
    if parts and parts[-1] == "index":
        if len(parts) == 1:
            return ""
        return str(Path(*parts[:-1])).replace("\\", "/")
    return str(without_ext).replace("\\", "/")


def list_content_files(content_dir: Path) -> list[Path]:
    """List all .md and .mdx files in a content directory, recursively."""
    if not content_dir.is_dir():
        return []
    return sorted(
        f for f in content_dir.rglob("*")
        if f.suffix in (".md", ".mdx") and f.is_file()
    )


# -- Frontmatter I/O --------------------------------------------------------
def read_frontmatter(filepath: Path) -> tuple[dict, str]:
    import yaml
    text = filepath.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    fm = yaml.safe_load(parts[1]) or {}
    return fm, text


def write_navbar_field(filepath: Path, value):
    """Targeted write: only update/insert the navbar: field in frontmatter."""
    text = filepath.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    if len(parts) < 3:
        return
    lines = parts[1].split("\n")
    new_lines, skip = [], False
    for line in lines:
        if re.match(r"^navbar:", line):
            skip = True
            continue
        if skip:
            if line.strip() == "" or line.startswith("  ") or line.startswith("\t"):
                if line.strip().startswith("- ") or line.strip() == "" or line.startswith("  "):
                    continue
                else:
                    skip = False
            else:
                skip = False
        new_lines.append(line)
    if isinstance(value, bool):
        nb = [f"navbar: {'true' if value else 'false'}"]
    elif isinstance(value, list):
        nb = ["navbar: []"] if not value else ["navbar:"] + [f"  - {v}" for v in value]
    else:
        nb = [f"navbar: {value}"]
    idx = len(new_lines)
    for i, line in enumerate(new_lines):
        if re.match(r"^(category|guide|game|brand):", line):
            idx = i + 1
            break
    if idx == len(new_lines):
        for i, line in enumerate(new_lines):
            if line.strip() and not line.strip().startswith("#"):
                idx = i + 1
                break
    for j, nl in enumerate(nb):
        new_lines.insert(idx + j, nl)
    filepath.write_text(f"{parts[0]}---{chr(10).join(new_lines)}---{parts[2]}", encoding="utf-8")


def write_field(filepath: Path, key: str, value: str):
    """Targeted write: update a single scalar YAML field in frontmatter."""
    text = filepath.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    if len(parts) < 3:
        return
    lines = parts[1].split("\n")
    needs_quote = any(c in value for c in ':{}[]&*?|>!%@#`') or value != value.strip()
    if needs_quote:
        escaped = value.replace('\\', '\\\\').replace('"', '\\"')
        quoted = f'"{escaped}"'
    else:
        quoted = value
    found = False
    for i, line in enumerate(lines):
        if re.match(rf"^{re.escape(key)}:", line):
            lines[i] = f"{key}: {quoted}"
            found = True
            break
    if not found:
        idx = len(lines)
        for i, line in enumerate(lines):
            if re.match(r"^(title|brand|game|guide|displayName):", line):
                idx = i + 1
                break
        if idx == len(lines):
            for i, line in enumerate(lines):
                if line.strip() and not line.strip().startswith("#"):
                    idx = i + 1
                    break
        lines.insert(idx, f"{key}: {quoted}")
    filepath.write_text(f"{parts[0]}---{chr(10).join(lines)}---{parts[2]}", encoding="utf-8")


# -- Data Loading ------------------------------------------------------------
def load_guides():
    guides = []
    d = CONTENT / "guides"
    if not d.is_dir():
        return guides
    for f in list_content_files(d):
        fm, _ = read_frontmatter(f)
        slug = entry_slug(f, d)
        guides.append({
            "path": f, "filename": slug,
            "category": fm.get("category", ""),
            "guide": fm.get("guide", fm.get("title", slug)),
            "title": fm.get("title", slug),
            "navbar": fm.get("navbar", []),
        })
    return guides

def load_brands():
    brands = []
    d = CONTENT / "brands"
    if not d.is_dir():
        return brands
    for f in list_content_files(d):
        fm, _ = read_frontmatter(f)
        slug = entry_slug(f, d)
        brands.append({
            "path": f, "filename": slug,
            "brand": fm.get("brand", slug),
            "displayName": fm.get("displayName", fm.get("brand", slug)),
            "navbar": fm.get("navbar", []),
        })
    return brands

def load_games():
    games = []
    d = CONTENT / "games"
    if not d.is_dir():
        return games
    for f in list_content_files(d):
        fm, _ = read_frontmatter(f)
        slug = entry_slug(f, d)
        games.append({
            "path": f, "filename": slug,
            "game": fm.get("game", fm.get("title", slug)),
            "title": fm.get("title", slug),
            "navbar": fm.get("navbar", False),
        })
    return games

def load_section_order():
    if SECTIONS_JSON.is_file():
        return json.loads(SECTIONS_JSON.read_text(encoding="utf-8"))
    return {}

def save_section_order(order):
    SECTIONS_JSON.write_text(json.dumps(order, indent=2) + "\n", encoding="utf-8")


# -- Custom Widgets ----------------------------------------------------------
class Toggle(tk.Canvas):
    """iOS-style pill toggle switch."""
    W, H = 46, 24

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


# -- Main Application -------------------------------------------------------
class NavbarManager(tk.Tk):

    def __init__(self):
        super().__init__()
        self.title("EG Navbar Manager")
        sw, sh = self.winfo_screenwidth(), self.winfo_screenheight()
        win_w, win_h = 1536, 864
        self.geometry(f"{win_w}x{win_h}+{(sw-win_w)//2}+{(sh-win_h)//2}")
        self.configure(bg=C.MANTLE)
        self.minsize(960, 640)

        # Dark title bar + branded icon
        self._dark_titlebar()
        try:
            ico = tk.PhotoImage(width=1, height=1)
            ico.put(ACCENT)
            self._icon = ico.zoom(32, 32)
            self.iconphoto(True, self._icon)
        except Exception:
            pass

        self._setup_styles()

        self.guides_data = load_guides()
        self.brands_data = load_brands()
        self.games_data = load_games()
        self.section_order_data = load_section_order()
        self.guide_categories = sorted(set(
            g["category"] for g in self.guides_data if g["category"]
        ))
        self.pending_changes: dict[str, dict] = {}
        self.pending_field_changes: dict[str, dict[str, str]] = {}

        # Drag state
        self._drag_src: tk.Listbox | None = None
        self._drag_idx: int | None = None
        self._drag_item: dict | None = None
        self._drag_ghost: tk.Toplevel | None = None
        self._drag_tab = ""
        self._guide_lbs: list[tk.Listbox] = []
        self._brand_lbs: list[tk.Listbox] = []

        self._build_header()
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(fill="both", expand=True, padx=16, pady=(0, 0))
        self._build_guides_tab()
        self._build_brands_tab()
        self._build_games_tab()
        self._build_hubs_tab()
        self._build_status_bar()
        self.toast = Toast(self)
        self.bind_all("<Control-s>", lambda e: self._save_all())
        self.notebook.bind("<<NotebookTabChanged>>", self._on_tab_change)
        self.protocol("WM_DELETE_WINDOW", self._on_close)

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
        s.configure("TLabel", background=C.MANTLE, foreground=C.TEXT, font=F.BODY)
        s.configure("TRadiobutton", background=C.MANTLE, foreground=C.TEXT, font=F.BODY,
                     focuscolor=C.MANTLE)
        s.map("TRadiobutton", background=[("active", C.SURFACE1)])
        s.configure("Horizontal.TScrollbar",
                     background=C.SURFACE1, troughcolor=C.BASE,
                     borderwidth=0, relief="flat")
        s.map("Horizontal.TScrollbar",
              background=[("active", C.SURFACE2), ("pressed", C.OVERLAY0)])

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
        tk.Label(inner, text="  Navbar Manager", bg=C.CRUST, fg=C.TEXT,
                 font=("Segoe UI", 14)).pack(side="left")
        tk.Label(inner, text=f"  ·  {ROOT.name}", bg=C.CRUST, fg=C.OVERLAY0,
                 font=F.BODY).pack(side="left", padx=(4, 0))
        self.save_btn = FlatBtn(inner, text="  Save All  ", command=self._save_all,
                                bg=ACCENT, fg=C.CRUST, hover_bg=ACCENT_HOVER,
                                font=F.BODY_BOLD)
        self.save_btn.pack(side="right", pady=4)
        self.changes_lbl = tk.Label(inner, text="", bg=C.CRUST, fg=C.PEACH, font=F.SMALL)
        self.changes_lbl.pack(side="right", padx=8)

    # -- Status Bar ----------------------------------------------------------
    def _build_status_bar(self):
        bar = tk.Frame(self, bg=C.CRUST, height=32)
        bar.pack(fill="x", side="bottom")
        bar.pack_propagate(False)
        self.status_var = tk.StringVar(value="  Ready  ·  Ctrl+S to save")
        tk.Label(bar, textvariable=self.status_var, bg=C.CRUST, fg=C.OVERLAY0,
                 font=F.TINY, padx=20).pack(side="left", fill="y")
        tk.Label(bar, text=f"{len(self.guides_data)} guides  ·  "
                 f"{len(self.brands_data)} brands  ·  "
                 f"{len(self.games_data)} games",
                 bg=C.CRUST, fg=C.SURFACE2, font=F.TINY, padx=20).pack(side="right", fill="y")

    def _update_badge(self):
        n = len(self.pending_changes) + len(self.pending_field_changes)
        if n > 0:
            self.changes_lbl.configure(
                text=f"{n} unsaved change{'s' if n != 1 else ''}", fg=C.PEACH)
        else:
            self.changes_lbl.configure(text="", fg=C.GREEN)

    # -- Window helpers ------------------------------------------------------
    def _dark_titlebar(self, window=None):
        if sys.platform != "win32":
            return
        w = window or self
        try:
            w.update_idletasks()
            hwnd = ctypes.windll.user32.GetParent(w.winfo_id())
            val = ctypes.c_int(1)
            ctypes.windll.dwmapi.DwmSetWindowAttribute(
                hwnd, 20, ctypes.byref(val), ctypes.sizeof(val))
        except Exception:
            pass

    def _on_close(self):
        has_changes = bool(self.pending_changes) or bool(self.pending_field_changes)
        if not has_changes:
            has_changes = self.section_order_data != load_section_order()
        if has_changes:
            if not messagebox.askyesno(
                    "Unsaved Changes",
                    "You have unsaved changes.\n\nExit without saving?",
                    parent=self):
                return
        self.destroy()

    def _on_tab_change(self, e=None):
        try:
            tab = self.notebook.index("current")
        except Exception:
            return
        hints = [
            "Drag between columns to reassign  ·  < > reorder sections  ·  Del key unassigns  ·  Double-click to rename",
            "Drag from pool to add  ·  Drag to pool or Del key to remove  ·  Double-click to rename",
            "Toggle games on/off  ·  Toggle All for bulk changes  ·  Double-click to rename",
            "Display only  ·  Use Category Manager to change activation flags",
        ]
        if 0 <= tab < len(hints):
            self.status_var.set(f"  {hints[tab]}  ·  Ctrl+S to save")

    # ========================================================================
    # SHARED DRAG-AND-DROP
    # ========================================================================
    def _active_lbs(self):
        if self._drag_tab == "guides":
            return self._guide_lbs
        if self._drag_tab == "brands":
            return self._brand_lbs
        return []

    def _drag_start(self, event, tab):
        lb = event.widget
        idx = lb.nearest(event.y)
        if idx < 0 or idx >= lb.size() or lb.bbox(idx) is None:
            return
        lb.selection_clear(0, "end")
        lb.selection_set(idx)
        self._drag_src = lb
        self._drag_idx = idx
        self._drag_item = lb._items[idx]
        self._drag_tab = tab
        # WHY: ghost is NOT created here — deferred to _drag_motion so that
        # double-click (no motion) never spawns a toplevel or triggers refresh.

    def _drag_motion(self, event):
        if not self._drag_item:
            return
        # Create ghost on first motion (deferred from _drag_start)
        if not self._drag_ghost:
            HoverListbox._global_drag = True
            name = self._drag_item.get("guide",
                   self._drag_item.get("displayName",
                   self._drag_item.get("brand",
                   self._drag_item.get("title", ""))))
            g = tk.Toplevel(self)
            g.overrideredirect(True)
            g.attributes("-alpha", 0.9)
            g.configure(bg=ACCENT)
            tk.Label(g, text=f"  {name}  ", bg=ACCENT, fg=C.CRUST,
                     font=F.BODY_BOLD, padx=8, pady=4).pack()
            self._drag_ghost = g
        self._drag_ghost.geometry(f"+{event.x_root + 14}+{event.y_root - 10}")
        tgt = self._lb_at(event.x_root, event.y_root)
        for lb in self._active_lbs():
            lb.configure(bg=C.SURFACE0)
        if tgt and tgt != self._drag_src:
            tgt.configure(bg=C.DROP)

    def _lb_at(self, x, y):
        for lb in self._active_lbs():
            try:
                lx, ly = lb.winfo_rootx(), lb.winfo_rooty()
                if lx <= x <= lx + lb.winfo_width() and ly <= y <= ly + lb.winfo_height():
                    return lb
            except tk.TclError:
                pass
        return None

    def _drag_cleanup(self):
        if self._drag_ghost:
            self._drag_ghost.destroy()
            self._drag_ghost = None
        self._drag_src = self._drag_idx = self._drag_item = None
        HoverListbox._global_drag = False
        for lbs in [self._guide_lbs, self._brand_lbs]:
            for lb in lbs:
                try:
                    lb.configure(bg=C.SURFACE0)
                except tk.TclError:
                    pass

    # ========================================================================
    # GUIDES TAB
    # ========================================================================
    def _build_guides_tab(self):
        frame = ttk.Frame(self.notebook)
        self.notebook.add(frame, text="  Guides  ")
        top = tk.Frame(frame, bg=C.MANTLE)
        top.pack(fill="x", padx=16, pady=(16, 8))

        # Category pills
        pill_row = tk.Frame(top, bg=C.MANTLE)
        pill_row.pack(side="left")
        tk.Label(pill_row, text="Category", bg=C.MANTLE, fg=C.OVERLAY0,
                 font=F.SMALL).pack(side="left", padx=(0, 12))
        default = self.guide_categories[0] if self.guide_categories else "mouse"
        self.guide_cat_var = tk.StringVar(value=default)
        self._cat_pills: list[tk.Frame] = []
        for cat in self.guide_categories:
            self._make_pill(pill_row, cat, self.guide_cat_var, self._on_cat_click)

        # Action buttons
        acts = tk.Frame(top, bg=C.MANTLE)
        acts.pack(side="right")
        FlatBtn(acts, text="+ Add Section", command=self._add_section).pack(side="left", padx=3)
        FlatBtn(acts, text="Rename", command=self._rename_section).pack(side="left", padx=3)
        FlatBtn(acts, text="Delete", command=self._delete_section,
                fg=C.RED, hover_bg=C.SURFACE2).pack(side="left", padx=3)

        self.guides_area = tk.Frame(frame, bg=C.MANTLE)
        self.guides_area.pack(fill="both", expand=True, padx=16, pady=(0, 16))
        self.guide_sections: dict[str, list[dict]] = {}
        self._init_guide_sections()
        self._refresh_guides()

    def _make_pill(self, parent, cat, var, cmd):
        color = CAT_COLORS.get(cat, ACCENT)
        pill = tk.Frame(parent, bg=C.MANTLE, cursor="hand2")
        pill.pack(side="left", padx=2)
        dot = tk.Canvas(pill, width=10, height=10, highlightthickness=0, bg=C.MANTLE)
        dot.pack(side="left", padx=(10, 4), pady=8)
        dot.create_oval(1, 1, 9, 9, fill=color, outline="")
        lbl = tk.Label(pill, text=cat.title(), fg=C.SUBTEXT0, bg=C.MANTLE,
                       font=F.BODY_BOLD, padx=4, pady=8)
        lbl.pack(side="left", padx=(0, 10))
        pill._cat, pill._color, pill._dot, pill._lbl = cat, color, dot, lbl
        self._cat_pills.append(pill)

        def click(e, c=cat):
            var.set(c)
            cmd()
        def enter(e, p=pill):
            if p._cat != var.get():
                for w in (p, p._dot, p._lbl):
                    w.configure(bg=C.SURFACE1)
        def leave(e):
            self._sync_pills()
        for w in (pill, dot, lbl):
            w.bind("<Button-1>", click)
            w.bind("<Enter>", enter)
            w.bind("<Leave>", leave)
        self._sync_pills()

    def _sync_pills(self):
        active = self.guide_cat_var.get()
        for p in self._cat_pills:
            is_active = p._cat == active
            bg = C.SURFACE2 if is_active else C.MANTLE
            fg = p._color if is_active else C.SUBTEXT0
            for w in (p, p._dot, p._lbl):
                w.configure(bg=bg)
            p._lbl.configure(fg=fg)

    def _on_cat_click(self):
        self._sync_pills()
        self._refresh_guides()

    def _init_guide_sections(self):
        for cat in self.guide_categories:
            buckets: dict[str, list] = {"Unassigned": []}
            for g in self.guides_data:
                if g["category"] != cat:
                    continue
                nb = g["navbar"]
                if isinstance(nb, list) and nb:
                    sec = nb[0]
                    buckets.setdefault(sec, []).append(g)
                else:
                    buckets["Unassigned"].append(g)
            saved = self.section_order_data.get(cat, [])
            ordered, seen = [], set()
            for name in saved:
                if name != "Unassigned":
                    ordered.append({"name": name, "items": buckets.get(name, [])})
                    seen.add(name)
            for name in sorted(buckets):
                if name not in seen and name != "Unassigned":
                    ordered.append({"name": name, "items": buckets[name]})
            ordered.append({"name": "Unassigned", "items": buckets.get("Unassigned", [])})
            self.guide_sections[cat] = ordered

    def _find_sec(self, cat, name):
        for s in self.guide_sections.get(cat, []):
            if s["name"] == name:
                return s
        return None

    def _refresh_guides(self):
        for w in self.guides_area.winfo_children():
            w.destroy()
        cat = self.guide_cat_var.get()
        sections = self.guide_sections.get(cat, [])
        self._guide_lbs = []
        accent = CAT_COLORS.get(cat, ACCENT)

        # Split layout: scrollable section columns (left) | gap | Unassigned pool (right)
        named = [s for s in sections if s["name"] != "Unassigned"]
        ua = next((s for s in sections if s["name"] == "Unassigned"), {"name": "Unassigned", "items": []})

        split = tk.Frame(self.guides_area, bg=C.MANTLE)
        split.pack(fill="both", expand=True)

        # Left: scrollable section columns
        left = tk.Frame(split, bg=C.MANTLE)
        left.pack(side="left", fill="both", expand=True)
        canvas = tk.Canvas(left, bg=C.MANTLE, highlightthickness=0)
        xsb = ttk.Scrollbar(left, orient="horizontal", command=canvas.xview)
        inner = tk.Frame(canvas, bg=C.MANTLE)
        inner.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=inner, anchor="nw")
        canvas.configure(xscrollcommand=xsb.set)
        canvas.pack(fill="both", expand=True)
        xsb.pack(fill="x")

        for ci, section in enumerate(named):
            name = section["name"]
            items = sorted(section["items"], key=lambda x: x.get("guide", x.get("title", "")))
            section["items"] = items
            self._guide_col(inner, name, accent, items, cat, ci, len(named))

        # Separator
        sep = tk.Frame(split, bg=C.SURFACE2, width=2)
        sep.pack(side="left", fill="y", padx=20, pady=8)

        # Right: Unassigned pool (fixed)
        ua_items = sorted(ua["items"], key=lambda x: x.get("guide", x.get("title", "")))
        ua["items"] = ua_items
        right = tk.Frame(split, bg=C.MANTLE)
        right.pack(side="right", fill="y")
        self._guide_col(right, "Unassigned", C.OVERLAY0, ua_items, cat, -1, -1)

    def _guide_col(self, parent, name, color, items, cat, ci, total):
        is_ua = name == "Unassigned"
        col = tk.Frame(parent, bg=C.SURFACE0,
                       highlightthickness=1, highlightbackground=C.CARD_BORDER)
        col.pack(side="left", fill="y", padx=6, pady=4)
        tk.Frame(col, bg=C.OVERLAY0 if is_ua else color, height=3).pack(fill="x")
        hdr = tk.Frame(col, bg=C.SURFACE0)
        hdr.pack(fill="x", padx=12, pady=(10, 2))
        if not is_ua:
            FlatBtn(hdr, text=" < ", command=lambda i=ci: self._move_sec(i, -1),
                    bg=C.SURFACE0, hover_bg=C.SURFACE1, font=F.TINY,
                    padx=4, pady=2).pack(side="left")
        tk.Label(hdr, text=name, bg=C.SURFACE0,
                 fg=C.OVERLAY0 if is_ua else C.TEXT,
                 font=F.BODY_BOLD).pack(side="left", padx=4)
        badge_bg = C.OVERLAY0 if is_ua else color
        tk.Label(hdr, text=str(len(items)), bg=badge_bg, fg=C.CRUST,
                 font=F.TINY, padx=6, pady=2).pack(side="left", padx=4)
        if not is_ua:
            FlatBtn(hdr, text=" > ", command=lambda i=ci: self._move_sec(i, +1),
                    bg=C.SURFACE0, hover_bg=C.SURFACE1, font=F.TINY,
                    padx=4, pady=2).pack(side="left")
        lb = HoverListbox(col, bg=C.SURFACE0, fg=C.SUBTEXT1,
                          selectbackground=C.BLUE, selectforeground=C.CRUST,
                          font=F.BODY, width=28, height=18,
                          activestyle="none", relief="flat", bd=0, highlightthickness=0,
                          hover_bg=C.SURFACE1, item_bg=C.SURFACE0)
        lb.pack(fill="both", expand=True, padx=12, pady=(4, 12))
        for it in items:
            lb.insert("end", it.get("guide", it.get("title", it["filename"])))
        lb._section_name = name
        lb._category = cat
        lb._items = items
        lb.bind("<ButtonPress-1>", lambda e: self._drag_start(e, "guides"))
        lb.bind("<B1-Motion>", self._drag_motion)
        lb.bind("<ButtonRelease-1>", self._on_guide_drop)
        lb.bind("<Double-Button-1>", lambda e, l=lb: self._on_guide_dblclick(e, l))
        self._guide_lbs.append(lb)

    def _on_guide_drop(self, event):
        if not self._drag_item or not self._drag_src or self._drag_tab != "guides":
            self._drag_cleanup()
            return
        dropped = False
        tgt = self._lb_at(event.x_root, event.y_root)
        if tgt and tgt != self._drag_src:
            g = self._drag_item
            cat = self._drag_src._category
            src = self._find_sec(cat, self._drag_src._section_name)
            dst = self._find_sec(cat, tgt._section_name)
            if src and dst and g in src["items"]:
                src["items"].remove(g)
                dst["items"].append(g)
                target = tgt._section_name
                g["navbar"] = [] if target == "Unassigned" else [target]
                self.pending_changes[str(g["path"])] = {"navbar": g["navbar"], "type": "list"}
                self._update_badge()
                dropped = True
        self._drag_cleanup()
        if dropped:
            self._refresh_guides()

    def _move_sec(self, ci, direction):
        cat = self.guide_cat_var.get()
        secs = self.guide_sections[cat]
        named = sum(1 for s in secs if s["name"] != "Unassigned")
        ni = ci + direction
        if ni < 0 or ni >= named:
            return
        secs[ci], secs[ni] = secs[ni], secs[ci]
        self.section_order_data[cat] = [s["name"] for s in secs if s["name"] != "Unassigned"]
        self._refresh_guides()

    # -- Guide section dialogs -----------------------------------------------
    def _dialog(self, title, w=360, h=200):
        dlg = tk.Toplevel(self)
        dlg.title(title)
        dlg.configure(bg=C.SURFACE0)
        dlg.resizable(False, False)
        self.update_idletasks()
        x = self.winfo_x() + (self.winfo_width() - w) // 2
        y = self.winfo_y() + (self.winfo_height() - h) // 2
        dlg.geometry(f"{w}x{h}+{x}+{y}")
        dlg.transient(self)
        dlg.grab_set()
        self._dark_titlebar(dlg)
        return dlg

    def _styled_entry(self, parent, width=30):
        return tk.Entry(parent, bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
                        font=F.BODY, relief="flat", bd=0, highlightthickness=1,
                        highlightcolor=C.BLUE, highlightbackground=C.SURFACE2,
                        width=width)

    def _add_section(self):
        cat = self.guide_cat_var.get()
        dlg = self._dialog("Add Section", 380, 160)
        body = tk.Frame(dlg, bg=C.SURFACE0)
        body.pack(fill="both", expand=True, padx=20, pady=16)
        tk.Label(body, text="Section name", bg=C.SURFACE0, fg=C.SUBTEXT0,
                 font=F.SMALL).pack(anchor="w", pady=(0, 4))
        entry = self._styled_entry(body)
        entry.pack(fill="x", ipady=4)
        entry.focus_set()

        def do():
            name = entry.get().strip()
            if not name:
                dlg.destroy()
                return
            if self._find_sec(cat, name):
                messagebox.showwarning("Exists", f"'{name}' already exists.", parent=dlg)
                return
            secs = self.guide_sections[cat]
            ui = next((i for i, s in enumerate(secs) if s["name"] == "Unassigned"), len(secs))
            secs.insert(ui, {"name": name, "items": []})
            self.section_order_data[cat] = [s["name"] for s in secs if s["name"] != "Unassigned"]
            dlg.destroy()
            self._refresh_guides()

        entry.bind("<Return>", lambda e: do())
        btn_row = tk.Frame(body, bg=C.SURFACE0)
        btn_row.pack(fill="x", pady=(16, 0))
        FlatBtn(btn_row, text="Cancel", command=dlg.destroy,
                bg=C.SURFACE1, hover_bg=C.SURFACE2).pack(side="right", padx=(8, 0))
        FlatBtn(btn_row, text="  Add  ", command=do,
                bg=ACCENT, fg=C.CRUST, hover_bg=ACCENT_HOVER).pack(side="right")

    def _delete_section(self):
        cat = self.guide_cat_var.get()
        secs = self.guide_sections[cat]
        deletable = [s for s in secs if s["name"] != "Unassigned"]
        if not deletable:
            return
        dlg = self._dialog("Delete Section", 380, 320)
        body = tk.Frame(dlg, bg=C.SURFACE0)
        body.pack(fill="both", expand=True, padx=20, pady=16)
        tk.Label(body, text="Select section to delete", bg=C.SURFACE0, fg=C.SUBTEXT0,
                 font=F.SMALL).pack(anchor="w", pady=(0, 4))
        lb = tk.Listbox(body, bg=C.SURFACE1, fg=C.TEXT, selectbackground=C.BLUE,
                        selectforeground=C.CRUST, font=F.BODY, height=6,
                        relief="flat", highlightthickness=0, activestyle="none")
        lb.pack(fill="both", expand=True)
        for s in deletable:
            lb.insert("end", f"  {s['name']}  ({len(s['items'])} items)")

        def do():
            sel = lb.curselection()
            if not sel:
                dlg.destroy()
                return
            target = deletable[sel[0]]
            ua = self._find_sec(cat, "Unassigned")
            for g in target["items"]:
                g["navbar"] = []
                self.pending_changes[str(g["path"])] = {"navbar": [], "type": "list"}
                if ua:
                    ua["items"].append(g)
            secs.remove(target)
            self.section_order_data[cat] = [s["name"] for s in secs if s["name"] != "Unassigned"]
            self._update_badge()
            dlg.destroy()
            self._refresh_guides()

        btn_row = tk.Frame(body, bg=C.SURFACE0)
        btn_row.pack(fill="x", pady=(12, 0))
        FlatBtn(btn_row, text="Cancel", command=dlg.destroy,
                bg=C.SURFACE1, hover_bg=C.SURFACE2).pack(side="right", padx=(8, 0))
        FlatBtn(btn_row, text="  Delete  ", command=do,
                bg=C.RED, fg=C.CRUST, hover_bg="#e06080").pack(side="right")

    def _rename_section(self):
        cat = self.guide_cat_var.get()
        secs = self.guide_sections[cat]
        renamable = [s for s in secs if s["name"] != "Unassigned"]
        if not renamable:
            return
        dlg = self._dialog("Rename Section", 380, 360)
        body = tk.Frame(dlg, bg=C.SURFACE0)
        body.pack(fill="both", expand=True, padx=20, pady=16)
        tk.Label(body, text="Select section", bg=C.SURFACE0, fg=C.SUBTEXT0,
                 font=F.SMALL).pack(anchor="w", pady=(0, 4))
        lb = tk.Listbox(body, bg=C.SURFACE1, fg=C.TEXT, selectbackground=C.BLUE,
                        selectforeground=C.CRUST, font=F.BODY, height=5,
                        relief="flat", highlightthickness=0, activestyle="none")
        lb.pack(fill="both", expand=True)
        for s in renamable:
            lb.insert("end", f"  {s['name']}")
        tk.Label(body, text="New name", bg=C.SURFACE0, fg=C.SUBTEXT0,
                 font=F.SMALL).pack(anchor="w", pady=(12, 4))
        entry = self._styled_entry(body)
        entry.pack(fill="x", ipady=4)

        def do():
            sel = lb.curselection()
            if not sel:
                dlg.destroy()
                return
            target = renamable[sel[0]]
            new_name = entry.get().strip()
            if not new_name or new_name == target["name"]:
                dlg.destroy()
                return
            if self._find_sec(cat, new_name):
                messagebox.showwarning("Exists", f"'{new_name}' already exists.", parent=dlg)
                return
            target["name"] = new_name
            for g in target["items"]:
                g["navbar"] = [new_name]
                self.pending_changes[str(g["path"])] = {"navbar": [new_name], "type": "list"}
            self.section_order_data[cat] = [s["name"] for s in secs if s["name"] != "Unassigned"]
            self._update_badge()
            dlg.destroy()
            self._refresh_guides()

        btn_row = tk.Frame(body, bg=C.SURFACE0)
        btn_row.pack(fill="x", pady=(12, 0))
        FlatBtn(btn_row, text="Cancel", command=dlg.destroy,
                bg=C.SURFACE1, hover_bg=C.SURFACE2).pack(side="right", padx=(8, 0))
        FlatBtn(btn_row, text="  Rename  ", command=do,
                bg=ACCENT, fg=C.CRUST, hover_bg=ACCENT_HOVER).pack(side="right")

    # ========================================================================
    # BRANDS TAB
    # ========================================================================
    def _build_brands_tab(self):
        frame = ttk.Frame(self.notebook)
        self.notebook.add(frame, text="  Brands  ")
        top = tk.Frame(frame, bg=C.MANTLE)
        top.pack(fill="x", padx=16, pady=(16, 8))
        tk.Label(top, text="Brands", bg=C.MANTLE, fg=C.TEXT, font=F.HEADING).pack(side="left")
        tk.Label(top, text=str(len(self.brands_data)), bg=ACCENT, fg=C.CRUST,
                 font=F.TINY, padx=6, pady=2).pack(side="left", padx=(10, 0))

        self.brands_area = tk.Frame(frame, bg=C.MANTLE)
        self.brands_area.pack(fill="both", expand=True, padx=16, pady=(0, 16))
        self._refresh_brands()

    def _refresh_brands(self):
        for w in self.brands_area.winfo_children():
            w.destroy()
        self._brand_lbs = []
        cat_brands = {c: [] for c in ALL_CATEGORIES}
        for b in self.brands_data:
            nb = b["navbar"] or []
            for c in nb:
                if c in cat_brands:
                    cat_brands[c].append(b)
        for c in ALL_CATEGORIES:
            cat_brands[c].sort(key=lambda x: x["brand"].lower())
        # "All Brands" = full alphabetical source pool (always every brand)
        all_sorted = sorted(self.brands_data, key=lambda x: x["brand"].lower())

        # Split layout: scrollable category columns (left) | gap | All Brands pool (right)
        split = tk.Frame(self.brands_area, bg=C.MANTLE)
        split.pack(fill="both", expand=True)

        # Left: scrollable category columns
        left = tk.Frame(split, bg=C.MANTLE)
        left.pack(side="left", fill="both", expand=True)
        canvas = tk.Canvas(left, bg=C.MANTLE, highlightthickness=0)
        xsb = ttk.Scrollbar(left, orient="horizontal", command=canvas.xview)
        inner = tk.Frame(canvas, bg=C.MANTLE)
        inner.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=inner, anchor="nw")
        canvas.configure(xscrollcommand=xsb.set)
        canvas.pack(fill="both", expand=True)
        xsb.pack(fill="x")

        for cat in ALL_CATEGORIES:
            items = cat_brands[cat]
            color = CAT_COLORS.get(cat, ACCENT)
            self._brand_column(inner, cat.title(), color, items, cat, False)

        # Separator
        sep = tk.Frame(split, bg=C.SURFACE2, width=2)
        sep.pack(side="left", fill="y", padx=20, pady=8)

        # Right: All Brands pool (fixed)
        right = tk.Frame(split, bg=C.MANTLE)
        right.pack(side="right", fill="y")
        self._brand_column(right, "All Brands", C.SUBTEXT0, all_sorted, "_all", True)

    def _brand_column(self, parent, title, color, items, col_name, is_ua):
        col = tk.Frame(parent, bg=C.SURFACE0,
                       highlightthickness=1, highlightbackground=C.CARD_BORDER)
        col.pack(side="left", fill="y", padx=6, pady=4)
        tk.Frame(col, bg=color, height=3).pack(fill="x")
        hdr = tk.Frame(col, bg=C.SURFACE0)
        hdr.pack(fill="x", padx=12, pady=(10, 2))
        tk.Label(hdr, text=title, bg=C.SURFACE0,
                 fg=C.OVERLAY0 if is_ua else C.TEXT,
                 font=F.BODY_BOLD).pack(side="left")
        tk.Label(hdr, text=str(len(items)), bg=color, fg=C.CRUST,
                 font=F.TINY, padx=6, pady=2).pack(side="left", padx=6)

        lb = HoverListbox(col, bg=C.SURFACE0, fg=C.SUBTEXT1,
                          selectbackground=C.BLUE, selectforeground=C.CRUST,
                          font=F.BODY, width=22, height=20,
                          activestyle="none", relief="flat", bd=0, highlightthickness=0,
                          hover_bg=C.SURFACE1, item_bg=C.SURFACE0)
        lb.pack(fill="both", expand=True, padx=12, pady=(4, 12))
        for b in items:
            lb.insert("end", b["displayName"])
        lb._col_name = col_name
        lb._items = items
        lb._is_unassigned = is_ua
        lb.bind("<ButtonPress-1>", lambda e: self._drag_start(e, "brands"))
        lb.bind("<B1-Motion>", self._drag_motion)
        lb.bind("<ButtonRelease-1>", self._on_brand_drop)
        lb.bind("<Double-Button-1>", lambda e, l=lb: self._on_brand_dblclick(e, l))
        if not is_ua:
            lb.bind("<Delete>", self._on_brand_del)
            lb.bind("<BackSpace>", self._on_brand_del)
        self._brand_lbs.append(lb)

    def _on_brand_drop(self, event):
        if not self._drag_item or not self._drag_src or self._drag_tab != "brands":
            self._drag_cleanup()
            return
        dropped = False
        tgt = self._lb_at(event.x_root, event.y_root)
        if tgt and tgt != self._drag_src:
            brand = self._drag_item
            tc = tgt._col_name
            sc = self._drag_src._col_name
            nb = list(brand["navbar"] or [])
            if tc == "_all":
                # Dropping back to "All Brands" from a category = remove that source category
                if sc != "_all" and sc in nb:
                    nb.remove(sc)
                    brand["navbar"] = nb
                    self.pending_changes[str(brand["path"])] = {"navbar": nb, "type": "list"}
                    self._update_badge()
                    dropped = True
            elif tc in nb:
                # Already in this category — notify user
                self.toast.show(
                    f"{brand['displayName']} is already in {tc.title()}", C.OVERLAY0, 2000)
            else:
                nb.append(tc)
                brand["navbar"] = nb
                self.pending_changes[str(brand["path"])] = {"navbar": nb, "type": "list"}
                self._update_badge()
                dropped = True
        self._drag_cleanup()
        if dropped:
            self._refresh_brands()

    def _on_brand_del(self, event):
        lb = event.widget
        if lb._is_unassigned:
            return
        sel = lb.curselection()
        if not sel:
            return
        brand = lb._items[sel[0]]
        cat = lb._col_name
        nb = list(brand["navbar"] or [])
        if cat in nb:
            nb.remove(cat)
            brand["navbar"] = nb
            self.pending_changes[str(brand["path"])] = {"navbar": nb, "type": "list"}
            self._update_badge()
            self._refresh_brands()

    # ========================================================================
    # GAMES TAB
    # ========================================================================
    def _build_games_tab(self):
        frame = ttk.Frame(self.notebook)
        self.notebook.add(frame, text="  Games  ")

        top = tk.Frame(frame, bg=C.MANTLE)
        top.pack(fill="x", padx=24, pady=(20, 12))
        tk.Label(top, text="Games", bg=C.MANTLE, fg=C.TEXT,
                 font=F.HEADING).pack(side="left")
        tk.Label(top, text=str(len(self.games_data)), bg=ACCENT, fg=C.CRUST,
                 font=F.TINY, padx=6, pady=2).pack(side="left", padx=(10, 0))
        FlatBtn(top, text="Toggle All", command=self._toggle_all_games).pack(side="right")

        grid = tk.Frame(frame, bg=C.MANTLE)
        grid.pack(fill="both", expand=True, padx=24, pady=(0, 20))
        self.game_toggles: list[Toggle] = []
        self.game_labels: list[tk.Label] = []

        cols = 3
        for i, g in enumerate(self.games_data):
            r, c = divmod(i, cols)
            card = tk.Frame(grid, bg=C.SURFACE0,
                            highlightthickness=1, highlightbackground=C.CARD_BORDER)
            card.grid(row=r, column=c, padx=6, pady=6, sticky="ew")
            grid.columnconfigure(c, weight=1)
            # Left accent
            tk.Frame(card, bg=ACCENT, width=3).pack(side="left", fill="y")
            inner = tk.Frame(card, bg=C.SURFACE0)
            inner.pack(side="left", fill="both", expand=True, padx=16, pady=14)
            lbl = tk.Label(inner, text=g["game"], bg=C.SURFACE0, fg=C.TEXT,
                           font=F.BODY_BOLD, anchor="w", cursor="hand2")
            lbl.pack(side="left", fill="x", expand=True)
            lbl.bind("<Double-Button-1>", lambda e, idx=i: self._rename_game(idx))
            self.game_labels.append(lbl)
            t = Toggle(inner, initial=bool(g["navbar"]),
                       on_toggle=lambda v, idx=i: self._on_game_toggle(idx, v),
                       bg=C.SURFACE0)
            t.pack(side="right")
            self.game_toggles.append(t)
            # Card hover
            for w in (card, inner, lbl):
                w.bind("<Enter>", lambda e, cd=card, inn=inner, lb=lbl: (
                    cd.configure(bg=C.SURFACE1), inn.configure(bg=C.SURFACE1),
                    lb.configure(bg=C.SURFACE1)))
                w.bind("<Leave>", lambda e, cd=card, inn=inner, lb=lbl: (
                    cd.configure(bg=C.SURFACE0), inn.configure(bg=C.SURFACE0),
                    lb.configure(bg=C.SURFACE0)))

    def _on_game_toggle(self, idx, val):
        g = self.games_data[idx]
        g["navbar"] = val
        self.pending_changes[str(g["path"])] = {"navbar": val, "type": "bool"}
        self._update_badge()

    def _toggle_all_games(self):
        any_off = any(not t.get() for t in self.game_toggles)
        for i, t in enumerate(self.game_toggles):
            t.set(any_off)
            self._on_game_toggle(i, any_off)

    # ========================================================================
    # HUBS TAB (display-only — reflects categories.json activation flags)
    # ========================================================================
    def _build_hubs_tab(self):
        frame = ttk.Frame(self.notebook)
        self.notebook.add(frame, text="  Hubs  ")

        top = tk.Frame(frame, bg=C.MANTLE)
        top.pack(fill="x", padx=24, pady=(20, 12))
        tk.Label(top, text="Hub Categories", bg=C.MANTLE, fg=C.TEXT,
                 font=F.HEADING).pack(side="left")
        tk.Label(top, text=str(len(ALL_CATEGORIES)), bg=ACCENT, fg=C.CRUST,
                 font=F.TINY, padx=6, pady=2).pack(side="left", padx=(10, 0))

        # WHY display-only: hubs in the navbar are driven by categories.json
        # product flags via config.ts → GlobalNav.astro. There is no separate
        # hubs toggle — use Category Manager to change activation flags.
        note = tk.Frame(top, bg=C.MANTLE)
        note.pack(side="right")
        tk.Label(note, text="Read-only  ·  Use Category Manager to edit flags",
                 bg=C.MANTLE, fg=C.OVERLAY0, font=F.SMALL).pack(side="left")

        container = tk.Frame(frame, bg=C.MANTLE)
        container.pack(fill="both", expand=True, padx=24, pady=(0, 20))

        for cat_def in ALL_CATEGORY_DEFS:
            cat = cat_def["id"]
            color = CAT_COLORS.get(cat, ACCENT)
            prod = cat_def.get("product", {})
            prod_on = prod.get("production", False)
            prod_vite = prod.get("vite", False)

            card = tk.Frame(container, bg=C.SURFACE0,
                            highlightthickness=1, highlightbackground=C.CARD_BORDER)
            card.pack(fill="x", pady=5)
            tk.Frame(card, bg=color, width=3).pack(side="left", fill="y")
            inner = tk.Frame(card, bg=C.SURFACE0)
            inner.pack(side="left", fill="both", expand=True, padx=16, pady=12)

            # Category dot + name
            dot = tk.Canvas(inner, width=12, height=12, highlightthickness=0, bg=C.SURFACE0)
            dot.pack(side="left", padx=(0, 10))
            dot.create_oval(1, 1, 11, 11, fill=color, outline="")
            tk.Label(inner, text=cat_def.get("label", cat.title()), bg=C.SURFACE0,
                     fg=C.TEXT, font=F.BODY_BOLD, anchor="w").pack(side="left")

            # Status badges (right side)
            badges = tk.Frame(inner, bg=C.SURFACE0)
            badges.pack(side="right")

            def _badge(parent, text, active, bg_on, bg_off=C.SURFACE2):
                bg = bg_on if active else bg_off
                fg = C.CRUST if active else C.OVERLAY0
                tk.Label(parent, text=text, bg=bg, fg=fg,
                         font=F.TINY, padx=6, pady=2).pack(side="left", padx=2)

            _badge(badges, "Product", prod_on, C.GREEN)
            _badge(badges, "Vite", prod_vite, C.BLUE)

            # Card hover
            all_widgets = [card, inner, dot, badges]
            for w in all_widgets:
                w.bind("<Enter>", lambda e, cd=card, inn=inner, d=dot, b=badges: (
                    cd.configure(bg=C.SURFACE1), inn.configure(bg=C.SURFACE1),
                    d.configure(bg=C.SURFACE1), b.configure(bg=C.SURFACE1)))
                w.bind("<Leave>", lambda e, cd=card, inn=inner, d=dot, b=badges: (
                    cd.configure(bg=C.SURFACE0), inn.configure(bg=C.SURFACE0),
                    d.configure(bg=C.SURFACE0), b.configure(bg=C.SURFACE0)))

    # ========================================================================
    # RENAME (double-click)
    # ========================================================================
    def _rename_item_dialog(self, title, current, callback):
        dlg = self._dialog(title, 380, 160)
        body = tk.Frame(dlg, bg=C.SURFACE0)
        body.pack(fill="both", expand=True, padx=20, pady=16)
        tk.Label(body, text="New name", bg=C.SURFACE0, fg=C.SUBTEXT0,
                 font=F.SMALL).pack(anchor="w", pady=(0, 4))
        entry = self._styled_entry(body)
        entry.pack(fill="x", ipady=4)
        entry.insert(0, current)
        entry.select_range(0, "end")
        entry.focus_set()

        def do():
            new_name = entry.get().strip()
            if not new_name or new_name == current:
                dlg.destroy()
                return
            callback(new_name)
            dlg.destroy()

        entry.bind("<Return>", lambda e: do())
        btn_row = tk.Frame(body, bg=C.SURFACE0)
        btn_row.pack(fill="x", pady=(16, 0))
        FlatBtn(btn_row, text="Cancel", command=dlg.destroy,
                bg=C.SURFACE1, hover_bg=C.SURFACE2).pack(side="right", padx=(8, 0))
        FlatBtn(btn_row, text="  Rename  ", command=do,
                bg=ACCENT, fg=C.CRUST, hover_bg=ACCENT_HOVER).pack(side="right")

    def _rename_game(self, idx):
        g = self.games_data[idx]
        current = g["title"]

        def on_rename(new_name):
            old_game = g["game"]
            g["title"] = new_name
            if old_game == current:
                g["game"] = new_name
            self.game_labels[idx].configure(text=g["game"])
            pkey = str(g["path"])
            self.pending_field_changes.setdefault(pkey, {})["title"] = new_name
            if old_game == current:
                self.pending_field_changes[pkey]["game"] = new_name
            self._update_badge()

        self._rename_item_dialog("Rename Game", current, on_rename)

    def _on_guide_dblclick(self, event, lb):
        self._drag_cleanup()
        idx = lb.nearest(event.y)
        if idx < 0 or idx >= lb.size() or lb.bbox(idx) is None:
            return
        self._rename_guide(lb, idx)

    def _rename_guide(self, lb, idx):
        item = lb._items[idx]
        current = item.get("guide", item.get("title", ""))

        def on_rename(new_name):
            item["guide"] = new_name
            pkey = str(item["path"])
            self.pending_field_changes.setdefault(pkey, {})["guide"] = new_name
            self._update_badge()
            self._refresh_guides()

        self._rename_item_dialog("Rename Guide", current, on_rename)

    def _on_brand_dblclick(self, event, lb):
        self._drag_cleanup()
        idx = lb.nearest(event.y)
        if idx < 0 or idx >= lb.size() or lb.bbox(idx) is None:
            return
        self._rename_brand(lb, idx)

    def _rename_brand(self, lb, idx):
        item = lb._items[idx]
        current = item.get("displayName", item.get("brand", ""))

        def on_rename(new_name):
            item["displayName"] = new_name
            pkey = str(item["path"])
            self.pending_field_changes.setdefault(pkey, {})["displayName"] = new_name
            self._update_badge()
            self._refresh_brands()

        self._rename_item_dialog("Rename Brand", current, on_rename)

    # ========================================================================
    # SAVE
    # ========================================================================
    def _save_all(self):
        section_changed = self.section_order_data != load_section_order()

        counts = {"guides": 0, "brands": 0, "games": 0}
        for p in self.pending_changes:
            rel = Path(p).relative_to(CONTENT)
            col = rel.parts[0]
            if col in counts:
                counts[col] += 1

        field_count = len(self.pending_field_changes)
        total = sum(counts.values()) + field_count + (1 if section_changed else 0)
        if total == 0:
            self.toast.show("No changes to save", C.OVERLAY0)
            return

        errors = []
        for p, c in self.pending_changes.items():
            try:
                write_navbar_field(Path(p), c["navbar"])
            except Exception as e:
                errors.append(f"{Path(p).name}: {e}")

        for p, fields in self.pending_field_changes.items():
            try:
                for key, value in fields.items():
                    write_field(Path(p), key, value)
            except Exception as e:
                errors.append(f"{Path(p).name}: {e}")

        if section_changed:
            try:
                save_section_order(self.section_order_data)
            except Exception as e:
                errors.append(f"sections: {e}")

        self.pending_changes.clear()
        self.pending_field_changes.clear()
        self._update_badge()

        if errors:
            self.toast.show(f"Saved with {len(errors)} error(s)", C.PEACH)
        else:
            parts = []
            if counts["guides"]:
                parts.append(f"{counts['guides']} guides")
            if counts["brands"]:
                parts.append(f"{counts['brands']} brands")
            if counts["games"]:
                parts.append(f"{counts['games']} games")
            if field_count:
                parts.append(f"{field_count} renamed")
            if section_changed:
                parts.append("section order")
            now = datetime.now().strftime("%H:%M:%S")
            self.toast.show(f"Saved {total} files ({', '.join(parts)}) at {now}", C.GREEN)
            self.status_var.set(f"Last saved at {now}  |  Ctrl+S to save")


if __name__ == "__main__":
    import yaml
    app = NavbarManager()
    app.mainloop()
