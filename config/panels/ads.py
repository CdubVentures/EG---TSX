"""
panels/ads.py — Ads panel for EG Config Manager.

Manages three JSON configs plus the PUBLIC_ADS_ENABLED env toggle.
Contains five internal sub-tabs: Positions, Usage Scanner, Inline Config,
Sponsors, Dashboard.
"""

import copy
import json
import re
import tkinter as tk
from tkinter import ttk, messagebox, simpledialog, filedialog
from datetime import datetime
from pathlib import Path

from lib.shared import C, F, FlatBtn, Tip, Toggle, darken, dark_title_bar
from lib.config_store import ConfigStore


# -- Constants ---------------------------------------------------------------

PROVIDERS = ["adsense", "direct"]
PLACEMENT_TYPES = ["rail", "inline"]
SAMPLE_AD_MODES = ["mixed", "svg", "video"]
SAMPLE_AD_NETWORKS = ["mixed", "adsense", "raptive", "mediavine", "ezoic"]
SIZE_PATTERN = re.compile(r"^\d+x\d+$")
IAB_SIZE_PRESETS = {
    "Leaderboard": "728x90",
    "Medium Rectangle": "300x250",
    "Large Rectangle": "336x280",
    "Half Page": "300x600",
    "Billboard": "970x250",
    "Mobile Banner": "320x50",
    "Mobile Leaderboard": "320x100",
    "Large Mobile": "320x480",
    "Skyscraper": "300x400",
}

DEFAULT_REGISTRY = {
    "global": {
        "adsenseClient": "",
        "adLabel": "Ad",
        "showProductionPlaceholders": False,
        "loadSampleAds": False,
        "sampleAdMode": "mixed",
        "sampleAdNetwork": "mixed",
    },
    "positions": {},
}

DEFAULT_INLINE = {
    "defaults": {"position": "in_content"},
    "collections": {},
}

DEFAULT_SPONSORS = {
    "creatives": {},
}

COLLECTIONS = ["reviews", "guides", "news", "games", "brands", "pages"]
PUBLIC_ADS_ENABLED_KEY = "PUBLIC_ADS_ENABLED"


# -- Pure functions (testable without GUI) -----------------------------------

def parse_sizes(sizes_str: str) -> list[tuple[int, int]]:
    """Parse a comma-separated sizes string into (width, height) tuples."""
    result = []
    for s in sizes_str.split(","):
        s = s.strip()
        if SIZE_PATTERN.match(s):
            w, h = s.split("x")
            result.append((int(w), int(h)))
    return result


def filter_positions(names: list[str], query: str) -> list[str]:
    """Filter position names by case-insensitive substring match."""
    if not query:
        return list(names)
    q = query.lower()
    return [n for n in names if q in n.lower()]


def calculate_inline_ads(word_count: int, cfg: dict) -> tuple[int, int]:
    """Calculate number of inline ads for desktop and mobile. Returns (desktop, mobile)."""
    desktop_cfg = cfg.get("desktop", {})
    mobile_cfg = cfg.get("mobile", {})
    scaling = cfg.get("wordScaling")
    d_count, m_count = 0, 0
    if desktop_cfg:
        wpa = (scaling or {}).get("desktopWordsPerAd", 0)
        max_d = desktop_cfg.get("max", 8)
        if scaling and scaling.get("enabled") and wpa > 0:
            d_count = min(word_count // wpa, max_d)
        else:
            paras = max(1, word_count // 100)
            first = desktop_cfg.get("firstAfter", 3)
            every = desktop_cfg.get("every", 5)
            if paras > first and every > 0:
                d_count = min(1 + (paras - first - 1) // every, max_d)
    if mobile_cfg:
        wpa = (scaling or {}).get("mobileWordsPerAd", 0)
        max_m = mobile_cfg.get("max", 10)
        if scaling and scaling.get("enabled") and wpa > 0:
            m_count = min(word_count // wpa, max_m)
        else:
            paras = max(1, word_count // 100)
            first = mobile_cfg.get("firstAfter", 3)
            every = mobile_cfg.get("every", 4)
            if paras > first and every > 0:
                m_count = min(1 + (paras - first - 1) // every, max_m)
    return (d_count, m_count)


def normalize_weights(weights: list[float]) -> list[float]:
    """Normalize a list of weights to sum to 100."""
    total = sum(weights)
    if total == 0 or not weights:
        return [100.0 / len(weights) if weights else 0.0] * len(weights)
    return [round(w / total * 100, 1) for w in weights]


def grep_usages(position: str, src_dir: Path) -> list[tuple[str, int, str]]:
    """Search src/ for position="<name>" references. Returns [(path, line, text)]."""
    results = []
    if not src_dir.is_dir():
        return results
    pattern = re.compile(r'''['"]''' + re.escape(position) + r'''['"]''')
    exts = {".astro", ".ts", ".tsx", ".md", ".mdx"}
    for p in src_dir.rglob("*"):
        if p.suffix not in exts or not p.is_file():
            continue
        try:
            for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
                if pattern.search(line):
                    results.append((str(p.relative_to(src_dir.parent)), i, line.strip()))
        except (OSError, UnicodeDecodeError):
            pass
    return results


def scan_all_positions(src_dir: Path, skip_ads_internals: bool = True) -> list[tuple[str, int, str, str]]:
    """Scan src/ for <AdSlot position="..."> references.

    Returns [(relative_path, line_number, position_name, line_text)].
    """
    results = []
    if not src_dir.is_dir():
        return results
    pattern = re.compile(
        r'<(?:AdSlot|InlineAd)\b[^>]*\bposition\s*=\s*["\']([^"\']+)["\']')
    exts = {".astro", ".ts", ".tsx"}
    ads_dir = src_dir / "features" / "ads"
    for p in sorted(src_dir.rglob("*")):
        if p.suffix not in exts or not p.is_file():
            continue
        if skip_ads_internals and ads_dir.is_dir() and p.is_relative_to(ads_dir):
            continue
        try:
            for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
                for m in pattern.finditer(line):
                    position = m.group(1)
                    rel = str(p.relative_to(src_dir.parent))
                    results.append((rel, i, position, line.strip()))
        except (OSError, UnicodeDecodeError):
            pass
    return results


def read_text_file(path: Path) -> str:
    """Read UTF-8 text or return an empty string when the file is missing."""
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


def read_env_value(env_source: str, key: str) -> str | None:
    """Return the raw value for an env assignment key, if present."""
    for raw_line in env_source.splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#") or "=" not in raw_line:
            continue
        candidate_key, candidate_value = raw_line.split("=", 1)
        if candidate_key.strip() == key:
            return candidate_value.strip()
    return None


def read_env_bool(env_source: str, key: str, default: bool = False) -> bool:
    """Return an env boolean where only the literal 'true' means enabled."""
    value = read_env_value(env_source, key)
    if value is None:
        return default
    return value.lower() == "true"


def upsert_env_value(env_source: str, key: str, value: str) -> str:
    """Replace or append a simple KEY=value assignment and normalize trailing newline."""
    lines = env_source.splitlines()
    updated_lines = []
    replaced = False

    for raw_line in lines:
        stripped = raw_line.strip()
        if stripped and not stripped.startswith("#") and "=" in raw_line:
            candidate_key, _candidate_value = raw_line.split("=", 1)
            if candidate_key.strip() == key:
                updated_lines.append(f"{key}={value}")
                replaced = True
                continue
        updated_lines.append(raw_line)

    if not replaced:
        updated_lines.append(f"{key}={value}")

    return "\n".join(updated_lines).rstrip("\n") + "\n"


# -- Panel -------------------------------------------------------------------

class AdsPanel(tk.Frame):
    """Ads management panel — manages positions, inline config, and sponsors."""

    def __init__(self, parent: tk.Widget, app):
        super().__init__(parent, bg=C.MANTLE)
        self._app = app
        # WHY: self._root shadows tkinter's internal _root() on Frame
        self._project_root = app.store._root
        self._env_path = self._project_root / ".env"

        # Load data
        self._config_data = app.store.get(ConfigStore.ADS_REGISTRY) or copy.deepcopy(DEFAULT_REGISTRY)
        self._inline_data = app.store.get(ConfigStore.INLINE_ADS) or copy.deepcopy(DEFAULT_INLINE)
        self._sponsors_data = app.store.get(ConfigStore.SPONSORS) or copy.deepcopy(DEFAULT_SPONSORS)

        # Snapshots for dirty tracking
        self._original = json.dumps(self._config_data, sort_keys=True)
        self._inline_original = json.dumps(self._inline_data, sort_keys=True)
        self._sponsors_original = json.dumps(self._sponsors_data, sort_keys=True)
        self._ads_enabled_original = read_env_bool(
            read_text_file(self._env_path),
            PUBLIC_ADS_ENABLED_KEY,
            default=False,
        )

        # Current selection state
        self._selected_name: str | None = None
        self._filter_var = tk.StringVar()
        self._sponsor_selected_idx: int | None = None

        # Build UI
        self._build_globals_bar()
        self._build_notebook()

        # Subscribe to external changes
        app.store.subscribe(ConfigStore.ADS_REGISTRY, self._on_registry_change)
        app.store.subscribe(ConfigStore.INLINE_ADS, self._on_inline_ext_change)
        app.store.subscribe(ConfigStore.SPONSORS, self._on_sponsors_ext_change)
        # WHY: CATEGORIES subscription removed — mega-app dispatches centrally
        # to avoid refreshing hidden panels

        self._update_status()

    # -- Globals bar ---------------------------------------------------------

    def _build_globals_bar(self):
        bar = tk.Frame(self, bg=C.SURFACE0, highlightthickness=1,
                       highlightbackground=C.CARD_BORDER)
        bar.pack(fill="x", padx=16, pady=(12, 0), ipady=6)

        tk.Label(bar, text="AdSense Client:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.BODY).pack(side="left", padx=(16, 4))
        self._client_var = tk.StringVar(
            value=self._config_data.get("global", {}).get("adsenseClient", ""))
        client_entry = tk.Entry(bar, textvariable=self._client_var,
                                bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
                                font=F.MONO, relief="flat", bd=0, width=28,
                                highlightthickness=1, highlightcolor=C.BLUE,
                                highlightbackground=C.SURFACE2)
        client_entry.pack(side="left", padx=(0, 20), ipady=3)
        self._client_var.trace_add("write", lambda *a: self._on_global_change())

        tk.Label(bar, text="Ad Label:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.BODY).pack(side="left", padx=(0, 4))
        self._label_var = tk.StringVar(
            value=self._config_data.get("global", {}).get("adLabel", "Ad"))
        label_entry = tk.Entry(bar, textvariable=self._label_var,
                               bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
                               font=F.BODY, relief="flat", bd=0, width=8,
                               highlightthickness=1, highlightcolor=C.BLUE,
                               highlightbackground=C.SURFACE2)
        label_entry.pack(side="left", ipady=3)
        self._label_var.trace_add("write", lambda *a: self._on_global_change())

        tk.Frame(bar, bg=C.SURFACE2, width=1).pack(side="left", fill="y",
                                                     padx=(20, 20), pady=4)

        tk.Label(bar, text="Ads Enabled:", bg=C.SURFACE0,
                 fg=C.OVERLAY0, font=F.BODY).pack(side="left", padx=(0, 4))
        self._ads_enabled_toggle = Toggle(
            bar,
            initial=self._ads_enabled_original,
            on_toggle=lambda v: self._on_global_change(),
            bg=C.SURFACE0,
        )
        self._ads_enabled_toggle.pack(side="left", padx=(0, 12))
        Tip(self._ads_enabled_toggle,
            "Controls PUBLIC_ADS_ENABLED in the project .env file.\n"
            "When ON, live ad wiring is used in dev and production.\n"
            "When OFF, placeholders or sample ads render instead.")

        tk.Label(bar, text="Production Placeholders:", bg=C.SURFACE0,
                 fg=C.OVERLAY0, font=F.BODY).pack(side="left", padx=(0, 4))
        self._prod_ph_toggle = Toggle(
            bar,
            initial=self._config_data.get("global", {}).get("showProductionPlaceholders", False),
            on_toggle=lambda v: self._on_global_change(),
            bg=C.SURFACE0,
        )
        self._prod_ph_toggle.pack(side="left", padx=(0, 4))
        Tip(self._prod_ph_toggle,
            "When ON and ads are disabled, shows HBS-style\n"
            "production placeholder (top/bottom border + Ad circle)\n"
            "instead of dev dashed-outline placeholder.")

        tk.Label(bar, text="Sample Ads:", bg=C.SURFACE0,
                 fg=C.OVERLAY0, font=F.BODY).pack(side="left", padx=(16, 4))
        self._sample_ads_toggle = Toggle(
            bar,
            initial=self._config_data.get("global", {}).get("loadSampleAds", False),
            on_toggle=lambda v: self._on_global_change(),
            bg=C.SURFACE0,
        )
        self._sample_ads_toggle.pack(side="left")
        Tip(self._sample_ads_toggle,
            "When ON, dev uses realistic SVG/video sample creatives\n"
            "instead of live networks so layout matches real ads.\n"
            "This never ships sample creatives in production.")

        tk.Label(bar, text="Mode:", bg=C.SURFACE0,
                 fg=C.OVERLAY0, font=F.BODY).pack(side="left", padx=(12, 4))
        self._sample_mode_var = tk.StringVar(
            value=self._config_data.get("global", {}).get("sampleAdMode", "mixed"))
        sample_mode_menu = ttk.Combobox(
            bar,
            textvariable=self._sample_mode_var,
            values=SAMPLE_AD_MODES,
            width=8,
            state="readonly",
        )
        sample_mode_menu.pack(side="left", padx=(0, 4))
        sample_mode_menu.bind("<<ComboboxSelected>>", lambda e: self._on_global_change())
        Tip(sample_mode_menu,
            "Sample creative format for dev-only ads.\n"
            "mixed rotates SVG and video, svg forces static art,\n"
            "video forces motion creatives when available.")

        tk.Label(bar, text="Network:", bg=C.SURFACE0,
                 fg=C.OVERLAY0, font=F.BODY).pack(side="left", padx=(12, 4))
        self._sample_network_var = tk.StringVar(
            value=self._config_data.get("global", {}).get("sampleAdNetwork", "mixed"))
        sample_network_menu = ttk.Combobox(
            bar,
            textvariable=self._sample_network_var,
            values=SAMPLE_AD_NETWORKS,
            width=11,
            state="readonly",
        )
        sample_network_menu.pack(side="left", padx=(0, 4))
        sample_network_menu.bind("<<ComboboxSelected>>", lambda e: self._on_global_change())
        Tip(sample_network_menu,
            "Select the simulated ad network mix for dev-only creatives.\n"
            "mixed rotates Google-style and premium-network samples.")

    def _on_global_change(self):
        g = self._config_data.setdefault("global", {})
        g["adsenseClient"] = self._client_var.get()
        g["adLabel"] = self._label_var.get()
        g["showProductionPlaceholders"] = self._prod_ph_toggle.get()
        g["loadSampleAds"] = self._sample_ads_toggle.get()
        g["sampleAdMode"] = self._sample_mode_var.get()
        g["sampleAdNetwork"] = self._sample_network_var.get()
        self._update_badge()

    # -- Notebook (5 sub-tabs) -----------------------------------------------

    def _setup_styles(self):
        s = ttk.Style()
        s.configure("Ads.TNotebook", background=C.MANTLE, borderwidth=0)
        s.configure("Ads.TNotebook.Tab",
                     background=C.SURFACE1, foreground=C.OVERLAY0,
                     padding=[28, 12], borderwidth=0, font=F.BODY_BOLD,
                     focuscolor=C.SURFACE1)
        s.map("Ads.TNotebook.Tab",
              background=[("selected", C.SURFACE0), ("active", C.SURFACE2)],
              foreground=[("selected", C.TEXT), ("active", C.SUBTEXT1)])

    def _build_notebook(self):
        self._setup_styles()
        self._nb = ttk.Notebook(self, style="Ads.TNotebook")
        self._nb.pack(fill="both", expand=True)
        self._build_placements_tab()
        self._build_usage_scanner_tab()
        self._build_inline_tab()
        self._build_sponsors_tab()
        self._build_dashboard_tab()

    # -- Tab 1: Positions ----------------------------------------------------

    def _build_placements_tab(self):
        tab = tk.Frame(self._nb, bg=C.MANTLE)
        self._nb.add(tab, text="  Positions  ")

        panel_frame = tk.Frame(tab, bg=C.MANTLE)
        panel_frame.pack(fill="both", expand=True, padx=16, pady=(8, 0))

        self._list_frame = tk.Frame(panel_frame, bg=C.SURFACE0,
                                     highlightthickness=1,
                                     highlightbackground=C.CARD_BORDER)
        self._list_frame.pack(side="left", fill="y", padx=(0, 8))
        self._list_frame.configure(width=350)
        self._list_frame.pack_propagate(False)

        self._detail_outer = tk.Frame(panel_frame, bg=C.SURFACE0,
                                       highlightthickness=1,
                                       highlightbackground=C.CARD_BORDER)
        self._detail_outer.pack(side="right", fill="both", expand=True, padx=(8, 0))

        self._refresh_list()

    def _refresh_list(self):
        for w in self._list_frame.winfo_children():
            w.destroy()

        accent = self._app.store.site_accent

        tk.Frame(self._list_frame, bg=accent, height=3).pack(fill="x")
        hdr = tk.Frame(self._list_frame, bg=C.SURFACE0)
        hdr.pack(fill="x", padx=12, pady=(10, 2))
        tk.Label(hdr, text="POSITIONS", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(side="left")

        # Filter bar
        filter_frame = tk.Frame(self._list_frame, bg=C.SURFACE0)
        filter_frame.pack(fill="x", padx=12, pady=(4, 0))
        filter_entry = tk.Entry(filter_frame, textvariable=self._filter_var,
                                bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
                                font=F.SMALL, relief="flat", bd=0,
                                highlightthickness=1, highlightcolor=C.BLUE,
                                highlightbackground=C.SURFACE2)
        filter_entry.pack(side="left", fill="x", expand=True, ipady=3)
        if not self._filter_var.get():
            filter_entry.insert(0, "Filter positions...")
            filter_entry.configure(fg=C.OVERLAY0)

        def _on_focus_in(e):
            if filter_entry.get() == "Filter positions...":
                filter_entry.delete(0, "end")
                filter_entry.configure(fg=C.TEXT)
        def _on_focus_out(e):
            if not filter_entry.get():
                filter_entry.insert(0, "Filter positions...")
                filter_entry.configure(fg=C.OVERLAY0)
        filter_entry.bind("<FocusIn>", _on_focus_in)
        filter_entry.bind("<FocusOut>", _on_focus_out)
        clear_btn = FlatBtn(filter_frame, text="\u00d7", bg=C.SURFACE0,
                            hover_bg=C.SURFACE1, fg=C.OVERLAY0,
                            font=("Segoe UI", 11), padx=4, pady=1,
                            command=lambda: (self._filter_var.set(""),
                                             filter_entry.focus_set()))
        clear_btn.pack(side="right", padx=(4, 0))
        self._filter_var.trace_add("write", lambda *a: self._apply_filter())

        # Scrollable list
        canvas = tk.Canvas(self._list_frame, bg=C.SURFACE0,
                           highlightthickness=0, bd=0)
        scrollbar = tk.Scrollbar(self._list_frame, orient="vertical",
                                  command=canvas.yview)
        self._list_inner = tk.Frame(canvas, bg=C.SURFACE0)
        self._list_inner.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=self._list_inner, anchor="nw",
                              tags="inner")
        canvas.configure(yscrollcommand=scrollbar.set)

        # WHY: scope mousewheel to this canvas only
        canvas.bind("<MouseWheel>",
                     lambda e: canvas.yview_scroll(int(-1 * (e.delta / 120)), "units"))

        def _resize_inner(e):
            canvas.itemconfigure("inner", width=e.width)
        canvas.bind("<Configure>", _resize_inner)

        scrollbar.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)

        positions = self._config_data.get("positions", {})
        self._list_rows: dict[str, tk.Frame] = {}

        for pname in positions:
            pdata = positions.get(pname, {})
            self._make_list_row(pname, pdata)

        # New Position button
        btn_frame = tk.Frame(self._list_inner, bg=C.SURFACE0)
        btn_frame.pack(fill="x", padx=12, pady=(16, 12))
        FlatBtn(btn_frame, text="+ New Position", command=self._new_placement,
                bg=C.SURFACE1, hover_bg=C.SURFACE2, font=F.SMALL).pack(fill="x")

        if self._selected_name and self._selected_name in positions:
            self._show_detail(self._selected_name)
        else:
            self._show_empty_detail()

    def _make_list_row(self, name: str, pdata: dict) -> tk.Frame:
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

        return row

    def _apply_filter(self):
        query = self._filter_var.get().strip().lower()
        if query == "filter positions...":
            query = ""
        for pname, row in self._list_rows.items():
            matches = not query or query in pname.lower()
            if matches:
                row.pack(fill="x", padx=8, pady=1)
            else:
                row.pack_forget()

    def _select_placement(self, name: str):
        if self._selected_name and self._selected_name in self._list_rows:
            prev = self._list_rows[self._selected_name]
            prev.configure(bg=C.SURFACE0)
            prev._dot.configure(bg=C.SURFACE0)
            prev._lbl.configure(bg=C.SURFACE0, fg=C.SUBTEXT1)

        self._selected_name = name

        if name in self._list_rows:
            row = self._list_rows[name]
            row.configure(bg=C.SURFACE1)
            row._dot.configure(bg=C.SURFACE1)
            row._lbl.configure(bg=C.SURFACE1, fg=C.TEXT)

        self._show_detail(name)

    def _show_empty_detail(self):
        for w in self._detail_outer.winfo_children():
            w.destroy()
        accent = self._app.store.site_accent
        tk.Frame(self._detail_outer, bg=accent, height=3).pack(fill="x")
        tk.Label(self._detail_outer, text="Select a position",
                 bg=C.SURFACE0, fg=C.OVERLAY0, font=F.BODY).pack(expand=True)

    def _show_detail(self, name: str):
        for w in self._detail_outer.winfo_children():
            w.destroy()

        accent = self._app.store.site_accent
        positions = self._config_data.get("positions", {})
        pdata = positions.get(name, {})

        tk.Frame(self._detail_outer, bg=accent, height=3).pack(fill="x")

        # Scrollable detail
        detail_canvas = tk.Canvas(self._detail_outer, bg=C.SURFACE0,
                                   highlightthickness=0, bd=0)
        detail_scroll = tk.Scrollbar(self._detail_outer, orient="vertical",
                                      command=detail_canvas.yview)
        detail_frame = tk.Frame(detail_canvas, bg=C.SURFACE0)
        detail_frame.bind(
            "<Configure>",
            lambda e: detail_canvas.configure(scrollregion=detail_canvas.bbox("all")))
        detail_canvas.create_window((0, 0), window=detail_frame, anchor="nw",
                                     tags="detail_inner")

        def _resize_detail(e):
            detail_canvas.itemconfigure("detail_inner", width=e.width)
        detail_canvas.bind("<Configure>", _resize_detail)

        detail_canvas.configure(yscrollcommand=detail_scroll.set)
        # WHY: scope mousewheel to detail canvas
        detail_canvas.bind("<MouseWheel>",
                            lambda e: detail_canvas.yview_scroll(
                                int(-1 * (e.delta / 120)), "units"))
        detail_scroll.pack(side="right", fill="y")
        detail_canvas.pack(side="left", fill="both", expand=True)

        pad = 20

        # Header
        hdr = tk.Frame(detail_frame, bg=C.SURFACE0)
        hdr.pack(fill="x", padx=pad, pady=(16, 4))
        tk.Label(hdr, text="POSITION DETAIL", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(side="left")

        # Name (read-only)
        self._detail_field(detail_frame, "Name:", name, readonly=True, pad=pad,
                           tip="Position names are used in <AdSlot position=\"...\"> "
                               "template references. Renaming requires updating templates.")

        # Provider dropdown
        prov_frame = tk.Frame(detail_frame, bg=C.SURFACE0)
        prov_frame.pack(fill="x", padx=pad, pady=(8, 0))
        tk.Label(prov_frame, text="Provider:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.BODY, width=12, anchor="w").pack(side="left")
        self._provider_var = tk.StringVar(value=pdata.get("provider", "adsense"))
        prov_menu = tk.OptionMenu(
            prov_frame, self._provider_var, *PROVIDERS,
            command=lambda v: self._on_provider_change(name))
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
            bg=C.SURFACE0)
        self._display_toggle.pack(side="left")
        self._display_label = tk.Label(
            disp_frame, text="ON" if pdata.get("display", True) else "OFF",
            bg=C.SURFACE0,
            fg=C.GREEN if pdata.get("display", True) else C.RED,
            font=F.BODY_BOLD)
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

        # Size presets
        preset_frame = tk.Frame(detail_frame, bg=C.SURFACE0)
        preset_frame.pack(fill="x", padx=pad, pady=(4, 0))
        tk.Label(preset_frame, text="Preset:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL).pack(side="left", padx=(0, 6))
        preset_values = [f"{label} ({size})" for label, size in IAB_SIZE_PRESETS.items()]
        preset_combo = ttk.Combobox(preset_frame, values=preset_values,
                                     state="readonly", width=28)
        preset_combo.pack(side="left")
        def _on_preset(e):
            sel = preset_combo.get()
            if "(" in sel and ")" in sel:
                size = sel.split("(")[1].rstrip(")")
                self._new_size_var.set(size)
                self._add_size(name)
                preset_combo.set("")
        preset_combo.bind("<<ComboboxSelected>>", _on_preset)

        # Size preview canvas
        if sizes_list:
            preview_frame = tk.Frame(detail_frame, bg=C.SURFACE0)
            preview_frame.pack(fill="x", padx=pad, pady=(8, 0))
            self._draw_size_preview(preview_frame, sizes_list)

        # Notes field
        notes_hdr = tk.Frame(detail_frame, bg=C.SURFACE0)
        notes_hdr.pack(fill="x", padx=pad, pady=(16, 4))
        tk.Frame(notes_hdr, bg=C.SURFACE2, height=1).pack(fill="x", side="top")
        tk.Label(notes_hdr, text="NOTES", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.TINY).pack(side="left", padx=4, pady=(4, 0))
        self._notes_text = tk.Text(detail_frame, height=3, bg=C.SURFACE1,
                                    fg=C.TEXT, insertbackground=C.TEXT,
                                    font=F.SMALL, relief="flat", bd=0,
                                    highlightthickness=1, highlightcolor=C.BLUE,
                                    highlightbackground=C.SURFACE2, wrap="word")
        self._notes_text.pack(fill="x", padx=pad)
        self._notes_text.insert("1.0", pdata.get("notes", ""))
        self._notes_text.bind("<KeyRelease>",
                              lambda e: self._on_notes_change(name))

        # Actions row
        act_frame = tk.Frame(detail_frame, bg=C.SURFACE0)
        act_frame.pack(fill="x", padx=pad, pady=(40, 20))
        tk.Frame(act_frame, bg=C.SURFACE2, height=1).pack(fill="x", pady=(0, 12))

        accent_hover = darken(self._app.store.site_accent)
        FlatBtn(act_frame, text="  Delete Placement  ",
                command=lambda: self._delete_placement(name),
                bg=C.RED, fg=C.CRUST, hover_bg=darken(C.RED, 0.8),
                font=F.BODY_BOLD).pack(side="right")
        FlatBtn(act_frame, text="  Duplicate  ",
                command=lambda: self._duplicate_placement(name),
                bg=C.SURFACE1, hover_bg=C.SURFACE2,
                font=F.BODY).pack(side="right", padx=(0, 8))
        FlatBtn(act_frame, text="  Find Usages  ",
                command=lambda: self._find_usages(name),
                bg=C.SURFACE1, hover_bg=C.SURFACE2,
                font=F.BODY).pack(side="right", padx=(0, 8))
        FlatBtn(act_frame, text="  Export  ",
                command=self._export_config,
                bg=C.SURFACE1, hover_bg=C.SURFACE2, font=F.SMALL,
                padx=8, pady=4).pack(side="left")
        FlatBtn(act_frame, text="  Import  ",
                command=self._import_config,
                bg=C.SURFACE1, hover_bg=C.SURFACE2, font=F.SMALL,
                padx=8, pady=4).pack(side="left", padx=(4, 0))

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
        prov_label = provider.upper()
        sep = tk.Frame(self._provider_frame, bg=C.SURFACE0)
        sep.pack(fill="x", pady=(0, 8))
        tk.Frame(sep, bg=C.SURFACE2, height=1).pack(fill="x")
        tk.Label(sep, text=prov_label, bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.TINY).pack(side="left", padx=4, pady=(4, 0))

        self._prov_entries = {}

        if provider == "adsense":
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

    def _draw_size_preview(self, parent: tk.Frame, sizes_list: list[str]):
        parsed = parse_sizes(",".join(sizes_list))
        if not parsed:
            return
        largest_area = max(w * h for w, h in parsed)
        parsed_sorted = sorted(parsed, key=lambda wh: wh[0] * wh[1], reverse=True)

        pad, gap = 8, 6
        avail_w = 500
        max_w = max(w for w, _ in parsed_sorted)
        max_h = max(h for _, h in parsed_sorted)
        scale = min(180 / max_w, 80 / max_h, 1.0)

        items = []
        for w, h in parsed_sorted:
            sw = max(int(w * scale), 20)
            sh = max(int(h * scale), 14)
            items.append((w, h, sw, sh))

        rows: list[list[tuple]] = [[]]
        row_w = pad
        for item in items:
            _, _, sw, _ = item
            if row_w + sw + gap > avail_w and rows[-1]:
                rows.append([])
                row_w = pad
            rows[-1].append(item)
            row_w += sw + gap

        total_h = pad
        for row in rows:
            row_h = max(sh for _, _, _, sh in row)
            total_h += row_h + gap
        total_h += pad

        canvas_h = max(total_h, 40)
        cvs = tk.Canvas(parent, width=avail_w, height=canvas_h,
                        bg=C.SURFACE1, highlightthickness=1,
                        highlightbackground=C.SURFACE2, bd=0)
        cvs.pack(anchor="w", pady=(4, 0))

        y = pad
        for row in rows:
            row_h = max(sh for _, _, _, sh in row)
            x = pad
            for orig_w, orig_h, sw, sh in row:
                is_largest = (orig_w * orig_h == largest_area)
                outline = C.BLUE if is_largest else C.OVERLAY0
                lw = 2 if is_largest else 1
                y_off = y + (row_h - sh) // 2
                cvs.create_rectangle(x, y_off, x + sw, y_off + sh,
                                     outline=outline, width=lw, fill="")
                label = f"{orig_w}x{orig_h}"
                if sh >= 18:
                    cvs.create_text(x + sw // 2, y_off + sh // 2,
                                    text=label, fill=C.SUBTEXT0, font=F.TINY)
                else:
                    cvs.create_text(x + sw // 2, y_off + sh + 8,
                                    text=label, fill=C.SUBTEXT0, font=F.TINY)
                x += sw + gap
            y += row_h + gap

    # -- Position detail change handlers -------------------------------------

    def _on_provider_change(self, name: str):
        pdata = self._config_data["positions"].get(name, {})
        pdata["provider"] = self._provider_var.get()
        for key in ("adSlot", "img", "href", "width", "height"):
            pdata.pop(key, None)
        self._config_data["positions"][name] = pdata
        self._build_provider_fields(name, pdata)
        self._update_badge()

    def _on_detail_change(self, name: str):
        pdata = self._config_data["positions"].get(name, {})
        pdata["provider"] = self._provider_var.get()
        pdata["placementType"] = self._type_var.get()
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
        self._config_data["positions"][name] = pdata
        self._update_badge()

    def _on_notes_change(self, name: str):
        text = self._notes_text.get("1.0", "end-1c").strip()
        pdata = self._config_data["positions"].get(name, {})
        if text:
            pdata["notes"] = text
        else:
            pdata.pop("notes", None)
        self._config_data["positions"][name] = pdata
        self._update_badge()

    def _on_display_toggle(self, name: str, val: bool):
        pdata = self._config_data["positions"].get(name, {})
        pdata["display"] = val
        self._config_data["positions"][name] = pdata

        if name in self._list_rows:
            row = self._list_rows[name]
            row._dot.delete("all")
            dot_color = C.GREEN if val else C.RED
            row._dot.create_oval(1, 1, 9, 9, fill=dot_color, outline="")

        self._display_label.configure(
            text="ON" if val else "OFF",
            fg=C.GREEN if val else C.RED)
        self._update_badge()
        self._update_status()

    # -- Size management -----------------------------------------------------

    def _add_size(self, name: str):
        new_size = self._new_size_var.get().strip()
        if not new_size:
            return
        if not SIZE_PATTERN.match(new_size):
            self._app.toast.show(
                f"Invalid size \"{new_size}\" \u2014 expected WxH (e.g. 300x250)",
                C.RED, 3000)
            return
        pdata = self._config_data["positions"].get(name, {})
        sizes_str = pdata.get("sizes", "")
        sizes = [s.strip() for s in sizes_str.split(",") if s.strip()]
        if new_size in sizes:
            self._app.toast.show(f"Size {new_size} already exists", C.OVERLAY0, 2000)
            return
        sizes.append(new_size)
        pdata["sizes"] = ",".join(sizes)
        self._config_data["positions"][name] = pdata
        self._new_size_var.set("")
        self._rebuild_sizes_list(name, sizes)
        self._update_badge()

    def _remove_size(self, name: str, idx: int):
        pdata = self._config_data["positions"].get(name, {})
        sizes_str = pdata.get("sizes", "")
        sizes = [s.strip() for s in sizes_str.split(",") if s.strip()]
        if 0 <= idx < len(sizes):
            sizes.pop(idx)
            pdata["sizes"] = ",".join(sizes)
            self._config_data["positions"][name] = pdata
            self._rebuild_sizes_list(name, sizes)
            self._update_badge()

    # -- New / Delete / Duplicate / Find Usages ------------------------------

    def _new_placement(self):
        dialog = _NewPositionDialog(self.winfo_toplevel())
        self.winfo_toplevel().wait_window(dialog)
        if dialog.result is None:
            return
        pname, provider = dialog.result
        positions = self._config_data.get("positions", {})
        if pname in positions:
            self._app.toast.show(f"Position \"{pname}\" already exists", C.RED, 3000)
            return
        new_entry = {
            "provider": provider,
            "sizes": "",
            "display": True,
            "placementType": "rail",
        }
        if provider == "adsense":
            new_entry["adSlot"] = ""
        positions[pname] = new_entry
        self._config_data["positions"] = positions
        self._selected_name = pname
        self._update_badge()
        self._refresh_list()
        self._app.toast.show(f"Created \"{pname}\"", C.GREEN, 2500)

    def _delete_placement(self, name: str):
        if not messagebox.askyesno(
                "Delete Position",
                f"Delete \"{name}\"?\n\nThis will remove it from the registry.\n"
                "Any <AdSlot> templates referencing it will stop rendering.",
                parent=self.winfo_toplevel()):
            return
        positions = self._config_data.get("positions", {})
        positions.pop(name, None)
        self._config_data["positions"] = positions
        if self._selected_name == name:
            self._selected_name = None
        self._update_badge()
        self._refresh_list()
        self._app.toast.show(f"Deleted \"{name}\"", C.PEACH, 2500)

    def _duplicate_placement(self, name: str):
        new_name = simpledialog.askstring(
            "Duplicate Position",
            f"New name for copy of \"{name}\":",
            parent=self.winfo_toplevel())
        if not new_name:
            return
        new_name = new_name.strip()
        if not re.match(r"^[a-z0-9][a-z0-9_\-]*$", new_name):
            self._app.toast.show(
                "Invalid name \u2014 lowercase alphanumeric + hyphens/underscores",
                C.RED)
            return
        positions = self._config_data.get("positions", {})
        if new_name in positions:
            self._app.toast.show(f"\"{new_name}\" already exists", C.RED)
            return
        positions[new_name] = copy.deepcopy(positions.get(name, {}))
        self._config_data["positions"] = positions
        self._selected_name = new_name
        self._update_badge()
        self._refresh_list()
        self._app.toast.show(f"Duplicated as \"{new_name}\"", C.GREEN, 2500)

    def _find_usages(self, name: str):
        src_dir = self._project_root / "src"
        results = grep_usages(name, src_dir)
        popup = tk.Toplevel(self.winfo_toplevel())
        popup.title(f"Usages of \"{name}\"")
        popup.configure(bg=C.MANTLE)
        popup.transient(self.winfo_toplevel())
        popup.geometry("600x400")
        dark_title_bar(popup)

        tk.Label(popup, text=f"References to \"{name}\"",
                 bg=C.MANTLE, fg=C.TEXT, font=F.HEADING).pack(
                     padx=16, pady=(12, 4), anchor="w")

        if not results:
            tk.Label(popup, text="No usages found in src/",
                     bg=C.MANTLE, fg=C.OVERLAY0, font=F.BODY).pack(expand=True)
            return

        tk.Label(popup,
                 text=f"{len(results)} result{'s' if len(results) != 1 else ''}  "
                      "\u00b7  click to copy path",
                 bg=C.MANTLE, fg=C.OVERLAY0, font=F.SMALL).pack(
                     padx=16, anchor="w")

        list_frame = tk.Frame(popup, bg=C.SURFACE0)
        list_frame.pack(fill="both", expand=True, padx=16, pady=(8, 16))
        canvas = tk.Canvas(list_frame, bg=C.SURFACE0, highlightthickness=0, bd=0)
        scrollbar = tk.Scrollbar(list_frame, orient="vertical", command=canvas.yview)
        inner = tk.Frame(canvas, bg=C.SURFACE0)
        inner.bind("<Configure>",
                   lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=inner, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)

        for path, lineno, text in results:
            row = tk.Frame(inner, bg=C.SURFACE0, cursor="hand2")
            row.pack(fill="x", padx=4, pady=1)
            path_str = f"{path}:{lineno}"
            lbl = tk.Label(row, text=path_str, bg=C.SURFACE0, fg=C.BLUE,
                           font=F.MONO_SMALL, anchor="w")
            lbl.pack(side="left", padx=(8, 0))
            txt = tk.Label(row, text=text[:60], bg=C.SURFACE0, fg=C.SUBTEXT0,
                           font=F.TINY, anchor="w")
            txt.pack(side="left", padx=(12, 0), fill="x", expand=True)

            def _copy(e, p=path_str):
                self.clipboard_clear()
                self.clipboard_append(p)
                self._app.toast.show(f"Copied: {p}", C.BLUE, 2000)
            for w in [row, lbl, txt]:
                w.bind("<Button-1>", _copy)

    # -- Import / Export -----------------------------------------------------

    def _export_config(self):
        path = filedialog.asksaveasfilename(
            parent=self.winfo_toplevel(), title="Export Ads Config",
            defaultextension=".json",
            filetypes=[("JSON", "*.json"), ("All files", "*.*")],
            initialfile="ads-registry-export.json")
        if not path:
            return
        try:
            Path(path).write_text(
                json.dumps(self._config_data, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8")
            self._app.toast.show(f"Exported to {Path(path).name}", C.GREEN)
        except Exception as e:
            self._app.toast.show(f"Export error: {e}", C.RED)

    def _import_config(self):
        path = filedialog.askopenfilename(
            parent=self.winfo_toplevel(), title="Import Ads Config",
            filetypes=[("JSON", "*.json"), ("All files", "*.*")])
        if not path:
            return
        if not messagebox.askyesno(
                "Import Config",
                "This will replace ALL current position settings.\n\nContinue?",
                parent=self.winfo_toplevel()):
            return
        try:
            data = json.loads(Path(path).read_text(encoding="utf-8"))
            if "positions" not in data or "global" not in data:
                self._app.toast.show("Invalid config \u2014 missing global/positions", C.RED)
                return
            self._config_data = data
            self._selected_name = None
            self._update_badge()
            self._refresh_list()
            g = data.get("global", {})
            self._client_var.set(g.get("adsenseClient", ""))
            self._label_var.set(g.get("adLabel", "Ad"))
            self._prod_ph_toggle.set(g.get("showProductionPlaceholders", False))
            self._sample_ads_toggle.set(g.get("loadSampleAds", False))
            self._sample_mode_var.set(g.get("sampleAdMode", "mixed"))
            self._sample_network_var.set(g.get("sampleAdNetwork", "mixed"))
            self._app.toast.show(f"Imported from {Path(path).name}", C.GREEN)
        except (json.JSONDecodeError, OSError) as e:
            self._app.toast.show(f"Import error: {e}", C.RED)

    # -- Tab 2: Usage Scanner ------------------------------------------------

    def _build_usage_scanner_tab(self):
        tab = tk.Frame(self._nb, bg=C.MANTLE)
        self._nb.add(tab, text="  Usage Scanner  ")

        outer = tk.Frame(tab, bg=C.MANTLE)
        outer.pack(fill="both", expand=True, padx=16, pady=8)

        accent = self._app.store.site_accent
        accent_hover = darken(accent)

        top = tk.Frame(outer, bg=C.MANTLE)
        top.pack(fill="x", pady=(0, 8))
        FlatBtn(top, text="  Scan src/  ",
                command=self._run_scan,
                bg=accent, hover_bg=accent_hover, fg=C.CRUST,
                font=F.BODY_BOLD).pack(side="left")
        FlatBtn(top, text="  Copy All  ",
                command=self._copy_scan_all,
                bg=C.SURFACE1, hover_bg=C.SURFACE2, fg=C.TEXT,
                font=F.SMALL, padx=10, pady=4).pack(side="left", padx=(8, 0))
        FlatBtn(top, text="  Copy Selected  ",
                command=self._copy_scan_selected,
                bg=C.SURFACE1, hover_bg=C.SURFACE2, fg=C.TEXT,
                font=F.SMALL, padx=10, pady=4).pack(side="left", padx=(4, 0))
        self._scan_status = tk.Label(top,
                                     text="Click Scan to find ad positions in code",
                                     bg=C.MANTLE, fg=C.OVERLAY0, font=F.SMALL)
        self._scan_status.pack(side="left", padx=12)

        # Treeview
        tree_frame = tk.Frame(outer, bg=C.SURFACE0, highlightthickness=1,
                              highlightbackground=C.CARD_BORDER)
        tree_frame.pack(fill="both", expand=True)

        cols = ("file", "line", "position", "provider", "display")
        self._scan_tree = ttk.Treeview(tree_frame, columns=cols,
                                        show="headings", selectmode="extended")
        for col, label, w, anchor in [
            ("file", "File", 320, "w"),
            ("line", "Line", 60, "center"),
            ("position", "Position", 200, "w"),
            ("provider", "Provider", 80, "center"),
            ("display", "Display", 60, "center"),
        ]:
            self._scan_tree.heading(col, text=label,
                                     command=lambda c=col: self._sort_scan_column(c))
            self._scan_tree.column(col, width=w, anchor=anchor)

        self._scan_sort_col = None
        self._scan_sort_reverse = False

        yscroll = ttk.Scrollbar(tree_frame, orient="vertical",
                                command=self._scan_tree.yview)
        xscroll = ttk.Scrollbar(tree_frame, orient="horizontal",
                                command=self._scan_tree.xview)
        self._scan_tree.configure(yscrollcommand=yscroll.set,
                                   xscrollcommand=xscroll.set)
        xscroll.pack(side="bottom", fill="x", padx=4, pady=(0, 4))
        self._scan_tree.pack(side="left", fill="both", expand=True, padx=(4, 0), pady=4)
        yscroll.pack(side="right", fill="y", pady=4, padx=(0, 4))

        self._scan_tree.bind("<Double-1>", self._on_scan_select)
        self._scan_tree.bind("<Control-c>", lambda e: self._copy_scan_selected())

        self._scan_ctx_menu = tk.Menu(self._scan_tree, tearoff=0,
                                       bg=C.SURFACE1, fg=C.TEXT, font=F.SMALL,
                                       activebackground=C.BLUE, activeforeground=C.CRUST,
                                       bd=1, relief="flat")
        self._scan_ctx_menu.add_command(label="Copy Row          Ctrl+C",
                                         command=self._copy_scan_selected)
        self._scan_ctx_menu.add_command(label="Copy All Rows",
                                         command=self._copy_scan_all)
        self._scan_ctx_menu.add_separator()
        self._scan_ctx_menu.add_command(label="Go to Position     Double-Click",
                                         command=self._on_scan_select)
        self._scan_tree.bind("<Button-3>", self._show_scan_context_menu)

        # Unplaced positions
        orphan_frame = tk.Frame(outer, bg=C.SURFACE0, highlightthickness=1,
                                highlightbackground=C.CARD_BORDER)
        orphan_frame.pack(fill="x", pady=(8, 0))
        tk.Label(orphan_frame, text="Unplaced Positions",
                 bg=C.SURFACE0, fg=C.OVERLAY0, font=F.BODY_BOLD
                 ).pack(anchor="w", padx=8, pady=(8, 4))
        self._orphan_label = tk.Label(orphan_frame,
                                      text="Run a scan to check which registry positions "
                                           "are not found in code.",
                                      bg=C.SURFACE0, fg=C.SUBTEXT0, font=F.SMALL,
                                      wraplength=700, justify="left")
        self._orphan_label.pack(fill="x", padx=8, pady=(0, 8))

        # Inline ads status
        inline_frame = tk.Frame(outer, bg=C.SURFACE0, highlightthickness=1,
                                highlightbackground=C.CARD_BORDER)
        inline_frame.pack(fill="x", pady=(4, 0))
        tk.Label(inline_frame, text="Auto-Injected Inline Ads",
                 bg=C.SURFACE0, fg=C.OVERLAY0, font=F.BODY_BOLD
                 ).pack(anchor="w", padx=8, pady=(8, 4))
        self._inline_status_label = tk.Label(inline_frame,
                                             text="Reads from inline-ads-config.json \u2014 "
                                                  "these are injected at build time, "
                                                  "not visible in code scan.",
                                             bg=C.SURFACE0, fg=C.SUBTEXT0, font=F.SMALL,
                                             wraplength=700, justify="left")
        self._inline_status_label.pack(fill="x", padx=8, pady=(0, 8))
        self._update_inline_scan_status()

    def _run_scan(self):
        src_dir = self._project_root / "src"
        results = scan_all_positions(src_dir)

        for item in self._scan_tree.get_children():
            self._scan_tree.delete(item)

        positions = self._config_data.get("positions", {})
        found_positions = set()

        for rel_path, line_no, position, _line_text in results:
            pdata = positions.get(position, {})
            provider = pdata.get("provider", "\u2014")
            display = "ON" if pdata.get("display", True) else "OFF"
            self._scan_tree.insert("", "end",
                                    values=(rel_path, line_no, position, provider, display))
            found_positions.add(position)

        n = len(results)
        self._scan_status.configure(
            text=f"Found {n} reference{'s' if n != 1 else ''} in src/",
            fg=C.GREEN if n > 0 else C.PEACH)

        all_names = set(positions.keys())
        orphans = sorted(all_names - found_positions)
        if orphans:
            self._orphan_label.configure(
                text=f"{len(orphans)} position{'s' if len(orphans) != 1 else ''} "
                     f"not found in code:  {', '.join(orphans)}",
                fg=C.PEACH)
        else:
            self._orphan_label.configure(
                text="All registry positions are placed in code." if n > 0
                     else "No references found \u2014 ads not yet placed in any page.",
                fg=C.GREEN if n > 0 else C.SUBTEXT0)

        self._update_inline_scan_status()

    def _on_scan_select(self, _event=None):
        sel = self._scan_tree.selection()
        if not sel:
            return
        values = self._scan_tree.item(sel[0], "values")
        position = values[2]
        if position in self._config_data.get("positions", {}):
            self._selected_name = position
            self._nb.select(0)
            self._refresh_list()

    def _sort_scan_column(self, col: str):
        if self._scan_sort_col == col:
            self._scan_sort_reverse = not self._scan_sort_reverse
        else:
            self._scan_sort_col = col
            self._scan_sort_reverse = False

        items = [(self._scan_tree.set(iid, col), iid)
                 for iid in self._scan_tree.get_children("")]

        if col == "line":
            try:
                items.sort(key=lambda x: int(x[0]), reverse=self._scan_sort_reverse)
            except ValueError:
                items.sort(key=lambda x: x[0], reverse=self._scan_sort_reverse)
        else:
            items.sort(key=lambda x: x[0].lower(), reverse=self._scan_sort_reverse)

        for idx, (_, iid) in enumerate(items):
            self._scan_tree.move(iid, "", idx)

        arrow = " \u25bc" if self._scan_sort_reverse else " \u25b2"
        for c in ("file", "line", "position", "provider", "display"):
            label = {"file": "File", "line": "Line", "position": "Position",
                     "provider": "Provider", "display": "Display"}[c]
            if c == col:
                self._scan_tree.heading(c, text=f"{label}{arrow}")
            else:
                self._scan_tree.heading(c, text=label)

    def _scan_rows_as_text(self, iids: list[str]) -> str:
        header = "File\tLine\tPosition\tProvider\tDisplay"
        lines = [header]
        for iid in iids:
            vals = self._scan_tree.item(iid, "values")
            lines.append("\t".join(str(v) for v in vals))
        return "\n".join(lines)

    def _copy_scan_all(self):
        iids = self._scan_tree.get_children("")
        if not iids:
            self._app.toast.show("No scan results to copy", C.OVERLAY0, 2000)
            return
        text = self._scan_rows_as_text(list(iids))
        self.clipboard_clear()
        self.clipboard_append(text)
        self._app.toast.show(f"Copied {len(iids)} rows to clipboard", C.BLUE, 2500)

    def _copy_scan_selected(self):
        sel = self._scan_tree.selection()
        if not sel:
            self._app.toast.show("No rows selected", C.OVERLAY0, 2000)
            return
        text = self._scan_rows_as_text(list(sel))
        self.clipboard_clear()
        self.clipboard_append(text)
        self._app.toast.show(
            f"Copied {len(sel)} row{'s' if len(sel) != 1 else ''} to clipboard",
            C.BLUE, 2500)

    def _show_scan_context_menu(self, event):
        iid = self._scan_tree.identify_row(event.y)
        if iid:
            self._scan_tree.selection_set(iid)
        try:
            self._scan_ctx_menu.tk_popup(event.x_root, event.y_root)
        finally:
            self._scan_ctx_menu.grab_release()

    def _update_inline_scan_status(self):
        collections = self._inline_data.get("collections", {})
        enabled = [c for c, v in collections.items()
                   if isinstance(v, dict) and v.get("enabled")]
        disabled = [c for c, v in collections.items()
                    if not (isinstance(v, dict) and v.get("enabled"))]
        parts = []
        if enabled:
            parts.append(f"Enabled: {', '.join(enabled)}")
        if disabled:
            parts.append(f"Disabled: {', '.join(disabled)}")
        text = "  |  ".join(parts) if parts else "No collections configured."
        fg = C.GREEN if enabled else C.SUBTEXT0
        self._inline_status_label.configure(text=text, fg=fg)

    # -- Tab 3: Inline Config ------------------------------------------------

    def _build_inline_tab(self):
        tab = tk.Frame(self._nb, bg=C.MANTLE)
        self._nb.add(tab, text="  Inline Config  ")
        self._inline_tab = tab

        outer = tk.Frame(tab, bg=C.MANTLE)
        outer.pack(fill="both", expand=True, padx=16, pady=8)

        # Collection selector
        sel_frame = tk.Frame(outer, bg=C.MANTLE)
        sel_frame.pack(fill="x", pady=(0, 8))
        tk.Label(sel_frame, text="Collection:", bg=C.MANTLE, fg=C.OVERLAY0,
                 font=F.BODY).pack(side="left", padx=(0, 8))
        self._inline_coll_var = tk.StringVar(value=COLLECTIONS[0])
        self._inline_coll_btns = {}
        for coll in COLLECTIONS:
            btn = FlatBtn(sel_frame, text=f" {coll.title()} ",
                          command=lambda c=coll: self._select_inline_coll(c),
                          bg=C.SURFACE1, hover_bg=C.SURFACE2, font=F.SMALL)
            btn.pack(side="left", padx=2)
            self._inline_coll_btns[coll] = btn

        # Main content
        content = tk.Frame(outer, bg=C.SURFACE0, highlightthickness=1,
                           highlightbackground=C.CARD_BORDER)
        content.pack(fill="both", expand=True)

        left = tk.Frame(content, bg=C.SURFACE0)
        left.pack(side="left", fill="both", expand=True, padx=20, pady=16)
        right = tk.Frame(content, bg=C.SURFACE0)
        right.pack(side="right", fill="both", padx=20, pady=16)

        # Left: Cadence editor
        tk.Label(left, text="CADENCE SETTINGS", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(anchor="w", pady=(0, 8))

        en_frame = tk.Frame(left, bg=C.SURFACE0)
        en_frame.pack(fill="x", pady=(0, 8))
        tk.Label(en_frame, text="Enabled:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.BODY, width=18, anchor="w").pack(side="left")
        self._inline_enabled = Toggle(en_frame, bg=C.SURFACE0,
                                       on_toggle=lambda v: self._on_inline_change())
        self._inline_enabled.pack(side="left")

        tk.Label(left, text="Desktop", bg=C.SURFACE0, fg=C.SUBTEXT0,
                 font=F.SMALL).pack(anchor="w", pady=(8, 2))
        self._inline_d_first = self._inline_spin(left, "First After (\u00a7):", 3)
        self._inline_d_every = self._inline_spin(left, "Every (\u00a7):", 5)
        self._inline_d_max = self._inline_spin(left, "Max Ads:", 8)

        tk.Label(left, text="Mobile", bg=C.SURFACE0, fg=C.SUBTEXT0,
                 font=F.SMALL).pack(anchor="w", pady=(12, 2))
        self._inline_m_first = self._inline_spin(left, "First After (\u00a7):", 3)
        self._inline_m_every = self._inline_spin(left, "Every (\u00a7):", 4)
        self._inline_m_max = self._inline_spin(left, "Max Ads:", 10)

        tk.Frame(left, bg=C.SURFACE2, height=1).pack(fill="x", pady=(12, 8))
        tk.Label(left, text="WORD SCALING", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(anchor="w", pady=(0, 4))
        ws_en = tk.Frame(left, bg=C.SURFACE0)
        ws_en.pack(fill="x", pady=(0, 4))
        tk.Label(ws_en, text="Scaling Enabled:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.BODY, width=18, anchor="w").pack(side="left")
        self._inline_ws_enabled = Toggle(ws_en, bg=C.SURFACE0,
                                          on_toggle=lambda v: self._on_inline_change())
        self._inline_ws_enabled.pack(side="left")
        self._inline_ws_desktop = self._inline_spin(left, "Desktop Words/Ad:", 450)
        self._inline_ws_mobile = self._inline_spin(left, "Mobile Words/Ad:", 350)
        self._inline_ws_min = self._inline_spin(left, "Min 1st Ad Words:", 150)

        # Right: Preview calculator
        tk.Label(right, text="PREVIEW CALCULATOR", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(anchor="w", pady=(0, 8))
        wc_frame = tk.Frame(right, bg=C.SURFACE0)
        wc_frame.pack(fill="x", pady=(0, 8))
        tk.Label(wc_frame, text="Word count:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.BODY).pack(side="left")
        self._inline_wc_var = tk.StringVar(value="2000")
        wc_entry = tk.Entry(wc_frame, textvariable=self._inline_wc_var,
                            bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
                            font=F.MONO, relief="flat", bd=0, width=8,
                            highlightthickness=1, highlightcolor=C.BLUE,
                            highlightbackground=C.SURFACE2)
        wc_entry.pack(side="left", padx=(8, 0), ipady=3)
        self._inline_wc_var.trace_add("write",
                                       lambda *a: self._update_inline_preview())

        self._inline_preview_lbl = tk.Label(right, text="", bg=C.SURFACE0,
                                             fg=C.TEXT, font=F.HEADING,
                                             justify="left")
        self._inline_preview_lbl.pack(anchor="w", pady=(8, 16))

        tk.Frame(right, bg=C.SURFACE2, height=1).pack(fill="x", pady=(16, 8))
        tk.Label(right, text="COLLECTION STATUS", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(anchor="w", pady=(0, 4))
        self._inline_status_frame = tk.Frame(right, bg=C.SURFACE0)
        self._inline_status_frame.pack(fill="x")

        self._select_inline_coll(COLLECTIONS[0])

    def _inline_spin(self, parent, label: str, default: int) -> tk.Spinbox:
        frame = tk.Frame(parent, bg=C.SURFACE0)
        frame.pack(fill="x", pady=1)
        tk.Label(frame, text=label, bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.BODY, width=18, anchor="w").pack(side="left")
        var = tk.IntVar(value=default)
        spin = tk.Spinbox(frame, from_=0, to=100, textvariable=var,
                          bg=C.SURFACE1, fg=C.TEXT, font=F.MONO,
                          buttonbackground=C.SURFACE2, relief="flat", bd=0,
                          width=6, highlightthickness=1,
                          highlightcolor=C.BLUE, highlightbackground=C.SURFACE2)
        spin.pack(side="left", ipady=2)
        spin._var = var
        var.trace_add("write", lambda *a: self._on_inline_change())
        return spin

    def _select_inline_coll(self, coll: str):
        self._inline_coll_var.set(coll)
        accent = self._app.store.site_accent
        accent_hover = darken(accent)
        for name, btn in self._inline_coll_btns.items():
            if name == coll:
                btn.configure(bg=accent, fg=C.CRUST)
                btn._bg = accent
                btn._hover = accent_hover
            else:
                btn.configure(bg=C.SURFACE1, fg=C.TEXT)
                btn._bg = C.SURFACE1
                btn._hover = C.SURFACE2

        collections = self._inline_data.get("collections", {})
        cfg = collections.get(coll, {})
        self._inline_enabled.set(cfg.get("enabled", False))
        d = cfg.get("desktop", {})
        m = cfg.get("mobile", {})
        ws = cfg.get("wordScaling", {})

        self._inline_d_first._var.set(d.get("firstAfter", 3))
        self._inline_d_every._var.set(d.get("every", 5))
        self._inline_d_max._var.set(d.get("max", 8))
        self._inline_m_first._var.set(m.get("firstAfter", 3))
        self._inline_m_every._var.set(m.get("every", 4))
        self._inline_m_max._var.set(m.get("max", 10))
        self._inline_ws_enabled.set(ws.get("enabled", False))
        self._inline_ws_desktop._var.set(ws.get("desktopWordsPerAd", 450))
        self._inline_ws_mobile._var.set(ws.get("mobileWordsPerAd", 350))
        self._inline_ws_min._var.set(ws.get("minFirstAdWords", 150))

        self._update_inline_preview()
        self._update_inline_status()

    def _on_inline_change(self):
        coll = self._inline_coll_var.get()
        collections = self._inline_data.setdefault("collections", {})
        cfg = collections.setdefault(coll, {})
        cfg["enabled"] = self._inline_enabled.get()
        if cfg["enabled"]:
            cfg["desktop"] = {
                "firstAfter": self._inline_d_first._var.get(),
                "every": self._inline_d_every._var.get(),
                "max": self._inline_d_max._var.get(),
            }
            cfg["mobile"] = {
                "firstAfter": self._inline_m_first._var.get(),
                "every": self._inline_m_every._var.get(),
                "max": self._inline_m_max._var.get(),
            }
            cfg["wordScaling"] = {
                "enabled": self._inline_ws_enabled.get(),
                "desktopWordsPerAd": self._inline_ws_desktop._var.get(),
                "mobileWordsPerAd": self._inline_ws_mobile._var.get(),
                "minFirstAdWords": self._inline_ws_min._var.get(),
            }
        self._update_badge()
        self._update_inline_preview()
        self._update_inline_status()

    def _update_inline_preview(self):
        try:
            wc = int(self._inline_wc_var.get())
        except ValueError:
            wc = 0
        coll = self._inline_coll_var.get()
        cfg = self._inline_data.get("collections", {}).get(coll, {})
        if not cfg.get("enabled"):
            self._inline_preview_lbl.configure(
                text="Collection disabled\nNo inline ads", fg=C.OVERLAY0)
            return
        d, m = calculate_inline_ads(wc, cfg)
        self._inline_preview_lbl.configure(
            text=f"Desktop: {d} ads\nMobile:  {m} ads", fg=C.TEXT)

    def _update_inline_status(self):
        for w in self._inline_status_frame.winfo_children():
            w.destroy()
        collections = self._inline_data.get("collections", {})
        for coll in COLLECTIONS:
            cfg = collections.get(coll, {})
            enabled = cfg.get("enabled", False)
            row = tk.Frame(self._inline_status_frame, bg=C.SURFACE0)
            row.pack(fill="x", pady=1)
            dot = tk.Canvas(row, width=10, height=10, highlightthickness=0,
                            bg=C.SURFACE0)
            dot.pack(side="left", padx=(0, 6))
            color = C.GREEN if enabled else C.RED
            dot.create_oval(1, 1, 9, 9, fill=color, outline="")
            tk.Label(row, text=coll.title(), bg=C.SURFACE0,
                     fg=C.TEXT if enabled else C.OVERLAY0,
                     font=F.SMALL).pack(side="left")

    # -- Tab 4: Sponsors -----------------------------------------------------

    def _build_sponsors_tab(self):
        tab = tk.Frame(self._nb, bg=C.MANTLE)
        self._nb.add(tab, text="  Sponsors  ")

        outer = tk.Frame(tab, bg=C.MANTLE)
        outer.pack(fill="both", expand=True, padx=16, pady=8)

        # Position selector (direct-only)
        sel_frame = tk.Frame(outer, bg=C.MANTLE)
        sel_frame.pack(fill="x", pady=(0, 8))
        tk.Label(sel_frame, text="Position:", bg=C.MANTLE, fg=C.OVERLAY0,
                 font=F.BODY).pack(side="left", padx=(0, 8))
        direct_placements = [
            name for name, p in self._config_data.get("positions", {}).items()
            if p.get("provider") == "direct"
        ]
        self._sponsor_place_var = tk.StringVar(
            value=direct_placements[0] if direct_placements else "")
        if direct_placements:
            self._sponsor_combo = ttk.Combobox(
                sel_frame, textvariable=self._sponsor_place_var,
                values=direct_placements, state="readonly", width=30)
            self._sponsor_combo.pack(side="left")
            self._sponsor_combo.bind("<<ComboboxSelected>>",
                                      lambda e: self._refresh_sponsors())
        else:
            tk.Label(sel_frame, text="No direct-provider positions",
                     bg=C.MANTLE, fg=C.OVERLAY0, font=F.BODY).pack(side="left")

        # Main content
        content = tk.Frame(outer, bg=C.SURFACE0, highlightthickness=1,
                           highlightbackground=C.CARD_BORDER)
        content.pack(fill="both", expand=True)

        # Left: Creative list
        left = tk.Frame(content, bg=C.SURFACE0, width=350)
        left.pack(side="left", fill="y", padx=(0, 1))
        left.pack_propagate(False)
        tk.Label(left, text="CREATIVES", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(anchor="w", padx=12, pady=(12, 4))
        self._sponsor_list_frame = tk.Frame(left, bg=C.SURFACE0)
        self._sponsor_list_frame.pack(fill="both", expand=True, padx=8)

        btn_frame = tk.Frame(left, bg=C.SURFACE0)
        btn_frame.pack(fill="x", padx=8, pady=(4, 8))
        FlatBtn(btn_frame, text="+ Add", bg=C.SURFACE1, hover_bg=C.SURFACE2,
                font=F.SMALL, padx=8, pady=4,
                command=self._add_creative).pack(side="left", padx=2)
        FlatBtn(btn_frame, text="Edit", bg=C.SURFACE1, hover_bg=C.SURFACE2,
                font=F.SMALL, padx=8, pady=4,
                command=self._edit_creative).pack(side="left", padx=2)
        FlatBtn(btn_frame, text="Delete", bg=C.SURFACE1, hover_bg=C.SURFACE2,
                font=F.SMALL, padx=8, pady=4, fg=C.RED,
                command=self._delete_creative).pack(side="left", padx=2)
        FlatBtn(btn_frame, text="Normalize", bg=C.SURFACE1, hover_bg=C.SURFACE2,
                font=F.SMALL, padx=8, pady=4,
                command=self._normalize_sponsor_weights).pack(side="left", padx=2)

        self._weight_bar_canvas = tk.Canvas(left, height=24, bg=C.SURFACE1,
                                             highlightthickness=0, bd=0)
        self._weight_bar_canvas.pack(fill="x", padx=8, pady=(0, 8))

        # Right: Preview
        right = tk.Frame(content, bg=C.SURFACE0)
        right.pack(side="right", fill="both", expand=True, padx=16, pady=16)
        tk.Label(right, text="PREVIEW", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(anchor="w", pady=(0, 8))
        self._sponsor_preview_frame = tk.Frame(right, bg=C.SURFACE0)
        self._sponsor_preview_frame.pack(fill="both", expand=True)

        self._refresh_sponsors()

    def _get_sponsor_creatives(self) -> list[dict]:
        placement = self._sponsor_place_var.get()
        return self._sponsors_data.get("creatives", {}).get(placement, [])

    def _refresh_sponsors(self):
        for w in self._sponsor_list_frame.winfo_children():
            w.destroy()

        creatives = self._get_sponsor_creatives()
        today = datetime.now().strftime("%Y-%m-%d")

        for i, c in enumerate(creatives):
            row = tk.Frame(self._sponsor_list_frame, bg=C.SURFACE0, cursor="hand2")
            row.pack(fill="x", pady=2)

            start = c.get("startDate", "")
            end = c.get("endDate", "")
            if today < start:
                status, color = "Scheduled", C.BLUE
            elif today > end:
                status, color = "Expired", C.RED
            else:
                status, color = "Active", C.GREEN

            is_sel = (i == self._sponsor_selected_idx)
            bg = C.SURFACE1 if is_sel else C.SURFACE0

            row.configure(bg=bg)
            tk.Label(row, text=f"{c.get('label', 'Untitled')} ({c.get('weight', 0)}%)",
                     bg=bg, fg=C.TEXT, font=F.BODY, anchor="w").pack(
                         side="left", padx=(8, 0), fill="x", expand=True)
            tk.Label(row, text=f"[{status}]", bg=bg, fg=color,
                     font=F.SMALL).pack(side="right", padx=(0, 8))
            tk.Label(row, text=f"{start} \u2192 {end}", bg=bg, fg=C.OVERLAY0,
                     font=F.TINY).pack(side="right", padx=(0, 8))

            def _on_click(e, idx=i):
                self._sponsor_selected_idx = idx
                self._refresh_sponsors()
            for w in row.winfo_children():
                w.bind("<Button-1>", _on_click)
            row.bind("<Button-1>", _on_click)

        if not creatives:
            tk.Label(self._sponsor_list_frame, text="No creatives",
                     bg=C.SURFACE0, fg=C.OVERLAY0, font=F.BODY).pack(
                         expand=True, pady=20)

        self._draw_weight_bar(creatives)
        self._update_sponsor_preview(creatives)

    def _draw_weight_bar(self, creatives: list[dict]):
        cvs = self._weight_bar_canvas
        cvs.delete("all")
        cvs.update_idletasks()
        w = max(cvs.winfo_width(), 300)
        h = 24
        if not creatives:
            return
        total = sum(c.get("weight", 0) for c in creatives)
        colors = [C.BLUE, C.GREEN, C.PEACH, C.MAUVE, C.TEAL, C.YELLOW, C.RED, C.SAPPHIRE]
        x = 0
        for i, c in enumerate(creatives):
            weight = c.get("weight", 0)
            bar_w = (weight / total * w) if total > 0 else 0
            color = colors[i % len(colors)]
            cvs.create_rectangle(x, 0, x + bar_w, h, fill=color, outline="")
            if bar_w > 30:
                cvs.create_text(x + bar_w / 2, h / 2,
                                text=f"{weight}%", fill=C.CRUST, font=F.TINY)
            x += bar_w
        if total != 100:
            cvs.create_text(w - 4, h / 2, text=f"Sum: {total}%",
                            fill=C.RED, font=F.TINY, anchor="e")

    def _update_sponsor_preview(self, creatives: list[dict]):
        for w in self._sponsor_preview_frame.winfo_children():
            w.destroy()
        idx = self._sponsor_selected_idx
        if idx is None or idx >= len(creatives):
            tk.Label(self._sponsor_preview_frame, text="Select a creative",
                     bg=C.SURFACE0, fg=C.OVERLAY0, font=F.BODY).pack(expand=True)
            return
        c = creatives[idx]
        fields = [
            ("Image:", c.get("img", "")),
            ("Size:", f"{c.get('width', '?')} x {c.get('height', '?')}"),
            ("Click URL:", c.get("href", "")),
            ("Rel:", c.get("rel", "nofollow sponsored noopener")),
            ("Alt:", c.get("alt", "")),
            ("Weight:", f"{c.get('weight', 0)}%"),
            ("Date Range:", f"{c.get('startDate', '')} \u2192 {c.get('endDate', '')}"),
        ]
        for label, value in fields:
            row = tk.Frame(self._sponsor_preview_frame, bg=C.SURFACE0)
            row.pack(fill="x", pady=2)
            tk.Label(row, text=label, bg=C.SURFACE0, fg=C.OVERLAY0,
                     font=F.BODY, width=12, anchor="w").pack(side="left")
            tk.Label(row, text=value, bg=C.SURFACE0, fg=C.TEXT,
                     font=F.MONO_SMALL, anchor="w").pack(side="left", fill="x",
                                                          expand=True)

    def _add_creative(self):
        placement = self._sponsor_place_var.get()
        if not placement:
            self._app.toast.show("Select a placement first", C.OVERLAY0)
            return
        dialog = _CreativeDialog(self.winfo_toplevel())
        self.winfo_toplevel().wait_window(dialog)
        if dialog.result:
            creatives = self._sponsors_data.setdefault("creatives", {})
            creatives.setdefault(placement, []).append(dialog.result)
            self._update_badge()
            self._refresh_sponsors()

    def _edit_creative(self):
        creatives = self._get_sponsor_creatives()
        idx = self._sponsor_selected_idx
        if idx is None or idx >= len(creatives):
            self._app.toast.show("Select a creative first", C.OVERLAY0)
            return
        dialog = _CreativeDialog(self.winfo_toplevel(), creatives[idx])
        self.winfo_toplevel().wait_window(dialog)
        if dialog.result:
            creatives[idx] = dialog.result
            self._update_badge()
            self._refresh_sponsors()

    def _delete_creative(self):
        placement = self._sponsor_place_var.get()
        creatives = self._get_sponsor_creatives()
        idx = self._sponsor_selected_idx
        if idx is None or idx >= len(creatives):
            self._app.toast.show("Select a creative first", C.OVERLAY0)
            return
        if not messagebox.askyesno("Delete Creative",
                                    f"Delete \"{creatives[idx].get('label', '')}\"?",
                                    parent=self.winfo_toplevel()):
            return
        creatives.pop(idx)
        self._sponsor_selected_idx = None
        self._update_badge()
        self._refresh_sponsors()

    def _normalize_sponsor_weights(self):
        creatives = self._get_sponsor_creatives()
        if not creatives:
            return
        weights = [c.get("weight", 0) for c in creatives]
        normalized = normalize_weights(weights)
        for c, w in zip(creatives, normalized):
            c["weight"] = w
        self._update_badge()
        self._refresh_sponsors()
        self._app.toast.show("Weights normalized to 100%", C.GREEN)

    # -- Tab 5: Dashboard (placeholder) --------------------------------------

    def _build_dashboard_tab(self):
        tab = tk.Frame(self._nb, bg=C.MANTLE)
        self._nb.add(tab, text="  Dashboard  ")

        center = tk.Frame(tab, bg=C.MANTLE)
        center.pack(expand=True)

        tk.Label(center, text="Dashboard will be available after ads go live.",
                 bg=C.MANTLE, fg=C.OVERLAY0, font=F.HEADING).pack(pady=(0, 24))

        cards_frame = tk.Frame(center, bg=C.MANTLE)
        cards_frame.pack()
        stats = [
            ("Impressions", "0"),
            ("Fill Rate", "N/A"),
            ("Revenue", "$0.00"),
            ("CLS Score", "N/A"),
        ]
        for label, value in stats:
            card = tk.Frame(cards_frame, bg=C.SURFACE1, highlightthickness=1,
                            highlightbackground=C.SURFACE2)
            card.pack(side="left", padx=8, ipadx=24, ipady=16)
            tk.Label(card, text=label, bg=C.SURFACE1, fg=C.OVERLAY0,
                     font=F.SMALL).pack()
            tk.Label(card, text=value, bg=C.SURFACE1, fg=C.SURFACE2,
                     font=F.HEADING).pack()

        connect_btn = FlatBtn(center, text="  Connect AdSense API  ",
                              bg=C.SURFACE2, fg=C.OVERLAY0,
                              hover_bg=C.SURFACE2, font=F.BODY)
        connect_btn.pack(pady=(24, 0))
        connect_btn.configure(cursor="arrow")
        Tip(connect_btn, "Available post-launch")

    # -- Status --------------------------------------------------------------

    def _update_status(self):
        positions = self._config_data.get("positions", {})
        total = len(positions)
        enabled = sum(1 for p in positions.values() if p.get("display", True))
        self._app.set_status_right(
            f"{total} positions  \u00b7  {enabled}/{total} enabled")

    # -- Change tracking + public API ----------------------------------------

    def has_changes(self) -> bool:
        if json.dumps(self._config_data, sort_keys=True) != self._original:
            return True
        if json.dumps(self._inline_data, sort_keys=True) != self._inline_original:
            return True
        if json.dumps(self._sponsors_data, sort_keys=True) != self._sponsors_original:
            return True
        ads_enabled_toggle = getattr(self, "_ads_enabled_toggle", None)
        if ads_enabled_toggle is not None and bool(ads_enabled_toggle.get()) != self._ads_enabled_original:
            return True
        return False

    def _update_badge(self):
        self._app.update_changes_badge()
        self._update_status()

    def save(self) -> bool:
        saved = []
        try:
            ads_enabled_toggle = getattr(self, "_ads_enabled_toggle", None)
            ads_enabled_current = bool(ads_enabled_toggle.get()) if ads_enabled_toggle is not None \
                else self._ads_enabled_original
            if ads_enabled_current != self._ads_enabled_original:
                env_source = read_text_file(self._env_path)
                updated_env = upsert_env_value(
                    env_source,
                    PUBLIC_ADS_ENABLED_KEY,
                    "true" if ads_enabled_current else "false",
                )
                self._env_path.write_text(updated_env, encoding="utf-8")
                self._ads_enabled_original = ads_enabled_current
                saved.append("env")

            current = json.dumps(self._config_data, sort_keys=True)
            if current != self._original:
                self._app.watcher.pause()
                self._app.store.save(ConfigStore.ADS_REGISTRY, self._config_data)
                self._app.watcher.snapshot()
                self._app.watcher.resume()
                self._original = current
                saved.append("registry")

            inline_cur = json.dumps(self._inline_data, sort_keys=True)
            if inline_cur != self._inline_original:
                self._app.watcher.pause()
                self._app.store.save(ConfigStore.INLINE_ADS, self._inline_data)
                self._app.watcher.snapshot()
                self._app.watcher.resume()
                self._inline_original = inline_cur
                saved.append("inline")

            sponsors_cur = json.dumps(self._sponsors_data, sort_keys=True)
            if sponsors_cur != self._sponsors_original:
                self._app.watcher.pause()
                self._app.store.save(ConfigStore.SPONSORS, self._sponsors_data)
                self._app.watcher.snapshot()
                self._app.watcher.resume()
                self._sponsors_original = sponsors_cur
                saved.append("sponsors")

            if not saved:
                self._app.toast.show("No changes to save", C.OVERLAY0)
                return False

            self._update_badge()
            now = datetime.now().strftime("%H:%M:%S")
            self._app.toast.show(
                f"Saved {', '.join(saved)} at {now}", C.GREEN)
            self._app.set_status(f"Last saved at {now}  \u00b7  Ctrl+S to save")
            return True

        except Exception as e:
            self._app.toast.show(f"Error: {e}", C.RED)
            return False

    def refresh(self):
        self._config_data = self._app.store.get(ConfigStore.ADS_REGISTRY) or \
            copy.deepcopy(DEFAULT_REGISTRY)
        self._inline_data = self._app.store.get(ConfigStore.INLINE_ADS) or \
            copy.deepcopy(DEFAULT_INLINE)
        self._sponsors_data = self._app.store.get(ConfigStore.SPONSORS) or \
            copy.deepcopy(DEFAULT_SPONSORS)
        self._original = json.dumps(self._config_data, sort_keys=True)
        self._inline_original = json.dumps(self._inline_data, sort_keys=True)
        self._sponsors_original = json.dumps(self._sponsors_data, sort_keys=True)
        self._ads_enabled_original = read_env_bool(
            read_text_file(self._env_path),
            PUBLIC_ADS_ENABLED_KEY,
            default=False,
        )

        # Refresh globals bar
        g = self._config_data.get("global", {})
        self._client_var.set(g.get("adsenseClient", ""))
        self._label_var.set(g.get("adLabel", "Ad"))
        self._ads_enabled_toggle.set(self._ads_enabled_original)
        self._prod_ph_toggle.set(g.get("showProductionPlaceholders", False))
        self._sample_ads_toggle.set(g.get("loadSampleAds", False))
        self._sample_mode_var.set(g.get("sampleAdMode", "mixed"))
        self._sample_network_var.set(g.get("sampleAdNetwork", "mixed"))

        self._refresh_list()
        self._update_inline_scan_status()
        self._update_badge()

    # -- External change handlers --------------------------------------------

    def _on_registry_change(self):
        self.refresh()

    def _on_inline_ext_change(self):
        self.refresh()

    def _on_sponsors_ext_change(self):
        self.refresh()

    def _on_categories_change(self):
        # Accent may have changed
        self._refresh_list()


# -- Modal Dialogs -----------------------------------------------------------

class _NewPositionDialog(tk.Toplevel):
    """Modal dialog for creating a new position."""

    def __init__(self, parent):
        super().__init__(parent)
        self.title("New Position")
        self.configure(bg=C.MANTLE)
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()

        w, h = 420, 200
        sx = parent.winfo_rootx() + (parent.winfo_width() - w) // 2
        sy = parent.winfo_rooty() + (parent.winfo_height() - h) // 2
        self.geometry(f"{w}x{h}+{sx}+{sy}")
        dark_title_bar(self)

        self.result = None
        pad = 20

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

        btn_frame = tk.Frame(self, bg=C.MANTLE)
        btn_frame.pack(fill="x", padx=pad, pady=(16, pad))
        accent = C.BLUE
        FlatBtn(btn_frame, text="  Create  ", command=self._on_create,
                bg=accent, fg=C.CRUST, hover_bg=darken(accent),
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
        if not re.match(r"^[a-z0-9][a-z0-9_\-]*$", name):
            messagebox.showwarning(
                "Invalid Name",
                "Position name must be lowercase alphanumeric with hyphens/underscores.\n"
                "Example: sidebar_sticky",
                parent=self)
            return
        self.result = (name, self._prov_var.get())
        self.destroy()


class _CreativeDialog(tk.Toplevel):
    """Modal dialog for adding/editing a sponsor creative."""

    def __init__(self, parent, data: dict | None = None):
        super().__init__(parent)
        self.title("Edit Creative" if data else "New Creative")
        self.configure(bg=C.MANTLE)
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()

        w, h = 480, 420
        sx = parent.winfo_rootx() + (parent.winfo_width() - w) // 2
        sy = parent.winfo_rooty() + (parent.winfo_height() - h) // 2
        self.geometry(f"{w}x{h}+{sx}+{sy}")
        dark_title_bar(self)

        self.result = None
        data = data or {}
        pad = 16

        fields = [
            ("Label:", "label", data.get("label", ""), 30),
            ("Image Path:", "img", data.get("img", ""), 30),
            ("Click URL:", "href", data.get("href", ""), 30),
            ("Width:", "width", str(data.get("width", "")), 8),
            ("Height:", "height", str(data.get("height", "")), 8),
            ("Weight %:", "weight", str(data.get("weight", 50)), 8),
            ("Start Date:", "startDate", data.get("startDate", ""), 12),
            ("End Date:", "endDate", data.get("endDate", ""), 12),
            ("Rel:", "rel", data.get("rel", "nofollow sponsored noopener"), 30),
            ("Alt Text:", "alt", data.get("alt", ""), 30),
        ]
        self._vars = {}
        for label, key, default, width in fields:
            f = tk.Frame(self, bg=C.MANTLE)
            f.pack(fill="x", padx=pad, pady=2)
            tk.Label(f, text=label, bg=C.MANTLE, fg=C.OVERLAY0,
                     font=F.BODY, width=12, anchor="w").pack(side="left")
            var = tk.StringVar(value=default)
            e = tk.Entry(f, textvariable=var, bg=C.SURFACE1, fg=C.TEXT,
                         insertbackground=C.TEXT, font=F.MONO, relief="flat",
                         bd=0, width=width, highlightthickness=1,
                         highlightcolor=C.BLUE, highlightbackground=C.SURFACE2)
            e.pack(side="left", ipady=2)
            self._vars[key] = var

        btn_frame = tk.Frame(self, bg=C.MANTLE)
        btn_frame.pack(fill="x", padx=pad, pady=(12, pad))
        accent = C.BLUE
        FlatBtn(btn_frame, text="  Save  ", command=self._on_save,
                bg=accent, fg=C.CRUST, hover_bg=darken(accent),
                font=F.BODY_BOLD).pack(side="right", padx=(8, 0))
        FlatBtn(btn_frame, text="  Cancel  ", command=self.destroy,
                bg=C.SURFACE1, hover_bg=C.SURFACE2, font=F.BODY).pack(side="right")

        self.bind("<Return>", lambda e: self._on_save())
        self.bind("<Escape>", lambda e: self.destroy())

    def _on_save(self):
        label = self._vars["label"].get().strip()
        if not label:
            return
        try:
            w = int(self._vars["width"].get()) if self._vars["width"].get() else 0
            h = int(self._vars["height"].get()) if self._vars["height"].get() else 0
            weight = float(self._vars["weight"].get()) if self._vars["weight"].get() else 50
        except ValueError:
            return
        self.result = {
            "label": label,
            "img": self._vars["img"].get().strip(),
            "href": self._vars["href"].get().strip(),
            "width": w,
            "height": h,
            "weight": weight,
            "startDate": self._vars["startDate"].get().strip(),
            "endDate": self._vars["endDate"].get().strip(),
            "rel": self._vars["rel"].get().strip(),
            "alt": self._vars["alt"].get().strip(),
        }
        self.destroy()
