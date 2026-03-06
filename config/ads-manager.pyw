#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ads-manager.pyw -- GUI for managing the ad placement registry.

Lets you view/edit ad placements with section grouping, provider-conditional
forms, display toggles, size management, and new/delete placement support.

Reads/writes config/data/ads-registry.json.
Reads config/data/categories.json for accent color.

Matches the Catppuccin Mocha theme used by all config tools.
"""

import ctypes
import json
import re
import sys
import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
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
ADS_JSON = ROOT / "config" / "data" / "ads-registry.json"


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


def _darken(hex_color: str, factor: float = 0.7) -> str:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"#{int(r*factor):02x}{int(g*factor):02x}{int(b*factor):02x}"


ACCENT = _load_site_accent()
ACCENT_HOVER = _darken(ACCENT)

PROVIDERS = ["adsense", "gpt", "direct", "native"]
PLACEMENT_TYPES = ["rail", "inline"]
SIZE_PATTERN = re.compile(r"^\d+x\d+$")


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

    def set(self, val: bool):
        self._on = val
        self._draw()


# -- Data I/O ----------------------------------------------------------------
def load_ads_config() -> dict:
    """Load the ads registry from JSON."""
    if ADS_JSON.is_file():
        try:
            return json.loads(ADS_JSON.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {"adsenseClient": "", "adLabel": "Ad", "sections": [], "placements": {}}


def save_ads_config(data: dict):
    """Write the ads registry to JSON."""
    ADS_JSON.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8"
    )


# -- Main Application -------------------------------------------------------
class AdsManager(tk.Tk):

    def __init__(self):
        super().__init__()
        self.title("EG Ads Manager")
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
        self.config_data = load_ads_config()
        self._original = json.dumps(self.config_data, sort_keys=True)

        # Current selection
        self._selected_name: str | None = None

        self._setup_styles()
        self._build_header()
        self._build_globals_bar()
        self._build_panels()
        self._build_status_bar()
        self.toast = Toast(self)

        self.bind_all("<Control-s>", lambda e: self._save())
        self.protocol("WM_DELETE_WINDOW", self._on_close)

        self._refresh_list()

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
        tk.Label(inner, text="  Ads Manager", bg=C.CRUST, fg=C.TEXT,
                 font=("Segoe UI", 14)).pack(side="left")
        tk.Label(inner, text=f"  \u00b7  {ROOT.name}", bg=C.CRUST, fg=C.OVERLAY0,
                 font=F.BODY).pack(side="left", padx=(4, 0))
        self.save_btn = FlatBtn(inner, text="  Save  ", command=self._save,
                                bg=ACCENT, fg=C.CRUST, hover_bg=ACCENT_HOVER,
                                font=F.BODY_BOLD)
        self.save_btn.pack(side="right", pady=4)
        self.changes_lbl = tk.Label(inner, text="", bg=C.CRUST, fg=C.PEACH, font=F.SMALL)
        self.changes_lbl.pack(side="right", padx=8)

    # -- Globals bar (AdSense Client + Ad Label) -----------------------------
    def _build_globals_bar(self):
        bar = tk.Frame(self, bg=C.SURFACE0, highlightthickness=1,
                       highlightbackground=C.CARD_BORDER)
        bar.pack(fill="x", padx=16, pady=(12, 0), ipady=6)

        tk.Label(bar, text="AdSense Client:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.BODY).pack(side="left", padx=(16, 4))
        self._client_var = tk.StringVar(value=self.config_data.get("adsenseClient", ""))
        client_entry = tk.Entry(bar, textvariable=self._client_var,
                                bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
                                font=F.MONO, relief="flat", bd=0, width=28,
                                highlightthickness=1, highlightcolor=C.BLUE,
                                highlightbackground=C.SURFACE2)
        client_entry.pack(side="left", padx=(0, 20), ipady=3)
        self._client_var.trace_add("write", lambda *a: self._on_global_change())

        tk.Label(bar, text="Ad Label:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.BODY).pack(side="left", padx=(0, 4))
        self._label_var = tk.StringVar(value=self.config_data.get("adLabel", "Ad"))
        label_entry = tk.Entry(bar, textvariable=self._label_var,
                               bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
                               font=F.BODY, relief="flat", bd=0, width=8,
                               highlightthickness=1, highlightcolor=C.BLUE,
                               highlightbackground=C.SURFACE2)
        label_entry.pack(side="left", ipady=3)
        self._label_var.trace_add("write", lambda *a: self._on_global_change())

        # Separator
        tk.Frame(bar, bg=C.SURFACE2, width=1).pack(side="left", fill="y",
                                                     padx=(20, 20), pady=4)

        # Production Placeholders toggle
        tk.Label(bar, text="Production Placeholders:", bg=C.SURFACE0,
                 fg=C.OVERLAY0, font=F.BODY).pack(side="left", padx=(0, 4))
        self._prod_ph_toggle = Toggle(
            bar,
            initial=self.config_data.get("showProductionPlaceholders", False),
            on_toggle=lambda v: self._on_global_change(),
            bg=C.SURFACE0,
        )
        self._prod_ph_toggle.pack(side="left", padx=(0, 4))
        Tip(self._prod_ph_toggle,
            "When ON and ads are disabled, shows HBS-style\n"
            "production placeholder (top/bottom border + Ad circle)\n"
            "instead of dev dashed-outline placeholder.")

        # Sample Ads toggle
        tk.Label(bar, text="Sample Ads:", bg=C.SURFACE0,
                 fg=C.OVERLAY0, font=F.BODY).pack(side="left", padx=(16, 4))
        self._sample_ads_toggle = Toggle(
            bar,
            initial=self.config_data.get("loadSampleAds", False),
            on_toggle=lambda v: self._on_global_change(),
            bg=C.SURFACE0,
        )
        self._sample_ads_toggle.pack(side="left")
        Tip(self._sample_ads_toggle,
            "When ON, fills ad slots with colored dummy\n"
            "rectangles for layout verification.\n"
            "Overrides all other ad rendering.")

    def _on_global_change(self):
        self.config_data["adsenseClient"] = self._client_var.get()
        self.config_data["adLabel"] = self._label_var.get()
        self.config_data["showProductionPlaceholders"] = self._prod_ph_toggle.get()
        self.config_data["loadSampleAds"] = self._sample_ads_toggle.get()
        self._update_badge()

    # -- Main Panels (List + Detail) -----------------------------------------
    def _build_panels(self):
        self._panel_frame = tk.Frame(self, bg=C.MANTLE)
        self._panel_frame.pack(fill="both", expand=True, padx=16, pady=(8, 0))

        # Left: Placement List (350px fixed)
        self._list_frame = tk.Frame(self._panel_frame, bg=C.SURFACE0,
                                     highlightthickness=1,
                                     highlightbackground=C.CARD_BORDER)
        self._list_frame.pack(side="left", fill="y", padx=(0, 8))
        self._list_frame.configure(width=350)
        self._list_frame.pack_propagate(False)

        # Right: Detail Panel
        self._detail_outer = tk.Frame(self._panel_frame, bg=C.SURFACE0,
                                       highlightthickness=1,
                                       highlightbackground=C.CARD_BORDER)
        self._detail_outer.pack(side="right", fill="both", expand=True, padx=(8, 0))

    # -- Left Panel: Placement List ------------------------------------------
    def _refresh_list(self):
        for w in self._list_frame.winfo_children():
            w.destroy()

        # Header
        tk.Frame(self._list_frame, bg=ACCENT, height=3).pack(fill="x")
        hdr = tk.Frame(self._list_frame, bg=C.SURFACE0)
        hdr.pack(fill="x", padx=12, pady=(10, 2))
        tk.Label(hdr, text="PLACEMENTS", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(side="left")

        # Scrollable list
        canvas = tk.Canvas(self._list_frame, bg=C.SURFACE0, highlightthickness=0,
                           bd=0)
        scrollbar = tk.Scrollbar(self._list_frame, orient="vertical",
                                  command=canvas.yview)
        self._list_inner = tk.Frame(canvas, bg=C.SURFACE0)

        self._list_inner.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        canvas.create_window((0, 0), window=self._list_inner, anchor="nw",
                              tags="inner")
        canvas.configure(yscrollcommand=scrollbar.set)

        # WHY: bind mousewheel to canvas, not inner frame, for scroll support
        def _on_mousewheel(e):
            canvas.yview_scroll(int(-1 * (e.delta / 120)), "units")
        canvas.bind_all("<MouseWheel>", _on_mousewheel)

        # WHY: make inner frame fill canvas width
        def _resize_inner(e):
            canvas.itemconfigure("inner", width=e.width)
        canvas.bind("<Configure>", _resize_inner)

        scrollbar.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)

        sections = self.config_data.get("sections", [])
        placements = self.config_data.get("placements", {})
        self._list_rows: dict[str, tk.Frame] = {}

        for section in sections:
            section_name = section.get("name", "")
            section_placements = section.get("placements", [])

            # Section header
            sep_frame = tk.Frame(self._list_inner, bg=C.SURFACE0)
            sep_frame.pack(fill="x", padx=8, pady=(10, 2))
            tk.Frame(sep_frame, bg=C.SURFACE2, height=1).pack(fill="x", side="top")
            tk.Label(sep_frame, text=section_name.upper(), bg=C.SURFACE0,
                     fg=C.OVERLAY0, font=F.TINY).pack(side="left", padx=4, pady=(2, 0))

            for pname in section_placements:
                pdata = placements.get(pname, {})
                self._make_list_row(pname, pdata)

        # New Placement button
        btn_frame = tk.Frame(self._list_inner, bg=C.SURFACE0)
        btn_frame.pack(fill="x", padx=12, pady=(16, 12))
        FlatBtn(btn_frame, text="+ New Placement", command=self._new_placement,
                bg=C.SURFACE1, hover_bg=C.SURFACE2, font=F.SMALL).pack(fill="x")

        # Show detail for current selection
        if self._selected_name and self._selected_name in placements:
            self._show_detail(self._selected_name)
        else:
            self._show_empty_detail()

    def _make_list_row(self, name: str, pdata: dict):
        row = tk.Frame(self._list_inner, bg=C.SURFACE0, cursor="hand2")
        row.pack(fill="x", padx=8, pady=1)

        enabled = pdata.get("display", True)
        dot_color = C.GREEN if enabled else C.RED

        dot = tk.Canvas(row, width=10, height=10, highlightthickness=0, bg=C.SURFACE0)
        dot.pack(side="left", padx=(8, 6), pady=6)
        dot.create_oval(1, 1, 9, 9, fill=dot_color, outline="")

        lbl = tk.Label(row, text=name, bg=C.SURFACE0, fg=C.SUBTEXT1,
                       font=F.MONO_SMALL, anchor="w")
        lbl.pack(side="left", fill="x", expand=True, pady=6)

        row._name = name
        row._dot = dot
        row._lbl = lbl
        self._list_rows[name] = row

        is_selected = (name == self._selected_name)
        if is_selected:
            row.configure(bg=C.SURFACE1)
            dot.configure(bg=C.SURFACE1)
            lbl.configure(bg=C.SURFACE1, fg=C.TEXT)

        def on_click(e, n=name):
            self._select_placement(n)
        def on_enter(e, r=row, d=dot, l=lbl):
            if r._name != self._selected_name:
                r.configure(bg=C.SURFACE1)
                d.configure(bg=C.SURFACE1)
                l.configure(bg=C.SURFACE1)
        def on_leave(e, r=row, d=dot, l=lbl):
            if r._name != self._selected_name:
                r.configure(bg=C.SURFACE0)
                d.configure(bg=C.SURFACE0)
                l.configure(bg=C.SURFACE0)

        for w in [row, dot, lbl]:
            w.bind("<Button-1>", on_click)
            w.bind("<Enter>", on_enter)
            w.bind("<Leave>", on_leave)

    def _select_placement(self, name: str):
        # Deselect previous
        if self._selected_name and self._selected_name in self._list_rows:
            prev = self._list_rows[self._selected_name]
            prev.configure(bg=C.SURFACE0)
            prev._dot.configure(bg=C.SURFACE0)
            prev._lbl.configure(bg=C.SURFACE0, fg=C.SUBTEXT1)

        self._selected_name = name

        # Highlight new
        if name in self._list_rows:
            row = self._list_rows[name]
            row.configure(bg=C.SURFACE1)
            row._dot.configure(bg=C.SURFACE1)
            row._lbl.configure(bg=C.SURFACE1, fg=C.TEXT)

        self._show_detail(name)

    # -- Right Panel: Detail -------------------------------------------------
    def _show_empty_detail(self):
        for w in self._detail_outer.winfo_children():
            w.destroy()
        tk.Frame(self._detail_outer, bg=ACCENT, height=3).pack(fill="x")
        tk.Label(self._detail_outer, text="Select a placement",
                 bg=C.SURFACE0, fg=C.OVERLAY0, font=F.BODY).pack(expand=True)

    def _show_detail(self, name: str):
        for w in self._detail_outer.winfo_children():
            w.destroy()

        placements = self.config_data.get("placements", {})
        pdata = placements.get(name, {})

        tk.Frame(self._detail_outer, bg=ACCENT, height=3).pack(fill="x")

        # Scrollable detail
        detail_canvas = tk.Canvas(self._detail_outer, bg=C.SURFACE0,
                                   highlightthickness=0, bd=0)
        detail_scroll = tk.Scrollbar(self._detail_outer, orient="vertical",
                                      command=detail_canvas.yview)
        detail_frame = tk.Frame(detail_canvas, bg=C.SURFACE0)
        detail_frame.bind(
            "<Configure>",
            lambda e: detail_canvas.configure(scrollregion=detail_canvas.bbox("all"))
        )
        detail_canvas.create_window((0, 0), window=detail_frame, anchor="nw",
                                     tags="detail_inner")

        def _resize_detail(e):
            detail_canvas.itemconfigure("detail_inner", width=e.width)
        detail_canvas.bind("<Configure>", _resize_detail)

        detail_canvas.configure(yscrollcommand=detail_scroll.set)
        detail_scroll.pack(side="right", fill="y")
        detail_canvas.pack(side="left", fill="both", expand=True)

        pad = 20

        # Header
        hdr = tk.Frame(detail_frame, bg=C.SURFACE0)
        hdr.pack(fill="x", padx=pad, pady=(16, 4))
        tk.Label(hdr, text="PLACEMENT DETAIL", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(side="left")

        # Name (read-only)
        self._detail_field(detail_frame, "Name:", name, readonly=True, pad=pad,
                           tip="Placement names are used in <AdSlot campaign=\"...\"> "
                               "template references. Renaming requires updating templates.")

        # Provider dropdown
        prov_frame = tk.Frame(detail_frame, bg=C.SURFACE0)
        prov_frame.pack(fill="x", padx=pad, pady=(8, 0))
        tk.Label(prov_frame, text="Provider:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.BODY, width=12, anchor="w").pack(side="left")
        self._provider_var = tk.StringVar(value=pdata.get("provider", "adsense"))
        prov_menu = tk.OptionMenu(
            prov_frame, self._provider_var, *PROVIDERS,
            command=lambda v: self._on_provider_change(name)
        )
        prov_menu.configure(bg=C.SURFACE1, fg=C.TEXT, font=F.BODY,
                            activebackground=C.SURFACE2, activeforeground=C.TEXT,
                            highlightthickness=0, bd=0, relief="flat",
                            indicatoron=True, width=12)
        prov_menu["menu"].configure(bg=C.SURFACE1, fg=C.TEXT, font=F.BODY,
                                     activebackground=C.BLUE, activeforeground=C.CRUST,
                                     bd=0, relief="flat")
        prov_menu.pack(side="left")

        # Placement Type radio
        type_frame = tk.Frame(detail_frame, bg=C.SURFACE0)
        type_frame.pack(fill="x", padx=pad, pady=(8, 0))
        tk.Label(type_frame, text="Type:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.BODY, width=12, anchor="w").pack(side="left")
        self._type_var = tk.StringVar(value=pdata.get("placementType", "rail"))
        for pt in PLACEMENT_TYPES:
            rb = tk.Radiobutton(type_frame, text=pt, variable=self._type_var,
                                value=pt, bg=C.SURFACE0, fg=C.TEXT,
                                selectcolor=C.SURFACE1, activebackground=C.SURFACE0,
                                activeforeground=C.TEXT, font=F.BODY,
                                highlightthickness=0, bd=0,
                                command=lambda: self._on_detail_change(name))
            rb.pack(side="left", padx=(0, 12))

        # Display toggle
        disp_frame = tk.Frame(detail_frame, bg=C.SURFACE0)
        disp_frame.pack(fill="x", padx=pad, pady=(8, 0))
        tk.Label(disp_frame, text="Display:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.BODY, width=12, anchor="w").pack(side="left")
        self._display_toggle = Toggle(
            disp_frame, initial=pdata.get("display", True),
            on_toggle=lambda v: self._on_display_toggle(name, v),
            bg=C.SURFACE0
        )
        self._display_toggle.pack(side="left")
        self._display_label = tk.Label(
            disp_frame, text="ON" if pdata.get("display", True) else "OFF",
            bg=C.SURFACE0, fg=C.GREEN if pdata.get("display", True) else C.RED,
            font=F.BODY_BOLD
        )
        self._display_label.pack(side="left", padx=(8, 0))

        # Provider-specific fields
        self._provider_frame = tk.Frame(detail_frame, bg=C.SURFACE0)
        self._provider_frame.pack(fill="x", padx=pad, pady=(16, 0))
        self._build_provider_fields(name, pdata)

        # Sizes section
        sizes_hdr = tk.Frame(detail_frame, bg=C.SURFACE0)
        sizes_hdr.pack(fill="x", padx=pad, pady=(20, 4))
        tk.Frame(sizes_hdr, bg=C.SURFACE2, height=1).pack(fill="x", side="top")
        tk.Label(sizes_hdr, text="SIZES", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.TINY).pack(side="left", padx=4, pady=(4, 0))

        sizes_str = pdata.get("sizes", "")
        sizes_list = [s.strip() for s in sizes_str.split(",") if s.strip()]

        self._sizes_frame = tk.Frame(detail_frame, bg=C.SURFACE0)
        self._sizes_frame.pack(fill="x", padx=pad, pady=(4, 0))
        self._rebuild_sizes_list(name, sizes_list)

        # Add size row
        add_frame = tk.Frame(detail_frame, bg=C.SURFACE0)
        add_frame.pack(fill="x", padx=pad, pady=(4, 0))
        self._new_size_var = tk.StringVar()
        size_entry = tk.Entry(add_frame, textvariable=self._new_size_var,
                              bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
                              font=F.MONO, relief="flat", bd=0, width=12,
                              highlightthickness=1, highlightcolor=C.BLUE,
                              highlightbackground=C.SURFACE2)
        size_entry.pack(side="left", padx=(0, 8), ipady=3)
        size_entry.bind("<Return>", lambda e: self._add_size(name))
        FlatBtn(add_frame, text="+ Add", command=lambda: self._add_size(name),
                bg=C.SURFACE1, hover_bg=C.SURFACE2, font=F.SMALL,
                padx=10, pady=4).pack(side="left")

        # Delete button
        del_frame = tk.Frame(detail_frame, bg=C.SURFACE0)
        del_frame.pack(fill="x", padx=pad, pady=(40, 20))
        tk.Frame(del_frame, bg=C.SURFACE2, height=1).pack(fill="x", pady=(0, 12))
        FlatBtn(del_frame, text="  Delete Placement  ",
                command=lambda: self._delete_placement(name),
                bg=C.RED, fg=C.CRUST, hover_bg=_darken(C.RED, 0.8),
                font=F.BODY_BOLD).pack(side="right")

    def _detail_field(self, parent, label: str, value: str, readonly=False,
                      pad=20, tip: str | None = None) -> tk.Entry | None:
        frame = tk.Frame(parent, bg=C.SURFACE0)
        frame.pack(fill="x", padx=pad, pady=(8, 0))
        lbl = tk.Label(frame, text=label, bg=C.SURFACE0, fg=C.OVERLAY0,
                       font=F.BODY, width=12, anchor="w")
        lbl.pack(side="left")
        if tip:
            Tip(lbl, tip)
        if readonly:
            val_lbl = tk.Label(frame, text=value, bg=C.SURFACE0, fg=C.TEXT,
                               font=F.MONO_BOLD, anchor="w")
            val_lbl.pack(side="left", fill="x", expand=True)
            return None
        else:
            var = tk.StringVar(value=value)
            entry = tk.Entry(frame, textvariable=var,
                             bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
                             font=F.MONO, relief="flat", bd=0, width=30,
                             highlightthickness=1, highlightcolor=C.BLUE,
                             highlightbackground=C.SURFACE2)
            entry.pack(side="left", ipady=3)
            entry._var = var
            return entry

    def _build_provider_fields(self, name: str, pdata: dict):
        for w in self._provider_frame.winfo_children():
            w.destroy()

        provider = self._provider_var.get()

        # Section header
        prov_label = provider.upper()
        sep = tk.Frame(self._provider_frame, bg=C.SURFACE0)
        sep.pack(fill="x", pady=(0, 8))
        tk.Frame(sep, bg=C.SURFACE2, height=1).pack(fill="x")
        tk.Label(sep, text=prov_label, bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.TINY).pack(side="left", padx=4, pady=(4, 0))

        self._prov_entries = {}

        if provider == "adsense":
            # Ad Client
            f1 = tk.Frame(self._provider_frame, bg=C.SURFACE0)
            f1.pack(fill="x", pady=(0, 6))
            tk.Label(f1, text="Ad Client:", bg=C.SURFACE0, fg=C.OVERLAY0,
                     font=F.BODY, width=12, anchor="w").pack(side="left")
            v1 = tk.StringVar(value=pdata.get("adClient", ""))
            e1 = tk.Entry(f1, textvariable=v1, bg=C.SURFACE1, fg=C.TEXT,
                          insertbackground=C.TEXT, font=F.MONO, relief="flat",
                          bd=0, width=28, highlightthickness=1,
                          highlightcolor=C.BLUE, highlightbackground=C.SURFACE2)
            e1.pack(side="left", ipady=3)
            v1.trace_add("write", lambda *a: self._on_detail_change(name))
            self._prov_entries["adClient"] = v1

            # Ad Slot
            f2 = tk.Frame(self._provider_frame, bg=C.SURFACE0)
            f2.pack(fill="x", pady=(0, 6))
            tk.Label(f2, text="Ad Slot:", bg=C.SURFACE0, fg=C.OVERLAY0,
                     font=F.BODY, width=12, anchor="w").pack(side="left")
            v2 = tk.StringVar(value=pdata.get("adSlot", ""))
            e2 = tk.Entry(f2, textvariable=v2, bg=C.SURFACE1, fg=C.TEXT,
                          insertbackground=C.TEXT, font=F.MONO, relief="flat",
                          bd=0, width=20, highlightthickness=1,
                          highlightcolor=C.BLUE, highlightbackground=C.SURFACE2)
            e2.pack(side="left", ipady=3)
            v2.trace_add("write", lambda *a: self._on_detail_change(name))
            self._prov_entries["adSlot"] = v2

        elif provider == "gpt":
            f1 = tk.Frame(self._provider_frame, bg=C.SURFACE0)
            f1.pack(fill="x", pady=(0, 6))
            tk.Label(f1, text="GPT Slot:", bg=C.SURFACE0, fg=C.OVERLAY0,
                     font=F.BODY, width=12, anchor="w").pack(side="left")
            v1 = tk.StringVar(value=pdata.get("slot", ""))
            e1 = tk.Entry(f1, textvariable=v1, bg=C.SURFACE1, fg=C.TEXT,
                          insertbackground=C.TEXT, font=F.MONO, relief="flat",
                          bd=0, width=30, highlightthickness=1,
                          highlightcolor=C.BLUE, highlightbackground=C.SURFACE2)
            e1.pack(side="left", ipady=3)
            v1.trace_add("write", lambda *a: self._on_detail_change(name))
            self._prov_entries["slot"] = v1

        elif provider == "direct":
            for field, label, width in [
                ("img", "Image URL:", 30),
                ("href", "Link URL:", 30),
                ("width", "Width:", 8),
                ("height", "Height:", 8),
            ]:
                f = tk.Frame(self._provider_frame, bg=C.SURFACE0)
                f.pack(fill="x", pady=(0, 6))
                tk.Label(f, text=label, bg=C.SURFACE0, fg=C.OVERLAY0,
                         font=F.BODY, width=12, anchor="w").pack(side="left")
                val = pdata.get(field, "")
                if val is None:
                    val = ""
                v = tk.StringVar(value=str(val))
                e = tk.Entry(f, textvariable=v, bg=C.SURFACE1, fg=C.TEXT,
                             insertbackground=C.TEXT, font=F.MONO, relief="flat",
                             bd=0, width=width, highlightthickness=1,
                             highlightcolor=C.BLUE, highlightbackground=C.SURFACE2)
                e.pack(side="left", ipady=3)
                v.trace_add("write", lambda *a: self._on_detail_change(name))
                self._prov_entries[field] = v

        # native has no provider-specific fields
        elif provider == "native":
            tk.Label(self._provider_frame, text="No provider-specific fields",
                     bg=C.SURFACE0, fg=C.OVERLAY0, font=F.SMALL).pack(
                         anchor="w", pady=(0, 6))

    def _rebuild_sizes_list(self, name: str, sizes: list[str]):
        for w in self._sizes_frame.winfo_children():
            w.destroy()

        for i, size in enumerate(sizes):
            row = tk.Frame(self._sizes_frame, bg=C.SURFACE0)
            row.pack(fill="x", pady=1)
            tk.Label(row, text=size, bg=C.SURFACE0, fg=C.TEXT,
                     font=F.MONO, width=12, anchor="w").pack(side="left")
            FlatBtn(row, text="\u00d7",
                    command=lambda idx=i: self._remove_size(name, idx),
                    bg=C.SURFACE0, hover_bg=C.SURFACE1, fg=C.RED,
                    font=("Segoe UI", 11), padx=4, pady=1).pack(side="right")

    # -- Provider change handler ---------------------------------------------
    def _on_provider_change(self, name: str):
        pdata = self.config_data["placements"].get(name, {})
        pdata["provider"] = self._provider_var.get()

        # WHY: clear provider-specific fields when switching providers
        for key in ("adClient", "adSlot", "slot", "img", "href", "width", "height"):
            pdata.pop(key, None)

        self.config_data["placements"][name] = pdata
        self._build_provider_fields(name, pdata)
        self._update_badge()

    # -- Detail change handler -----------------------------------------------
    def _on_detail_change(self, name: str):
        pdata = self.config_data["placements"].get(name, {})
        pdata["provider"] = self._provider_var.get()
        pdata["placementType"] = self._type_var.get()

        # Write provider-specific fields
        for key, var in self._prov_entries.items():
            val = var.get()
            if key in ("width", "height"):
                try:
                    pdata[key] = int(val) if val else None
                except ValueError:
                    pass
            else:
                if val:
                    pdata[key] = val
                else:
                    pdata.pop(key, None)

        self.config_data["placements"][name] = pdata
        self._update_badge()

    # -- Display toggle handler ----------------------------------------------
    def _on_display_toggle(self, name: str, val: bool):
        pdata = self.config_data["placements"].get(name, {})
        pdata["display"] = val
        self.config_data["placements"][name] = pdata

        # Update left panel dot color
        if name in self._list_rows:
            row = self._list_rows[name]
            row._dot.delete("all")
            dot_color = C.GREEN if val else C.RED
            row._dot.create_oval(1, 1, 9, 9, fill=dot_color, outline="")

        # Update display label
        self._display_label.configure(
            text="ON" if val else "OFF",
            fg=C.GREEN if val else C.RED
        )

        self._update_badge()
        self._update_status()

    # -- Size management -----------------------------------------------------
    def _add_size(self, name: str):
        new_size = self._new_size_var.get().strip()
        if not new_size:
            return
        if not SIZE_PATTERN.match(new_size):
            self.toast.show(f"Invalid size \"{new_size}\" — expected WxH (e.g. 300x250)",
                            C.RED, 3000)
            return

        pdata = self.config_data["placements"].get(name, {})
        sizes_str = pdata.get("sizes", "")
        sizes = [s.strip() for s in sizes_str.split(",") if s.strip()]

        if new_size in sizes:
            self.toast.show(f"Size {new_size} already exists", C.OVERLAY0, 2000)
            return

        sizes.append(new_size)
        pdata["sizes"] = ",".join(sizes)
        self.config_data["placements"][name] = pdata
        self._new_size_var.set("")
        self._rebuild_sizes_list(name, sizes)
        self._update_badge()

    def _remove_size(self, name: str, idx: int):
        pdata = self.config_data["placements"].get(name, {})
        sizes_str = pdata.get("sizes", "")
        sizes = [s.strip() for s in sizes_str.split(",") if s.strip()]
        if 0 <= idx < len(sizes):
            sizes.pop(idx)
            pdata["sizes"] = ",".join(sizes)
            self.config_data["placements"][name] = pdata
            self._rebuild_sizes_list(name, sizes)
            self._update_badge()

    # -- New Placement -------------------------------------------------------
    def _new_placement(self):
        dialog = _NewPlacementDialog(self, self.config_data.get("sections", []))
        self.wait_window(dialog)
        if dialog.result is None:
            return

        pname, provider, section_name = dialog.result
        placements = self.config_data.get("placements", {})

        if pname in placements:
            self.toast.show(f"Placement \"{pname}\" already exists", C.RED, 3000)
            return

        # Build default placement
        new_entry = {
            "provider": provider,
            "sizes": "",
            "display": True,
            "placementType": "rail",
        }
        if provider == "adsense":
            new_entry["adClient"] = self.config_data.get("adsenseClient", "")
            new_entry["adSlot"] = ""

        placements[pname] = new_entry
        self.config_data["placements"] = placements

        # Add to section
        sections = self.config_data.get("sections", [])
        found = False
        for sec in sections:
            if sec["name"] == section_name:
                sec["placements"].append(pname)
                found = True
                break
        if not found:
            sections.append({"name": section_name, "placements": [pname]})
            self.config_data["sections"] = sections

        self._selected_name = pname
        self._update_badge()
        self._refresh_list()
        self.toast.show(f"Created \"{pname}\"", C.GREEN, 2500)

    # -- Delete Placement ----------------------------------------------------
    def _delete_placement(self, name: str):
        if not messagebox.askyesno(
                "Delete Placement",
                f"Delete \"{name}\"?\n\nThis will remove it from the registry.\n"
                "Any <AdSlot> templates referencing it will stop rendering.",
                parent=self):
            return

        placements = self.config_data.get("placements", {})
        placements.pop(name, None)
        self.config_data["placements"] = placements

        # Remove from sections
        for sec in self.config_data.get("sections", []):
            if name in sec.get("placements", []):
                sec["placements"].remove(name)

        if self._selected_name == name:
            self._selected_name = None

        self._update_badge()
        self._refresh_list()
        self.toast.show(f"Deleted \"{name}\"", C.PEACH, 2500)

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
        placements = self.config_data.get("placements", {})
        total = len(placements)
        enabled = sum(1 for p in placements.values() if p.get("display", True))
        self._status_right.configure(
            text=f"{total} placements  \u00b7  {enabled}/{total} enabled"
        )

    # -- Change tracking + Save ----------------------------------------------
    def _update_badge(self):
        current = json.dumps(self.config_data, sort_keys=True)
        if current != self._original:
            self.changes_lbl.configure(text="unsaved changes", fg=C.PEACH)
        else:
            self.changes_lbl.configure(text="", fg=C.GREEN)
        self._update_status()

    def _save(self):
        current = json.dumps(self.config_data, sort_keys=True)
        if current == self._original:
            self.toast.show("No changes to save", C.OVERLAY0)
            return
        try:
            save_ads_config(self.config_data)
            self._original = current
            self._update_badge()
            now = datetime.now().strftime("%H:%M:%S")
            n = len(self.config_data.get("placements", {}))
            self.toast.show(
                f"Saved {n} placement{'s' if n != 1 else ''} at {now}",
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


# -- New Placement Dialog ----------------------------------------------------
class _NewPlacementDialog(tk.Toplevel):
    """Modal dialog for creating a new placement."""

    def __init__(self, parent, sections: list[dict]):
        super().__init__(parent)
        self.title("New Placement")
        self.configure(bg=C.MANTLE)
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()

        w, h = 420, 260
        sx = parent.winfo_rootx() + (parent.winfo_width() - w) // 2
        sy = parent.winfo_rooty() + (parent.winfo_height() - h) // 2
        self.geometry(f"{w}x{h}+{sx}+{sy}")

        dark_title_bar(self)

        self.result = None
        self._sections = sections
        section_names = [s["name"] for s in sections]

        pad = 20

        # Name
        f1 = tk.Frame(self, bg=C.MANTLE)
        f1.pack(fill="x", padx=pad, pady=(pad, 8))
        tk.Label(f1, text="Name:", bg=C.MANTLE, fg=C.OVERLAY0,
                 font=F.BODY, width=10, anchor="w").pack(side="left")
        self._name_var = tk.StringVar()
        name_entry = tk.Entry(f1, textvariable=self._name_var,
                              bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
                              font=F.MONO, relief="flat", bd=0, width=24,
                              highlightthickness=1, highlightcolor=C.BLUE,
                              highlightbackground=C.SURFACE2)
        name_entry.pack(side="left", ipady=3)
        name_entry.focus_set()

        # Provider
        f2 = tk.Frame(self, bg=C.MANTLE)
        f2.pack(fill="x", padx=pad, pady=(0, 8))
        tk.Label(f2, text="Provider:", bg=C.MANTLE, fg=C.OVERLAY0,
                 font=F.BODY, width=10, anchor="w").pack(side="left")
        self._prov_var = tk.StringVar(value="adsense")
        prov_menu = tk.OptionMenu(f2, self._prov_var, *PROVIDERS)
        prov_menu.configure(bg=C.SURFACE1, fg=C.TEXT, font=F.BODY,
                            activebackground=C.SURFACE2, activeforeground=C.TEXT,
                            highlightthickness=0, bd=0, relief="flat", width=12)
        prov_menu["menu"].configure(bg=C.SURFACE1, fg=C.TEXT, font=F.BODY,
                                     activebackground=C.BLUE, activeforeground=C.CRUST,
                                     bd=0, relief="flat")
        prov_menu.pack(side="left")

        # Section
        f3 = tk.Frame(self, bg=C.MANTLE)
        f3.pack(fill="x", padx=pad, pady=(0, 8))
        tk.Label(f3, text="Section:", bg=C.MANTLE, fg=C.OVERLAY0,
                 font=F.BODY, width=10, anchor="w").pack(side="left")
        self._section_var = tk.StringVar(value=section_names[0] if section_names else "")
        sec_menu = tk.OptionMenu(f3, self._section_var,
                                  *(section_names if section_names else ["Default"]))
        sec_menu.configure(bg=C.SURFACE1, fg=C.TEXT, font=F.BODY,
                           activebackground=C.SURFACE2, activeforeground=C.TEXT,
                           highlightthickness=0, bd=0, relief="flat", width=12)
        sec_menu["menu"].configure(bg=C.SURFACE1, fg=C.TEXT, font=F.BODY,
                                    activebackground=C.BLUE, activeforeground=C.CRUST,
                                    bd=0, relief="flat")
        sec_menu.pack(side="left")

        # Buttons
        btn_frame = tk.Frame(self, bg=C.MANTLE)
        btn_frame.pack(fill="x", padx=pad, pady=(16, pad))
        FlatBtn(btn_frame, text="  Create  ", command=self._on_create,
                bg=ACCENT, fg=C.CRUST, hover_bg=ACCENT_HOVER,
                font=F.BODY_BOLD).pack(side="right", padx=(8, 0))
        FlatBtn(btn_frame, text="  Cancel  ", command=self.destroy,
                bg=C.SURFACE1, hover_bg=C.SURFACE2,
                font=F.BODY).pack(side="right")

        self.bind("<Return>", lambda e: self._on_create())
        self.bind("<Escape>", lambda e: self.destroy())

    def _on_create(self):
        name = self._name_var.get().strip()
        if not name:
            return
        # WHY: validate name is a valid slug (lowercase, hyphens, no spaces)
        if not re.match(r"^[a-z0-9][a-z0-9\-]*$", name):
            messagebox.showwarning(
                "Invalid Name",
                "Placement name must be lowercase alphanumeric with hyphens.\n"
                "Example: my-new-ad",
                parent=self
            )
            return
        self.result = (name, self._prov_var.get(), self._section_var.get())
        self.destroy()


if __name__ == "__main__":
    app = AdsManager()
    app.mainloop()
