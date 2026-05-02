"""
panels/navbar.py — Navbar content management panel for EG Config Manager.

Manages navbar visibility for guides (section assignment), brands (category
assignment), and games (toggle on/off). Reads/writes YAML frontmatter in
.md files under src/content/. Section ordering saved to navbar-guide-sections.json.
"""

import json
import re
import tkinter as tk
from tkinter import ttk, messagebox
from pathlib import Path

from lib.shared import (C, F, FlatBtn, Toast, Toggle, HoverListbox,
                         darken, make_dialog)
from lib.config_store import ConfigStore


# ── Pure functions (no tkinter) ─────────────────────────────────────────────


def entry_slug(filepath: Path, content_dir: Path) -> str:
    """Derive entry slug from a content file path.

    Handles both layouts:
      slug-folder: games/apex-legends/index.md  -> apex-legends
      flat (legacy): games/apex-legends.md      -> apex-legends
      nested:  guides/mouse/my-guide/index.md   -> mouse/my-guide
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


def read_frontmatter(filepath: Path) -> tuple[dict, str]:
    """Parse YAML frontmatter from a file. Returns (frontmatter_dict, full_text)."""
    import yaml
    text = filepath.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    fm = yaml.safe_load(parts[1]) or {}
    return fm, text


def write_list_field(filepath: Path, key: str, value):
    """Targeted write: update/insert a YAML list field in frontmatter."""
    text = filepath.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    if len(parts) < 3:
        return
    lines = parts[1].split("\n")
    pat = re.compile(rf"^{re.escape(key)}:")
    new_lines, skip = [], False
    for line in lines:
        if pat.match(line):
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
        nb = [f"{key}: {'true' if value else 'false'}"]
    elif isinstance(value, list):
        nb = [f"{key}: []"] if not value else [f"{key}:"] + [f"  - {v}" for v in value]
    else:
        nb = [f"{key}: {value}"]
    idx = len(new_lines)
    for i, line in enumerate(new_lines):
        if re.match(r"^(category|guide|game|brand|categories):", line):
            idx = i + 1
            break
    if idx == len(new_lines):
        for i, line in enumerate(new_lines):
            if line.strip() and not line.strip().startswith("#"):
                idx = i + 1
                break
    for j, nl in enumerate(nb):
        new_lines.insert(idx + j, nl)
    filepath.write_text(
        f"{parts[0]}---{chr(10).join(new_lines)}---{parts[2]}", encoding="utf-8")


def write_navbar_field(filepath: Path, value):
    """Targeted write: only update/insert the navbar: field in frontmatter."""
    write_list_field(filepath, "navbar", value)


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
    filepath.write_text(
        f"{parts[0]}---{chr(10).join(lines)}---{parts[2]}", encoding="utf-8")


def load_guides(content_dir: Path) -> list[dict]:
    """Scan guides directory, return list of guide dicts."""
    guides = []
    if not content_dir.is_dir():
        return guides
    for f in list_content_files(content_dir):
        fm, _ = read_frontmatter(f)
        slug = entry_slug(f, content_dir)
        guides.append({
            "path": f, "filename": slug,
            "category": fm.get("category", ""),
            "guide": fm.get("guide", fm.get("title", slug)),
            "title": fm.get("title", slug),
            "navbar": fm.get("navbar", []),
        })
    return guides


def load_brands(content_dir: Path) -> list[dict]:
    """Scan brands directory, return list of brand dicts."""
    brands = []
    if not content_dir.is_dir():
        return brands
    for f in list_content_files(content_dir):
        fm, _ = read_frontmatter(f)
        slug = entry_slug(f, content_dir)
        brands.append({
            "path": f, "filename": slug,
            "brand": fm.get("brand", slug),
            "displayName": fm.get("displayName", fm.get("brand", slug)),
            "categories": fm.get("categories", []),
            "navbar": fm.get("navbar", []),
        })
    return brands


def load_games(content_dir: Path) -> list[dict]:
    """Scan games directory, return list of game dicts."""
    games = []
    if not content_dir.is_dir():
        return games
    for f in list_content_files(content_dir):
        fm, _ = read_frontmatter(f)
        slug = entry_slug(f, content_dir)
        games.append({
            "path": f, "filename": slug,
            "game": fm.get("game", fm.get("title", slug)),
            "title": fm.get("title", slug),
            "navbar": fm.get("navbar", False),
        })
    return games


# ── Panel class ─────────────────────────────────────────────────────────────


class NavbarPanel(tk.Frame):
    """Navbar content management panel — manages guide sections, brand
    categories, and game toggles in the mega-app navbar tab."""

    def __init__(self, parent: tk.Widget, app):
        super().__init__(parent, bg=C.MANTLE)
        self._app = app
        self._project_root = app.store._root
        self._content = self._project_root / "src" / "content"

        # Load data from shared cache
        self._guides_data = app.cache.get_guides()
        self._brands_data = app.cache.get_brands()
        self._games_data = app.cache.get_games()
        self._section_order = dict(app.store.get(ConfigStore.NAV_SECTIONS) or {})
        self._original_sections = json.dumps(self._section_order, sort_keys=True)

        self._guide_categories = sorted(set(
            g["category"] for g in self._guides_data if g["category"]
        ))

        # Pending changes
        self._pending_changes: dict[str, dict] = {}
        self._pending_field_changes: dict[str, dict[str, str]] = {}

        # Drag state
        self._drag_src = None
        self._drag_idx = None
        self._drag_item = None
        self._drag_ghost = None
        self._drag_tab = ""
        self._guide_lbs: list[tk.Listbox] = []
        self._brand_lbs: list[tk.Listbox] = []

        # Guide section buckets
        self._guide_sections: dict[str, list[dict]] = {}
        self._init_guide_sections()

        # Build UI
        self._setup_styles()
        self._notebook = ttk.Notebook(self, style="Navbar.TNotebook")
        self._notebook.pack(fill="both", expand=True)

        self._build_guides_tab()
        self._build_brands_tab()
        self._build_games_tab()
        self._build_hubs_tab()

        self._notebook.bind("<<NotebookTabChanged>>", self._on_tab_change)

        # Subscribe to changes
        app.store.subscribe(ConfigStore.NAV_SECTIONS, self._on_external_change)
        # WHY: CATEGORIES subscription removed — mega-app dispatches centrally
        # to avoid refreshing hidden panels

        self._update_status_counts()

    # ── Public interface ────────────────────────────────────────────────────

    def save(self) -> bool:
        section_changed = (json.dumps(self._section_order, sort_keys=True)
                           != self._original_sections)
        counts = {"guides": 0, "brands": 0, "games": 0}
        for p in self._pending_changes:
            try:
                rel = Path(p).relative_to(self._content)
                col = rel.parts[0]
                if col in counts:
                    counts[col] += 1
            except ValueError:
                pass

        field_count = len(self._pending_field_changes)
        total = sum(counts.values()) + field_count + (1 if section_changed else 0)
        if total == 0:
            self._app.toast.show("No changes to save", C.OVERLAY0)
            return False

        self._app.watcher.pause()
        errors = []

        for p, c in self._pending_changes.items():
            try:
                if "categories" in c:
                    write_list_field(Path(p), "categories", c["categories"])
                write_list_field(Path(p), "navbar", c["navbar"])
            except Exception as e:
                errors.append(f"{Path(p).name}: {e}")

        for p, fields in self._pending_field_changes.items():
            try:
                for key, value in fields.items():
                    write_field(Path(p), key, value)
            except Exception as e:
                errors.append(f"{Path(p).name}: {e}")

        if section_changed:
            try:
                self._app.store.save(ConfigStore.NAV_SECTIONS, self._section_order)
            except Exception as e:
                errors.append(f"sections: {e}")

        had_field_changes = bool(self._pending_field_changes)
        self._pending_changes.clear()
        self._pending_field_changes.clear()
        self._app.store.brand_categories.clear()
        self._original_sections = json.dumps(self._section_order, sort_keys=True)
        self._app.watcher.snapshot()
        self._app.watcher.resume()
        self._app.update_changes_badge()
        # Invalidate data cache so other panels pick up renames
        if had_field_changes:
            self._app.cache.invalidate()

        if errors:
            self._app.toast.show(f"Saved with {len(errors)} error(s)", C.PEACH)
        else:
            from datetime import datetime
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
            self._app.toast.show(
                f"Saved {total} files ({', '.join(parts)}) at {now}", C.GREEN)
            self._app.set_status(f"Last saved at {now}  \u00b7  Ctrl+S to save")
        return True

    def has_changes(self) -> bool:
        if self._pending_changes or self._pending_field_changes:
            return True
        return (json.dumps(self._section_order, sort_keys=True)
                != self._original_sections)

    def refresh(self):
        self._guides_data = load_guides(self._content / "guides")
        self._brands_data = load_brands(self._content / "brands")
        self._games_data = load_games(self._content / "games")
        self._section_order = dict(self._app.store.get(ConfigStore.NAV_SECTIONS) or {})
        self._original_sections = json.dumps(self._section_order, sort_keys=True)
        self._guide_categories = sorted(set(
            g["category"] for g in self._guides_data if g["category"]
        ))
        self._pending_changes.clear()
        self._pending_field_changes.clear()
        self._app.store.brand_categories.clear()
        self._guide_sections.clear()
        self._init_guide_sections()
        self._refresh_guides()
        self._refresh_brands()
        self._refresh_games()
        self._refresh_hubs()
        self._update_status_counts()
        self._app.update_changes_badge()

    # ── Internal ────────────────────────────────────────────────────────────

    def _on_external_change(self):
        self.refresh()

    def _on_categories_change(self):
        self._refresh_hubs()
        self._refresh_brands()
        self._update_status_counts()

    def _setup_styles(self):
        s = ttk.Style()
        s.configure("Navbar.TNotebook", background=C.MANTLE, borderwidth=0,
                     tabmargins=[4, 8, 4, 0])
        s.configure("Navbar.TNotebook.Tab",
                     background=C.SURFACE1, foreground=C.OVERLAY0,
                     padding=[28, 12], borderwidth=0, font=F.BODY_BOLD,
                     focuscolor=C.SURFACE1)
        s.map("Navbar.TNotebook.Tab",
              background=[("selected", C.SURFACE0), ("active", C.SURFACE2)],
              foreground=[("selected", C.TEXT), ("active", C.SUBTEXT1)])

    def _update_status_counts(self):
        self._app.set_status_right(
            f"{len(self._guides_data)} guides  \u00b7  "
            f"{len(self._brands_data)} brands  \u00b7  "
            f"{len(self._games_data)} games")

    def _on_tab_change(self, e=None):
        hints = [
            "Drag between columns to reassign  \u00b7  < > reorder sections  \u00b7  "
            "Del key unassigns  \u00b7  Double-click to rename",
            "Drag from pool to add  \u00b7  Drag to pool or Del key to remove  \u00b7  "
            "Double-click to rename",
            "Toggle games on/off  \u00b7  Toggle All for bulk changes  \u00b7  "
            "Double-click to rename",
            "Display only  \u00b7  Use Categories tab to change activation flags",
        ]
        try:
            tab = self._notebook.index("current")
            if 0 <= tab < len(hints):
                self._app.set_status(f"{hints[tab]}  \u00b7  Ctrl+S to save")
        except Exception:
            pass

    def _update_badge(self):
        self._app.update_changes_badge()

    def _accent(self):
        return self._app.store.site_accent

    def _accent_hover(self):
        return darken(self._accent())

    def _cat_colors(self):
        return self._app.store.cat_colors

    def _cat_ids(self):
        return self._app.store.cat_ids

    def _categories(self):
        return self._app.store.categories

    # ── Shared drag-and-drop ────────────────────────────────────────────────

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

    def _drag_motion(self, event):
        if not self._drag_item:
            return
        if not self._drag_ghost:
            HoverListbox._global_drag = True
            name = self._drag_item.get("guide",
                   self._drag_item.get("displayName",
                   self._drag_item.get("brand",
                   self._drag_item.get("title", ""))))
            accent = self._accent()
            g = tk.Toplevel(self.winfo_toplevel())
            g.overrideredirect(True)
            g.attributes("-alpha", 0.9)
            g.configure(bg=accent)
            tk.Label(g, text=f"  {name}  ", bg=accent, fg=C.CRUST,
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

    # ── Rename dialog ───────────────────────────────────────────────────────

    def _rename_item_dialog(self, title, current, callback):
        dlg = make_dialog(self.winfo_toplevel(), title, 380, 160)
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
                bg=self._accent(), fg=C.CRUST,
                hover_bg=self._accent_hover()).pack(side="right")

    def _styled_entry(self, parent, width=30):
        return tk.Entry(parent, bg=C.SURFACE1, fg=C.TEXT, insertbackground=C.TEXT,
                        font=F.BODY, relief="flat", bd=0, highlightthickness=1,
                        highlightcolor=C.BLUE, highlightbackground=C.SURFACE2,
                        width=width)

    # ========================================================================
    # GUIDES TAB
    # ========================================================================

    def _init_guide_sections(self):
        for cat in self._guide_categories:
            buckets: dict[str, list] = {"Unassigned": []}
            for g in self._guides_data:
                if g["category"] != cat:
                    continue
                nb = g["navbar"]
                if isinstance(nb, list) and nb:
                    sec = nb[0]
                    buckets.setdefault(sec, []).append(g)
                else:
                    buckets["Unassigned"].append(g)
            saved = self._section_order.get(cat, [])
            ordered, seen = [], set()
            for name in saved:
                if name != "Unassigned":
                    ordered.append({"name": name, "items": buckets.get(name, [])})
                    seen.add(name)
            for name in sorted(buckets):
                if name not in seen and name != "Unassigned":
                    ordered.append({"name": name, "items": buckets[name]})
            ordered.append({"name": "Unassigned",
                            "items": buckets.get("Unassigned", [])})
            self._guide_sections[cat] = ordered

    def _find_sec(self, cat, name):
        for s in self._guide_sections.get(cat, []):
            if s["name"] == name:
                return s
        return None

    def _build_guides_tab(self):
        frame = tk.Frame(self._notebook, bg=C.MANTLE)
        self._notebook.add(frame, text="  Guides  ")
        top = tk.Frame(frame, bg=C.MANTLE)
        top.pack(fill="x", padx=16, pady=(16, 8))

        pill_row = tk.Frame(top, bg=C.MANTLE)
        pill_row.pack(side="left")
        tk.Label(pill_row, text="Category", bg=C.MANTLE, fg=C.OVERLAY0,
                 font=F.SMALL).pack(side="left", padx=(0, 12))
        default = self._guide_categories[0] if self._guide_categories else "mouse"
        self._guide_cat_var = tk.StringVar(value=default)
        self._cat_pills: list[tk.Frame] = []
        for cat in self._guide_categories:
            self._make_pill(pill_row, cat, self._guide_cat_var, self._on_cat_click)

        acts = tk.Frame(top, bg=C.MANTLE)
        acts.pack(side="right")
        FlatBtn(acts, text="+ Add Section",
                command=self._add_section).pack(side="left", padx=3)
        FlatBtn(acts, text="Rename",
                command=self._rename_section).pack(side="left", padx=3)
        FlatBtn(acts, text="Delete", command=self._delete_section,
                fg=C.RED, hover_bg=C.SURFACE2).pack(side="left", padx=3)

        self._guides_area = tk.Frame(frame, bg=C.MANTLE)
        self._guides_area.pack(fill="both", expand=True, padx=16, pady=(0, 16))
        self._refresh_guides()

    def _make_pill(self, parent, cat, var, cmd):
        color = self._cat_colors().get(cat, self._accent())
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
        active = self._guide_cat_var.get()
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

    def _refresh_guides(self):
        for w in self._guides_area.winfo_children():
            w.destroy()
        cat = self._guide_cat_var.get()
        sections = self._guide_sections.get(cat, [])
        self._guide_lbs = []
        accent = self._cat_colors().get(cat, self._accent())

        named = [s for s in sections if s["name"] != "Unassigned"]
        ua = next((s for s in sections if s["name"] == "Unassigned"),
                  {"name": "Unassigned", "items": []})

        split = tk.Frame(self._guides_area, bg=C.MANTLE)
        split.pack(fill="both", expand=True)

        left = tk.Frame(split, bg=C.MANTLE)
        left.pack(side="left", fill="both", expand=True)
        canvas = tk.Canvas(left, bg=C.MANTLE, highlightthickness=0)
        xsb = ttk.Scrollbar(left, orient="horizontal", command=canvas.xview)
        inner = tk.Frame(canvas, bg=C.MANTLE)
        inner.bind("<Configure>",
                    lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=inner, anchor="nw")
        canvas.configure(xscrollcommand=xsb.set)
        canvas.pack(fill="both", expand=True)
        xsb.pack(fill="x")

        for ci, section in enumerate(named):
            name = section["name"]
            items = sorted(section["items"],
                           key=lambda x: x.get("guide", x.get("title", "")))
            section["items"] = items
            self._guide_col(inner, name, accent, items, cat, ci, len(named))

        sep = tk.Frame(split, bg=C.SURFACE2, width=2)
        sep.pack(side="left", fill="y", padx=20, pady=8)

        ua_items = sorted(ua["items"],
                          key=lambda x: x.get("guide", x.get("title", "")))
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
            FlatBtn(hdr, text=" < ",
                    command=lambda i=ci: self._move_sec(i, -1),
                    bg=C.SURFACE0, hover_bg=C.SURFACE1, font=F.TINY,
                    padx=4, pady=2).pack(side="left")
        tk.Label(hdr, text=name, bg=C.SURFACE0,
                 fg=C.OVERLAY0 if is_ua else C.TEXT,
                 font=F.BODY_BOLD).pack(side="left", padx=4)
        badge_bg = C.OVERLAY0 if is_ua else color
        tk.Label(hdr, text=str(len(items)), bg=badge_bg, fg=C.CRUST,
                 font=F.TINY, padx=6, pady=2).pack(side="left", padx=4)
        if not is_ua:
            FlatBtn(hdr, text=" > ",
                    command=lambda i=ci: self._move_sec(i, +1),
                    bg=C.SURFACE0, hover_bg=C.SURFACE1, font=F.TINY,
                    padx=4, pady=2).pack(side="left")
        lb = HoverListbox(col, bg=C.SURFACE0, fg=C.SUBTEXT1,
                          selectbackground=C.BLUE, selectforeground=C.CRUST,
                          font=F.BODY, width=28, height=18,
                          activestyle="none", relief="flat", bd=0,
                          highlightthickness=0,
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
        lb.bind("<Double-Button-1>",
                lambda e, l=lb: self._on_guide_dblclick(e, l))
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
                self._pending_changes[str(g["path"])] = {
                    "navbar": g["navbar"], "type": "list"}
                self._update_badge()
                dropped = True
        self._drag_cleanup()
        if dropped:
            self._refresh_guides()

    def _move_sec(self, ci, direction):
        cat = self._guide_cat_var.get()
        secs = self._guide_sections[cat]
        named = sum(1 for s in secs if s["name"] != "Unassigned")
        ni = ci + direction
        if ni < 0 or ni >= named:
            return
        secs[ci], secs[ni] = secs[ni], secs[ci]
        self._section_order[cat] = [
            s["name"] for s in secs if s["name"] != "Unassigned"]
        self._update_badge()
        self._refresh_guides()

    # -- Guide section dialogs -----------------------------------------------

    def _add_section(self):
        cat = self._guide_cat_var.get()
        dlg = make_dialog(self.winfo_toplevel(), "Add Section", 380, 160)
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
                messagebox.showwarning("Exists", f"'{name}' already exists.",
                                       parent=dlg)
                return
            secs = self._guide_sections[cat]
            ui = next((i for i, s in enumerate(secs)
                       if s["name"] == "Unassigned"), len(secs))
            secs.insert(ui, {"name": name, "items": []})
            self._section_order[cat] = [
                s["name"] for s in secs if s["name"] != "Unassigned"]
            self._update_badge()
            dlg.destroy()
            self._refresh_guides()

        entry.bind("<Return>", lambda e: do())
        btn_row = tk.Frame(body, bg=C.SURFACE0)
        btn_row.pack(fill="x", pady=(16, 0))
        FlatBtn(btn_row, text="Cancel", command=dlg.destroy,
                bg=C.SURFACE1, hover_bg=C.SURFACE2).pack(side="right", padx=(8, 0))
        FlatBtn(btn_row, text="  Add  ", command=do,
                bg=self._accent(), fg=C.CRUST,
                hover_bg=self._accent_hover()).pack(side="right")

    def _delete_section(self):
        cat = self._guide_cat_var.get()
        secs = self._guide_sections[cat]
        deletable = [s for s in secs if s["name"] != "Unassigned"]
        if not deletable:
            return
        dlg = make_dialog(self.winfo_toplevel(), "Delete Section", 380, 320)
        body = tk.Frame(dlg, bg=C.SURFACE0)
        body.pack(fill="both", expand=True, padx=20, pady=16)
        tk.Label(body, text="Select section to delete", bg=C.SURFACE0,
                 fg=C.SUBTEXT0, font=F.SMALL).pack(anchor="w", pady=(0, 4))
        lb = tk.Listbox(body, bg=C.SURFACE1, fg=C.TEXT,
                        selectbackground=C.BLUE, selectforeground=C.CRUST,
                        font=F.BODY, height=6, relief="flat",
                        highlightthickness=0, activestyle="none")
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
                self._pending_changes[str(g["path"])] = {
                    "navbar": [], "type": "list"}
                if ua:
                    ua["items"].append(g)
            secs.remove(target)
            self._section_order[cat] = [
                s["name"] for s in secs if s["name"] != "Unassigned"]
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
        cat = self._guide_cat_var.get()
        secs = self._guide_sections[cat]
        renamable = [s for s in secs if s["name"] != "Unassigned"]
        if not renamable:
            return
        dlg = make_dialog(self.winfo_toplevel(), "Rename Section", 380, 360)
        body = tk.Frame(dlg, bg=C.SURFACE0)
        body.pack(fill="both", expand=True, padx=20, pady=16)
        tk.Label(body, text="Select section", bg=C.SURFACE0, fg=C.SUBTEXT0,
                 font=F.SMALL).pack(anchor="w", pady=(0, 4))
        lb = tk.Listbox(body, bg=C.SURFACE1, fg=C.TEXT,
                        selectbackground=C.BLUE, selectforeground=C.CRUST,
                        font=F.BODY, height=5, relief="flat",
                        highlightthickness=0, activestyle="none")
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
                messagebox.showwarning("Exists", f"'{new_name}' already exists.",
                                       parent=dlg)
                return
            target["name"] = new_name
            for g in target["items"]:
                g["navbar"] = [new_name]
                self._pending_changes[str(g["path"])] = {
                    "navbar": [new_name], "type": "list"}
            self._section_order[cat] = [
                s["name"] for s in secs if s["name"] != "Unassigned"]
            self._update_badge()
            dlg.destroy()
            self._refresh_guides()

        btn_row = tk.Frame(body, bg=C.SURFACE0)
        btn_row.pack(fill="x", pady=(12, 0))
        FlatBtn(btn_row, text="Cancel", command=dlg.destroy,
                bg=C.SURFACE1, hover_bg=C.SURFACE2).pack(side="right", padx=(8, 0))
        FlatBtn(btn_row, text="  Rename  ", command=do,
                bg=self._accent(), fg=C.CRUST,
                hover_bg=self._accent_hover()).pack(side="right")

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
            self._pending_field_changes.setdefault(pkey, {})["guide"] = new_name
            self._update_badge()
            self._refresh_guides()

        self._rename_item_dialog("Rename Guide", current, on_rename)

    # ========================================================================
    # BRANDS TAB
    # ========================================================================

    def _build_brands_tab(self):
        frame = tk.Frame(self._notebook, bg=C.MANTLE)
        self._notebook.add(frame, text="  Brands  ")
        top = tk.Frame(frame, bg=C.MANTLE)
        top.pack(fill="x", padx=16, pady=(16, 8))
        tk.Label(top, text="Brands", bg=C.MANTLE, fg=C.TEXT,
                 font=F.HEADING).pack(side="left")
        tk.Label(top, text=str(len(self._brands_data)),
                 bg=self._accent(), fg=C.CRUST,
                 font=F.TINY, padx=6, pady=2).pack(side="left", padx=(10, 0))

        self._brands_area = tk.Frame(frame, bg=C.MANTLE)
        self._brands_area.pack(fill="both", expand=True, padx=16, pady=(0, 16))
        self._refresh_brands()

    def _refresh_brands(self):
        for w in self._brands_area.winfo_children():
            w.destroy()
        self._brand_lbs = []
        cat_ids = self._cat_ids()
        cat_brands = {c: [] for c in cat_ids}
        for b in self._brands_data:
            nb = b["categories"] or []
            for c in nb:
                if c in cat_brands:
                    cat_brands[c].append(b)
        for c in cat_ids:
            cat_brands[c].sort(key=lambda x: x["brand"].lower())
        all_sorted = sorted(self._brands_data, key=lambda x: x["brand"].lower())

        split = tk.Frame(self._brands_area, bg=C.MANTLE)
        split.pack(fill="both", expand=True)

        left = tk.Frame(split, bg=C.MANTLE)
        left.pack(side="left", fill="both", expand=True)
        canvas = tk.Canvas(left, bg=C.MANTLE, highlightthickness=0)
        xsb = ttk.Scrollbar(left, orient="horizontal", command=canvas.xview)
        inner = tk.Frame(canvas, bg=C.MANTLE)
        inner.bind("<Configure>",
                    lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=inner, anchor="nw")
        canvas.configure(xscrollcommand=xsb.set)
        canvas.pack(fill="both", expand=True)
        xsb.pack(fill="x")

        colors = self._cat_colors()
        accent = self._accent()
        for cat in cat_ids:
            items = cat_brands[cat]
            color = colors.get(cat, accent)
            self._brand_column(inner, cat.title(), color, items, cat, False)

        sep = tk.Frame(split, bg=C.SURFACE2, width=2)
        sep.pack(side="left", fill="y", padx=20, pady=8)

        right = tk.Frame(split, bg=C.MANTLE)
        right.pack(side="right", fill="y")
        self._brand_column(right, "All Brands", C.SUBTEXT0,
                           all_sorted, "_all", True)

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
                          activestyle="none", relief="flat", bd=0,
                          highlightthickness=0,
                          hover_bg=C.SURFACE1, item_bg=C.SURFACE0)
        lb.pack(fill="both", expand=True, padx=12, pady=(4, 12))
        for b in items:
            if is_ua:
                lb.insert("end", b["displayName"])
            else:
                in_nav = col_name in (b.get("navbar") or [])
                prefix = "[x] " if in_nav else "[ ] "
                lb.insert("end", f"{prefix}{b['displayName']}")
        lb._col_name = col_name
        lb._items = items
        lb._is_unassigned = is_ua
        lb.bind("<ButtonPress-1>", lambda e: self._drag_start(e, "brands"))
        lb.bind("<B1-Motion>", self._drag_motion)
        lb.bind("<ButtonRelease-1>", self._on_brand_drop)
        lb.bind("<Double-Button-1>",
                lambda e, l=lb: self._on_brand_dblclick(e, l))
        if not is_ua:
            lb.bind("<Delete>", self._on_brand_del)
            lb.bind("<BackSpace>", self._on_brand_del)
        self._brand_lbs.append(lb)

    def _on_brand_drop(self, event):
        if not self._drag_item or not self._drag_src or self._drag_tab != "brands":
            self._drag_cleanup()
            return
        dropped = False
        no_drag = self._drag_ghost is None  # no motion → just a click
        tgt = self._lb_at(event.x_root, event.y_root)
        if tgt and tgt != self._drag_src:
            # ── Dropped on a different column ──
            brand = self._drag_item
            tc = tgt._col_name
            sc = self._drag_src._col_name
            cats = list(brand.get("categories") or [])
            nav = list(brand.get("navbar") or [])
            if tc == "_all":
                if sc != "_all" and sc in cats:
                    cats.remove(sc)
                    nav = [x for x in nav if x != sc]
                    brand["categories"] = cats
                    brand["navbar"] = nav
                    self._pending_changes[str(brand["path"])] = {
                        "categories": cats, "navbar": nav, "type": "list"}
                    self._app.store.brand_categories[brand["filename"]] = list(cats)
                    self._app.store.notify("brand_categories")
                    self._update_badge()
                    dropped = True
            elif tc in cats:
                self._app.toast.show(
                    f"{brand['displayName']} is already in {tc.title()}",
                    C.OVERLAY0, 2000)
            else:
                cats.append(tc)
                nav.append(tc)
                brand["categories"] = cats
                brand["navbar"] = nav
                self._pending_changes[str(brand["path"])] = {
                    "categories": cats, "navbar": nav, "type": "list"}
                self._app.store.brand_categories[brand["filename"]] = list(cats)
                self._app.store.notify("brand_categories")
                self._update_badge()
                dropped = True
        elif tgt and tgt == self._drag_src and no_drag and not tgt._is_unassigned:
            # ── Clicked (not dragged) on a category column — check for checkbox ──
            local_x = event.x_root - tgt.winfo_rootx()
            if local_x <= 30:
                idx = tgt.nearest(event.y)
                if 0 <= idx < tgt.size() and tgt.bbox(idx) is not None:
                    self._toggle_nav_checkbox(tgt, idx)
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
        cats = list(brand.get("categories") or [])
        nav = list(brand.get("navbar") or [])
        if cat in cats:
            cats.remove(cat)
            nav = [x for x in nav if x != cat]
            brand["categories"] = cats
            brand["navbar"] = nav
            self._pending_changes[str(brand["path"])] = {
                "categories": cats, "navbar": nav, "type": "list"}
            self._app.store.brand_categories[brand["filename"]] = list(cats)
            self._app.store.notify("brand_categories")
            self._update_badge()
            self._refresh_brands()

    def _toggle_nav_checkbox(self, lb, idx):
        """Checkbox click: toggle category in/out of navbar (categories unchanged)."""
        brand = lb._items[idx]
        cat = lb._col_name
        nav = list(brand.get("navbar") or [])
        cats = list(brand.get("categories") or [])
        if cat in nav:
            nav.remove(cat)
        else:
            nav.append(cat)
        brand["navbar"] = nav
        # Categories unchanged — only navbar visibility toggled
        self._pending_changes[str(brand["path"])] = {
            "categories": cats, "navbar": nav, "type": "list"}
        self._update_badge()
        self._refresh_brands()

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
            self._pending_field_changes.setdefault(pkey, {})["displayName"] = new_name
            self._update_badge()
            self._refresh_brands()

        self._rename_item_dialog("Rename Brand", current, on_rename)

    # ========================================================================
    # GAMES TAB
    # ========================================================================

    def _build_games_tab(self):
        self._games_frame = tk.Frame(self._notebook, bg=C.MANTLE)
        self._notebook.add(self._games_frame, text="  Games  ")
        self._game_toggles: list[Toggle] = []
        self._game_labels: list[tk.Label] = []
        self._refresh_games()

    def _refresh_games(self):
        for w in self._games_frame.winfo_children():
            w.destroy()
        self._game_toggles = []
        self._game_labels = []
        accent = self._accent()

        top = tk.Frame(self._games_frame, bg=C.MANTLE)
        top.pack(fill="x", padx=24, pady=(20, 12))
        tk.Label(top, text="Games", bg=C.MANTLE, fg=C.TEXT,
                 font=F.HEADING).pack(side="left")
        tk.Label(top, text=str(len(self._games_data)), bg=accent, fg=C.CRUST,
                 font=F.TINY, padx=6, pady=2).pack(side="left", padx=(10, 0))
        FlatBtn(top, text="Toggle All",
                command=self._toggle_all_games).pack(side="right")

        grid = tk.Frame(self._games_frame, bg=C.MANTLE)
        grid.pack(fill="both", expand=True, padx=24, pady=(0, 20))

        cols = 3
        for i, g in enumerate(self._games_data):
            r, c = divmod(i, cols)
            card = tk.Frame(grid, bg=C.SURFACE0,
                            highlightthickness=1,
                            highlightbackground=C.CARD_BORDER)
            card.grid(row=r, column=c, padx=6, pady=6, sticky="ew")
            grid.columnconfigure(c, weight=1)
            tk.Frame(card, bg=accent, width=3).pack(side="left", fill="y")
            inner = tk.Frame(card, bg=C.SURFACE0)
            inner.pack(side="left", fill="both", expand=True, padx=16, pady=14)
            lbl = tk.Label(inner, text=g["game"], bg=C.SURFACE0, fg=C.TEXT,
                           font=F.BODY_BOLD, anchor="w", cursor="hand2")
            lbl.pack(side="left", fill="x", expand=True)
            lbl.bind("<Double-Button-1>",
                     lambda e, idx=i: self._rename_game(idx))
            self._game_labels.append(lbl)
            t = Toggle(inner, initial=bool(g["navbar"]),
                       on_toggle=lambda v, idx=i: self._on_game_toggle(idx, v),
                       bg=C.SURFACE0)
            t.pack(side="right")
            self._game_toggles.append(t)
            for w in (card, inner, lbl):
                w.bind("<Enter>", lambda e, cd=card, inn=inner, lb=lbl: (
                    cd.configure(bg=C.SURFACE1), inn.configure(bg=C.SURFACE1),
                    lb.configure(bg=C.SURFACE1)))
                w.bind("<Leave>", lambda e, cd=card, inn=inner, lb=lbl: (
                    cd.configure(bg=C.SURFACE0), inn.configure(bg=C.SURFACE0),
                    lb.configure(bg=C.SURFACE0)))

    def _on_game_toggle(self, idx, val):
        g = self._games_data[idx]
        g["navbar"] = val
        self._pending_changes[str(g["path"])] = {"navbar": val, "type": "bool"}
        self._update_badge()

    def _toggle_all_games(self):
        any_off = any(not t.get() for t in self._game_toggles)
        for i, t in enumerate(self._game_toggles):
            t.set(any_off)
            self._on_game_toggle(i, any_off)

    def _rename_game(self, idx):
        g = self._games_data[idx]
        current = g["title"]

        def on_rename(new_name):
            old_game = g["game"]
            g["title"] = new_name
            if old_game == current:
                g["game"] = new_name
            self._game_labels[idx].configure(text=g["game"])
            pkey = str(g["path"])
            self._pending_field_changes.setdefault(pkey, {})["title"] = new_name
            if old_game == current:
                self._pending_field_changes[pkey]["game"] = new_name
            self._update_badge()

        self._rename_item_dialog("Rename Game", current, on_rename)

    # ========================================================================
    # HUBS TAB (display-only)
    # ========================================================================

    def _build_hubs_tab(self):
        self._hubs_frame = tk.Frame(self._notebook, bg=C.MANTLE)
        self._notebook.add(self._hubs_frame, text="  Hubs  ")
        self._refresh_hubs()

    def _refresh_hubs(self):
        for w in self._hubs_frame.winfo_children():
            w.destroy()
        categories = self._categories()
        colors = self._cat_colors()
        accent = self._accent()

        top = tk.Frame(self._hubs_frame, bg=C.MANTLE)
        top.pack(fill="x", padx=24, pady=(20, 12))
        tk.Label(top, text="Hub Categories", bg=C.MANTLE, fg=C.TEXT,
                 font=F.HEADING).pack(side="left")
        tk.Label(top, text=str(len(categories)), bg=accent, fg=C.CRUST,
                 font=F.TINY, padx=6, pady=2).pack(side="left", padx=(10, 0))

        note = tk.Frame(top, bg=C.MANTLE)
        note.pack(side="right")
        tk.Label(note, text="Read-only  \u00b7  Use Categories tab to edit flags",
                 bg=C.MANTLE, fg=C.OVERLAY0, font=F.SMALL).pack(side="left")

        container = tk.Frame(self._hubs_frame, bg=C.MANTLE)
        container.pack(fill="both", expand=True, padx=24, pady=(0, 20))

        for cat_def in categories:
            cat = cat_def["id"]
            color = colors.get(cat, accent)
            prod = cat_def.get("product", {})
            prod_on = prod.get("production", False)
            prod_vite = prod.get("vite", False)

            card = tk.Frame(container, bg=C.SURFACE0,
                            highlightthickness=1,
                            highlightbackground=C.CARD_BORDER)
            card.pack(fill="x", pady=5)
            tk.Frame(card, bg=color, width=3).pack(side="left", fill="y")
            inner = tk.Frame(card, bg=C.SURFACE0)
            inner.pack(side="left", fill="both", expand=True, padx=16, pady=12)

            dot = tk.Canvas(inner, width=12, height=12,
                            highlightthickness=0, bg=C.SURFACE0)
            dot.pack(side="left", padx=(0, 10))
            dot.create_oval(1, 1, 11, 11, fill=color, outline="")
            tk.Label(inner, text=cat_def.get("label", cat.title()),
                     bg=C.SURFACE0, fg=C.TEXT, font=F.BODY_BOLD,
                     anchor="w").pack(side="left")

            badges = tk.Frame(inner, bg=C.SURFACE0)
            badges.pack(side="right")

            def _badge(parent, text, active, bg_on, bg_off=C.SURFACE2):
                bg = bg_on if active else bg_off
                fg = C.CRUST if active else C.OVERLAY0
                tk.Label(parent, text=text, bg=bg, fg=fg,
                         font=F.TINY, padx=6, pady=2).pack(side="left", padx=2)

            _badge(badges, "Product", prod_on, C.GREEN)
            _badge(badges, "Vite", prod_vite, C.BLUE)

            all_widgets = [card, inner, dot, badges]
            for w in all_widgets:
                w.bind("<Enter>",
                       lambda e, cd=card, inn=inner, d=dot, b=badges: (
                           cd.configure(bg=C.SURFACE1),
                           inn.configure(bg=C.SURFACE1),
                           d.configure(bg=C.SURFACE1),
                           b.configure(bg=C.SURFACE1)))
                w.bind("<Leave>",
                       lambda e, cd=card, inn=inner, d=dot, b=badges: (
                           cd.configure(bg=C.SURFACE0),
                           inn.configure(bg=C.SURFACE0),
                           d.configure(bg=C.SURFACE0),
                           b.configure(bg=C.SURFACE0)))
