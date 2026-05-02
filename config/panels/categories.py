"""
Categories panel — manages category flags, colors, site theme, and content discovery.

Reads/writes categories.json via ConfigStore. Scans src/content/ for article
counts and auto-discovers new categories not yet in JSON.
"""

import json
import re
import tkinter as tk
from tkinter import messagebox
from datetime import datetime
from pathlib import Path

from lib.shared import (
    C, F, Toggle, FlatBtn, Tip, ColorPicker,
    draw_category_icon, derive_colors, hex_to_rgb,
    generate_distinct_color, darken,
)
from lib.config_store import ConfigStore


# ── Data Helpers (pure functions, no tkinter) ────────────────────────────────

def default_collections() -> dict:
    return {
        "dataProducts": False,
        "reviews": False,
        "guides": False,
        "news": False,
    }


def normalize_toggle(value) -> dict:
    source = value if isinstance(value, dict) else {}
    return {
        "production": bool(source.get("production", False)),
        "vite": bool(source.get("vite", False)),
    }


def normalize_collections(value) -> dict:
    merged = default_collections()
    if isinstance(value, dict):
        for key in merged:
            merged[key] = bool(value.get(key, merged[key]))
    return merged


def normalize_category(category: dict) -> dict:
    normalized = dict(category)
    normalized["product"] = normalize_toggle(category.get("product"))
    normalized["content"] = normalize_toggle(category.get("content"))
    normalized["collections"] = normalize_collections(category.get("collections"))
    return normalized


def infer_collections(article_counts: dict, product_counts: dict,
                      category_id: str) -> dict:
    counts = article_counts.get(category_id, {})
    return {
        "dataProducts": product_counts.get(category_id, 0) > 0,
        "reviews": counts.get("reviews", 0) > 0,
        "guides": counts.get("guides", 0) > 0,
        "news": counts.get("news", 0) > 0,
    }


def extract_category_from_frontmatter(filepath: Path) -> str | None:
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


def scan_content_categories(content_dir: Path) -> set[str]:
    """Scan content dirs for all category values used in frontmatter."""
    found: set[str] = set()
    for dirname in ("reviews", "guides", "news"):
        d = content_dir / dirname
        if not d.is_dir():
            continue
        for f in d.rglob("*"):
            if f.suffix in (".md", ".mdx") and f.is_file():
                cat = extract_category_from_frontmatter(f)
                if cat:
                    found.add(cat)
    dp = content_dir / "data-products"
    if dp.is_dir():
        for child in dp.iterdir():
            if child.is_dir():
                found.add(child.name)
    return found


def count_articles(content_dir: Path) -> dict[str, dict[str, int]]:
    """Count articles per category per content type."""
    counts: dict[str, dict[str, int]] = {}
    for dirname in ("reviews", "guides", "news"):
        d = content_dir / dirname
        if not d.is_dir():
            continue
        for f in d.rglob("*"):
            if f.suffix in (".md", ".mdx") and f.is_file():
                cat = extract_category_from_frontmatter(f)
                if cat:
                    counts.setdefault(cat, {"reviews": 0, "guides": 0, "news": 0})
                    counts[cat][dirname] += 1
    return counts


def count_products(content_dir: Path) -> dict[str, int]:
    """Count product JSON files per category from data-products/."""
    dp = content_dir / "data-products"
    counts: dict[str, int] = {}
    if not dp.is_dir():
        return counts
    for cat_dir in dp.iterdir():
        if cat_dir.is_dir():
            n = sum(1 for f in cat_dir.rglob("*.json") if f.is_file())
            counts[cat_dir.name] = n
    return counts


def scan_category_presence(content_dir: Path) -> dict[str, dict[str, bool]]:
    """Determine what each category has on disk.

    Returns {cat_id: {"has_products": bool, "has_content": bool}}.
    """
    dp = content_dir / "data-products"
    product_dirs: set[str] = set()
    if dp.is_dir():
        product_dirs = {d.name for d in dp.iterdir() if d.is_dir()}

    article_cats: set[str] = set()
    for dirname in ("reviews", "guides", "news"):
        d = content_dir / dirname
        if not d.is_dir():
            continue
        for f in d.rglob("*"):
            if f.suffix in (".md", ".mdx") and f.is_file():
                cat = extract_category_from_frontmatter(f)
                if cat:
                    article_cats.add(cat)

    result: dict[str, dict[str, bool]] = {}
    all_ids = product_dirs | article_cats
    for cat_id in all_ids:
        result[cat_id] = {
            "has_products": cat_id in product_dirs,
            "has_content": cat_id in article_cats,
        }
    return result


# ── Panel Class ──────────────────────────────────────────────────────────────

class CategoriesPanel(tk.Frame):
    """Categories management panel for the mega-app notebook."""

    COLS = 2

    def __init__(self, parent: tk.Widget, app):
        super().__init__(parent, bg=C.MANTLE)
        self._app = app
        self._project_root = app.store._root
        self._content_dir = self._project_root / "src" / "content"
        self._navbar_icons = self._project_root / "public" / "images" / "navbar"

        # Load data from store
        raw = app.store.get(ConfigStore.CATEGORIES)
        self._site_colors = dict(raw.get("siteColors",
                                         {"primary": "#89b4fa", "secondary": "#89b4fa"}))
        self._categories = [normalize_category(c)
                            for c in raw.get("categories", [])]

        # Scan content for counts (via shared cache)
        self._article_counts = app.cache.get_article_counts()
        self._product_counts = app.cache.get_product_counts()
        self._cat_presence = app.cache.get_category_presence()

        # Auto-discover categories from content not yet in JSON
        self._auto_discover()

        # Snapshot for dirty tracking
        self._snapshot()

        self._card_widgets: list[dict] = []
        self._broadcasting = False
        self._broadcast_after_id = None

        # Build UI
        self._build_site_theme_row()
        self._build_scrollable_area()
        self._build_add_button()

        # Update status bar
        app.set_status_right(f"{len(self._categories)} categories")

        # Subscribe to external category changes (from watcher)
        app.store.subscribe(ConfigStore.CATEGORIES, self._on_external_change)

    def _snapshot(self):
        self._original = json.dumps(
            {"s": self._site_colors, "c": self._categories}, sort_keys=True)

    def has_changes(self) -> bool:
        current = json.dumps(
            {"s": self._site_colors, "c": self._categories}, sort_keys=True)
        return current != self._original

    def save(self) -> bool:
        """Save categories data via ConfigStore. Returns True if saved."""
        if not self.has_changes():
            self._app.toast.show("No changes to save", C.OVERLAY0)
            return False
        try:
            data = {
                "siteColors": self._site_colors,
                "categories": self._categories,
            }
            # Pause watcher so our own write isn't detected as external
            self._app.watcher.pause()
            self._app.store.save(ConfigStore.CATEGORIES, data)
            self._app.watcher.snapshot()
            self._app.watcher.resume()

            self._snapshot()
            self._app.update_changes_badge()

            now = datetime.now().strftime("%H:%M:%S")
            self._app.toast.show(
                f"Saved site colors + {len(self._categories)} categories at {now}",
                C.GREEN)
            self._app.set_status(
                f"Last saved at {now}  \u00b7  Ctrl+S to save")
            self._app.set_status_right(f"{len(self._categories)} categories")
            return True
        except Exception as e:
            self._app.toast.show(f"Error: {e}", C.RED)
            return False

    def refresh(self):
        """Reload UI from ConfigStore data (after external change)."""
        raw = self._app.store.get(ConfigStore.CATEGORIES)
        self._site_colors = dict(raw.get("siteColors",
                                         {"primary": "#89b4fa", "secondary": "#89b4fa"}))
        self._categories = [normalize_category(c)
                            for c in raw.get("categories", [])]
        self._snapshot()
        self._refresh_site_theme()
        self._refresh_cards()
        self._app.update_changes_badge()
        self._app.set_status_right(f"{len(self._categories)} categories")

    def _broadcast_changes(self):
        """Push in-memory category state to store for live cross-panel sync."""
        self._broadcasting = True
        self._app.store.preview(ConfigStore.CATEGORIES, {
            "siteColors": self._site_colors,
            "categories": self._categories,
        })
        self._broadcasting = False
        self._app.update_changes_badge()

    def _schedule_broadcast(self):
        """Debounced broadcast for text entry changes (300ms)."""
        if self._broadcast_after_id:
            self.after_cancel(self._broadcast_after_id)
        self._broadcast_after_id = self.after(
            300, self._broadcast_changes)

    def _on_external_change(self):
        """Called when ConfigStore fires CATEGORIES subscriber."""
        if self._broadcasting:
            return
        self.refresh()

    # -- Auto-discover --------------------------------------------------------
    def _auto_discover(self):
        existing_ids = {c["id"] for c in self._categories}
        content_cats = self._app.cache.get_content_categories()
        existing_colors = [c.get("color", "") for c in self._categories]
        new_cats = sorted(content_cats - existing_ids)
        for cat_id in new_cats:
            color = generate_distinct_color(existing_colors)
            existing_colors.append(color)
            self._categories.append({
                "id": cat_id,
                "label": cat_id.capitalize(),
                "plural": cat_id.capitalize() + "s",
                "color": color,
                "product": {"production": False, "vite": True},
                "content": {"production": False, "vite": True},
                "collections": infer_collections(
                    self._article_counts, self._product_counts, cat_id),
            })

    # -- Site Theme Row -------------------------------------------------------
    def _build_site_theme_row(self):
        row = tk.Frame(self, bg=C.SURFACE0, highlightthickness=1,
                       highlightbackground=C.CARD_BORDER, height=52)
        row.pack(fill="x", padx=16, pady=(4, 0))
        row.pack_propagate(False)

        accent_bar = tk.Canvas(row, width=4, highlightthickness=0, bg=C.SURFACE0)
        accent_bar.pack(side="left", fill="y")
        self._site_accent_bar = accent_bar

        inner = tk.Frame(row, bg=C.SURFACE0)
        inner.pack(side="left", fill="both", expand=True, padx=8, pady=4)

        row_a = tk.Frame(inner, bg=C.SURFACE0)
        row_a.pack(fill="x")

        tk.Label(row_a, text="Site Theme", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(side="left")
        tk.Label(row_a, text="  seasonal colors", bg=C.SURFACE0,
                 fg=C.OVERLAY0, font=F.TINY).pack(side="left")

        self._grad_canvas = tk.Canvas(row_a, width=200, height=14,
                                      highlightthickness=1,
                                      highlightbackground=C.SURFACE2)
        self._grad_canvas.pack(side="right")

        self._site_derived: dict[str, tk.Canvas] = {}
        for key in reversed(["accent", "hover", "grad-start", "dark", "soft"]):
            sw = tk.Canvas(row_a, width=16, height=12, highlightthickness=1,
                           highlightbackground=C.SURFACE2)
            sw.pack(side="right", padx=1)
            self._site_derived[key] = sw
        tk.Label(row_a, text="Derived:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.TINY).pack(side="right", padx=(8, 2))

        row_b = tk.Frame(inner, bg=C.SURFACE0)
        row_b.pack(fill="x", pady=(2, 0))

        tk.Label(row_b, text="Primary:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.TINY).pack(side="left")
        self._pri_swatch = tk.Canvas(row_b, width=14, height=14,
                                     highlightthickness=1,
                                     highlightbackground=C.SURFACE2,
                                     bg=self._site_colors["primary"],
                                     cursor="hand2")
        self._pri_swatch.pack(side="left", padx=(3, 2))
        self._pri_lbl = tk.Label(row_b, text=self._site_colors["primary"],
                                 bg=C.SURFACE0,
                                 fg=self._site_colors["primary"],
                                 font=F.SMALL, cursor="hand2")
        self._pri_lbl.pack(side="left", padx=(0, 12))

        tk.Label(row_b, text="Secondary:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.TINY).pack(side="left")
        self._sec_swatch = tk.Canvas(row_b, width=14, height=14,
                                     highlightthickness=1,
                                     highlightbackground=C.SURFACE2,
                                     bg=self._site_colors["secondary"],
                                     cursor="hand2")
        self._sec_swatch.pack(side="left", padx=(3, 2))
        self._sec_lbl = tk.Label(row_b, text=self._site_colors["secondary"],
                                 bg=C.SURFACE0,
                                 fg=self._site_colors["secondary"],
                                 font=F.SMALL, cursor="hand2")
        self._sec_lbl.pack(side="left")

        self._pri_swatch.bind("<Button-1>",
                              lambda e: self._pick_site_color("primary"))
        self._pri_lbl.bind("<Button-1>",
                           lambda e: self._pick_site_color("primary"))
        self._sec_swatch.bind("<Button-1>",
                              lambda e: self._pick_site_color("secondary"))
        self._sec_lbl.bind("<Button-1>",
                           lambda e: self._pick_site_color("secondary"))

        Tip(self._pri_swatch,
            "Primary site color (--site-color).\n"
            "Used as gradient start, navbar accent, SVG gradients.")
        Tip(self._sec_swatch,
            "Secondary site color (--brand-color).\n"
            "Used as gradient end, CTA highlights.")
        Tip(self._grad_canvas,
            "Live preview of the site gradient.\n"
            "Used in navbar, buttons, borders, SVG fills.")

        self._refresh_site_theme()

    def _refresh_site_theme(self):
        pri = self._site_colors["primary"]
        sec = self._site_colors["secondary"]

        pr, pg, pb = hex_to_rgb(pri)
        sr, sg, sb = hex_to_rgb(sec)

        # Horizontal gradient via PhotoImage (1 op vs 200 create_line calls)
        gc = self._grad_canvas
        gc.delete("all")
        w = 200

        def _lerp_color(t):
            r = int(pr + (sr - pr) * t)
            g = int(pg + (sg - pg) * t)
            b = int(pb + (sb - pb) * t)
            return f"#{r:02x}{g:02x}{b:02x}"

        img = tk.PhotoImage(width=w, height=1)
        row = " ".join(_lerp_color(x / (w - 1)) for x in range(w))
        img.put(f"{{{row}}}")
        self._grad_img = img.zoom(1, 14)
        gc.create_image(0, 0, image=self._grad_img, anchor="nw")

        # Vertical accent bar via PhotoImage (1 op vs h create_line calls)
        ab = self._site_accent_bar
        ab.delete("all")
        ab.update_idletasks()
        h = max(ab.winfo_height(), 60)
        col_img = tk.PhotoImage(width=1, height=h)
        # WHY: each {color} = one row of 1 pixel, stacked vertically
        rows = " ".join(
            f"{{{_lerp_color(y / max(h - 1, 1))}}}" for y in range(h))
        col_img.put(rows)
        self._accent_bar_img = col_img.zoom(4, 1)
        ab.create_image(0, 0, image=self._accent_bar_img, anchor="nw")

        derived = derive_colors(pri)
        for key, canvas in self._site_derived.items():
            val = derived.get(key, pri)
            if not val.startswith("rgba"):
                canvas.configure(bg=val)

        # Update primary/secondary swatch labels
        self._pri_swatch.configure(bg=pri)
        self._pri_lbl.configure(text=pri, fg=pri)
        self._sec_swatch.configure(bg=sec)
        self._sec_lbl.configure(text=sec, fg=sec)

    def _pick_site_color(self, which: str):
        current = self._site_colors[which]
        label = ("Primary (site-color)" if which == "primary"
                 else "Secondary (brand-color)")
        picker = ColorPicker(self, initial=current, title=f"Site {label}",
                             accent=self._site_colors["primary"])
        self.wait_window(picker)
        if picker.result:
            self._site_colors[which] = picker.result
            self._refresh_site_theme()
            self._broadcast_changes()

    # -- Scrollable Area (2-column grid) --------------------------------------
    def _build_scrollable_area(self):
        container = tk.Frame(self, bg=C.MANTLE)
        container.pack(fill="both", expand=True)

        self._canvas = tk.Canvas(container, bg=C.MANTLE, highlightthickness=0)
        scrollbar = tk.Scrollbar(container, orient="vertical",
                                 command=self._canvas.yview,
                                 bg=C.SURFACE1, troughcolor=C.BASE,
                                 highlightthickness=0, bd=0)
        self._cards_frame = tk.Frame(self._canvas, bg=C.MANTLE)
        self._cards_frame.columnconfigure(0, weight=1, uniform="col")
        self._cards_frame.columnconfigure(1, weight=1, uniform="col")

        self._cards_frame.bind(
            "<Configure>",
            lambda e: self._canvas.configure(
                scrollregion=self._canvas.bbox("all")))
        self._canvas_win = self._canvas.create_window(
            (0, 0), window=self._cards_frame, anchor="nw")
        self._canvas.configure(yscrollcommand=scrollbar.set)

        def _on_canvas_resize(e):
            self._canvas.itemconfigure(self._canvas_win, width=e.width)
        self._canvas.bind("<Configure>", _on_canvas_resize)

        self._canvas.pack(side="left", fill="both", expand=True,
                          padx=(16, 0), pady=(12, 0))
        scrollbar.pack(side="right", fill="y", padx=(0, 4), pady=(12, 0))

        def _on_mousewheel(e):
            self._canvas.yview_scroll(int(-1 * (e.delta / 120)), "units")
        self._canvas.bind_all("<MouseWheel>", _on_mousewheel)

        self._refresh_cards()

    def _refresh_cards(self):
        for w in self._cards_frame.winfo_children():
            w.destroy()
        self._card_widgets = []

        for i, cat in enumerate(self._categories):
            self._build_card(i, cat)
        self._app.update_changes_badge()

    def _build_card(self, idx: int, cat: dict):
        color = cat.get("color", self._site_colors["primary"])
        cat_id = cat.get("id", "")
        grid_row, grid_col = divmod(idx, self.COLS)

        card = tk.Frame(self._cards_frame, bg=C.SURFACE0,
                        highlightthickness=1,
                        highlightbackground=C.CARD_BORDER)
        card.grid(row=grid_row, column=grid_col, sticky="nsew",
                  padx=4, pady=4)

        accent = tk.Frame(card, bg=color, width=4)
        accent.pack(side="left", fill="y")

        inner = tk.Frame(card, bg=C.SURFACE0)
        inner.pack(side="left", fill="both", expand=True, padx=10, pady=8)

        # Row 1: color swatch + ID + hex color
        row1 = tk.Frame(inner, bg=C.SURFACE0)
        row1.pack(fill="x")

        swatch = tk.Canvas(row1, width=18, height=18, highlightthickness=1,
                           highlightbackground=C.SURFACE2, bg=color,
                           cursor="hand2")
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
                 highlightbackground=C.SURFACE2,
                 width=10).pack(side="left", padx=(4, 8))

        tk.Label(row2, text="Plural:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL).pack(side="left")
        plural_var = tk.StringVar(value=cat.get("plural", ""))
        tk.Entry(row2, textvariable=plural_var, bg=C.SURFACE1, fg=C.TEXT,
                 insertbackground=C.TEXT, font=F.BODY, relief="flat", bd=0,
                 highlightthickness=1, highlightcolor=C.BLUE,
                 highlightbackground=C.SURFACE2,
                 width=10).pack(side="left", padx=(4, 0))

        # Row 3: Product + Content toggles
        row3 = tk.Frame(inner, bg=C.SURFACE0)
        row3.pack(fill="x", pady=(5, 0))

        def _toggle_pair(parent, label_text, initial, on_cb):
            pair = tk.Frame(parent, bg=C.SURFACE0)
            pair.pack(side="left", padx=(0, 4))
            tk.Label(pair, text=label_text, bg=C.SURFACE0, fg=C.SUBTEXT0,
                     font=F.SMALL).pack(side="left", padx=(0, 3))
            t = Toggle(pair, initial=initial, on_toggle=on_cb, bg=C.SURFACE0)
            t.pack(side="left")
            return t

        presence = self._cat_presence.get(
            cat_id, {"has_products": False, "has_content": False})
        has_products = presence["has_products"]
        has_content = presence["has_content"]
        show_product = has_products or (not has_products and not has_content)
        show_content = has_content or (not has_products and not has_content)

        prod_prod = prod_vite = cont_prod = cont_vite = None

        if show_product:
            tk.Label(row3, text="Product", bg=C.SURFACE0, fg=C.TEXT,
                     font=F.SMALL).pack(side="left", padx=(0, 6))
            prod_prod = _toggle_pair(
                row3, "Prod",
                cat.get("product", {}).get("production", False),
                lambda v, i=idx: self._on_toggle(i, "product", "production", v))
            prod_vite = _toggle_pair(
                row3, "Vite",
                cat.get("product", {}).get("vite", False),
                lambda v, i=idx: self._on_toggle(i, "product", "vite", v))

        if show_product and show_content:
            tk.Frame(row3, bg=C.SURFACE2, width=1,
                     height=20).pack(side="left", fill="y", padx=(8, 8))

        if show_content:
            tk.Label(row3, text="Content", bg=C.SURFACE0, fg=C.TEXT,
                     font=F.SMALL).pack(side="left", padx=(0, 6))
            cont_prod = _toggle_pair(
                row3, "Prod",
                cat.get("content", {}).get("production", False),
                lambda v, i=idx: self._on_toggle(i, "content", "production", v))
            cont_vite = _toggle_pair(
                row3, "Vite",
                cat.get("content", {}).get("vite", False),
                lambda v, i=idx: self._on_toggle(i, "content", "vite", v))

        # Row 4: Product count + Article counts + icon status
        row4 = tk.Frame(inner, bg=C.SURFACE0)
        row4.pack(fill="x", pady=(4, 0))

        parts: list[str] = []
        p_count = self._product_counts.get(cat_id, 0)
        if p_count > 0:
            parts.append(f"{p_count} products")

        counts = self._article_counts.get(cat_id, {})
        r_count = counts.get("reviews", 0)
        g_count = counts.get("guides", 0)
        n_count = counts.get("news", 0)
        a_total = r_count + g_count + n_count
        if a_total > 0:
            parts.append(f"{r_count} reviews \u00b7 {g_count} guides \u00b7 {n_count} news")

        count_text = "  |  ".join(parts) if parts else "no data found"

        tk.Label(row4, text=count_text, bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.TINY).pack(side="left")

        # Icon status
        icon_path = self._navbar_icons / f"{cat_id}.svg"
        has_icon = icon_path.is_file()

        icon_frame = tk.Frame(row4, bg=C.SURFACE0)
        icon_frame.pack(side="right")

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
                f"Found \u2014 custom icon active.")
        else:
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
                f"NOT FOUND \u2014 navbar will have no icon for this category.\n"
                f"Add a 24x24 SVG silhouette to this path.")
        Tip(icon_lbl, tip_text)

        # Row 5: Derived color swatches
        row5 = tk.Frame(inner, bg=C.SURFACE0)
        row5.pack(fill="x", pady=(4, 0))

        derived = derive_colors(color)
        swatch_widgets = {}
        swatch_order = ["base", "accent", "hover", "grad-start",
                        "score-end", "dark", "soft"]
        for key in swatch_order:
            hex_val = derived[key]
            sw_c = tk.Canvas(row5, width=20, height=12, highlightthickness=1,
                             highlightbackground=C.SURFACE2, bg=hex_val)
            sw_c.pack(side="left", padx=1)
            swatch_widgets[key] = sw_c

        # Bind entry changes
        label_var.trace_add("write",
            lambda *a, i=idx, v=label_var: self._on_entry(i, "label", v))
        plural_var.trace_add("write",
            lambda *a, i=idx, v=plural_var: self._on_entry(i, "plural", v))

        # Color picker
        def _pick_color(e=None, i=idx, sw=swatch, cl=color_lbl, ac=accent,
                        sw_w=swatch_widgets, ic=icon_canvas):
            current = self._categories[i].get("color", "#ffffff")
            picker = ColorPicker(self, initial=current,
                                 title=f"Color for {self._categories[i]['id']}",
                                 category_id=self._categories[i]["id"],
                                 accent=self._site_colors["primary"])
            self.wait_window(picker)
            if picker.result:
                new_color = picker.result
                self._categories[i]["color"] = new_color
                sw.configure(bg=new_color)
                cl.configure(text=new_color, fg=new_color)
                ac.configure(bg=new_color)
                new_derived = derive_colors(new_color)
                for key, canvas in sw_w.items():
                    if new_derived.get(key, "").startswith("rgba"):
                        continue
                    canvas.configure(bg=new_derived[key])
                draw_category_icon(ic, self._categories[i]["id"], new_color)
                self._broadcast_changes()

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
        self._categories[idx].setdefault(section, {})
        self._categories[idx][section][field] = val
        self._broadcast_changes()

    def _on_entry(self, idx, field, var):
        self._categories[idx][field] = var.get()
        self._schedule_broadcast()

    # -- Add Category ---------------------------------------------------------
    def _build_add_button(self):
        add_frame = tk.Frame(self, bg=C.MANTLE)
        add_frame.pack(fill="x", padx=24, pady=(8, 8))
        FlatBtn(add_frame, text="+ Add Category",
                command=self._add_category,
                bg=C.SURFACE1, hover_bg=C.SURFACE2,
                font=F.BODY_BOLD).pack(side="left")

    def _add_category(self):
        dlg = tk.Toplevel(self)
        dlg.title("Add Category")
        dlg.configure(bg=C.SURFACE0)
        dlg.resizable(False, False)
        self.update_idletasks()
        w, h = 380, 260
        px = self.winfo_toplevel().winfo_x()
        py = self.winfo_toplevel().winfo_y()
        pw = self.winfo_toplevel().winfo_width()
        ph = self.winfo_toplevel().winfo_height()
        x = px + (pw - w) // 2
        y = py + (ph - h) // 2
        dlg.geometry(f"{w}x{h}+{x}+{y}")
        dlg.transient(self.winfo_toplevel())
        dlg.grab_set()

        try:
            from lib.shared import dark_title_bar
            dark_title_bar(dlg)
        except Exception:
            pass

        body = tk.Frame(dlg, bg=C.SURFACE0)
        body.pack(fill="both", expand=True, padx=20, pady=16)

        def make_field(parent, label_text, row):
            tk.Label(parent, text=label_text, bg=C.SURFACE0, fg=C.SUBTEXT0,
                     font=F.SMALL).grid(row=row, column=0, sticky="w",
                                        pady=(0, 4))
            entry = tk.Entry(parent, bg=C.SURFACE1, fg=C.TEXT,
                             insertbackground=C.TEXT, font=F.BODY,
                             relief="flat", bd=0, highlightthickness=1,
                             highlightcolor=C.BLUE,
                             highlightbackground=C.SURFACE2, width=30)
            entry.grid(row=row, column=1, sticky="ew", pady=(0, 8),
                       padx=(8, 0))
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
            if any(c["id"] == new_id for c in self._categories):
                self._app.toast.show(f"'{new_id}' already exists",
                                     C.PEACH, 2500)
                dlg.destroy()
                return
            if not new_label:
                new_label = new_id.capitalize()
            if not new_plural:
                new_plural = new_label + "s"
            existing_colors = [c.get("color", "") for c in self._categories]
            color = generate_distinct_color(existing_colors)
            self._categories.append({
                "id": new_id, "label": new_label, "plural": new_plural,
                "color": color,
                "product": {"production": False, "vite": True},
                "content": {"production": False, "vite": True},
                "collections": default_collections(),
            })
            dlg.destroy()
            self._refresh_cards()
            self._broadcast_changes()
            self._app.set_status_right(
                f"{len(self._categories)} categories")

        id_entry.bind("<Return>", lambda e: do_add())

        btn_row = tk.Frame(body, bg=C.SURFACE0)
        btn_row.pack(fill="x", pady=(12, 0))
        FlatBtn(btn_row, text="Cancel", command=dlg.destroy,
                bg=C.SURFACE1, hover_bg=C.SURFACE2).pack(side="right",
                                                          padx=(8, 0))
        pri = self._site_colors["primary"]
        hover = derive_colors(pri).get("hover", pri)
        FlatBtn(btn_row, text="  Add  ", command=do_add,
                bg=pri, fg=C.CRUST,
                hover_bg=hover).pack(side="right")
