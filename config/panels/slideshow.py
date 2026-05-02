"""
panels/slideshow.py — Slideshow queue management panel for EG Config Manager.

Manages the home page slideshow queue: product pool with search/filter/sort,
drag-and-drop queue assignment, auto-fill, max-slides control.
Reads product data from src/content/data-products/.
Reads/writes config/data/slideshow.json via ConfigStore.
"""

import json
import tkinter as tk
from tkinter import ttk
from pathlib import Path

from lib.shared import (C, F, FlatBtn, Tip, HoverListbox, darken)
from lib.config_store import ConfigStore


# ── Constants ───────────────────────────────────────────────────────────────

PLACEHOLDER_DOMAINS = {"dasad.com", "dasd.com", ""}
MIN_AUTOFILL_SCORE = 8.0
MAX_PER_CAT = 3


# ── Pure functions (no tkinter) ─────────────────────────────────────────────


def parse_release_date(raw) -> tuple[int, int]:
    """Parse 'MM/YYYY' -> (year, month) for sorting. Returns (0, 0) on failure."""
    if not raw or not isinstance(raw, str):
        return (0, 0)
    raw = raw.strip()
    parts = raw.split("/")
    if len(parts) == 2:
        try:
            m, y = int(parts[0]), int(parts[1])
            return (y, m)
        except ValueError:
            pass
    try:
        return (int(raw), 0)
    except ValueError:
        return (0, 0)


def has_deal_link(data: dict) -> bool:
    """Check if any affiliate field has a real (non-placeholder) URL."""
    for key in ("alink_amazon", "alink_bestbuy", "alink_newegg",
                "alink_walmart", "alink_brand"):
        val = str(data.get(key, "")).strip()
        if val and val not in PLACEHOLDER_DOMAINS and val.startswith("http"):
            return True

    affiliate_links = data.get("affiliateLinks", [])
    if isinstance(affiliate_links, list):
        for link in affiliate_links:
            if not isinstance(link, dict):
                continue
            val = str(link.get("url", "")).strip()
            if val and val not in PLACEHOLDER_DOMAINS and val.startswith("http"):
                return True

    return False


def load_products(data_products_dir: Path) -> list[dict]:
    """Scan data-products and build the eligible product list."""
    products = []
    if not data_products_dir.is_dir():
        return products

    for json_path in sorted(data_products_dir.rglob("*.json")):
        try:
            data = json.loads(json_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue

        rel = json_path.relative_to(data_products_dir)
        parts = rel.with_suffix("").parts
        if len(parts) != 3:
            continue
        entry_id = "-".join(parts[1:])

        category = data.get("category", parts[0])
        brand = data.get("brand", "")
        model = data.get("model", "")
        slug = data.get("slug", parts[2])
        overall_raw = data.get("overall", "")
        release_date = str(data.get("release_date", ""))
        image_path = data.get("imagePath", "")

        try:
            overall = float(overall_raw)
        except (ValueError, TypeError):
            overall = 0.0

        media = data.get("media", {})
        image_count = len(media.get("images", []))

        if overall <= 0 or image_count == 0:
            continue

        products.append({
            "entry_id": entry_id,
            "slug": slug,
            "brand": brand,
            "model": model,
            "category": category,
            "overall": overall,
            "release_date": release_date,
            "release_sort": parse_release_date(release_date),
            "image_path": image_path,
            "image_count": image_count,
            "has_deal": has_deal_link(data),
        })

    return products


def auto_fill_slots(products: list[dict], current_queue: list[str],
                    max_slides: int) -> tuple[list[str], int]:
    """Fill empty queue slots. Returns (new_queue, num_added).

    Priority: deal links first, then release date desc, then score.
    Filters: score >= MIN_AUTOFILL_SCORE, max MAX_PER_CAT per category.
    """
    queue = list(current_queue)
    remaining = max_slides - len(queue)
    if remaining <= 0:
        return queue, 0

    queue_set = set(queue)
    eligible = [
        p for p in products
        if p["entry_id"] not in queue_set
        and p["overall"] >= MIN_AUTOFILL_SCORE
    ]

    eligible.sort(key=lambda p: (
        0 if p["has_deal"] else 1,
        -p["release_sort"][0],
        -p["release_sort"][1],
        -p["overall"],
    ))

    cat_counts: dict[str, int] = {}
    added = 0

    for p in eligible:
        if added >= remaining:
            break
        cat = p["category"]
        if cat_counts.get(cat, 0) >= MAX_PER_CAT:
            continue
        queue.append(p["entry_id"])
        queue_set.add(p["entry_id"])
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
        added += 1

    return queue, added


# ── Panel class ─────────────────────────────────────────────────────────────


class SlideshowPanel(tk.Frame):
    """Slideshow queue management panel for the mega-app notebook."""

    def __init__(self, parent: tk.Widget, app):
        super().__init__(parent, bg=C.MANTLE)
        self._app = app
        self._project_root = app.store._root
        self._data_products = self._project_root / "src" / "content" / "data-products"

        # Load products from shared cache
        self._all_products = app.cache.get_products()
        self._product_map: dict[str, dict] = {
            p["entry_id"]: p for p in self._all_products
        }

        # Load config from store
        cfg = app.store.get(ConfigStore.SLIDESHOW)
        self._queue: list[str] = [
            eid for eid in cfg.get("slides", [])
            if eid in self._product_map
        ]
        self._max_slides = cfg.get("maxSlides", 10)
        self._config_data = {"maxSlides": self._max_slides,
                             "slides": list(self._queue)}
        self._original = json.dumps(self._config_data, sort_keys=True)

        # Filter/sort state
        self._search_var = tk.StringVar(value="")
        self._cat_filter = "all"
        self._sort_key = "score"
        self._cat_pills: list[tk.Frame] = []

        # Debounce state
        self._search_after_id = None

        # Drag state
        self._drag_src = None
        self._drag_entry_id = None
        self._drag_ghost = None
        self._drag_queue_idx = None

        # Pool/queue listbox refs (built once)
        self._pool_lb: HoverListbox | None = None
        self._pool_hdr_lbl: tk.Label | None = None
        self._queue_lb: HoverListbox | None = None
        self._queue_display_items: list[str | None] = []
        self._queue_btn_col: tk.Frame | None = None
        self._queue_filled_lbl: tk.Label | None = None

        # Build UI
        self._build_toolbar()
        self._build_panels()
        self._build_pool_ui()
        self._build_queue_ui()

        self._refresh_pool()
        self._refresh_queue()

        # Subscribe to changes
        app.store.subscribe(ConfigStore.SLIDESHOW, self._on_external_change)
        # WHY: CATEGORIES subscription removed — mega-app dispatches centrally
        # to avoid refreshing hidden panels

        self._update_status()

    # ── Public interface ────────────────────────────────────────────────────

    def save(self) -> bool:
        current = json.dumps(self._config_data, sort_keys=True)
        if current == self._original:
            self._app.toast.show("No changes to save", C.OVERLAY0)
            return False
        self._app.watcher.pause()
        try:
            self._app.store.save(ConfigStore.SLIDESHOW, self._config_data)
            self._original = current
            self._app.update_changes_badge()
            from datetime import datetime
            now = datetime.now().strftime("%H:%M:%S")
            n = len(self._queue)
            self._app.toast.show(
                f"Saved {n} slide{'s' if n != 1 else ''} "
                f"(max {self._max_slides}) at {now}", C.GREEN)
            self._app.set_status(f"Last saved at {now}  \u00b7  Ctrl+S to save")
        except Exception as e:
            self._app.toast.show(f"Error: {e}", C.RED)
        finally:
            self._app.watcher.snapshot()
            self._app.watcher.resume()
        return True

    def has_changes(self) -> bool:
        return json.dumps(self._config_data, sort_keys=True) != self._original

    def refresh(self):
        cfg = self._app.store.get(ConfigStore.SLIDESHOW)
        self._queue = [
            eid for eid in cfg.get("slides", [])
            if eid in self._product_map
        ]
        self._max_slides = cfg.get("maxSlides", 10)
        self._config_data = {"maxSlides": self._max_slides,
                             "slides": list(self._queue)}
        self._original = json.dumps(self._config_data, sort_keys=True)
        self._refresh_pool()
        self._refresh_queue()
        self._update_status()
        self._app.update_changes_badge()

    # ── Internal ────────────────────────────────────────────────────────────

    def _on_external_change(self):
        self.refresh()

    def _on_categories_change(self):
        self._rebuild_pills()
        self._refresh_pool()

    def _accent(self):
        return self._app.store.site_accent

    def _cat_colors(self):
        return self._app.store.cat_colors

    def _cat_labels(self):
        return self._app.store.cat_labels

    def _mark_changed(self):
        self._config_data = {
            "maxSlides": self._max_slides,
            "slides": list(self._queue),
        }
        self._app.update_changes_badge()

    def _update_status(self):
        filled = len(self._queue)
        total = len(self._all_products)
        self._app.set_status_right(
            f"{total} eligible products  \u00b7  {filled} assigned")

    # ── Toolbar ─────────────────────────────────────────────────────────────

    def _build_toolbar(self):
        bar = tk.Frame(self, bg=C.MANTLE)
        bar.pack(fill="x", padx=16, pady=(12, 0))

        # Search
        search_frame = tk.Frame(bar, bg=C.MANTLE)
        search_frame.pack(side="left")
        tk.Label(search_frame, text="\U0001f50d", bg=C.MANTLE, fg=C.OVERLAY0,
                 font=F.BODY).pack(side="left", padx=(0, 4))
        self._search_entry = tk.Entry(
            search_frame, textvariable=self._search_var,
            bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
            font=F.BODY, relief="flat", bd=0,
            highlightthickness=1, highlightcolor=C.BLUE,
            highlightbackground=C.SURFACE2, width=25)
        self._search_entry.pack(side="left", ipady=4)
        def _debounced_search(*a):
            if self._search_after_id:
                self.after_cancel(self._search_after_id)
            self._search_after_id = self.after(300, self._refresh_pool)
        self._search_var.trace_add("write", _debounced_search)

        # Category pills
        self._pill_row = tk.Frame(bar, bg=C.MANTLE)
        self._pill_row.pack(side="left", padx=(24, 0))
        self._rebuild_pills()

        # Sort dropdown
        sort_frame = tk.Frame(bar, bg=C.MANTLE)
        sort_frame.pack(side="right")
        tk.Label(sort_frame, text="Sort:", bg=C.MANTLE, fg=C.OVERLAY0,
                 font=F.SMALL).pack(side="left", padx=(0, 6))
        self._sort_var = tk.StringVar(value="Score")
        sort_menu = tk.OptionMenu(
            sort_frame, self._sort_var,
            "Score", "Release Date", "Brand", "Model",
            command=self._on_sort_change)
        sort_menu.configure(bg=C.SURFACE1, fg=C.TEXT, font=F.SMALL,
                            activebackground=C.SURFACE2,
                            activeforeground=C.TEXT,
                            highlightthickness=0, bd=0, relief="flat",
                            indicatoron=True)
        sort_menu["menu"].configure(bg=C.SURFACE1, fg=C.TEXT, font=F.SMALL,
                                     activebackground=C.BLUE,
                                     activeforeground=C.CRUST,
                                     bd=0, relief="flat")
        sort_menu.pack(side="left")

    def _rebuild_pills(self):
        for w in self._pill_row.winfo_children():
            w.destroy()
        self._cat_pills = []
        accent = self._accent()
        self._make_pill(self._pill_row, "all", "All", accent)
        product_cats = sorted(set(p["category"] for p in self._all_products))
        colors = self._cat_colors()
        labels = self._cat_labels()
        for cat in product_cats:
            color = colors.get(cat, accent)
            label = labels.get(cat, cat.title())
            self._make_pill(self._pill_row, cat, label, color)

    def _make_pill(self, parent, cat_id: str, label: str, color: str):
        pill = tk.Frame(parent, bg=C.MANTLE, cursor="hand2")
        pill.pack(side="left", padx=2)

        if cat_id != "all":
            dot = tk.Canvas(pill, width=10, height=10,
                            highlightthickness=0, bg=C.MANTLE)
            dot.pack(side="left", padx=(8, 4), pady=8)
            dot.create_oval(1, 1, 9, 9, fill=color, outline="")
        else:
            dot = None

        lbl = tk.Label(pill, text=label, fg=C.SUBTEXT0, bg=C.MANTLE,
                       font=F.BODY_BOLD, padx=4, pady=8)
        lbl.pack(side="left", padx=(0 if dot else 8, 8))

        pill._cat = cat_id
        pill._color = color
        pill._dot = dot
        pill._lbl = lbl
        self._cat_pills.append(pill)

        def click(e, c=cat_id):
            self._cat_filter = c
            self._sync_pills()
            self._refresh_pool()
        def enter(e, p=pill):
            if p._cat != self._cat_filter:
                widgets = [p, p._lbl] + ([p._dot] if p._dot else [])
                for w in widgets:
                    w.configure(bg=C.SURFACE1)
        def leave(e):
            self._sync_pills()

        for w in [pill, lbl] + ([dot] if dot else []):
            w.bind("<Button-1>", click)
            w.bind("<Enter>", enter)
            w.bind("<Leave>", leave)

        self._sync_pills()

    def _sync_pills(self):
        active = self._cat_filter
        for p in self._cat_pills:
            is_active = p._cat == active
            bg = C.SURFACE2 if is_active else C.MANTLE
            fg = p._color if is_active else C.SUBTEXT0
            widgets = [p, p._lbl] + ([p._dot] if p._dot else [])
            for w in widgets:
                w.configure(bg=bg)
            p._lbl.configure(fg=fg)

    def _on_sort_change(self, selection):
        mapping = {
            "Score": "score", "Release Date": "release",
            "Brand": "brand", "Model": "model",
        }
        self._sort_key = mapping.get(selection, "score")
        self._refresh_pool()

    # ── Main panels ─────────────────────────────────────────────────────────

    def _build_panels(self):
        self._panel_frame = tk.Frame(self, bg=C.MANTLE)
        self._panel_frame.pack(fill="both", expand=True, padx=16, pady=(8, 0))

        self._pool_frame = tk.Frame(self._panel_frame, bg=C.SURFACE0,
                                     highlightthickness=1,
                                     highlightbackground=C.CARD_BORDER)
        self._pool_frame.pack(side="left", fill="both", expand=True,
                               padx=(0, 8))

        self._queue_frame = tk.Frame(self._panel_frame, bg=C.SURFACE0,
                                      highlightthickness=1,
                                      highlightbackground=C.CARD_BORDER)
        self._queue_frame.pack(side="right", fill="both", padx=(8, 0))
        self._queue_frame.configure(width=420)
        self._queue_frame.pack_propagate(False)

    # ── Pool ────────────────────────────────────────────────────────────────

    def _build_pool_ui(self):
        """One-time creation of pool header + listbox. Data filled by _refresh_pool."""
        accent = self._accent()
        self._pool_accent_bar = tk.Frame(self._pool_frame, bg=accent, height=3)
        self._pool_accent_bar.pack(fill="x")

        hdr = tk.Frame(self._pool_frame, bg=C.SURFACE0)
        hdr.pack(fill="x", padx=12, pady=(10, 2))
        tk.Label(hdr, text="Product Pool", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(side="left")
        self._pool_hdr_lbl = tk.Label(hdr, text="", bg=C.SURFACE0,
                                       fg=C.OVERLAY0, font=F.TINY)
        self._pool_hdr_lbl.pack(side="right")

        tk.Label(self._pool_frame,
                 text="   Product                                "
                      "Score    Released    $",
                 bg=C.SURFACE0, fg=C.OVERLAY0, font=F.MONO_SMALL,
                 anchor="w").pack(fill="x", padx=12, pady=(4, 0))

        lb = HoverListbox(self._pool_frame, bg=C.SURFACE0, fg=C.SUBTEXT1,
                          selectbackground=C.BLUE, selectforeground=C.CRUST,
                          font=F.MONO, activestyle="none", relief="flat",
                          bd=0, highlightthickness=0,
                          hover_bg=C.SURFACE1, item_bg=C.SURFACE0)
        lb.pack(fill="both", expand=True, padx=12, pady=(2, 12))
        self._pool_lb = lb

        lb.bind("<ButtonPress-1>", self._pool_drag_start)
        lb.bind("<B1-Motion>", self._drag_motion)
        lb.bind("<ButtonRelease-1>", self._drag_drop)
        lb.bind("<Double-Button-1>", self._pool_dblclick)

    def _refresh_pool(self):
        """Update pool data in-place (no widget destroy/rebuild)."""
        lb = self._pool_lb
        lb.delete(0, "end")

        search = self._search_var.get().strip().lower()
        cat_filter = self._cat_filter

        visible = []
        for p in self._all_products:
            if cat_filter != "all" and p["category"] != cat_filter:
                continue
            if search:
                haystack = f"{p['brand']} {p['model']}".lower()
                if search not in haystack:
                    continue
            visible.append(p)

        if self._sort_key == "score":
            visible.sort(key=lambda p: -p["overall"])
        elif self._sort_key == "release":
            visible.sort(key=lambda p: (
                -p["release_sort"][0], -p["release_sort"][1]))
        elif self._sort_key == "brand":
            visible.sort(key=lambda p: p["brand"].lower())
        elif self._sort_key == "model":
            visible.sort(key=lambda p: p["model"].lower())

        total_eligible = len(self._all_products)
        self._pool_hdr_lbl.configure(
            text=f"{total_eligible} eligible \u00b7 {len(visible)} shown")

        # Update accent bar color in case category changed
        self._pool_accent_bar.configure(bg=self._accent())

        self._pool_items = visible
        queue_set = set(self._queue)

        for i, p in enumerate(visible):
            in_queue = p["entry_id"] in queue_set
            score_str = f"{p['overall']:.1f}"
            name = f"{p['brand']} {p['model']}"
            if len(name) > 38:
                name = name[:35] + "..."
            date_str = p["release_date"] if p["release_date"] else "\u2014"
            deal = "$" if p["has_deal"] else " "
            display = (f"   {name:<38}    {score_str:>5}"
                       f"    {date_str:>7}    {deal}")
            lb.insert("end", display)
            if in_queue:
                lb.itemconfigure(i, fg=C.SURFACE2)
            elif p["has_deal"]:
                lb.itemconfigure(i, fg=C.GREEN)

        lb._items = visible

    # ── Queue ───────────────────────────────────────────────────────────────

    def _build_queue_ui(self):
        """One-time creation of queue header + controls + listbox."""
        accent = self._accent()
        self._queue_accent_bar = tk.Frame(self._queue_frame, bg=accent, height=3)
        self._queue_accent_bar.pack(fill="x")

        hdr = tk.Frame(self._queue_frame, bg=C.SURFACE0)
        hdr.pack(fill="x", padx=12, pady=(10, 2))
        tk.Label(hdr, text="Slideshow Queue", bg=C.SURFACE0, fg=C.TEXT,
                 font=F.BODY_BOLD).pack(side="left")

        ctrl = tk.Frame(self._queue_frame, bg=C.SURFACE0)
        ctrl.pack(fill="x", padx=12, pady=(4, 4))

        tk.Label(ctrl, text="Slots:", bg=C.SURFACE0, fg=C.OVERLAY0,
                 font=F.SMALL).pack(side="left", padx=(0, 4))
        self._max_var = tk.IntVar(value=self._max_slides)
        spin = tk.Spinbox(ctrl, from_=1, to=20, width=3,
                          textvariable=self._max_var,
                          bg=C.SURFACE1, fg=C.TEXT, font=F.BODY,
                          buttonbackground=C.SURFACE2,
                          insertbackground=C.TEXT,
                          relief="flat", bd=0,
                          highlightthickness=1, highlightcolor=C.BLUE,
                          highlightbackground=C.SURFACE2,
                          command=self._on_max_change)
        spin.pack(side="left", padx=(0, 12))
        spin.bind("<Return>", lambda e: self._on_max_change())

        autofill_btn = FlatBtn(ctrl, text="Auto-fill",
                               command=self._auto_fill,
                               bg=C.SURFACE1, hover_bg=C.SURFACE2,
                               font=F.SMALL)
        autofill_btn.pack(side="left", padx=(0, 4))
        Tip(autofill_btn,
            "Fill empty slots: deal links first, then by\n"
            "release date (newest). Score \u2265 8.0, max 3/cat")

        clear_btn = FlatBtn(ctrl, text="Clear All",
                            command=self._clear_all,
                            bg=C.SURFACE1, hover_bg=C.SURFACE2,
                            fg=C.RED, font=F.SMALL)
        clear_btn.pack(side="left", padx=(0, 4))

        self._queue_filled_lbl = tk.Label(ctrl, text="",
                                           bg=C.SURFACE0, fg=C.OVERLAY0,
                                           font=F.TINY)
        self._queue_filled_lbl.pack(side="right")

        tk.Label(self._queue_frame,
                 text="    #   Product                      "
                      "Score    Released    $",
                 bg=C.SURFACE0, fg=C.OVERLAY0, font=F.MONO_SMALL,
                 anchor="w").pack(fill="x", padx=12, pady=(4, 0))

        queue_container = tk.Frame(self._queue_frame, bg=C.SURFACE0)
        queue_container.pack(fill="both", expand=True, padx=12, pady=(2, 12))

        lb = HoverListbox(queue_container, bg=C.SURFACE0, fg=C.SUBTEXT1,
                          selectbackground=C.BLUE, selectforeground=C.CRUST,
                          font=F.MONO, activestyle="none", relief="flat",
                          bd=0, highlightthickness=0,
                          hover_bg=C.SURFACE1, item_bg=C.SURFACE0)
        lb.pack(side="left", fill="both", expand=True)
        self._queue_lb = lb

        lb.bind("<ButtonPress-1>", self._queue_drag_start)
        lb.bind("<B1-Motion>", self._drag_motion)
        lb.bind("<ButtonRelease-1>", self._drag_drop)
        lb.bind("<Delete>", self._queue_delete_key)
        lb.bind("<BackSpace>", self._queue_delete_key)
        lb.bind("<Up>", self._queue_move_up)
        lb.bind("<Down>", self._queue_move_down)

        self._queue_btn_col = tk.Frame(queue_container, bg=C.SURFACE0)
        self._queue_btn_col.pack(side="right", fill="y")

    def _refresh_queue(self):
        """Update queue data in-place (no widget destroy/rebuild)."""
        lb = self._queue_lb
        lb.delete(0, "end")

        # Update accent bar
        self._queue_accent_bar.configure(bg=self._accent())

        # Update filled label
        filled = len(self._queue)
        self._queue_filled_lbl.configure(
            text=f"{filled}/{self._max_slides} slots filled")

        self._queue_display_items = []

        for i in range(self._max_slides):
            pos = f"{i+1:>2}."
            if i < len(self._queue):
                eid = self._queue[i]
                p = self._product_map.get(eid)
                if p:
                    score_str = f"{p['overall']:.1f}"
                    name = f"{p['brand']} {p['model']}"
                    if len(name) > 24:
                        name = name[:21] + "..."
                    date_str = (p["release_date"]
                                if p["release_date"] else "\u2014")
                    deal = "$" if p["has_deal"] else " "
                    lb.insert("end",
                              f"  {pos}  {name:<24}    {score_str:>5}"
                              f"    {date_str:>7}    {deal}")
                    self._queue_display_items.append(eid)
                    if p["has_deal"]:
                        lb.itemconfigure(i, fg=C.GREEN)
                else:
                    lb.insert("end", f"  {pos}  (unknown: {eid})")
                    self._queue_display_items.append(eid)
            else:
                lb.insert("end", f"  {pos}  \u2014")
                lb.itemconfigure(i, fg=C.SURFACE2)
                self._queue_display_items.append(None)

        # Rebuild remove buttons
        for w in self._queue_btn_col.winfo_children():
            w.destroy()
        for i in range(self._max_slides):
            if i < len(self._queue):
                rm = FlatBtn(self._queue_btn_col, text="\u00d7",
                             command=lambda idx=i: self._remove_from_queue(idx),
                             bg=C.SURFACE0, hover_bg=C.SURFACE1, fg=C.RED,
                             font=("Segoe UI", 11), padx=4, pady=1)
                rm.pack(fill="x")
            else:
                tk.Label(self._queue_btn_col, text=" ", bg=C.SURFACE0,
                         font=("Segoe UI", 11), padx=4, pady=1).pack(fill="x")

        self._update_status()

    # ── Queue operations ────────────────────────────────────────────────────

    def _add_to_queue(self, entry_id: str):
        if entry_id in self._queue:
            self._app.toast.show("Already in queue", C.OVERLAY0, 2000)
            return
        if len(self._queue) >= self._max_slides:
            self._app.toast.show(
                f"Queue full ({self._max_slides} slots)", C.PEACH, 2000)
            return
        self._queue.append(entry_id)
        self._mark_changed()
        self._refresh_pool()
        self._refresh_queue()

    def _remove_from_queue(self, idx: int):
        if 0 <= idx < len(self._queue):
            self._queue.pop(idx)
            self._mark_changed()
            self._refresh_pool()
            self._refresh_queue()

    def _clear_all(self):
        if not self._queue:
            return
        self._queue.clear()
        self._mark_changed()
        self._refresh_pool()
        self._refresh_queue()
        self._app.toast.show("Queue cleared", C.OVERLAY0, 2000)

    def _on_max_change(self):
        try:
            new_max = self._max_var.get()
        except tk.TclError:
            return
        new_max = max(1, min(20, new_max))
        self._max_var.set(new_max)
        self._max_slides = new_max
        if len(self._queue) > self._max_slides:
            self._queue = self._queue[:self._max_slides]
        self._mark_changed()
        self._refresh_queue()

    def _auto_fill(self):
        try:
            new_queue, added = auto_fill_slots(
                self._all_products, self._queue, self._max_slides)
            if added > 0:
                self._queue = new_queue
                self._mark_changed()
                self._refresh_pool()
                self._refresh_queue()
                self._app.toast.show(
                    f"Auto-filled {added} slot{'s' if added != 1 else ''}",
                    C.GREEN, 2500)
            else:
                self._app.toast.show(
                    "No eligible products (score \u2265 8.0)",
                    C.OVERLAY0, 2000)
        except Exception as exc:
            self._app.toast.show(f"Auto-fill error: {exc}", C.RED, 5000)

    def _pool_dblclick(self, event):
        self._drag_cleanup()
        lb = event.widget
        idx = lb.nearest(event.y)
        if idx < 0 or idx >= lb.size() or lb.bbox(idx) is None:
            return
        if idx < len(self._pool_items):
            self._add_to_queue(self._pool_items[idx]["entry_id"])

    def _queue_delete_key(self, event):
        sel = self._queue_lb.curselection()
        if not sel:
            return
        idx = sel[0]
        if idx < len(self._queue):
            self._remove_from_queue(idx)

    def _queue_move_up(self, event):
        sel = self._queue_lb.curselection()
        if not sel:
            return "break"
        idx = sel[0]
        if idx > 0 and idx < len(self._queue):
            self._queue[idx], self._queue[idx-1] = (
                self._queue[idx-1], self._queue[idx])
            self._mark_changed()
            self._refresh_queue()
            self._queue_lb.selection_set(idx - 1)
            self._queue_lb.see(idx - 1)
        return "break"

    def _queue_move_down(self, event):
        sel = self._queue_lb.curselection()
        if not sel:
            return "break"
        idx = sel[0]
        if idx < len(self._queue) - 1:
            self._queue[idx], self._queue[idx+1] = (
                self._queue[idx+1], self._queue[idx])
            self._mark_changed()
            self._refresh_queue()
            self._queue_lb.selection_set(idx + 1)
            self._queue_lb.see(idx + 1)
        return "break"

    # ── Drag-and-drop ───────────────────────────────────────────────────────

    def _pool_drag_start(self, event):
        lb = event.widget
        idx = lb.nearest(event.y)
        if idx < 0 or idx >= lb.size() or lb.bbox(idx) is None:
            return
        if idx >= len(self._pool_items):
            return
        product = self._pool_items[idx]
        if product["entry_id"] in self._queue:
            return
        lb.selection_clear(0, "end")
        lb.selection_set(idx)
        self._drag_src = "pool"
        self._drag_entry_id = product["entry_id"]

    def _queue_drag_start(self, event):
        lb = event.widget
        idx = lb.nearest(event.y)
        if idx < 0 or idx >= lb.size() or lb.bbox(idx) is None:
            return
        if idx >= len(self._queue):
            return
        lb.selection_clear(0, "end")
        lb.selection_set(idx)
        self._drag_src = "queue"
        self._drag_entry_id = self._queue[idx]
        self._drag_queue_idx = idx

    def _drag_motion(self, event):
        if not self._drag_entry_id:
            return
        if not self._drag_ghost:
            HoverListbox._global_drag = True
            p = self._product_map.get(self._drag_entry_id)
            if not p:
                return
            cat_color = self._cat_colors().get(p["category"], self._accent())
            name = f"{p['brand']} {p['model']}"
            g = tk.Toplevel(self.winfo_toplevel())
            g.overrideredirect(True)
            g.attributes("-alpha", 0.9)
            g.configure(bg=cat_color)
            tk.Label(g, text=f"  {name}  ", bg=cat_color, fg=C.CRUST,
                     font=F.BODY_BOLD, padx=8, pady=4).pack()
            self._drag_ghost = g
        self._drag_ghost.geometry(
            f"+{event.x_root + 14}+{event.y_root - 10}")

        self._pool_lb.configure(bg=C.SURFACE0)
        self._queue_lb.configure(bg=C.SURFACE0)
        tgt = self._lb_at(event.x_root, event.y_root)
        if tgt:
            tgt.configure(bg=C.DROP)

    def _drag_drop(self, event):
        if not self._drag_entry_id:
            self._drag_cleanup()
            return

        tgt = self._lb_at(event.x_root, event.y_root)
        dropped = False

        if self._drag_src == "pool" and tgt == self._queue_lb:
            drop_idx = tgt.nearest(event.y) if tgt.size() > 0 else 0
            if drop_idx > len(self._queue):
                drop_idx = len(self._queue)
            if (self._drag_entry_id not in self._queue
                    and len(self._queue) < self._max_slides):
                self._queue.insert(drop_idx, self._drag_entry_id)
                dropped = True
            elif self._drag_entry_id in self._queue:
                self._app.toast.show("Already in queue", C.OVERLAY0, 2000)
            else:
                self._app.toast.show(
                    f"Queue full ({self._max_slides} slots)", C.PEACH, 2000)

        elif self._drag_src == "queue" and tgt == self._queue_lb:
            drop_idx = tgt.nearest(event.y)
            if drop_idx >= len(self._queue):
                drop_idx = len(self._queue) - 1
            src_idx = self._drag_queue_idx
            if (src_idx is not None and src_idx != drop_idx
                    and 0 <= drop_idx < len(self._queue)):
                item = self._queue.pop(src_idx)
                self._queue.insert(drop_idx, item)
                dropped = True

        elif self._drag_src == "queue" and tgt == self._pool_lb:
            src_idx = self._drag_queue_idx
            if src_idx is not None and 0 <= src_idx < len(self._queue):
                self._queue.pop(src_idx)
                dropped = True

        self._drag_cleanup()
        if dropped:
            self._mark_changed()
            self._refresh_pool()
            self._refresh_queue()

    def _lb_at(self, x, y):
        for lb in [self._pool_lb, self._queue_lb]:
            try:
                lx, ly = lb.winfo_rootx(), lb.winfo_rooty()
                if (lx <= x <= lx + lb.winfo_width()
                        and ly <= y <= ly + lb.winfo_height()):
                    return lb
            except tk.TclError:
                pass
        return None

    def _drag_cleanup(self):
        if self._drag_ghost:
            self._drag_ghost.destroy()
            self._drag_ghost = None
        self._drag_src = None
        self._drag_entry_id = None
        self._drag_queue_idx = None
        HoverListbox._global_drag = False
        try:
            self._pool_lb.configure(bg=C.SURFACE0)
            self._queue_lb.configure(bg=C.SURFACE0)
        except (tk.TclError, AttributeError):
            pass
