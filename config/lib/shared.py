"""
shared.py — Design system, widgets, and helpers for EG Config Manager.

Single source of truth for all visual tokens, reusable widgets, color math,
and platform helpers. Extracted from the 7 standalone manager .pyw files.
"""

import colorsys
import ctypes
import math
import random
import sys
import tkinter as tk


# ── Color Tokens (Catppuccin Mocha — frozen) ────────────────────────────────

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


# ── Font Tokens ─────────────────────────────────────────────────────────────

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


# ── Collection Constants ────────────────────────────────────────────────────

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


# ── Color Helper Functions ──────────────────────────────────────────────────

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


def darken(hex_color: str, factor: float = 0.7) -> str:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"#{int(r*factor):02x}{int(g*factor):02x}{int(b*factor):02x}"


def generate_distinct_color(existing_colors: list[str]) -> str:
    """Generate a random hex color that's distinct from existing ones."""
    for _ in range(100):
        h = random.randint(0, 359)
        s = random.randint(50, 90)
        l = random.randint(55, 75)
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


# ── Platform Helpers ────────────────────────────────────────────────────────

def setup_dpi_awareness():
    """Enable DPI awareness on Windows. Call before creating any Tk window."""
    if sys.platform == "win32":
        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except Exception:
            pass


def dark_title_bar(window):
    """Apply dark title bar on Windows."""
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


def make_icon(color: str) -> tk.PhotoImage:
    """Create a 32x32 solid-color window icon."""
    ico = tk.PhotoImage(width=1, height=1)
    ico.put(color)
    return ico.zoom(32, 32)


def center_window(window, width: int, height: int):
    """Center a window on screen with given dimensions."""
    sw = window.winfo_screenwidth()
    sh = window.winfo_screenheight()
    x = (sw - width) // 2
    y = (sh - height) // 2
    window.geometry(f"{width}x{height}+{x}+{y}")


def make_dialog(parent, title: str, w: int = 360, h: int = 200) -> tk.Toplevel:
    """Create a centered modal dialog with dark title bar."""
    dlg = tk.Toplevel(parent)
    dlg.title(title)
    dlg.configure(bg=C.SURFACE0)
    dlg.resizable(False, False)
    dlg.transient(parent)
    dlg.grab_set()
    parent.update_idletasks()
    x = parent.winfo_x() + (parent.winfo_width() - w) // 2
    y = parent.winfo_y() + (parent.winfo_height() - h) // 2
    dlg.geometry(f"{w}x{h}+{x}+{y}")
    dark_title_bar(dlg)
    return dlg


# ── Widgets ─────────────────────────────────────────────────────────────────

class Toggle(tk.Canvas):
    """iOS-style pill toggle switch.

    Default size is 38x20 (category-manager). Pass size=(46, 24)
    for the larger variant used by navbar-manager.
    """

    def __init__(self, parent, initial=False, on_toggle=None,
                 size=None, **kw):
        bg = kw.pop("bg", C.SURFACE0)
        w, h = size or (38, 20)
        self.W, self.H = w, h
        super().__init__(parent, width=w, height=h,
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
    """Hover tooltip — attach to any widget. Shows instantly."""

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


class HoverTooltip:
    """Tooltip that appears on hover with a short delay."""

    def __init__(self, widget, text: str, delay: int = 350):
        self._widget = widget
        self._text = text
        self._delay = delay
        self._tip: tk.Toplevel | None = None
        self._after_id: str | None = None
        widget.bind("<Enter>", self._schedule, add="+")
        widget.bind("<Leave>", self._cancel, add="+")

    def _schedule(self, _event):
        self._cancel()
        self._after_id = self._widget.after(self._delay, self._show)

    def _cancel(self, _event=None):
        if self._after_id:
            self._widget.after_cancel(self._after_id)
            self._after_id = None
        if self._tip:
            self._tip.destroy()
            self._tip = None

    def _show(self):
        if self._tip:
            return
        x = self._widget.winfo_rootx()
        y = self._widget.winfo_rooty() + self._widget.winfo_height() + 4
        self._tip = tw = tk.Toplevel(self._widget)
        tw.wm_overrideredirect(True)
        tw.configure(bg=C.SURFACE2)
        inner = tk.Frame(tw, bg=C.SURFACE0, padx=12, pady=8,
                         highlightthickness=1, highlightbackground=C.SURFACE2)
        inner.pack()
        tk.Label(inner, text=self._text, bg=C.SURFACE0, fg=C.TEXT,
                 font=F.SMALL, justify="left", wraplength=340).pack()
        tw.wm_geometry(f"+{x}+{y}")


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


class ColorPicker(tk.Toplevel):
    """Full-featured color picker with SV gradient, hue strip, hex/RGB inputs,
    preset swatches, and live derived-color preview."""

    SV_SIZE = 220
    HUE_W = 24
    HUE_H = 220
    PRESETS = [
        "#00aeff", "#EE8B22", "#ff69b4", "#a855f7", "#22c55e", "#ef4444",
        "#a6e3a1", "#f9e2af", "#74c7ec", "#cba6f7", "#f38ba8", "#94e2d5",
        "#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3", "#54a0ff", "#5f27cd",
        "#01a3a4", "#ff9f43", "#ee5a24", "#c8d6e5", "#8395a7", "#576574",
    ]

    def __init__(self, parent, initial="#ffffff", title="Pick a Color",
                 category_id="", on_preview=None, accent=None):
        super().__init__(parent)
        self.title(title)
        self._accent = accent or C.BLUE
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
        self.result = None

        r, g, b = hex_to_rgb(initial)
        h_val, s_val, v_val = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        self._hue = h_val
        self._sat = s_val
        self._val = v_val
        self._suppress_trace = False

        self._build_ui()
        self._draw_sv()
        self._draw_hue()
        self._sync_from_hsv()

    def _build_ui(self):
        top = tk.Frame(self, bg=C.SURFACE0)
        top.pack(fill="both", expand=True, padx=16, pady=(16, 8))

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

        right = tk.Frame(top, bg=C.SURFACE0)
        right.pack(side="left", fill="both", expand=True, padx=(16, 0))

        self._preview = tk.Canvas(right, width=80, height=50, highlightthickness=1,
                                  highlightbackground=C.SURFACE2)
        self._preview.pack(anchor="w", pady=(0, 10))

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

        btn_row = tk.Frame(self, bg=C.SURFACE0)
        btn_row.pack(fill="x", padx=16, pady=(0, 16))
        FlatBtn(btn_row, text="Cancel", command=self._cancel,
                bg=C.SURFACE1, hover_bg=C.SURFACE2).pack(side="right", padx=(8, 0))
        hover = derive_colors(self._accent).get("hover", self._accent)
        FlatBtn(btn_row, text="  OK  ", command=self._ok,
                bg=self._accent, fg=C.CRUST, hover_bg=hover,
                font=F.BODY_BOLD).pack(side="right")

        self.bind("<Return>", lambda e: self._ok())
        self.bind("<Escape>", lambda e: self._cancel())

    def _draw_sv(self):
        size = self.SV_SIZE
        img = tk.PhotoImage(width=size, height=size)
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
        self._sv_img = img
        self._sv_canvas.delete("all")
        self._sv_canvas.create_image(0, 0, anchor="nw", image=img)
        cx = int(self._sat * (size - 1))
        cy = int((1.0 - self._val) * (size - 1))
        ring_color = "#ffffff" if self._val < 0.5 else "#000000"
        self._sv_canvas.create_oval(cx - 6, cy - 6, cx + 6, cy + 6,
                                    outline=ring_color, width=2)

    def _draw_hue(self):
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
        hy = int(self._hue * (h - 1))
        self._hue_canvas.create_polygon(0, hy - 4, 6, hy, 0, hy + 4,
                                        fill="#ffffff", outline=C.SURFACE2)
        self._hue_canvas.create_polygon(w, hy - 4, w - 6, hy, w, hy + 4,
                                        fill="#ffffff", outline=C.SURFACE2)

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
        r, g, b = hex_to_rgb(hex_color)
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        self._hue, self._sat, self._val = h, s, v
        self._draw_sv()
        self._draw_hue()
        self._sync_from_hsv()

    def _sync_from_hsv(self):
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
        try:
            derived = derive_colors(hex_color)
            for key, canvas in self._derived_canvases.items():
                val = derived.get(key, hex_color)
                if val.startswith("rgba"):
                    continue
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


# ── Category Icon Drawers (tk Canvas primitives) ───────────────────────────

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
