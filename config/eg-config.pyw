#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EG Config Manager — unified configuration tool.

Single mega-app replacing the standalone config managers.
Left-sidebar navigation with context bar and content area.
"""

import sys
import tkinter as tk
from tkinter import ttk
from pathlib import Path

# WHY: DPI must be set before any Tk window creation
from lib.shared import setup_dpi_awareness
setup_dpi_awareness()

from lib.shared import (C, F, FlatBtn, Toast, darken,
                         dark_title_bar, make_icon, center_window)
from lib.config_store import ConfigStore
from lib.config_watcher import ConfigWatcher
from lib.data_cache import DataCache

ROOT = Path(__file__).resolve().parent.parent

# Sidebar nav items: (key, label, icon_char)
_NAV_ITEMS = [
    ("Categories",     "Categories",      "\U0001f3f7"),  # 🏷 tag
    ("Content",        "Content",         "\U0001f4f0"),  # 📰 newspaper
    ("Index Heroes",   "Index Heroes",    "\U0001f3c6"),  # 🏆 trophy
    ("Hub Tools",      "Hub Tools",       "\U0001f527"),  # 🔧 wrench
    ("Navbar",         "Navbar",          "\U0001f9ed"),  # 🧭 compass
    ("Slideshow",      "Slideshow",       "\U0001f5bc"),  # 🖼 framed picture
    ("Image Defaults", "Image Defaults",  "\U0001f4f7"),  # 📷 camera
    ("Ads",            "Ads",             "\U0001f4b0"),  # 💰 money bag
    ("Cache / CDN",    "Cache / CDN",     "\U00002601"),  # cloud
]

SIDEBAR_W = 200


def _import_panel_class(name: str):
    """Lazy-import panel classes to avoid loading all modules at startup."""
    if name == "Categories":
        from panels.categories import CategoriesPanel
        return CategoriesPanel
    if name == "Content":
        from panels.content import ContentPanel
        return ContentPanel
    if name == "Index Heroes":
        from panels.index_heroes import IndexHeroesPanel
        return IndexHeroesPanel
    if name == "Hub Tools":
        from panels.hub_tools import HubToolsPanel
        return HubToolsPanel
    if name == "Navbar":
        from panels.navbar import NavbarPanel
        return NavbarPanel
    if name == "Slideshow":
        from panels.slideshow import SlideshowPanel
        return SlideshowPanel
    if name == "Image Defaults":
        from panels.image_defaults import ImageDefaultsPanel
        return ImageDefaultsPanel
    if name == "Ads":
        from panels.ads import AdsPanel
        return AdsPanel
    if name == "Cache / CDN":
        from panels.cache_cdn import CacheCdnPanel
        return CacheCdnPanel
    raise ValueError(f"Unknown panel: {name}")


class MegaConfig(tk.Tk):

    def __init__(self):
        super().__init__()

        self.store = ConfigStore(ROOT)
        self.cache = DataCache(ROOT)
        accent = self.store.site_accent

        # Window
        self.title("EG Config Manager")
        center_window(self, 1536, 864)
        self.minsize(1100, 700)
        self.configure(bg=C.MANTLE)

        try:
            self._icon = make_icon(accent)
            self.iconphoto(True, self._icon)
        except Exception:
            pass

        dark_title_bar(self)

        # Global ttk styles
        self._setup_styles()

        # Status bar (32px) — pack first so it stays at bottom
        self._build_status_bar()

        # Main horizontal split: sidebar | right area
        self._body = tk.Frame(self, bg=C.MANTLE)
        self._body.pack(fill="both", expand=True)

        # ── Sidebar ────────────────────────────────────────────────────
        self._sidebar = tk.Frame(self._body, bg=C.CRUST, width=SIDEBAR_W)
        self._sidebar.pack(side="left", fill="y")
        self._sidebar.pack_propagate(False)

        self._build_sidebar(accent)

        # Accent stripe between sidebar and content
        tk.Frame(self._body, bg=accent, width=2).pack(side="left", fill="y")
        self._sidebar_stripe = self._body.winfo_children()[-1]

        # ── Right area ─────────────────────────────────────────────────
        right = tk.Frame(self._body, bg=C.MANTLE)
        right.pack(side="left", fill="both", expand=True)

        # Context bar (top of right area)
        self._build_context_bar(accent, right)

        # Content container (holds all panels, only one visible at a time)
        self._content = tk.Frame(right, bg=C.MANTLE)
        self._content.pack(fill="both", expand=True)

        # ── Panels (lazy-initialized) ─────────────────────────────────
        self._tab_order = [item[0] for item in _NAV_ITEMS]
        self._panels: dict[str, object] = {}
        self._active_panel: str = ""
        # WHY: Track panels needing category refresh when next shown
        self._cat_stale: set[str] = set()

        # Toast
        self.toast = Toast(self)

        # File watcher
        self.watcher = ConfigWatcher(self, self.store)

        # Only create the first panel eagerly — others on demand
        self._panels["Categories"] = _import_panel_class("Categories")(
            self._content, self)

        # Show first panel
        self._show_panel("Categories")

        # Bindings
        self.bind_all("<Control-s>", self._on_save)
        self.protocol("WM_DELETE_WINDOW", self._on_close)

        # Keyboard nav: Ctrl+1..7 to switch panels
        for i in range(len(self._tab_order)):
            self.bind_all(f"<Control-Key-{i+1}>",
                          lambda e, idx=i: self._show_panel(self._tab_order[idx]))

        # Subscribe to category changes for accent refresh
        self.store.subscribe(ConfigStore.CATEGORIES,
                             self._on_categories_changed)

    # ── Category Change Dispatch (lazy) ───────────────────────────────

    def _on_categories_changed(self):
        """Central handler for CATEGORIES changes. Refreshes only what's visible."""
        # Always refresh mega-app chrome (sidebar, context bar, icon)
        self._refresh_accent()

        # Mark all created non-active panels as stale
        for name, panel in self._panels.items():
            if name == self._active_panel or name == "Categories":
                continue
            self._cat_stale.add(name)

        # Refresh active panel immediately (if it has the handler and isn't Categories)
        active = self._panels.get(self._active_panel)
        if (active and self._active_panel != "Categories"
                and hasattr(active, "_on_categories_change")):
            active._on_categories_change()

    # ── Sidebar ────────────────────────────────────────────────────────

    def _build_sidebar(self, accent: str):
        # Logo area
        logo = tk.Frame(self._sidebar, bg=C.CRUST, height=56)
        logo.pack(fill="x")
        logo.pack_propagate(False)
        logo_inner = tk.Frame(logo, bg=C.CRUST)
        logo_inner.pack(fill="both", expand=True, padx=20)
        self._eg_lbl = tk.Label(logo_inner, text="EG",
                                font=("Segoe UI", 18, "bold"),
                                fg=accent, bg=C.CRUST)
        self._eg_lbl.pack(side="left")
        tk.Label(logo_inner, text="  Config",
                 font=("Segoe UI", 12), fg=C.TEXT, bg=C.CRUST).pack(side="left")

        # Separator
        tk.Frame(self._sidebar, bg=C.SURFACE1, height=1).pack(fill="x")

        # Nav items
        self._nav_items: dict[str, dict] = {}
        nav_area = tk.Frame(self._sidebar, bg=C.CRUST)
        nav_area.pack(fill="both", expand=True, pady=(8, 0))

        for key, label, icon in _NAV_ITEMS:
            self._build_nav_item(nav_area, key, label, icon)

        # Bottom info
        tk.Frame(self._sidebar, bg=C.SURFACE1, height=1).pack(fill="x")
        bottom = tk.Frame(self._sidebar, bg=C.CRUST, height=36)
        bottom.pack(fill="x")
        bottom.pack_propagate(False)
        tk.Label(bottom, text=f"  {ROOT.name}",
                 font=F.TINY, fg=C.OVERLAY0, bg=C.CRUST).pack(
                     side="left", padx=12, fill="y", expand=False)

    def _build_nav_item(self, parent, key: str, label: str, icon: str):
        row = tk.Frame(parent, bg=C.CRUST, height=42, cursor="hand2")
        row.pack(fill="x", padx=6, pady=1)
        row.pack_propagate(False)

        # Accent indicator (left edge, hidden by default)
        indicator = tk.Frame(row, bg=C.CRUST, width=3)
        indicator.pack(side="left", fill="y")

        # Icon
        icon_lbl = tk.Label(row, text=icon, font=("Segoe UI", 13),
                            fg=C.OVERLAY0, bg=C.CRUST, width=2)
        icon_lbl.pack(side="left", padx=(10, 6))

        # Label
        text_lbl = tk.Label(row, text=label, font=F.BODY,
                             fg=C.SUBTEXT0, bg=C.CRUST, anchor="w")
        text_lbl.pack(side="left", fill="x", expand=True)

        self._nav_items[key] = {
            "row": row, "indicator": indicator,
            "icon": icon_lbl, "text": text_lbl,
        }

        # Click binding on all sub-widgets
        for w in (row, indicator, icon_lbl, text_lbl):
            w.bind("<Button-1>", lambda e, k=key: self._show_panel(k))
            w.bind("<Enter>", lambda e, k=key: self._nav_hover(k, True))
            w.bind("<Leave>", lambda e, k=key: self._nav_hover(k, False))

    def _nav_hover(self, key: str, entering: bool):
        if key == self._active_panel:
            return
        item = self._nav_items[key]
        bg = C.SURFACE1 if entering else C.CRUST
        for w in (item["row"], item["indicator"], item["icon"], item["text"]):
            w.configure(bg=bg)

    def _sync_sidebar(self):
        accent = self.store.site_accent
        for key, item in self._nav_items.items():
            is_active = key == self._active_panel
            bg = C.SURFACE0 if is_active else C.CRUST
            fg_icon = accent if is_active else C.OVERLAY0
            fg_text = C.TEXT if is_active else C.SUBTEXT0
            ind_bg = accent if is_active else C.CRUST
            item["row"].configure(bg=bg)
            item["indicator"].configure(bg=ind_bg)
            item["icon"].configure(bg=bg, fg=fg_icon)
            item["text"].configure(bg=bg, fg=fg_text)

    # ── Context Bar ────────────────────────────────────────────────────

    def _build_context_bar(self, accent: str, parent: tk.Frame):
        bar = tk.Frame(parent, bg=C.CRUST, height=48)
        bar.pack(fill="x")
        bar.pack_propagate(False)

        inner = tk.Frame(bar, bg=C.CRUST)
        inner.pack(fill="both", expand=True, padx=20)

        # Breadcrumb
        self._breadcrumb = tk.Label(inner, text="Categories",
                                     font=F.HEADING, fg=C.TEXT, bg=C.CRUST)
        self._breadcrumb.pack(side="left")

        # Save button
        hover = darken(accent)
        self._save_btn = FlatBtn(inner, text="  Save  ", font=F.BODY_BOLD,
                                  bg=accent, fg=C.CRUST,
                                  hover_bg=hover,
                                  command=lambda: self._on_save())
        self._save_btn.pack(side="right", pady=6)

        # Changes badge
        self._changes_lbl = tk.Label(inner, text="", font=F.SMALL,
                                      fg=C.PEACH, bg=C.CRUST)
        self._changes_lbl.pack(side="right", padx=8)

        # Bottom accent line
        self._ctx_border = tk.Frame(bar, bg=accent, height=2)
        self._ctx_border.pack(fill="x", side="bottom")

    # ── Panel Switching ────────────────────────────────────────────────

    def _show_panel(self, name: str):
        if name == self._active_panel:
            return
        # Hide current
        if self._active_panel and self._active_panel in self._panels:
            self._panels[self._active_panel].pack_forget()

        # Lazy-create panel if not yet initialized
        if name not in self._panels:
            self._panels[name] = _import_panel_class(name)(
                self._content, self)

        # Show new
        self._active_panel = name
        self._panels[name].pack(fill="both", expand=True)
        self._sync_sidebar()

        # Update context bar
        self._breadcrumb.configure(text=name)

        # Flush stale category state if needed
        if name in self._cat_stale:
            self._cat_stale.discard(name)
            panel = self._panels[name]
            if hasattr(panel, "_on_categories_change"):
                panel._on_categories_change()

        # Update badge and status
        self.update_changes_badge()

        # Trigger panel's tab-change handler if it has one
        if hasattr(self._panels[name], "_on_tab_change"):
            self._panels[name]._on_tab_change()

    # ── Status Bar ─────────────────────────────────────────────────────

    def _build_status_bar(self):
        bar = tk.Frame(self, bg=C.CRUST, height=32)
        bar.pack(fill="x", side="bottom")
        bar.pack_propagate(False)

        self._status_lbl = tk.Label(bar, text="  Ready  \u00b7  Ctrl+S to save",
                                     font=F.SMALL, fg=C.OVERLAY0, bg=C.CRUST)
        self._status_lbl.pack(side="left")

        self._status_right = tk.Label(bar, text="",
                                       font=F.SMALL, fg=C.OVERLAY0,
                                       bg=C.CRUST)
        self._status_right.pack(side="right", padx=16)

    # ── Styles ─────────────────────────────────────────────────────────

    def _setup_styles(self):
        s = ttk.Style()
        s.theme_use("default")

        # Inner-panel notebooks (Content, Hub Tools, Navbar, Ads)
        s.configure("TNotebook", background=C.MANTLE, borderwidth=0)
        s.configure("TNotebook.Tab",
                     background=C.SURFACE1, foreground=C.SUBTEXT0,
                     padding=[16, 6], font=F.BODY_BOLD,
                     focuscolor=C.SURFACE1)
        s.map("TNotebook.Tab",
              background=[("selected", C.SURFACE0), ("active", C.SURFACE2)],
              foreground=[("selected", C.TEXT), ("active", C.SUBTEXT1)])

        # ttk.Frame background (fixes white leaks in navbar etc.)
        s.configure("TFrame", background=C.MANTLE)

        # Global Treeview style (used by Ads scanner, etc.)
        s.configure("Treeview",
                     background=C.SURFACE0, foreground=C.TEXT,
                     fieldbackground=C.SURFACE0, borderwidth=0,
                     font=F.SMALL, rowheight=28)
        s.configure("Treeview.Heading",
                     background=C.SURFACE1, foreground=C.SUBTEXT1,
                     borderwidth=0, font=F.BODY_BOLD, padding=[8, 6])
        s.map("Treeview",
              background=[("selected", C.SURFACE2)],
              foreground=[("selected", C.TEXT)])
        s.map("Treeview.Heading",
              background=[("active", C.SURFACE2)])

        # Scrollbar — dark themed
        s.configure("Vertical.TScrollbar",
                     background=C.SURFACE1, troughcolor=C.BASE,
                     borderwidth=0, arrowsize=12)
        s.configure("Horizontal.TScrollbar",
                     background=C.SURFACE1, troughcolor=C.BASE,
                     borderwidth=0, arrowsize=12)

    # ── Accent Refresh ─────────────────────────────────────────────────

    def _refresh_accent(self):
        accent = self.store.site_accent
        self._eg_lbl.configure(fg=accent)
        self._ctx_border.configure(bg=accent)
        self._sidebar_stripe.configure(bg=accent)
        self._save_btn.configure(bg=accent)
        self._save_btn._bg = accent
        self._save_btn._hover = darken(accent)
        self._sync_sidebar()
        try:
            self._icon = make_icon(accent)
            self.iconphoto(True, self._icon)
        except Exception:
            pass

    # ── Save / Close ───────────────────────────────────────────────────

    def _on_save(self, event=None):
        """Save ALL panels that have unsaved changes (global save)."""
        dirty = [(name, p) for name, p in self._panels.items()
                 if hasattr(p, "has_changes") and p.has_changes()
                 and hasattr(p, "save")]
        if not dirty:
            self.toast.show("No changes to save", C.OVERLAY0)
            return

        self.watcher.pause()
        saved_names = []
        for name, panel in dirty:
            try:
                if panel.save():
                    saved_names.append(name)
            except Exception as e:
                self.toast.show(f"Error saving {name}: {e}", C.RED)
        self.watcher.snapshot()
        self.watcher.resume()

        if saved_names:
            from datetime import datetime
            now = datetime.now().strftime("%H:%M:%S")
            label = ", ".join(saved_names)
            self.toast.show(f"Saved {label} at {now}", C.GREEN)
            self.set_status(f"Last saved at {now}  \u00b7  Ctrl+S to save")
        self.update_changes_badge()

    def _get_active_panel(self):
        """Return the panel object for the currently selected panel, or None."""
        return self._panels.get(self._active_panel)

    def update_changes_badge(self):
        """Update the context bar 'unsaved changes' badge across ALL panels."""
        dirty_names = [name for name, p in self._panels.items()
                       if hasattr(p, "has_changes") and p.has_changes()]
        if dirty_names:
            if len(dirty_names) == 1:
                text = f"unsaved: {dirty_names[0]}"
            else:
                text = f"unsaved: {len(dirty_names)} panels"
            self._changes_lbl.configure(text=text, fg=C.PEACH)
        else:
            self._changes_lbl.configure(text="")

    def _on_close(self):
        has_unsaved = any(
            hasattr(p, "has_changes") and p.has_changes()
            for p in self._panels.values()
        )
        if has_unsaved:
            from tkinter import messagebox
            if not messagebox.askyesno(
                    "Unsaved Changes",
                    "You have unsaved changes.\n\nExit without saving?",
                    parent=self):
                return
        self.destroy()

    def set_status(self, text: str):
        self._status_lbl.configure(text=f"  {text}")

    def set_status_right(self, text: str):
        self._status_right.configure(text=text)


if __name__ == "__main__":
    app = MegaConfig()
    app.mainloop()
