"""Image Defaults panel for the EG Config mega-app.

Manages per-category product image defaults: defaultImageView,
listThumbKeyBase, headerGame, coverImageView, viewPriority, viewMeta.

Pure functions are at module level for testability.
"""
import json
import copy
import tkinter as tk
from tkinter import ttk
from pathlib import Path
from collections import defaultdict

from lib.shared import C, F, FlatBtn, Tip, darken
from lib.config_store import ConfigStore

# -- Constants ---------------------------------------------------------------

CANONICAL_VIEWS = {
    "feature-image", "top", "left", "right", "sangle", "angle",
    "front", "rear", "bot", "img", "shape-side", "shape-top",
}

DEFAULT_CONFIG = {
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


# -- Pure functions ----------------------------------------------------------

def scan_product_views(data_products_dir: Path):
    """Scan all product JSONs, count views per category.

    Returns: ({category: {view_name: count}}, {category: product_count})
    Each view is counted at most once per product (deduped).
    """
    view_counts = defaultdict(lambda: defaultdict(int))
    product_counts = defaultdict(int)

    if not data_products_dir.is_dir():
        return {}, {}

    for json_path in sorted(data_products_dir.rglob("*.json")):
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
                view_counts[category][view] += 1

    return dict(view_counts), dict(product_counts)


def get_resolved_defaults(config_data: dict, category: str) -> dict:
    """Get resolved defaults for a category (merges overrides onto globals).

    If category is "__defaults__", returns the global defaults dict.
    Otherwise merges category overrides onto global defaults, with
    deep merge for viewMeta.
    """
    defaults = config_data.get("defaults", {})

    if category == "__defaults__":
        return dict(defaults)

    cat_overrides = config_data.get("categories", {}).get(category, {})
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


# -- Panel -------------------------------------------------------------------

class ImageDefaultsPanel(tk.Frame):
    """Image Defaults configuration panel for the mega-app."""

    def __init__(self, parent: tk.Widget, app):
        super().__init__(parent, bg=C.MANTLE)
        self._app = app
        self._project_root = app.store._root

        # Load config
        stored = app.store.get(ConfigStore.IMAGE_DEFAULTS)
        if stored:
            self._config_data = copy.deepcopy(stored)
        else:
            self._config_data = copy.deepcopy(DEFAULT_CONFIG)
        self._original = json.dumps(self._config_data, sort_keys=True)

        # Scan products (via shared cache)
        self._view_counts, self._product_counts = app.cache.get_view_counts()

        # State
        self._active_cat = "mouse"
        self._cat_pills = []
        self._drag_idx = None
        self._fallback_state = {}

        # Build UI
        self._build_category_pills()
        self._build_panels()

        self._refresh_all()

        # Subscribe to config changes
        app.store.subscribe(ConfigStore.IMAGE_DEFAULTS, self._on_store_change)
        # WHY: CATEGORIES subscription removed — mega-app dispatches centrally
        # to avoid refreshing hidden panels

    # ── Public interface ───────────────────────────────────────────────────

    def save(self) -> bool:
        if not self.has_changes():
            self._app.toast.show("No changes to save", C.OVERLAY0)
            return False
        try:
            self._app.watcher.pause()
            self._app.store.save(ConfigStore.IMAGE_DEFAULTS,
                                 self._config_data)
            self._app.watcher.snapshot()
            self._app.watcher.resume()
            self._original = json.dumps(self._config_data, sort_keys=True)
            self._app.update_changes_badge()
            now = __import__("datetime").datetime.now().strftime("%H:%M:%S")
            self._app.toast.show(f"Saved image-defaults.json at {now}", C.GREEN)
            self._app.set_status(f"Last saved at {now}  \u00b7  Ctrl+S to save")
            return True
        except Exception as ex:
            self._app.watcher.resume()
            self._app.toast.show(f"Save failed: {ex}", C.RED)
            return False

    def has_changes(self) -> bool:
        current = json.dumps(self._config_data, sort_keys=True)
        return current != self._original

    def refresh(self):
        stored = self._app.store.get(ConfigStore.IMAGE_DEFAULTS)
        if stored:
            self._config_data = copy.deepcopy(stored)
        else:
            self._config_data = copy.deepcopy(DEFAULT_CONFIG)
        self._original = json.dumps(self._config_data, sort_keys=True)
        self._refresh_all()
        self._app.update_changes_badge()

    # ── Subscribers ────────────────────────────────────────────────────────

    def _on_store_change(self):
        self.refresh()

    def _on_categories_change(self):
        # Rebuild pills with new colors
        self._pill_bar.destroy()
        self._cat_pills = []
        self._build_category_pills()
        self._refresh_all()

    # ── Category Pills ─────────────────────────────────────────────────────

    def _build_category_pills(self):
        self._pill_bar = tk.Frame(self, bg=C.MANTLE)
        self._pill_bar.pack(fill="x", padx=20, pady=(12, 4))

        cat_colors = self._app.store.cat_colors
        cat_labels = self._app.store.cat_labels

        cats = list(self._config_data.get("categories", {}).keys())
        if not cats:
            cats = list(self._product_counts.keys())
        if not cats:
            cats = ["mouse", "keyboard", "monitor"]

        for cat in cats:
            color = cat_colors.get(cat, C.OVERLAY0)
            label_text = cat_labels.get(cat, cat.title())
            count = self._product_counts.get(cat, 0)

            pill = tk.Frame(self._pill_bar, bg=C.SURFACE0, padx=0, pady=0,
                           highlightthickness=2,
                           highlightbackground=C.SURFACE1)
            pill.pack(side="left", padx=(0, 8))

            tk.Frame(pill, bg=color, width=4).pack(side="left", fill="y")

            inner = tk.Frame(pill, bg=C.SURFACE0)
            inner.pack(side="left", padx=(8, 12), pady=6)

            lbl = tk.Label(inner, text=label_text, font=F.BODY_BOLD,
                          fg=C.TEXT, bg=C.SURFACE0)
            lbl.pack(side="left")
            cnt = tk.Label(inner, text=f"  ({count})", font=F.SMALL,
                          fg=C.OVERLAY0, bg=C.SURFACE0)
            cnt.pack(side="left")

            for widget in (pill, inner, lbl, cnt):
                widget.bind("<Button-1>",
                           lambda e, c=cat: self._select_category(c))
                widget.configure(cursor="hand2")

            self._cat_pills.append((cat, pill))

        # "Defaults (Global)" pill
        pill = tk.Frame(self._pill_bar, bg=C.SURFACE0, padx=0, pady=0,
                       highlightthickness=2,
                       highlightbackground=C.SURFACE1)
        pill.pack(side="left", padx=(16, 0))
        tk.Frame(pill, bg=C.OVERLAY0, width=4).pack(side="left", fill="y")
        inner = tk.Frame(pill, bg=C.SURFACE0)
        inner.pack(side="left", padx=(8, 12), pady=6)
        lbl = tk.Label(inner, text="Defaults (Global)", font=F.BODY_BOLD,
                      fg=C.TEXT, bg=C.SURFACE0)
        lbl.pack(side="left")
        for widget in (pill, inner, lbl):
            widget.bind("<Button-1>",
                       lambda e: self._select_category("__defaults__"))
            widget.configure(cursor="hand2")
        self._cat_pills.append(("__defaults__", pill))

    def _select_category(self, cat: str):
        self._active_cat = cat
        self._refresh_all()

    def _update_pill_highlight(self):
        accent = self._app.store.site_accent
        cat_colors = self._app.store.cat_colors
        for cat, pill in self._cat_pills:
            if cat == self._active_cat:
                color = cat_colors.get(cat, accent)
                if cat == "__defaults__":
                    color = accent
                pill.configure(highlightbackground=color)
            else:
                pill.configure(highlightbackground=C.SURFACE1)

    # ── Main Panels ────────────────────────────────────────────────────────

    def _build_panels(self):
        self._panel_frame = tk.Frame(self, bg=C.MANTLE)
        self._panel_frame.pack(fill="both", expand=True, padx=20, pady=(8, 0))

        self._build_scanner_panel()
        self._build_editor_panel()

    def _build_scanner_panel(self):
        left = tk.Frame(self._panel_frame, bg=C.SURFACE0,
                       highlightthickness=1,
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
        for label_text, w in [("View", 22), ("Count", 8), ("% Products", 10),
                               ("Status", 10)]:
            tk.Label(table_hdr, text=label_text, font=F.SMALL,
                    fg=C.SUBTEXT0, bg=C.SURFACE1, width=w,
                    anchor="w").pack(side="left", padx=4, pady=4)

        # Scrollable list
        list_frame = tk.Frame(left, bg=C.SURFACE0)
        list_frame.pack(fill="both", expand=True, padx=12, pady=(0, 12))

        canvas = tk.Canvas(list_frame, bg=C.SURFACE0, highlightthickness=0)
        scrollbar = tk.Scrollbar(list_frame, orient="vertical",
                                command=canvas.yview)
        self._scanner_inner = tk.Frame(canvas, bg=C.SURFACE0)

        self._scanner_inner.bind("<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=self._scanner_inner, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Scoped mousewheel (not bind_all)
        def _on_mousewheel(e):
            canvas.yview_scroll(int(-1 * (e.delta / 120)), "units")
        canvas.bind("<MouseWheel>", _on_mousewheel)
        self._scanner_inner.bind("<MouseWheel>", _on_mousewheel)

        self._scanner_canvas = canvas

    def _build_editor_panel(self):
        right = tk.Frame(self._panel_frame, bg=C.SURFACE0,
                        highlightthickness=1,
                        highlightbackground=C.CARD_BORDER)
        right.pack(side="right", fill="both", expand=True, padx=(8, 0))

        canvas = tk.Canvas(right, bg=C.SURFACE0, highlightthickness=0)
        scrollbar = tk.Scrollbar(right, orient="vertical",
                                command=canvas.yview)
        self._editor_inner = tk.Frame(canvas, bg=C.SURFACE0)

        self._editor_inner.bind("<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=self._editor_inner, anchor="nw",
                           tags="inner")

        def _resize_inner(e):
            canvas.itemconfigure("inner", width=e.width)
        canvas.bind("<Configure>", _resize_inner)

        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Scoped mousewheel (not bind_all)
        def _on_mousewheel(e):
            canvas.yview_scroll(int(-1 * (e.delta / 120)), "units")
        canvas.bind("<MouseWheel>", _on_mousewheel)
        self._editor_inner.bind("<MouseWheel>", _on_mousewheel)

        self._editor_canvas = canvas

    # ── Refresh ────────────────────────────────────────────────────────────

    def _refresh_all(self):
        self._update_pill_highlight()
        self._refresh_scanner()
        self._refresh_editor()
        self._update_changes()

    def _refresh_scanner(self):
        for w in self._scanner_inner.winfo_children():
            w.destroy()

        cat = self._active_cat
        cat_labels = self._app.store.cat_labels

        if cat == "__defaults__":
            views = defaultdict(int)
            total_products = sum(self._product_counts.values())
            for cat_views in self._view_counts.values():
                for view, count in cat_views.items():
                    views[view] += count
            self._scanner_subtitle.configure(
                text=f"All categories \u2014 {total_products} products total")
        else:
            views = dict(self._view_counts.get(cat, {}))
            total_products = self._product_counts.get(cat, 0)
            label = cat_labels.get(cat, cat.title())
            self._scanner_subtitle.configure(
                text=f"{label} \u2014 {total_products} products")

        if not views:
            tk.Label(self._scanner_inner, text="No product data found.",
                    font=F.BODY, fg=C.OVERLAY0, bg=C.SURFACE0).pack(pady=20)
            return

        sorted_views = sorted(views.items(), key=lambda x: -x[1])

        for i, (view, count) in enumerate(sorted_views):
            bg = C.SURFACE0 if i % 2 == 0 else C.MANTLE
            row = tk.Frame(self._scanner_inner, bg=bg)
            row.pack(fill="x")

            is_canonical = view in CANONICAL_VIEWS
            fg = C.TEXT if is_canonical else C.RED
            tk.Label(row, text=view, font=F.MONO, fg=fg, bg=bg,
                    width=22, anchor="w").pack(side="left", padx=(8, 4),
                                               pady=3)

            tk.Label(row, text=str(count), font=F.MONO, fg=C.SUBTEXT0,
                    bg=bg, width=8,
                    anchor="e").pack(side="left", padx=4, pady=3)

            pct = (count / total_products * 100) if total_products > 0 else 0
            tk.Label(row, text=f"{pct:.0f}%", font=F.MONO, fg=C.SUBTEXT0,
                    bg=bg, width=10,
                    anchor="e").pack(side="left", padx=4, pady=3)

            if not is_canonical:
                status_text, status_fg = "ANOMALY", C.RED
            elif pct >= 90:
                status_text, status_fg = "common", C.GREEN
            elif pct >= 50:
                status_text, status_fg = "partial", C.YELLOW
            else:
                status_text, status_fg = "sparse", C.PEACH

            tk.Label(row, text=status_text, font=F.SMALL, fg=status_fg,
                    bg=bg, width=10,
                    anchor="w").pack(side="left", padx=4, pady=3)

    def _refresh_editor(self):
        for w in self._editor_inner.winfo_children():
            w.destroy()

        self._fallback_state = {}
        editing_defaults = self._active_cat == "__defaults__"
        resolved = get_resolved_defaults(self._config_data, self._active_cat)
        cat_labels = self._app.store.cat_labels

        # Header
        if editing_defaults:
            title = "Global Defaults"
            subtitle = "These apply to all categories unless overridden."
        else:
            label = cat_labels.get(self._active_cat,
                                   self._active_cat.title())
            title = f"{label} Overrides"
            subtitle = "Empty = inherit from global defaults."

        tk.Label(self._editor_inner, text=title, font=F.HEADING,
                fg=C.TEXT, bg=C.SURFACE0).pack(anchor="w", padx=12,
                                                pady=(10, 0))
        tk.Label(self._editor_inner, text=subtitle, font=F.SMALL,
                fg=C.OVERLAY0, bg=C.SURFACE0).pack(anchor="w", padx=12,
                                                    pady=(0, 8))

        # Available views for dropdowns
        if self._active_cat == "__defaults__":
            available_views = list(
                CANONICAL_VIEWS - {"shape-side", "shape-top"})
        else:
            cat_views = self._view_counts.get(self._active_cat, {})
            available_views = [v for v in cat_views if v in CANONICAL_VIEWS]
        available_views.sort()

        # Coverage helpers
        cat_for_scanner = (self._active_cat
                          if self._active_cat != "__defaults__" else None)
        if cat_for_scanner:
            view_counts_cat = self._view_counts.get(cat_for_scanner, {})
            total = self._product_counts.get(cat_for_scanner, 1) or 1
        else:
            view_counts_cat = defaultdict(int)
            for cv in self._view_counts.values():
                for v, c in cv.items():
                    view_counts_cat[v] += c
            total = sum(self._product_counts.values()) or 1

        def coverage_sorted(exclude=None):
            ex = set(exclude or [])
            filtered = [v for v in available_views if v not in ex]
            filtered.sort(
                key=lambda v: view_counts_cat.get(v, 0), reverse=True)
            return filtered

        def coverage_pct(view):
            return int(view_counts_cat.get(view, 0) / total * 100)

        # ── Section: Contain Defaults ─────────────────────────────────────
        section = tk.Frame(self._editor_inner, bg=C.SURFACE0)
        section.pack(fill="x", padx=12, pady=(4, 8))

        tk.Label(section, text="Contain Defaults", font=F.BODY_BOLD,
                fg=C.SAPPHIRE, bg=C.SURFACE0).pack(anchor="w", pady=(0, 6))

        self._build_fallback_row(
            section, "defaultImageView:",
            resolved.get("defaultImageView", ["top"]),
            available_views, coverage_sorted, coverage_pct,
            primary_count=1, field_key="defaultImageView",
            tip="Primary contain view for product images. "
                "Fallbacks auto-sorted by coverage %.")

        self._build_fallback_row(
            section, "listThumbKeyBase:",
            resolved.get("listThumbKeyBase", ["left"]),
            available_views, coverage_sorted, coverage_pct,
            primary_count=1, field_key="listThumbKeyBase",
            tip="Primary contain view for list thumbnails. "
                "Fallbacks auto-sorted by coverage %.")

        self._build_fallback_row(
            section, "headerGame:",
            resolved.get("headerGame", ["left", "top"]),
            available_views, coverage_sorted, coverage_pct,
            primary_count=2, field_key="headerGame",
            tip="Two primary contain views for game header images. "
                "Backups auto-sorted by coverage %.")

        # ── Section: Cover Defaults ───────────────────────────────────────
        tk.Frame(self._editor_inner, bg=C.SURFACE1,
                height=1).pack(fill="x", padx=12, pady=8)

        section_cover = tk.Frame(self._editor_inner, bg=C.SURFACE0)
        section_cover.pack(fill="x", padx=12, pady=(0, 8))

        tk.Label(section_cover, text="Cover Defaults", font=F.BODY_BOLD,
                fg=C.PEACH, bg=C.SURFACE0).pack(anchor="w", pady=(0, 6))

        self._build_fallback_row(
            section_cover, "coverImageView:",
            resolved.get("coverImageView", ["feature-image"]),
            available_views, coverage_sorted, coverage_pct,
            primary_count=1, field_key="coverImageView",
            tip="Primary cover view for slideshows and hero images. "
                "Fallbacks auto-sorted by coverage %.")

        # ── Section: View Priority ────────────────────────────────────────
        tk.Frame(self._editor_inner, bg=C.SURFACE1,
                height=1).pack(fill="x", padx=12, pady=8)

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
            activestyle="none")
        for i, view in enumerate(priority):
            self._priority_listbox.insert("end", f"  {i+1}. {view}")
        self._priority_listbox.pack(anchor="w", pady=2)

        self._priority_listbox.bind("<Button-1>", self._prio_drag_start)
        self._priority_listbox.bind("<B1-Motion>", self._prio_drag_motion)
        self._priority_listbox.bind("<ButtonRelease-1>", self._prio_drag_end)

        btn_row = tk.Frame(section2, bg=C.SURFACE0)
        btn_row.pack(anchor="w", pady=4)
        FlatBtn(btn_row, text="Move Up", command=self._prio_move_up,
               font=F.SMALL, padx=10, pady=3).pack(side="left",
                                                     padx=(0, 4))
        FlatBtn(btn_row, text="Move Down", command=self._prio_move_down,
               font=F.SMALL, padx=10, pady=3).pack(side="left",
                                                     padx=(0, 4))

        if not editing_defaults:
            FlatBtn(btn_row, text="Reset to Defaults",
                   command=self._prio_reset, font=F.SMALL, fg=C.PEACH,
                   padx=10, pady=3).pack(side="left", padx=(12, 0))

        # ── Section: View Meta ────────────────────────────────────────────
        tk.Frame(self._editor_inner, bg=C.SURFACE1,
                height=1).pack(fill="x", padx=12, pady=8)

        section3 = tk.Frame(self._editor_inner, bg=C.SURFACE0)
        section3.pack(fill="x", padx=12, pady=(0, 12))

        tk.Label(section3, text="View Meta", font=F.BODY_BOLD,
                fg=C.SAPPHIRE, bg=C.SURFACE0).pack(anchor="w", pady=(0, 4))

        meta_hdr = tk.Frame(section3, bg=C.SURFACE1)
        meta_hdr.pack(fill="x", pady=(0, 2))
        for label_text, w in [("View", 18), ("Fit", 8),
                               ("Label", 16), ("Short", 10)]:
            tk.Label(meta_hdr, text=label_text, font=F.SMALL,
                    fg=C.SUBTEXT0, bg=C.SURFACE1, width=w,
                    anchor="w").pack(side="left", padx=2, pady=3)

        view_meta = resolved.get("viewMeta", {})
        self._meta_widgets = {}

        for view in priority:
            meta = view_meta.get(view, {
                "objectFit": "contain", "label": view,
                "labelShort": view[:4]})
            row = tk.Frame(section3, bg=C.SURFACE0)
            row.pack(fill="x", pady=1)

            tk.Label(row, text=view, font=F.MONO_SMALL, fg=C.TEXT,
                    bg=C.SURFACE0, width=18,
                    anchor="w").pack(side="left", padx=2)

            fit_var = tk.StringVar(value=meta.get("objectFit", "contain"))
            fit_fg = C.GREEN if fit_var.get() == "contain" else C.PEACH
            fit_btn = tk.Label(row, textvariable=fit_var,
                             font=F.MONO_SMALL, fg=fit_fg,
                             bg=C.SURFACE1, width=8, cursor="hand2",
                             padx=4, pady=2)
            fit_btn.pack(side="left", padx=2)
            fit_btn.bind("<Button-1>",
                        lambda e, v=fit_var, b=fit_btn, vw=view:
                        self._toggle_fit(v, b, vw))
            Tip(fit_btn, "Click to toggle contain/cover")

            label_var = tk.StringVar(value=meta.get("label", ""))
            label_entry = tk.Entry(row, textvariable=label_var,
                                  font=F.MONO_SMALL, bg=C.SURFACE1,
                                  fg=C.TEXT, insertbackground=C.TEXT,
                                  highlightthickness=0, width=16)
            label_entry.pack(side="left", padx=2)
            label_entry.bind("<FocusOut>",
                           lambda e, vw=view, v=label_var:
                           self._set_meta_field(vw, "label", v.get()))
            label_entry.bind("<Return>",
                           lambda e, vw=view, v=label_var:
                           self._set_meta_field(vw, "label", v.get()))

            short_var = tk.StringVar(value=meta.get("labelShort", ""))
            short_entry = tk.Entry(row, textvariable=short_var,
                                  font=F.MONO_SMALL, bg=C.SURFACE1,
                                  fg=C.TEXT, insertbackground=C.TEXT,
                                  highlightthickness=0, width=10)
            short_entry.pack(side="left", padx=2)
            short_entry.bind("<FocusOut>",
                           lambda e, vw=view, v=short_var:
                           self._set_meta_field(vw, "labelShort", v.get()))
            short_entry.bind("<Return>",
                           lambda e, vw=view, v=short_var:
                           self._set_meta_field(vw, "labelShort", v.get()))

            self._meta_widgets[view] = {
                "fit_var": fit_var, "fit_btn": fit_btn,
                "label_var": label_var, "short_var": short_var,
            }

    # ── Fallback row builder ───────────────────────────────────────────────

    def _build_fallback_row(self, parent, label_text, current_val,
                            available_views, coverage_sorted_fn,
                            coverage_pct_fn, primary_count, field_key, tip):
        val = list(current_val) if isinstance(current_val, list) \
            else [current_val]
        primaries = val[:primary_count]
        while len(primaries) < primary_count:
            primaries.append(
                available_views[0] if available_views else "top")

        container = tk.Frame(parent, bg=C.SURFACE0)
        container.pack(fill="x", pady=(2, 6))

        top_row = tk.Frame(container, bg=C.SURFACE0)
        top_row.pack(fill="x")

        lbl = tk.Label(top_row, text=label_text, font=F.MONO, fg=C.TEXT,
                       bg=C.SURFACE0, width=22, anchor="w")
        lbl.pack(side="left")
        Tip(lbl, tip)

        combo_vars = []
        for i in range(primary_count):
            prim_var = tk.StringVar(value=primaries[i])
            combo = ttk.Combobox(top_row, textvariable=prim_var,
                                 values=available_views,
                                 state="readonly", width=14)
            combo.pack(side="left", padx=(0, 6))
            combo_vars.append(prim_var)
            combo.bind("<<ComboboxSelected>>",
                       lambda e, fk=field_key, cvs=combo_vars:
                       self._on_fallback_primary_change(
                           fk, cvs, coverage_sorted_fn))

        fallback_frame = tk.Frame(container, bg=C.SURFACE0)
        fallback_frame.pack(fill="x", pady=(2, 0))

        self._fallback_state[field_key] = {
            "combo_vars": combo_vars,
            "fallback_frame": fallback_frame,
            "coverage_sorted_fn": coverage_sorted_fn,
            "coverage_pct_fn": coverage_pct_fn,
            "primary_count": primary_count,
        }

        self._render_fallbacks(field_key)

    def _render_fallbacks(self, field_key):
        state = self._fallback_state[field_key]
        frame = state["fallback_frame"]
        combo_vars = state["combo_vars"]
        coverage_sorted_fn = state["coverage_sorted_fn"]
        coverage_pct_fn = state["coverage_pct_fn"]

        for w in frame.winfo_children():
            w.destroy()

        primaries = [v.get() for v in combo_vars]
        fallbacks = coverage_sorted_fn(exclude=primaries)

        if not fallbacks:
            return

        row = tk.Frame(frame, bg=C.SURFACE0)
        row.pack(fill="x")

        tk.Label(row, text="", font=F.MONO, bg=C.SURFACE0,
                width=22).pack(side="left")

        tk.Label(row, text="Fallbacks:", font=F.TINY,
                fg=C.OVERLAY0, bg=C.SURFACE0).pack(side="left", padx=(0, 6))

        for i, view in enumerate(fallbacks):
            pct = coverage_pct_fn(view)
            tag = tk.Label(row, text=f"{view} ({pct}%)",
                          font=F.MONO_SMALL, fg=C.OVERLAY0,
                          bg=C.SURFACE1, padx=6, pady=1)
            tag.pack(side="left", padx=(0, 4))
            Tip(tag, f"Fallback {i+1}: {view} \u2014 {pct}% coverage")

    def _on_fallback_primary_change(self, field_key, combo_vars,
                                     coverage_sorted_fn):
        primaries = [v.get() for v in combo_vars]
        fallbacks = coverage_sorted_fn(exclude=primaries)
        full_chain = primaries + fallbacks
        self._set_field(field_key, full_chain)
        self._render_fallbacks(field_key)

    # ── Field setters ──────────────────────────────────────────────────────

    def _get_target(self) -> dict:
        if self._active_cat == "__defaults__":
            return self._config_data["defaults"]
        cats = self._config_data.setdefault("categories", {})
        return cats.setdefault(self._active_cat, {})

    def _set_field(self, key: str, value):
        target = self._get_target()
        target[key] = value
        self._update_changes()

    def _toggle_fit(self, var, btn, view):
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

    def _get_current_priority(self):
        items = self._priority_listbox.get(0, "end")
        return [item.strip().split(". ", 1)[-1] for item in items]

    def _save_priority(self, priority):
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
            item = self._priority_listbox.get(self._drag_idx)
            self._priority_listbox.delete(self._drag_idx)
            self._priority_listbox.insert(target_idx, item)
            self._priority_listbox.selection_set(target_idx)
            self._drag_idx = target_idx

    def _prio_drag_end(self, e):
        if self._drag_idx is not None:
            priority = self._get_current_priority()
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
        target = self._get_target()
        if "viewPriority" in target:
            del target["viewPriority"]
        self._refresh_all()

    # ── Change tracking ────────────────────────────────────────────────────

    def _update_changes(self):
        self._app.update_changes_badge()
