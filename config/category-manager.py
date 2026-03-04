#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
category-manager.py -- Enhanced GUI for managing category flags, colors, and content.

Reads/writes config/categories.json.
Scans src/content/{reviews,guides,news} for article counts and auto-discovers new categories.
Matches navbar-manager.py Catppuccin Mocha theme.
"""

import ctypes
import json
import re
import random
import sys
import tkinter as tk
from tkinter import messagebox
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
CATEGORIES_JSON = ROOT / "config" / "categories.json"
CONTENT = ROOT / "src" / "content"
NAVBAR_ICONS = ROOT / "public" / "images" / "navbar"


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


# -- Color Picker Dialog -----------------------------------------------------
import colorsys
import math


class ColorPicker(tk.Toplevel):
    """Full-featured color picker with SV gradient, hue strip, hex/RGB inputs,
    preset swatches, and live derived-color preview."""

    SV_SIZE = 220       # saturation-value canvas size
    HUE_W = 24          # hue strip width
    HUE_H = 220         # hue strip height (matches SV_SIZE)
    PRESETS = [
        "#00aeff", "#EE8B22", "#ff69b4", "#a855f7", "#22c55e", "#ef4444",
        "#a6e3a1", "#f9e2af", "#74c7ec", "#cba6f7", "#f38ba8", "#94e2d5",
        "#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3", "#54a0ff", "#5f27cd",
        "#01a3a4", "#ff9f43", "#ee5a24", "#c8d6e5", "#8395a7", "#576574",
    ]

    def __init__(self, parent, initial="#ffffff", title="Pick a Color",
                 category_id="", on_preview=None):
        super().__init__(parent)
        self.title(title)
        self.configure(bg=C.SURFACE0)
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()
        parent.update_idletasks()
        w, h = 540, 480
        x = parent.winfo_x() + (parent.winfo_width() - w) // 2
        y = parent.winfo_y() + (parent.winfo_height() - h) // 2
        self.geometry(f"{w}x{h}+{x}+{y}")
        dark_title_bar(self)

        self._cat_id = category_id
        self._on_preview = on_preview
        self.result = None  # set on OK

        # Parse initial color into HSV
        r, g, b = hex_to_rgb(initial)
        h_val, s_val, v_val = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        self._hue = h_val         # 0..1
        self._sat = s_val         # 0..1
        self._val = v_val         # 0..1
        self._suppress_trace = False

        self._build_ui()
        self._draw_sv()
        self._draw_hue()
        self._sync_from_hsv()

    # -- Build UI -----------------------------------------------------------
    def _build_ui(self):
        top = tk.Frame(self, bg=C.SURFACE0)
        top.pack(fill="both", expand=True, padx=16, pady=(16, 8))

        # Left: SV canvas + hue strip
        left = tk.Frame(top, bg=C.SURFACE0)
        left.pack(side="left")

        self._sv_canvas = tk.Canvas(left, width=self.SV_SIZE, height=self.SV_SIZE,
                                    highlightthickness=1, highlightbackground=C.SURFACE2,
                                    cursor="crosshair")
        self._sv_canvas.pack(side="left")
        self._sv_canvas.bind("<Button-1>", self._on_sv_click)
        self._sv_canvas.bind("<B1-Motion>", self._on_sv_click)

        self._hue_canvas = tk.Canvas(left, width=self.HUE_W, height=self.HUE_H,
                                     highlightthickness=1, highlightbackground=C.SURFACE2,
                                     cursor="hand2")
        self._hue_canvas.pack(side="left", padx=(8, 0))
        self._hue_canvas.bind("<Button-1>", self._on_hue_click)
        self._hue_canvas.bind("<B1-Motion>", self._on_hue_click)

        # Right: preview + inputs + presets + derived
        right = tk.Frame(top, bg=C.SURFACE0)
        right.pack(side="left", fill="both", expand=True, padx=(16, 0))

        # Large preview swatch
        self._preview = tk.Canvas(right, width=80, height=50, highlightthickness=1,
                                  highlightbackground=C.SURFACE2)
        self._preview.pack(anchor="w", pady=(0, 10))

        # Hex input
        hex_row = tk.Frame(right, bg=C.SURFACE0)
        hex_row.pack(fill="x", pady=2)
        tk.Label(hex_row, text="Hex:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL, width=4, anchor="w").pack(side="left")
        self._hex_var = tk.StringVar()
        self._hex_entry = tk.Entry(hex_row, textvariable=self._hex_var,
                                   bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
                                   font=F.BODY, relief="flat", bd=0,
                                   highlightthickness=1, highlightcolor=C.BLUE,
                                   highlightbackground=C.SURFACE2, width=10)
        self._hex_entry.pack(side="left", padx=(4, 0))
        self._hex_var.trace_add("write", self._on_hex_change)

        # RGB inputs
        self._r_var = tk.StringVar()
        self._g_var = tk.StringVar()
        self._b_var = tk.StringVar()
        for label, var in [("R:", self._r_var), ("G:", self._g_var), ("B:", self._b_var)]:
            row = tk.Frame(right, bg=C.SURFACE0)
            row.pack(fill="x", pady=2)
            tk.Label(row, text=label, bg=C.SURFACE0, fg=C.OVERLAY0,
                     font=F.SMALL, width=4, anchor="w").pack(side="left")
            e = tk.Entry(row, textvariable=var, bg=C.SURFACE1, fg=C.TEXT,
                         insertbackground=C.TEXT, font=F.BODY, relief="flat", bd=0,
                         highlightthickness=1, highlightcolor=C.BLUE,
                         highlightbackground=C.SURFACE2, width=6)
            e.pack(side="left", padx=(4, 0))
            var.trace_add("write", self._on_rgb_change)

        # Preset swatches
        tk.Label(right, text="Presets", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL).pack(anchor="w", pady=(10, 4))
        preset_grid = tk.Frame(right, bg=C.SURFACE0)
        preset_grid.pack(anchor="w")
        for i, pc in enumerate(self.PRESETS):
            row_i, col_i = divmod(i, 6)
            sw = tk.Canvas(preset_grid, width=22, height=18, highlightthickness=1,
                           highlightbackground=C.SURFACE2, bg=pc, cursor="hand2")
            sw.grid(row=row_i, column=col_i, padx=1, pady=1)
            sw.bind("<Button-1>", lambda e, c=pc: self._apply_hex(c))

        # Derived color preview row
        tk.Label(right, text="Derived", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL).pack(anchor="w", pady=(10, 4))
        self._derived_frame = tk.Frame(right, bg=C.SURFACE0)
        self._derived_frame.pack(anchor="w")
        self._derived_canvases: dict[str, tk.Canvas] = {}
        for key in ["accent", "hover", "grad-start", "score-end", "dark", "soft"]:
            f = tk.Frame(self._derived_frame, bg=C.SURFACE0)
            f.pack(side="left", padx=1)
            c = tk.Canvas(f, width=22, height=14, highlightthickness=1,
                          highlightbackground=C.SURFACE2)
            c.pack()
            tk.Label(f, text=key, bg=C.SURFACE0, fg=C.OVERLAY0,
                     font=("Segoe UI", 7)).pack()
            self._derived_canvases[key] = c

        # Buttons
        btn_row = tk.Frame(self, bg=C.SURFACE0)
        btn_row.pack(fill="x", padx=16, pady=(0, 16))
        FlatBtn(btn_row, text="Cancel", command=self._cancel,
                bg=C.SURFACE1, hover_bg=C.SURFACE2).pack(side="right", padx=(8, 0))
        FlatBtn(btn_row, text="  OK  ", command=self._ok,
                bg=C.BLUE, fg=C.CRUST, hover_bg=C.SAPPHIRE,
                font=F.BODY_BOLD).pack(side="right")

        self.bind("<Return>", lambda e: self._ok())
        self.bind("<Escape>", lambda e: self._cancel())

    # -- Drawing ------------------------------------------------------------
    def _draw_sv(self):
        """Draw the saturation-value gradient for the current hue."""
        size = self.SV_SIZE
        img = tk.PhotoImage(width=size, height=size)
        # Build row strings for performance (avoid per-pixel put)
        rows = []
        for y in range(size):
            val = 1.0 - y / (size - 1)
            row_colors = []
            for x in range(size):
                sat = x / (size - 1)
                r, g, b = colorsys.hsv_to_rgb(self._hue, sat, val)
                row_colors.append(f"#{int(r*255):02x}{int(g*255):02x}{int(b*255):02x}")
            rows.append("{" + " ".join(row_colors) + "}")
        img.put(" ".join(rows), to=(0, 0))
        self._sv_img = img  # prevent GC
        self._sv_canvas.delete("all")
        self._sv_canvas.create_image(0, 0, anchor="nw", image=img)
        # Crosshair
        cx = int(self._sat * (size - 1))
        cy = int((1.0 - self._val) * (size - 1))
        ring_color = "#ffffff" if self._val < 0.5 else "#000000"
        self._sv_canvas.create_oval(cx - 6, cy - 6, cx + 6, cy + 6,
                                    outline=ring_color, width=2)

    def _draw_hue(self):
        """Draw the vertical hue strip."""
        w, h = self.HUE_W, self.HUE_H
        img = tk.PhotoImage(width=w, height=h)
        for y in range(h):
            hue = y / (h - 1)
            r, g, b = colorsys.hsv_to_rgb(hue, 1.0, 1.0)
            color = f"#{int(r*255):02x}{int(g*255):02x}{int(b*255):02x}"
            img.put(color, to=(0, y, w, y + 1))
        self._hue_img = img
        self._hue_canvas.delete("all")
        self._hue_canvas.create_image(0, 0, anchor="nw", image=img)
        # Arrow indicator
        hy = int(self._hue * (h - 1))
        self._hue_canvas.create_polygon(0, hy - 4, 6, hy, 0, hy + 4,
                                        fill="#ffffff", outline=C.SURFACE2)
        self._hue_canvas.create_polygon(w, hy - 4, w - 6, hy, w, hy + 4,
                                        fill="#ffffff", outline=C.SURFACE2)

    # -- Events -------------------------------------------------------------
    def _on_sv_click(self, e):
        size = self.SV_SIZE
        self._sat = max(0.0, min(1.0, e.x / (size - 1)))
        self._val = max(0.0, min(1.0, 1.0 - e.y / (size - 1)))
        self._draw_sv()
        self._sync_from_hsv()

    def _on_hue_click(self, e):
        self._hue = max(0.0, min(1.0, e.y / (self.HUE_H - 1)))
        self._draw_sv()
        self._draw_hue()
        self._sync_from_hsv()

    def _on_hex_change(self, *args):
        if self._suppress_trace:
            return
        raw = self._hex_var.get().strip().lstrip("#")
        if len(raw) == 6:
            try:
                r, g, b = int(raw[0:2], 16), int(raw[2:4], 16), int(raw[4:6], 16)
                h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                self._hue, self._sat, self._val = h, s, v
                self._suppress_trace = True
                self._r_var.set(str(r))
                self._g_var.set(str(g))
                self._b_var.set(str(b))
                self._suppress_trace = False
                self._draw_sv()
                self._draw_hue()
                self._update_preview()
            except ValueError:
                pass

    def _on_rgb_change(self, *args):
        if self._suppress_trace:
            return
        try:
            r = int(self._r_var.get())
            g = int(self._g_var.get())
            b = int(self._b_var.get())
            if not (0 <= r <= 255 and 0 <= g <= 255 and 0 <= b <= 255):
                return
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            self._hue, self._sat, self._val = h, s, v
            self._suppress_trace = True
            self._hex_var.set(f"{r:02x}{g:02x}{b:02x}")
            self._suppress_trace = False
            self._draw_sv()
            self._draw_hue()
            self._update_preview()
        except ValueError:
            pass

    def _apply_hex(self, hex_color: str):
        """Apply a preset/external hex color."""
        r, g, b = hex_to_rgb(hex_color)
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        self._hue, self._sat, self._val = h, s, v
        self._draw_sv()
        self._draw_hue()
        self._sync_from_hsv()

    # -- Sync ---------------------------------------------------------------
    def _sync_from_hsv(self):
        """Push HSV state to hex/RGB fields and update preview."""
        r, g, b = colorsys.hsv_to_rgb(self._hue, self._sat, self._val)
        ri, gi, bi = int(r * 255), int(g * 255), int(b * 255)
        self._suppress_trace = True
        self._hex_var.set(f"{ri:02x}{gi:02x}{bi:02x}")
        self._r_var.set(str(ri))
        self._g_var.set(str(gi))
        self._b_var.set(str(bi))
        self._suppress_trace = False
        self._update_preview()

    def _update_preview(self):
        hex_color = f"#{self._hex_var.get().lstrip('#')}"
        try:
            self._preview.configure(bg=hex_color)
        except tk.TclError:
            return
        # Update derived swatches
        try:
            derived = derive_colors(hex_color)
            for key, canvas in self._derived_canvases.items():
                val = derived.get(key, hex_color)
                if val.startswith("rgba"):
                    continue  # can't use rgba in tk
                canvas.configure(bg=val)
        except Exception:
            pass

    def _current_hex(self) -> str:
        return f"#{self._hex_var.get().lstrip('#')}"

    def _ok(self):
        self.result = self._current_hex()
        self.destroy()

    def _cancel(self):
        self.result = None
        self.destroy()


# -- Data I/O ---------------------------------------------------------------
DEFAULT_SITE_COLORS = {"primary": "#394cc8", "secondary": "#00aeff"}


def _load_raw() -> dict:
    if CATEGORIES_JSON.is_file():
        return json.loads(CATEGORIES_JSON.read_text(encoding="utf-8"))
    return {}


def load_categories() -> list[dict]:
    return _load_raw().get("categories", [])


def load_site_colors() -> dict:
    return _load_raw().get("siteColors", dict(DEFAULT_SITE_COLORS))


def save_all(site_colors: dict, cats: list[dict]):
    CATEGORIES_JSON.write_text(
        json.dumps({"siteColors": site_colors, "categories": cats}, indent=2) + "\n",
        encoding="utf-8"
    )


# -- Content Scanning --------------------------------------------------------
def _extract_category_from_frontmatter(filepath: Path) -> str | None:
    """Extract category: value from YAML frontmatter of a .md/.mdx file."""
    try:
        text = filepath.read_text(encoding="utf-8", errors="replace")
        parts = text.split("---", 2)
        if len(parts) < 3:
            return None
        for line in parts[1].splitlines():
            m = re.match(r"^category:\s*(.+)", line)
            if m:
                val = m.group(1).strip().strip("'\"")
                if val:
                    return val
    except Exception:
        pass
    return None


def scan_content_categories() -> set[str]:
    """Scan content dirs for all category values used in frontmatter."""
    found: set[str] = set()
    for dirname in ("reviews", "guides", "news"):
        d = CONTENT / dirname
        if not d.is_dir():
            continue
        for f in d.rglob("*"):
            if f.suffix in (".md", ".mdx") and f.is_file():
                cat = _extract_category_from_frontmatter(f)
                if cat:
                    found.add(cat)
    # Also scan data-products subdirectory names
    dp = CONTENT / "data-products"
    if dp.is_dir():
        for child in dp.iterdir():
            if child.is_dir():
                found.add(child.name)
    return found


def count_articles() -> dict[str, dict[str, int]]:
    """Count articles per category per content type (reviews, guides, news)."""
    counts: dict[str, dict[str, int]] = {}
    for dirname in ("reviews", "guides", "news"):
        d = CONTENT / dirname
        if not d.is_dir():
            continue
        for f in d.rglob("*"):
            if f.suffix in (".md", ".mdx") and f.is_file():
                cat = _extract_category_from_frontmatter(f)
                if cat:
                    counts.setdefault(cat, {"reviews": 0, "guides": 0, "news": 0})
                    counts[cat][dirname] += 1
    return counts


def _generate_distinct_color(existing_colors: list[str]) -> str:
    """Generate a random hex color that's distinct from existing ones."""
    for _ in range(100):
        h = random.randint(0, 359)
        s = random.randint(50, 90)
        l = random.randint(55, 75)
        # HSL to RGB
        c = (1 - abs(2 * l / 100 - 1)) * s / 100
        x = c * (1 - abs((h / 60) % 2 - 1))
        m = l / 100 - c / 2
        if h < 60:
            r, g, b = c, x, 0
        elif h < 120:
            r, g, b = x, c, 0
        elif h < 180:
            r, g, b = 0, c, x
        elif h < 240:
            r, g, b = 0, x, c
        elif h < 300:
            r, g, b = x, 0, c
        else:
            r, g, b = c, 0, x
        ri, gi, bi = int((r + m) * 255), int((g + m) * 255), int((b + m) * 255)
        color = f"#{ri:02x}{gi:02x}{bi:02x}"
        # Check it's distinct enough
        if not existing_colors:
            return color
        ok = True
        for ec in existing_colors:
            try:
                er, eg, eb = int(ec[1:3], 16), int(ec[3:5], 16), int(ec[5:7], 16)
                dist = abs(ri - er) + abs(gi - eg) + abs(bi - eb)
                if dist < 80:
                    ok = False
                    break
            except Exception:
                continue
        if ok:
            return color
    return f"#{random.randint(0, 0xFFFFFF):06x}"


# -- Color Derivation Engine (mirrors MainLayout.astro formulas) -------------
def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def rgb_to_hsl(r: int, g: int, b: int) -> tuple[float, float, float]:
    r_, g_, b_ = r / 255, g / 255, b / 255
    mx, mn = max(r_, g_, b_), min(r_, g_, b_)
    l = (mx + mn) / 2
    if mx == mn:
        return 0.0, 0.0, l * 100
    d = mx - mn
    s = d / (2 - mx - mn) if l > 0.5 else d / (mx + mn)
    if mx == r_:
        h = ((g_ - b_) / d + (6 if g_ < b_ else 0)) / 6
    elif mx == g_:
        h = ((b_ - r_) / d + 2) / 6
    else:
        h = ((r_ - g_) / d + 4) / 6
    return h * 360, s * 100, l * 100


def hsl_to_hex(h: float, s: float, l: float) -> str:
    h = h % 360
    s = max(0, min(100, s)) / 100
    l = max(0, min(100, l)) / 100
    c = (1 - abs(2 * l - 1)) * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = l - c / 2
    if h < 60:
        r, g, b = c, x, 0
    elif h < 120:
        r, g, b = x, c, 0
    elif h < 180:
        r, g, b = 0, c, x
    elif h < 240:
        r, g, b = 0, x, c
    elif h < 300:
        r, g, b = x, 0, c
    else:
        r, g, b = c, 0, x
    to_hex = lambda v: f"{max(0, min(255, round((v + m) * 255))):02x}"
    return f"#{to_hex(r)}{to_hex(g)}{to_hex(b)}"


def derive_colors(hex_color: str) -> dict[str, str]:
    """Derive all color variants from a single base hex. Mirrors MainLayout.astro."""
    r, g, b = hex_to_rgb(hex_color)
    h, s, l = rgb_to_hsl(r, g, b)
    # Soft: desaturate 40%, lighten 15% (capped at 85%) — used for glow/shadows
    soft = hsl_to_hex(h, s * 0.6, min(l * 1.15, 85))
    sr, sg, sb = hex_to_rgb(soft)
    return {
        "base": hex_color,
        "accent": hsl_to_hex(h, s, l * 0.9),
        "dark": hsl_to_hex(h, s * 0.4, l * 0.35),
        "hover": hsl_to_hex(h, s, l * 0.7),
        "grad-start": hsl_to_hex(h, s * 0.85, l * 0.5),
        "soft": soft,
        "highlight": f"rgba({r},{g},{b},0.1)",
        "glow": f"rgba({sr},{sg},{sb},0.8)",
        "score-start": hex_color,
        "score-end": hsl_to_hex(h, s, l * 0.75),
        "score-rgba": f"rgba({r},{g},{b},1)",
    }


# -- Icon Preview Drawing (tk Canvas primitives) ----------------------------
# WHY: tkinter can't render SVGs natively. These draw simplified versions of
# each category's navbar icon so the GUI shows a recognizable preview.
# Each function draws on a 20x20 canvas using the category color.

def _draw_mouse(c, clr):
    c.create_oval(4, 1, 16, 19, outline=clr, width=1.5)
    c.create_line(10, 1, 10, 9, fill=clr, width=1)
    c.create_oval(8.5, 5, 11.5, 8, outline=clr, width=1)

def _draw_keyboard(c, clr):
    c.create_rectangle(1, 4, 19, 16, outline=clr, width=1.5)
    for x in [4, 7, 10, 13, 15]:
        c.create_rectangle(x, 6, x+1.5, 7.5, fill=clr, outline="")
    for x in [4, 7, 10, 13, 15]:
        c.create_rectangle(x, 9, x+1.5, 10.5, fill=clr, outline="")
    c.create_line(7, 13, 14, 13, fill=clr, width=1.5)

def _draw_monitor(c, clr):
    c.create_rectangle(1, 2, 19, 13, outline=clr, width=1.5)
    c.create_line(10, 13, 10, 17, fill=clr, width=1.5)
    c.create_line(6, 17, 14, 17, fill=clr, width=1.5)

def _draw_headset(c, clr):
    c.create_arc(3, 1, 17, 15, start=0, extent=180, style="arc", outline=clr, width=1.5)
    c.create_rectangle(2, 11, 6, 18, outline=clr, width=1.2)
    c.create_rectangle(14, 11, 18, 18, outline=clr, width=1.2)

def _draw_mousepad(c, clr):
    c.create_rectangle(1, 5, 19, 17, outline=clr, width=1.5)
    c.create_line(4, 14, 16, 14, fill=clr, width=1, dash=(2, 2))

def _draw_controller(c, clr):
    c.create_oval(2, 4, 18, 16, outline=clr, width=1.5)
    c.create_line(6, 10, 10, 10, fill=clr, width=1.2)
    c.create_line(8, 8, 8, 12, fill=clr, width=1.2)
    c.create_oval(13, 8, 14.5, 9.5, fill=clr, outline="")
    c.create_oval(11.5, 10.5, 13, 12, fill=clr, outline="")

def _draw_hardware(c, clr):
    c.create_rectangle(4, 4, 16, 16, outline=clr, width=1.5)
    c.create_rectangle(7, 7, 13, 13, outline=clr, width=1)
    for v in [7, 13]:
        c.create_line(v, 1, v, 4, fill=clr, width=1)
        c.create_line(v, 16, v, 19, fill=clr, width=1)
    for v in [7, 13]:
        c.create_line(1, v, 4, v, fill=clr, width=1)
        c.create_line(16, v, 19, v, fill=clr, width=1)

def _draw_game(c, clr):
    c.create_oval(2, 2, 18, 18, outline=clr, width=1.5)
    c.create_oval(7, 7, 13, 13, outline=clr, width=1)
    c.create_line(10, 1, 10, 5, fill=clr, width=1)
    c.create_line(10, 15, 10, 19, fill=clr, width=1)
    c.create_line(1, 10, 5, 10, fill=clr, width=1)
    c.create_line(15, 10, 19, 10, fill=clr, width=1)

def _draw_gpu(c, clr):
    c.create_rectangle(1, 4, 19, 17, outline=clr, width=1.5)
    c.create_oval(5, 7, 15, 17, outline=clr, width=1)
    c.create_oval(8, 10, 12, 14, outline=clr, width=1)
    c.create_line(5, 4, 5, 1, fill=clr, width=1)
    c.create_line(9, 4, 9, 1, fill=clr, width=1)

def _draw_ai(c, clr):
    c.create_polygon(10, 2, 12, 8, 18, 10, 12, 12, 10, 18, 8, 12, 2, 10, 8, 8,
                     outline=clr, fill="", width=1.5)
    c.create_polygon(17, 1, 17.5, 4, 20, 4.5, 17.5, 5, 17, 7, 16.5, 5, 14.5, 4.5, 16.5, 4,
                     outline=clr, fill="", width=1)

def _draw_unknown(c, clr):
    c.create_oval(5, 5, 15, 15, outline=clr, width=1.5)
    c.create_text(10, 10, text="?", fill=clr, font=("Segoe UI", 8, "bold"))

ICON_DRAWERS = {
    "mouse": _draw_mouse, "keyboard": _draw_keyboard, "monitor": _draw_monitor,
    "headset": _draw_headset, "mousepad": _draw_mousepad, "controller": _draw_controller,
    "hardware": _draw_hardware, "game": _draw_game, "gpu": _draw_gpu, "ai": _draw_ai,
}


def draw_category_icon(canvas: tk.Canvas, cat_id: str, color: str):
    """Draw a simplified category icon preview on a 20x20 canvas."""
    canvas.delete("all")
    drawer = ICON_DRAWERS.get(cat_id, _draw_unknown)
    drawer(canvas, color)


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


# -- Main Application -------------------------------------------------------
class CategoryManager(tk.Tk):

    def __init__(self):
        super().__init__()
        self.title("EG Category Manager")
        sw, sh = self.winfo_screenwidth(), self.winfo_screenheight()
        win_w, win_h = 1250, 920
        self.geometry(f"{win_w}x{win_h}+{(sw-win_w)//2}+{(sh-win_h)//2}")
        self.configure(bg=C.MANTLE)
        self.minsize(1000, 700)

        dark_title_bar(self)
        try:
            ico = tk.PhotoImage(width=1, height=1)
            ico.put(C.BLUE)
            self._icon = ico.zoom(32, 32)
            self.iconphoto(True, self._icon)
        except Exception:
            pass

        self.categories = load_categories()
        self.site_colors = load_site_colors()
        self.article_counts = count_articles()

        # Auto-discover categories from content that aren't in JSON
        self._auto_discover()

        self._original = json.dumps({"s": self.site_colors, "c": self.categories})
        self._card_widgets: list[dict] = []

        self._build_header()
        self._build_site_theme_row()
        self._build_scrollable_area()
        self._build_add_button()
        self._build_status_bar()
        self.toast = Toast(self)
        self.bind_all("<Control-s>", lambda e: self._save())
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    def _auto_discover(self):
        """Add categories found in content but missing from JSON."""
        existing_ids = {c["id"] for c in self.categories}
        content_cats = scan_content_categories()
        existing_colors = [c.get("color", "") for c in self.categories]
        new_cats = sorted(content_cats - existing_ids)
        for cat_id in new_cats:
            color = _generate_distinct_color(existing_colors)
            existing_colors.append(color)
            self.categories.append({
                "id": cat_id,
                "label": cat_id.capitalize(),
                "plural": cat_id.capitalize() + "s",
                "color": color,
                "product": {"production": False, "vite": True},
                "content": {"production": False, "vite": True},
            })

    # -- Header --------------------------------------------------------------
    def _build_header(self):
        hdr = tk.Frame(self, bg=C.CRUST, height=58)
        hdr.pack(fill="x")
        hdr.pack_propagate(False)
        tk.Frame(hdr, bg=C.BLUE, height=2).pack(fill="x", side="bottom")
        inner = tk.Frame(hdr, bg=C.CRUST)
        inner.pack(fill="both", expand=True, padx=24)
        tk.Label(inner, text="EG", bg=C.CRUST, fg=C.BLUE,
                 font=("Segoe UI", 20, "bold")).pack(side="left")
        tk.Label(inner, text="  Category Manager", bg=C.CRUST, fg=C.TEXT,
                 font=("Segoe UI", 14)).pack(side="left")
        tk.Label(inner, text=f"  ·  {ROOT.name}", bg=C.CRUST, fg=C.OVERLAY0,
                 font=F.SMALL).pack(side="left", padx=(4, 0))
        self.save_btn = FlatBtn(inner, text="  Save  ", command=self._save,
                                bg=C.BLUE, fg=C.CRUST, hover_bg=C.SAPPHIRE,
                                font=F.BODY_BOLD)
        self.save_btn.pack(side="right", pady=10)
        self.changes_lbl = tk.Label(inner, text="", bg=C.CRUST, fg=C.PEACH, font=F.SMALL)
        self.changes_lbl.pack(side="right", padx=12)

    # -- Site Theme Row ------------------------------------------------------
    def _build_site_theme_row(self):
        """Top row: primary + secondary color pickers, gradient preview, derived swatches."""
        row = tk.Frame(self, bg=C.SURFACE0, highlightthickness=1,
                       highlightbackground=C.CARD_BORDER)
        row.pack(fill="x", padx=16, pady=(12, 0))

        # Left accent bar (gradient drawn on canvas)
        accent_bar = tk.Canvas(row, width=4, highlightthickness=0, bg=C.SURFACE0)
        accent_bar.pack(side="left", fill="y")
        self._site_accent_bar = accent_bar

        inner = tk.Frame(row, bg=C.SURFACE0)
        inner.pack(side="left", fill="both", expand=True, padx=12, pady=10)

        # Row A: title + gradient preview
        row_a = tk.Frame(inner, bg=C.SURFACE0)
        row_a.pack(fill="x")

        tk.Label(row_a, text="Site Theme", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.HEADING).pack(side="left")
        tk.Label(row_a, text="  seasonal colors for navbar, gradients, SVGs",
                 bg=C.SURFACE0, fg=C.OVERLAY0, font=F.TINY).pack(side="left", pady=(2, 0))

        # Gradient preview bar (wide canvas showing the left-to-right gradient)
        self._grad_canvas = tk.Canvas(row_a, width=200, height=20,
                                      highlightthickness=1, highlightbackground=C.SURFACE2)
        self._grad_canvas.pack(side="right", padx=(8, 0))

        # Row B: primary + secondary pickers
        row_b = tk.Frame(inner, bg=C.SURFACE0)
        row_b.pack(fill="x", pady=(6, 0))

        # Primary (site-color / gradient start)
        tk.Label(row_b, text="Primary:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL).pack(side="left")
        self._pri_swatch = tk.Canvas(row_b, width=18, height=18, highlightthickness=1,
                                     highlightbackground=C.SURFACE2,
                                     bg=self.site_colors["primary"], cursor="hand2")
        self._pri_swatch.pack(side="left", padx=(4, 2))
        self._pri_lbl = tk.Label(row_b, text=self.site_colors["primary"],
                                 bg=C.SURFACE0, fg=self.site_colors["primary"],
                                 font=F.BODY_BOLD, cursor="hand2")
        self._pri_lbl.pack(side="left", padx=(0, 16))

        # Secondary (brand-color / gradient end)
        tk.Label(row_b, text="Secondary:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL).pack(side="left")
        self._sec_swatch = tk.Canvas(row_b, width=18, height=18, highlightthickness=1,
                                     highlightbackground=C.SURFACE2,
                                     bg=self.site_colors["secondary"], cursor="hand2")
        self._sec_swatch.pack(side="left", padx=(4, 2))
        self._sec_lbl = tk.Label(row_b, text=self.site_colors["secondary"],
                                 bg=C.SURFACE0, fg=self.site_colors["secondary"],
                                 font=F.BODY_BOLD, cursor="hand2")
        self._sec_lbl.pack(side="left", padx=(0, 16))

        # Derived color swatches (from primary)
        tk.Label(row_b, text="Derived:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL).pack(side="left", padx=(8, 4))
        self._site_derived: dict[str, tk.Canvas] = {}
        for key in ["accent", "hover", "grad-start", "dark", "soft"]:
            sw = tk.Canvas(row_b, width=20, height=14, highlightthickness=1,
                           highlightbackground=C.SURFACE2)
            sw.pack(side="left", padx=1)
            self._site_derived[key] = sw

        # Bind click handlers
        self._pri_swatch.bind("<Button-1>", lambda e: self._pick_site_color("primary"))
        self._pri_lbl.bind("<Button-1>", lambda e: self._pick_site_color("primary"))
        self._sec_swatch.bind("<Button-1>", lambda e: self._pick_site_color("secondary"))
        self._sec_lbl.bind("<Button-1>", lambda e: self._pick_site_color("secondary"))

        Tip(self._pri_swatch, "Primary site color (--site-color).\nUsed as gradient start, navbar accent, SVG gradients.")
        Tip(self._sec_swatch, "Secondary site color (--brand-color).\nUsed as gradient end, CTA highlights.")
        Tip(self._grad_canvas, "Live preview of the site gradient.\nUsed in navbar, buttons, borders, SVG fills.")

        # Initial paint
        self._refresh_site_theme()

    def _refresh_site_theme(self):
        """Repaint gradient preview, accent bar, and derived swatches."""
        pri = self.site_colors["primary"]
        sec = self.site_colors["secondary"]

        # Gradient preview bar (draw columns of interpolated color)
        gc = self._grad_canvas
        gc.delete("all")
        w = 200
        pr, pg, pb = hex_to_rgb(pri)
        sr, sg, sb = hex_to_rgb(sec)
        for x in range(w):
            t = x / (w - 1)
            r = int(pr + (sr - pr) * t)
            g = int(pg + (sg - pg) * t)
            b = int(pb + (sb - pb) * t)
            color = f"#{r:02x}{g:02x}{b:02x}"
            gc.create_line(x, 0, x, 20, fill=color)

        # Accent bar (simple vertical gradient)
        ab = self._site_accent_bar
        ab.delete("all")
        ab.update_idletasks()
        h = max(ab.winfo_height(), 60)
        for y in range(h):
            t = y / max(h - 1, 1)
            r = int(pr + (sr - pr) * t)
            g = int(pg + (sg - pg) * t)
            b = int(pb + (sb - pb) * t)
            color = f"#{r:02x}{g:02x}{b:02x}"
            ab.create_line(0, y, 4, y, fill=color)

        # Derived swatches (from primary)
        derived = derive_colors(pri)
        for key, canvas in self._site_derived.items():
            val = derived.get(key, pri)
            if not val.startswith("rgba"):
                canvas.configure(bg=val)

    def _pick_site_color(self, which: str):
        """Open color picker for primary or secondary site color."""
        current = self.site_colors[which]
        label = "Primary (site-color)" if which == "primary" else "Secondary (brand-color)"
        picker = ColorPicker(self, initial=current, title=f"Site {label}")
        self.wait_window(picker)
        if picker.result:
            self.site_colors[which] = picker.result
            if which == "primary":
                self._pri_swatch.configure(bg=picker.result)
                self._pri_lbl.configure(text=picker.result, fg=picker.result)
            else:
                self._sec_swatch.configure(bg=picker.result)
                self._sec_lbl.configure(text=picker.result, fg=picker.result)
            self._refresh_site_theme()
            self._update_badge()

    # -- Status Bar ----------------------------------------------------------
    def _build_status_bar(self):
        bar = tk.Frame(self, bg=C.CRUST, height=32)
        bar.pack(fill="x", side="bottom")
        bar.pack_propagate(False)
        self.status_var = tk.StringVar(value="  Ready  ·  Ctrl+S to save")
        tk.Label(bar, textvariable=self.status_var, bg=C.CRUST, fg=C.OVERLAY0,
                 font=F.TINY, padx=20).pack(side="left", fill="y")
        self.count_lbl = tk.Label(bar, text=f"{len(self.categories)} categories",
                                  bg=C.CRUST, fg=C.SURFACE2, font=F.TINY, padx=20)
        self.count_lbl.pack(side="right", fill="y")

    # -- Scrollable Area (2-column grid) -------------------------------------
    COLS = 2

    def _build_scrollable_area(self):
        container = tk.Frame(self, bg=C.MANTLE)
        container.pack(fill="both", expand=True)

        self.canvas = tk.Canvas(container, bg=C.MANTLE, highlightthickness=0)
        scrollbar = tk.Scrollbar(container, orient="vertical", command=self.canvas.yview,
                                 bg=C.SURFACE1, troughcolor=C.BASE,
                                 highlightthickness=0, bd=0)
        self.cards_frame = tk.Frame(self.canvas, bg=C.MANTLE)
        self.cards_frame.columnconfigure(0, weight=1, uniform="col")
        self.cards_frame.columnconfigure(1, weight=1, uniform="col")

        self.cards_frame.bind(
            "<Configure>",
            lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all"))
        )
        self._canvas_win = self.canvas.create_window((0, 0), window=self.cards_frame, anchor="nw")
        self.canvas.configure(yscrollcommand=scrollbar.set)

        # Keep inner frame width synced to canvas width so columns stretch
        def _on_canvas_resize(e):
            self.canvas.itemconfigure(self._canvas_win, width=e.width)
        self.canvas.bind("<Configure>", _on_canvas_resize)

        self.canvas.pack(side="left", fill="both", expand=True, padx=(16, 0), pady=(12, 0))
        scrollbar.pack(side="right", fill="y", padx=(0, 4), pady=(12, 0))

        # Mouse wheel scrolling
        def _on_mousewheel(e):
            self.canvas.yview_scroll(int(-1 * (e.delta / 120)), "units")
        self.canvas.bind_all("<MouseWheel>", _on_mousewheel)

        self._refresh_cards()

    def _refresh_cards(self):
        for w in self.cards_frame.winfo_children():
            w.destroy()
        self._card_widgets = []

        for i, cat in enumerate(self.categories):
            self._build_card(i, cat)
        self._update_badge()

    def _build_card(self, idx: int, cat: dict):
        color = cat.get("color", C.BLUE)
        cat_id = cat.get("id", "")
        grid_row, grid_col = divmod(idx, self.COLS)

        card = tk.Frame(self.cards_frame, bg=C.SURFACE0,
                        highlightthickness=1, highlightbackground=C.CARD_BORDER)
        card.grid(row=grid_row, column=grid_col, sticky="nsew", padx=4, pady=4)

        # Left accent bar
        accent = tk.Frame(card, bg=color, width=4)
        accent.pack(side="left", fill="y")

        inner = tk.Frame(card, bg=C.SURFACE0)
        inner.pack(side="left", fill="both", expand=True, padx=10, pady=8)

        # Row 1: color swatch + ID + hex color
        row1 = tk.Frame(inner, bg=C.SURFACE0)
        row1.pack(fill="x")

        swatch = tk.Canvas(row1, width=18, height=18, highlightthickness=1,
                           highlightbackground=C.SURFACE2, bg=color, cursor="hand2")
        swatch.pack(side="left", padx=(0, 6))

        tk.Label(row1, text=cat_id, bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY_BOLD, anchor="w").pack(side="left")

        color_lbl = tk.Label(row1, text=color, bg=C.SURFACE0, fg=color,
                             font=F.BODY_BOLD, cursor="hand2")
        color_lbl.pack(side="right")

        # Row 2: Label + Plural inputs
        row2 = tk.Frame(inner, bg=C.SURFACE0)
        row2.pack(fill="x", pady=(4, 0))

        tk.Label(row2, text="Label:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL).pack(side="left")
        label_var = tk.StringVar(value=cat.get("label", ""))
        tk.Entry(row2, textvariable=label_var, bg=C.SURFACE1, fg=C.TEXT,
                 insertbackground=C.TEXT, font=F.BODY, relief="flat", bd=0,
                 highlightthickness=1, highlightcolor=C.BLUE,
                 highlightbackground=C.SURFACE2, width=10).pack(side="left", padx=(4, 8))

        tk.Label(row2, text="Plural:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL).pack(side="left")
        plural_var = tk.StringVar(value=cat.get("plural", ""))
        tk.Entry(row2, textvariable=plural_var, bg=C.SURFACE1, fg=C.TEXT,
                 insertbackground=C.TEXT, font=F.BODY, relief="flat", bd=0,
                 highlightthickness=1, highlightcolor=C.BLUE,
                 highlightbackground=C.SURFACE2, width=10).pack(side="left", padx=(4, 0))

        # Row 3: Product + Content toggles (compact, vertically centered)
        row3 = tk.Frame(inner, bg=C.SURFACE0)
        row3.pack(fill="x", pady=(5, 0))

        # WHY: wrap each label+toggle in a sub-frame so they center as a unit
        def _toggle_pair(parent, label_text, initial, on_cb):
            pair = tk.Frame(parent, bg=C.SURFACE0)
            pair.pack(side="left", padx=(0, 4))
            lbl = tk.Label(pair, text=label_text, bg=C.SURFACE0, fg=C.SUBTEXT0,
                           font=F.SMALL)
            lbl.pack(side="left", padx=(0, 3))
            t = Toggle(pair, initial=initial, on_toggle=on_cb, bg=C.SURFACE0)
            t.pack(side="left")
            return t

        tk.Label(row3, text="Product", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.SMALL).pack(side="left", padx=(0, 6))

        prod_prod = _toggle_pair(row3, "Prod", cat.get("product", {}).get("production", False),
                                 lambda v, i=idx: self._on_toggle(i, "product", "production", v))
        prod_vite = _toggle_pair(row3, "Vite", cat.get("product", {}).get("vite", False),
                                 lambda v, i=idx: self._on_toggle(i, "product", "vite", v))

        tk.Frame(row3, bg=C.SURFACE2, width=1, height=20).pack(side="left", fill="y", padx=(8, 8))

        tk.Label(row3, text="Content", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.SMALL).pack(side="left", padx=(0, 6))

        cont_prod = _toggle_pair(row3, "Prod", cat.get("content", {}).get("production", False),
                                 lambda v, i=idx: self._on_toggle(i, "content", "production", v))
        cont_vite = _toggle_pair(row3, "Vite", cat.get("content", {}).get("vite", False),
                                 lambda v, i=idx: self._on_toggle(i, "content", "vite", v))

        # Row 4: Article counts + icon status
        row4 = tk.Frame(inner, bg=C.SURFACE0)
        row4.pack(fill="x", pady=(4, 0))

        counts = self.article_counts.get(cat_id, {})
        r_count = counts.get("reviews", 0)
        g_count = counts.get("guides", 0)
        n_count = counts.get("news", 0)
        total = r_count + g_count + n_count
        count_text = f"{r_count} reviews · {g_count} guides · {n_count} news"
        if total == 0:
            count_text = "no articles found"

        tk.Label(row4, text=count_text, bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.TINY).pack(side="left")

        # Icon status: preview + SVG file check
        icon_path = NAVBAR_ICONS / f"{cat_id}.svg"
        has_icon = icon_path.is_file()

        icon_frame = tk.Frame(row4, bg=C.SURFACE0)
        icon_frame.pack(side="right")

        # Draw icon preview canvas (20x20)
        icon_canvas = tk.Canvas(icon_frame, width=20, height=20,
                                highlightthickness=0, bg=C.SURFACE0)
        icon_canvas.pack(side="left", padx=(0, 4))
        draw_category_icon(icon_canvas, cat_id, color)

        if has_icon:
            icon_lbl = tk.Label(icon_frame, text=f"{cat_id}.svg",
                                bg=C.SURFACE0, fg=C.GREEN, font=F.TINY)
            icon_lbl.pack(side="left")
            tip_text = (
                f"Navbar icon: public/images/navbar/{cat_id}.svg\n"
                f"Found — custom icon active."
            )
        else:
            # Red flag: prominent missing-icon warning
            warn_canvas = tk.Canvas(icon_frame, width=14, height=14,
                                    highlightthickness=0, bg=C.SURFACE0)
            warn_canvas.pack(side="left", padx=(0, 2))
            warn_canvas.create_polygon(7, 1, 13, 13, 1, 13,
                                       fill=C.RED, outline="")
            warn_canvas.create_text(7, 9, text="!", fill=C.BASE,
                                    font=("Segoe UI", 7, "bold"))
            icon_lbl = tk.Label(icon_frame, text="MISSING ICON",
                                bg=C.SURFACE0, fg=C.RED, font=F.TINY)
            icon_lbl.pack(side="left")
            tip_text = (
                f"Navbar icon: public/images/navbar/{cat_id}.svg\n"
                f"NOT FOUND — navbar will have no icon for this category.\n"
                f"Add a 24x24 SVG silhouette to this path."
            )
        Tip(icon_lbl, tip_text)

        # Row 5: Derived color swatches
        row5 = tk.Frame(inner, bg=C.SURFACE0)
        row5.pack(fill="x", pady=(4, 0))

        derived = derive_colors(color)
        swatch_widgets = {}
        swatch_order = ["base", "accent", "hover", "grad-start", "score-end", "dark", "soft"]
        for key in swatch_order:
            hex_val = derived[key]
            sw_c = tk.Canvas(row5, width=20, height=12, highlightthickness=1,
                             highlightbackground=C.SURFACE2, bg=hex_val)
            sw_c.pack(side="left", padx=1)
            swatch_widgets[key] = sw_c

        # Bind entry changes
        label_var.trace_add("write", lambda *a, i=idx, v=label_var: self._on_entry(i, "label", v))
        plural_var.trace_add("write", lambda *a, i=idx, v=plural_var: self._on_entry(i, "plural", v))

        # Color picker — bind swatch + hex label click
        def _pick_color(e=None, i=idx, sw=swatch, cl=color_lbl, ac=accent,
                        sw_w=swatch_widgets, ic=icon_canvas):
            current = self.categories[i].get("color", "#ffffff")
            picker = ColorPicker(self, initial=current,
                                 title=f"Color for {self.categories[i]['id']}",
                                 category_id=self.categories[i]["id"])
            self.wait_window(picker)
            if picker.result:
                new_color = picker.result
                self.categories[i]["color"] = new_color
                sw.configure(bg=new_color)
                cl.configure(text=new_color, fg=new_color)
                ac.configure(bg=new_color)
                new_derived = derive_colors(new_color)
                for key, canvas in sw_w.items():
                    if new_derived.get(key, "").startswith("rgba"):
                        continue
                    canvas.configure(bg=new_derived[key])
                # Redraw icon preview with new color
                draw_category_icon(ic, self.categories[i]["id"], new_color)
                self._update_badge()

        swatch.bind("<Button-1>", _pick_color)
        color_lbl.bind("<Button-1>", _pick_color)

        self._card_widgets.append({
            "card": card, "label_var": label_var, "plural_var": plural_var,
            "prod_prod": prod_prod, "prod_vite": prod_vite,
            "cont_prod": cont_prod, "cont_vite": cont_vite,
            "swatch": swatch, "color_lbl": color_lbl, "accent": accent,
            "derived_swatches": swatch_widgets, "icon_canvas": icon_canvas,
        })

    def _on_toggle(self, idx, section, field, val):
        self.categories[idx].setdefault(section, {})
        self.categories[idx][section][field] = val
        self._update_badge()

    def _on_entry(self, idx, field, var):
        self.categories[idx][field] = var.get()
        self._update_badge()

    def _update_badge(self):
        current = json.dumps({"s": self.site_colors, "c": self.categories})
        if current != self._original:
            self.changes_lbl.configure(text="unsaved changes", fg=C.PEACH)
        else:
            self.changes_lbl.configure(text="", fg=C.GREEN)

    # -- Add Button ----------------------------------------------------------
    def _build_add_button(self):
        self.add_frame = tk.Frame(self, bg=C.MANTLE)
        self.add_frame.pack(fill="x", padx=24, pady=(8, 8))
        FlatBtn(self.add_frame, text="+ Add Category", command=self._add_category,
                bg=C.SURFACE1, hover_bg=C.SURFACE2, font=F.BODY_BOLD).pack(side="left")

    def _add_category(self):
        dlg = tk.Toplevel(self)
        dlg.title("Add Category")
        dlg.configure(bg=C.SURFACE0)
        dlg.resizable(False, False)
        self.update_idletasks()
        w, h = 380, 260
        x = self.winfo_x() + (self.winfo_width() - w) // 2
        y = self.winfo_y() + (self.winfo_height() - h) // 2
        dlg.geometry(f"{w}x{h}+{x}+{y}")
        dlg.transient(self)
        dlg.grab_set()
        dark_title_bar(dlg)

        body = tk.Frame(dlg, bg=C.SURFACE0)
        body.pack(fill="both", expand=True, padx=20, pady=16)

        def make_field(parent, label_text, row):
            tk.Label(parent, text=label_text, bg=C.SURFACE0, fg=C.SUBTEXT0,
                     font=F.SMALL).grid(row=row, column=0, sticky="w", pady=(0, 4))
            entry = tk.Entry(parent, bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
                             font=F.BODY, relief="flat", bd=0, highlightthickness=1,
                             highlightcolor=C.BLUE, highlightbackground=C.SURFACE2, width=30)
            entry.grid(row=row, column=1, sticky="ew", pady=(0, 8), padx=(8, 0))
            return entry

        fields = tk.Frame(body, bg=C.SURFACE0)
        fields.pack(fill="x")
        fields.columnconfigure(1, weight=1)

        id_entry = make_field(fields, "ID (slug)", 0)
        label_entry = make_field(fields, "Label", 1)
        plural_entry = make_field(fields, "Plural", 2)
        id_entry.focus_set()

        def do_add():
            new_id = id_entry.get().strip().lower()
            new_label = label_entry.get().strip()
            new_plural = plural_entry.get().strip()
            if not new_id:
                dlg.destroy()
                return
            if any(c["id"] == new_id for c in self.categories):
                self.toast.show(f"'{new_id}' already exists", C.PEACH, 2500)
                dlg.destroy()
                return
            if not new_label:
                new_label = new_id.capitalize()
            if not new_plural:
                new_plural = new_label + "s"
            existing_colors = [c.get("color", "") for c in self.categories]
            color = _generate_distinct_color(existing_colors)
            self.categories.append({
                "id": new_id, "label": new_label, "plural": new_plural,
                "color": color,
                "product": {"production": False, "vite": True},
                "content": {"production": False, "vite": True},
            })
            dlg.destroy()
            self._refresh_cards()

        id_entry.bind("<Return>", lambda e: do_add())

        btn_row = tk.Frame(body, bg=C.SURFACE0)
        btn_row.pack(fill="x", pady=(12, 0))
        FlatBtn(btn_row, text="Cancel", command=dlg.destroy,
                bg=C.SURFACE1, hover_bg=C.SURFACE2).pack(side="right", padx=(8, 0))
        FlatBtn(btn_row, text="  Add  ", command=do_add,
                bg=C.BLUE, fg=C.CRUST, hover_bg=C.SAPPHIRE).pack(side="right")

    # -- Save ----------------------------------------------------------------
    def _save(self):
        current = json.dumps({"s": self.site_colors, "c": self.categories})
        if current == self._original:
            self.toast.show("No changes to save", C.OVERLAY0)
            return
        try:
            save_all(self.site_colors, self.categories)
            self._original = current
            self._update_badge()
            now = datetime.now().strftime("%H:%M:%S")
            self.toast.show(f"Saved site colors + {len(self.categories)} categories at {now}", C.GREEN)
            self.status_var.set(f"  Last saved at {now}  ·  Ctrl+S to save")
            self.count_lbl.configure(text=f"{len(self.categories)} categories")
        except Exception as e:
            self.toast.show(f"Error: {e}", C.RED)

    # -- Close ---------------------------------------------------------------
    def _on_close(self):
        current = json.dumps({"s": self.site_colors, "c": self.categories})
        if current != self._original:
            if not messagebox.askyesno(
                    "Unsaved Changes",
                    "You have unsaved changes.\n\nExit without saving?",
                    parent=self):
                return
        self.destroy()


if __name__ == "__main__":
    app = CategoryManager()
    app.mainloop()
