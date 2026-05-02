"""Cache / CDN panel for the EG Config mega-app."""

import copy
import json
import tkinter as tk
from tkinter import ttk

from lib.shared import C, F
from lib.config_store import ConfigStore


DEFAULT_POLICIES = {
    "staticPages": {
        "browserMaxAge": 0,
        "edgeMaxAge": 86400,
        "staleWhileRevalidate": 0,
        "mustRevalidate": True,
        "immutable": False,
        "noStore": False,
        "varyQuery": "none",
        "varyHeaders": [],
        "invalidationGroup": "pages",
    },
    "hubPages": {
        "browserMaxAge": 0,
        "edgeMaxAge": 86400,
        "staleWhileRevalidate": 0,
        "mustRevalidate": True,
        "immutable": False,
        "noStore": False,
        "varyQuery": "none",
        "varyHeaders": [],
        "invalidationGroup": "hubs",
    },
    "staticAssets": {
        "browserMaxAge": 31536000,
        "edgeMaxAge": 31536000,
        "staleWhileRevalidate": 0,
        "mustRevalidate": False,
        "immutable": True,
        "noStore": False,
        "varyQuery": "none",
        "varyHeaders": [],
        "invalidationGroup": "assets",
    },
    "images": {
        "browserMaxAge": 31536000,
        "edgeMaxAge": 31536000,
        "staleWhileRevalidate": 0,
        "mustRevalidate": False,
        "immutable": True,
        "noStore": False,
        "varyQuery": "none",
        "varyHeaders": ["Accept"],
        "invalidationGroup": "images",
    },
    "searchApi": {
        "browserMaxAge": 60,
        "edgeMaxAge": 300,
        "staleWhileRevalidate": 300,
        "mustRevalidate": False,
        "immutable": False,
        "noStore": False,
        "varyQuery": "all",
        "varyHeaders": [],
        "invalidationGroup": "api-search",
    },
    "dynamicApis": {
        "browserMaxAge": 0,
        "edgeMaxAge": 0,
        "staleWhileRevalidate": 0,
        "mustRevalidate": False,
        "immutable": False,
        "noStore": True,
        "varyQuery": "none",
        "varyHeaders": [],
        "invalidationGroup": "dynamic",
    },
}

DEFAULT_PAGE_TYPES = {
    "sitePages": {
        "label": "Site Pages",
        "description": "Default static HTML pages and documents served from the S3 origin.",
        "policy": "staticPages",
    },
    "hubPages": {
        "label": "Hub Pages",
        "description": "Static hub shells that keep client-side view state out of the cache key.",
        "policy": "hubPages",
    },
    "staticAssets": {
        "label": "Static Assets",
        "description": "Hashed client bundles, fonts, and immutable build artifacts.",
        "policy": "staticAssets",
    },
    "images": {
        "label": "Images",
        "description": "Product and editorial image paths that vary by format negotiation instead of query strings.",
        "policy": "images",
    },
    "searchApi": {
        "label": "Search API",
        "description": "Public search JSON that can be short-lived at the browser and edge.",
        "policy": "searchApi",
    },
    "authAndSession": {
        "label": "Auth And Session",
        "description": "Authentication and session routes that must never be cached.",
        "policy": "dynamicApis",
    },
    "userData": {
        "label": "User Data",
        "description": "Signed-in user and vault routes that must never be cached.",
        "policy": "dynamicApis",
    },
    "apiFallback": {
        "label": "API Fallback",
        "description": "Catch-all dynamic API routes that default to no-store behavior.",
        "policy": "dynamicApis",
    },
}

DEFAULT_TARGETS = [
    {"id": "static-pages", "label": "Static Pages", "pathPatterns": ["*"], "pageType": "sitePages"},
    {"id": "hub-pages", "label": "Hub Pages", "pathPatterns": ["/hubs/*"], "pageType": "hubPages"},
    {
        "id": "static-assets",
        "label": "Static Assets",
        "pathPatterns": ["/assets/*", "/_astro/*", "/fonts/*", "/js/*"],
        "pageType": "staticAssets",
    },
    {"id": "images", "label": "Images", "pathPatterns": ["/images/*"], "pageType": "images"},
    {"id": "search-api", "label": "Search API", "pathPatterns": ["/api/search*"], "pageType": "searchApi"},
    {
        "id": "auth-and-session",
        "label": "Auth And Session",
        "pathPatterns": ["/api/auth/*", "/auth/*", "/login/*", "/logout", "/logout/*"],
        "pageType": "authAndSession",
    },
    {
        "id": "user-data",
        "label": "User Data",
        "pathPatterns": ["/api/user/*", "/api/vault/*"],
        "pageType": "userData",
    },
    {"id": "api-fallback", "label": "API Fallback", "pathPatterns": ["/api/*"], "pageType": "apiFallback"},
]

DEFAULT_CACHE_CDN = {
    "policies": copy.deepcopy(DEFAULT_POLICIES),
    "pageTypes": copy.deepcopy(DEFAULT_PAGE_TYPES),
    "targets": copy.deepcopy(DEFAULT_TARGETS),
}

POLICY_NAMES = list(DEFAULT_POLICIES.keys())
PAGE_TYPE_NAMES = list(DEFAULT_PAGE_TYPES.keys())


def build_policy_preview(policy: dict) -> str:
    """Build the Cache-Control preview string for a policy row."""
    if policy.get("noStore"):
        return "no-store"

    parts = [
        "public",
        f"max-age={int(policy.get('browserMaxAge', 0))}",
        f"s-maxage={int(policy.get('edgeMaxAge', 0))}",
    ]
    stale = int(policy.get("staleWhileRevalidate", 0))
    if stale > 0:
        parts.append(f"stale-while-revalidate={stale}")
    if policy.get("mustRevalidate"):
        parts.append("must-revalidate")
    if policy.get("immutable"):
        parts.append("immutable")
    return ", ".join(parts)


def _coerce_int(value, default=0) -> int:
    try:
        return max(0, int(str(value).strip()))
    except (TypeError, ValueError):
        return default


def _clean_headers(value) -> list[str]:
    if isinstance(value, list):
        items = value
    else:
        items = str(value or "").split(",")
    return [str(item).strip() for item in items if str(item).strip()]


def _clean_patterns(value) -> list[str]:
    if isinstance(value, list):
        items = value
    else:
        items = str(value or "").splitlines()
    return [str(item).strip() for item in items if str(item).strip()]


def _legacy_page_type_for_target(target: dict) -> str:
    policy = str(target.get("policy") or "").strip()
    patterns = _clean_patterns(target.get("pathPatterns", []))

    if policy == "staticPages":
        return "sitePages"
    if policy == "hubPages":
        return "hubPages"
    if policy == "staticAssets":
        return "staticAssets"
    if policy == "images":
        return "images"
    if policy == "searchApi":
        return "searchApi"
    if "/api/user/*" in patterns or "/api/vault/*" in patterns:
        return "userData"
    if any(pattern in {"/api/auth/*", "/auth/*", "/login/*", "/logout", "/logout/*"} for pattern in patterns):
        return "authAndSession"
    return "apiFallback"


def normalize_cache_cdn_config(data: dict | None) -> dict:
    """Normalize raw JSON into the editor contract expected by the panel."""
    raw = data if isinstance(data, dict) else {}

    policies = {}
    raw_policies = raw.get("policies", {})
    for name, defaults in DEFAULT_POLICIES.items():
        source = raw_policies.get(name, {}) if isinstance(raw_policies, dict) else {}
        policies[name] = {
            "browserMaxAge": _coerce_int(source.get("browserMaxAge"), defaults["browserMaxAge"]),
            "edgeMaxAge": _coerce_int(source.get("edgeMaxAge"), defaults["edgeMaxAge"]),
            "staleWhileRevalidate": _coerce_int(source.get("staleWhileRevalidate"), defaults["staleWhileRevalidate"]),
            "mustRevalidate": bool(source.get("mustRevalidate", defaults["mustRevalidate"])),
            "immutable": bool(source.get("immutable", defaults["immutable"])),
            "noStore": bool(source.get("noStore", defaults["noStore"])),
            "varyQuery": source.get("varyQuery") if source.get("varyQuery") in {"none", "all"} else defaults["varyQuery"],
            "varyHeaders": _clean_headers(source.get("varyHeaders", defaults["varyHeaders"])),
            "invalidationGroup": str(source.get("invalidationGroup", defaults["invalidationGroup"])).strip() or defaults["invalidationGroup"],
        }

    page_types = {}
    raw_page_types = raw.get("pageTypes", {})
    for name, defaults in DEFAULT_PAGE_TYPES.items():
        source = raw_page_types.get(name, {}) if isinstance(raw_page_types, dict) else {}
        policy_name = str(source.get("policy", defaults["policy"])).strip()
        page_types[name] = {
            "label": str(source.get("label", defaults["label"])).strip() or defaults["label"],
            "description": str(source.get("description", defaults["description"])).strip() or defaults["description"],
            "policy": policy_name if policy_name in POLICY_NAMES else defaults["policy"],
        }

    targets = []
    raw_targets = raw.get("targets", [])
    if isinstance(raw_targets, list) and raw_targets:
        for index, target in enumerate(raw_targets):
            if not isinstance(target, dict):
                continue
            target_id = str(target.get("id") or f"target-{index + 1}").strip() or f"target-{index + 1}"
            page_type = str(target.get("pageType") or "").strip()
            if page_type not in PAGE_TYPE_NAMES:
                page_type = _legacy_page_type_for_target(target)
            patterns = _clean_patterns(target.get("pathPatterns", []))
            targets.append({
                "id": target_id,
                "label": str(target.get("label") or target_id.replace("-", " ").title()).strip() or target_id,
                "pathPatterns": patterns or ["/new-path/*"],
                "pageType": page_type,
            })
    else:
        targets = copy.deepcopy(DEFAULT_TARGETS)

    return {
        "policies": policies,
        "pageTypes": page_types,
        "targets": targets,
    }


def list_page_type_targets(config_data: dict, page_type: str) -> list[str]:
    """Return all path patterns currently assigned to a page type."""
    return [
        pattern
        for target in config_data.get("targets", [])
        if target.get("pageType") == page_type
        for pattern in target.get("pathPatterns", [])
    ]


def audit_cache_cdn_config(config_data: dict) -> list[str]:
    """Return human-readable validation issues for the current contract."""
    issues = []
    policies = config_data.get("policies", {})
    page_types = config_data.get("pageTypes", {})
    targets = config_data.get("targets", [])
    seen_patterns = {}

    for policy_name, policy in policies.items():
        if policy.get("noStore") and (
            _coerce_int(policy.get("browserMaxAge")) != 0
            or _coerce_int(policy.get("edgeMaxAge")) != 0
            or _coerce_int(policy.get("staleWhileRevalidate")) != 0
        ):
            issues.append(f"{policy_name}: no-store policies must use zero TTLs.")
        if policy.get("noStore") and policy.get("immutable"):
            issues.append(f"{policy_name}: no-store policies cannot be immutable.")
        if policy.get("noStore") and policy.get("mustRevalidate"):
            issues.append(f"{policy_name}: no-store policies cannot require revalidation.")
        if (
            not policy.get("noStore")
            and not policy.get("immutable")
            and _coerce_int(policy.get("browserMaxAge")) == 0
            and _coerce_int(policy.get("edgeMaxAge")) > 0
            and not policy.get("mustRevalidate")
        ):
            issues.append(
                f"{policy_name}: browser-revalidated public policies should set must-revalidate when browser TTL is zero."
            )

    for page_type_name, page_type in page_types.items():
        if page_type.get("policy") not in policies:
            issues.append(f"{page_type_name}: unknown policy '{page_type.get('policy')}'.")

    for target in targets:
        target_id = str(target.get("id") or "?")
        page_type = str(target.get("pageType") or "")
        if page_type not in page_types:
            issues.append(f"{target_id}: unknown page type '{page_type}'.")
        for pattern in _clean_patterns(target.get("pathPatterns", [])):
            if pattern in seen_patterns:
                issues.append(
                    f'Duplicate path pattern "{pattern}" in {seen_patterns[pattern]} and {target_id}.'
                )
                continue
            seen_patterns[pattern] = target_id

    return issues


class CacheCdnPanel(tk.Frame):
    """Cache / CDN editor panel for the unified config manager."""

    def __init__(self, parent: tk.Widget, app):
        super().__init__(parent, bg=C.MANTLE)
        self._app = app
        self._config_data = normalize_cache_cdn_config(
            copy.deepcopy(app.store.get(ConfigStore.CACHE_CDN) or DEFAULT_CACHE_CDN)
        )
        self._original = json.dumps(self._config_data, sort_keys=True)
        self._active_policy = POLICY_NAMES[0]
        self._active_page_type = PAGE_TYPE_NAMES[0]
        self._active_target_index = 0

        self._build_notebook()
        self._refresh_all()

        app.store.subscribe(ConfigStore.CACHE_CDN, self._on_store_change)

    def save(self) -> bool:
        if not self.has_changes():
            self._app.toast.show("No changes to save", C.OVERLAY0)
            return False
        try:
            self._app.store.save(ConfigStore.CACHE_CDN, self._config_data)
            self._original = json.dumps(self._config_data, sort_keys=True)
            self._refresh_all()
            self._app.update_changes_badge()
            now = __import__("datetime").datetime.now().strftime("%H:%M:%S")
            self._app.toast.show(f"Saved cache-cdn.json at {now}", C.GREEN)
            self._app.set_status(f"Last saved at {now}  -  Ctrl+S to save")
            return True
        except Exception as ex:
            self._app.toast.show(f"Save failed: {ex}", C.RED)
            return False

    def has_changes(self) -> bool:
        return json.dumps(self._config_data, sort_keys=True) != self._original

    def refresh(self):
        self._config_data = normalize_cache_cdn_config(
            copy.deepcopy(self._app.store.get(ConfigStore.CACHE_CDN) or DEFAULT_CACHE_CDN)
        )
        self._original = json.dumps(self._config_data, sort_keys=True)
        self._refresh_all()
        self._app.update_changes_badge()

    def _on_store_change(self):
        self.refresh()

    def _on_categories_change(self):
        self._refresh_all()

    def _on_tab_change(self, _event=None):
        self._refresh_preview()
        self._refresh_audit()
        self._app.set_status_right(
            f"{len(self._config_data['pageTypes'])} page types - {len(self._config_data['targets'])} targets"
        )

    def _build_notebook(self):
        self._nb = ttk.Notebook(self)
        self._nb.pack(fill="both", expand=True, padx=20, pady=16)
        self._nb.bind("<<NotebookTabChanged>>", self._on_tab_change)

        self._doc_tab = tk.Frame(self._nb, bg=C.MANTLE)
        self._page_tab = tk.Frame(self._nb, bg=C.MANTLE)
        self._target_tab = tk.Frame(self._nb, bg=C.MANTLE)
        self._preview_tab = tk.Frame(self._nb, bg=C.MANTLE)
        self._audit_tab = tk.Frame(self._nb, bg=C.MANTLE)

        self._nb.add(self._doc_tab, text="Document Types")
        self._nb.add(self._page_tab, text="Page Types")
        self._nb.add(self._target_tab, text="Route Targets")
        self._nb.add(self._preview_tab, text="Preview")
        self._nb.add(self._audit_tab, text="Audit")

        self._policy_list, self._policy_detail = self._build_master_detail(self._doc_tab, "DOCUMENT TYPES")
        self._page_type_list, self._page_type_detail = self._build_master_detail(self._page_tab, "PAGE TYPES")
        self._target_list, self._target_detail = self._build_master_detail(
            self._target_tab,
            "ROUTE TARGETS",
            with_actions=True,
        )

        self._preview_text = self._build_text_panel(self._preview_tab, "GENERATED PREVIEW")
        self._audit_text = self._build_text_panel(self._audit_tab, "AUDIT")

        self._policy_list.bind("<<ListboxSelect>>", self._on_policy_select)
        self._page_type_list.bind("<<ListboxSelect>>", self._on_page_type_select)
        self._target_list.bind("<<ListboxSelect>>", self._on_target_select)

    def _build_master_detail(self, parent, heading: str, with_actions: bool = False):
        outer = tk.Frame(parent, bg=C.MANTLE)
        outer.pack(fill="both", expand=True)

        left = tk.Frame(outer, bg=C.SURFACE0, width=320)
        left.pack(side="left", fill="y")
        left.pack_propagate(False)
        right = tk.Frame(outer, bg=C.SURFACE0)
        right.pack(side="left", fill="both", expand=True, padx=(12, 0))

        tk.Label(left, text=heading, font=F.SMALL, fg=C.OVERLAY0, bg=C.SURFACE0).pack(
            anchor="w",
            padx=14,
            pady=(12, 8),
        )

        if with_actions:
            btn_row = tk.Frame(left, bg=C.SURFACE0)
            btn_row.pack(fill="x", padx=12, pady=(0, 8))
            self._action_button(btn_row, "+ Target", self._add_target).pack(side="left")
            self._action_button(btn_row, "Delete", self._delete_target).pack(side="left", padx=(8, 0))

        listbox = tk.Listbox(
            left,
            bg=C.SURFACE0,
            fg=C.TEXT,
            selectbackground=C.SURFACE2,
            selectforeground=C.TEXT,
            relief="flat",
            borderwidth=0,
            font=F.BODY,
            activestyle="none",
            exportselection=False,
        )
        listbox.pack(fill="both", expand=True, padx=12, pady=(0, 12))

        tk.Frame(right, bg=C.SURFACE1, height=1).pack(fill="x")
        return listbox, right

    def _build_text_panel(self, parent, heading: str):
        frame = tk.Frame(parent, bg=C.SURFACE0)
        frame.pack(fill="both", expand=True)

        tk.Label(frame, text=heading, font=F.SMALL, fg=C.OVERLAY0, bg=C.SURFACE0).pack(
            anchor="w",
            padx=14,
            pady=(12, 8),
        )
        text = tk.Text(
            frame,
            bg=C.SURFACE0,
            fg=C.TEXT,
            insertbackground=C.TEXT,
            relief="flat",
            borderwidth=0,
            wrap="word",
            font=F.MONO_SMALL,
        )
        text.pack(fill="both", expand=True, padx=12, pady=(0, 12))
        text.configure(state="disabled")
        return text

    def _action_button(self, parent, text, command):
        return tk.Button(
            parent,
            text=text,
            command=command,
            bg=C.SURFACE1,
            fg=C.TEXT,
            activebackground=C.SURFACE2,
            activeforeground=C.TEXT,
            relief="flat",
            font=F.SMALL,
        )

    def _refresh_all(self):
        self._refresh_policy_list()
        self._show_policy_detail(self._active_policy)
        self._refresh_page_type_list()
        self._show_page_type_detail(self._active_page_type)
        self._refresh_target_list()
        self._show_target_detail(self._active_target_index)
        self._refresh_preview()
        self._refresh_audit()
        self._on_tab_change()

    def _refresh_policy_list(self):
        self._policy_list.delete(0, tk.END)
        for name in POLICY_NAMES:
            preview = build_policy_preview(self._config_data["policies"][name])
            self._policy_list.insert(tk.END, f"{name}  -  {preview}")
        self._select_list_index(self._policy_list, POLICY_NAMES.index(self._active_policy))

    def _refresh_page_type_list(self):
        self._page_type_list.delete(0, tk.END)
        for name in PAGE_TYPE_NAMES:
            page_type = self._config_data["pageTypes"][name]
            self._page_type_list.insert(tk.END, f"{page_type['label']}  -  {page_type['policy']}")
        self._select_list_index(self._page_type_list, PAGE_TYPE_NAMES.index(self._active_page_type))

    def _refresh_target_list(self):
        self._target_list.delete(0, tk.END)
        for target in self._config_data["targets"]:
            self._target_list.insert(tk.END, f"{target['label']}  -  {target['pageType']}")

        if not self._config_data["targets"]:
            self._active_target_index = -1
            return

        if self._active_target_index >= len(self._config_data["targets"]):
            self._active_target_index = len(self._config_data["targets"]) - 1
        self._select_list_index(self._target_list, self._active_target_index)

    def _select_list_index(self, listbox, index: int):
        if index < 0:
            return
        listbox.selection_clear(0, tk.END)
        listbox.selection_set(index)
        listbox.activate(index)
        listbox.see(index)

    def _on_policy_select(self, _event=None):
        sel = self._policy_list.curselection()
        if not sel:
            return
        self._active_policy = POLICY_NAMES[sel[0]]
        self._show_policy_detail(self._active_policy)

    def _on_page_type_select(self, _event=None):
        sel = self._page_type_list.curselection()
        if not sel:
            return
        self._active_page_type = PAGE_TYPE_NAMES[sel[0]]
        self._show_page_type_detail(self._active_page_type)

    def _on_target_select(self, _event=None):
        sel = self._target_list.curselection()
        if not sel:
            return
        self._active_target_index = sel[0]
        self._show_target_detail(self._active_target_index)

    def _clear_detail(self, frame):
        for widget in frame.winfo_children():
            widget.destroy()

    def _detail_field(self, parent, label: str):
        row = tk.Frame(parent, bg=C.SURFACE0)
        row.pack(fill="x", padx=16, pady=(0, 10))
        tk.Label(
            row,
            text=label,
            font=F.SMALL,
            fg=C.OVERLAY0,
            bg=C.SURFACE0,
            width=18,
            anchor="w",
        ).pack(side="left")
        return row

    def _show_policy_detail(self, policy_name: str):
        self._clear_detail(self._policy_detail)
        policy = self._config_data["policies"][policy_name]
        tk.Label(self._policy_detail, text=policy_name, font=F.HEADING, fg=C.TEXT, bg=C.SURFACE0).pack(
            anchor="w",
            padx=16,
            pady=(16, 4),
        )
        self._policy_preview_lbl = tk.Label(
            self._policy_detail,
            text=build_policy_preview(policy),
            font=F.MONO_SMALL,
            fg=C.GREEN,
            bg=C.SURFACE0,
        )
        self._policy_preview_lbl.pack(anchor="w", padx=16, pady=(0, 16))

        self._int_entry(self._policy_detail, "Browser TTL", policy_name, "browserMaxAge")
        self._int_entry(self._policy_detail, "Edge TTL", policy_name, "edgeMaxAge")
        self._int_entry(self._policy_detail, "Stale While Revalidate", policy_name, "staleWhileRevalidate")
        self._bool_entry(self._policy_detail, "Must Revalidate", policy_name, "mustRevalidate")
        self._text_entry(self._policy_detail, "Invalidation Group", policy_name, "invalidationGroup")
        self._combo_entry(self._policy_detail, "Vary Query", policy_name, "varyQuery", ["none", "all"])
        self._text_entry(
            self._policy_detail,
            "Vary Headers",
            policy_name,
            "varyHeaders",
            value=", ".join(policy.get("varyHeaders", [])),
            transform=lambda raw: _clean_headers(raw),
        )
        self._bool_entry(self._policy_detail, "Immutable", policy_name, "immutable")
        self._bool_entry(self._policy_detail, "No Store", policy_name, "noStore")

    def _show_page_type_detail(self, page_type_name: str):
        self._clear_detail(self._page_type_detail)
        page_type = self._config_data["pageTypes"][page_type_name]
        tk.Label(self._page_type_detail, text=page_type_name, font=F.HEADING, fg=C.TEXT, bg=C.SURFACE0).pack(
            anchor="w",
            padx=16,
            pady=(16, 4),
        )
        self._text_entry(self._page_type_detail, "Label", page_type_name, "label", area="pageType")
        self._text_entry(self._page_type_detail, "Description", page_type_name, "description", area="pageType")
        self._combo_entry(
            self._page_type_detail,
            "Document Type",
            page_type_name,
            "policy",
            POLICY_NAMES,
            area="pageType",
        )

        patterns = list_page_type_targets(self._config_data, page_type_name)
        tk.Label(self._page_type_detail, text="Assigned Routes", font=F.SMALL, fg=C.OVERLAY0, bg=C.SURFACE0).pack(
            anchor="w",
            padx=16,
            pady=(8, 4),
        )
        tk.Label(
            self._page_type_detail,
            text="\n".join(patterns) if patterns else "No targets assigned",
            font=F.MONO_SMALL,
            fg=C.TEXT,
            bg=C.SURFACE0,
            justify="left",
        ).pack(anchor="w", padx=16, pady=(0, 12))

    def _show_target_detail(self, index: int):
        self._clear_detail(self._target_detail)
        if index < 0 or index >= len(self._config_data["targets"]):
            return

        target = self._config_data["targets"][index]
        tk.Label(self._target_detail, text=target["id"], font=F.HEADING, fg=C.TEXT, bg=C.SURFACE0).pack(
            anchor="w",
            padx=16,
            pady=(16, 4),
        )
        self._text_entry(self._target_detail, "ID", index, "id", area="target")
        self._text_entry(self._target_detail, "Label", index, "label", area="target")
        self._combo_entry(
            self._target_detail,
            "Page Type",
            index,
            "pageType",
            PAGE_TYPE_NAMES,
            area="target",
        )

        row = self._detail_field(self._target_detail, "Path Patterns")
        text = tk.Text(
            row,
            height=8,
            bg=C.SURFACE1,
            fg=C.TEXT,
            insertbackground=C.TEXT,
            relief="flat",
            borderwidth=0,
            font=F.MONO_SMALL,
            width=40,
        )
        text.pack(side="left", fill="x", expand=True)
        text.insert("1.0", "\n".join(target.get("pathPatterns", [])))

        def _on_patterns_change(_event=None):
            self._config_data["targets"][index]["pathPatterns"] = _clean_patterns(
                text.get("1.0", "end")
            ) or ["/new-path/*"]
            self._touch()

        text.bind("<KeyRelease>", _on_patterns_change)

    def _int_entry(self, parent, label, key_name, field_name):
        policy = self._config_data["policies"][key_name]
        self._text_entry(
            parent,
            label,
            key_name,
            field_name,
            value=str(policy.get(field_name, 0)),
            transform=_coerce_int,
        )

    def _bool_entry(self, parent, label, key_name, field_name):
        row = self._detail_field(parent, label)
        var = tk.BooleanVar(value=bool(self._config_data["policies"][key_name].get(field_name)))
        check = tk.Checkbutton(
            row,
            variable=var,
            bg=C.SURFACE0,
            fg=C.TEXT,
            selectcolor=C.SURFACE1,
            activebackground=C.SURFACE0,
            activeforeground=C.TEXT,
            highlightthickness=0,
        )
        check.pack(side="left")
        var.trace_add("write", lambda *_args: self._set_policy_value(key_name, field_name, bool(var.get())))

    def _combo_entry(self, parent, label, key_name, field_name, values, area="policy"):
        current = self._get_area_value(area, key_name, field_name)
        row = self._detail_field(parent, label)
        var = tk.StringVar(value=str(current))
        combo = ttk.Combobox(row, values=values, textvariable=var, state="readonly", width=24)
        combo.pack(side="left", fill="x", expand=True)
        var.trace_add("write", lambda *_args: self._set_area_value(area, key_name, field_name, var.get()))

    def _text_entry(self, parent, label, key_name, field_name, area="policy", value=None, transform=None):
        current = self._get_area_value(area, key_name, field_name) if value is None else value
        row = self._detail_field(parent, label)
        var = tk.StringVar(value=str(current))
        entry = tk.Entry(
            row,
            textvariable=var,
            bg=C.SURFACE1,
            fg=C.TEXT,
            insertbackground=C.TEXT,
            relief="flat",
            font=F.BODY,
        )
        entry.pack(side="left", fill="x", expand=True)

        def _on_change(*_args):
            next_value = var.get()
            if transform:
                next_value = transform(next_value)
            self._set_area_value(area, key_name, field_name, next_value)

        var.trace_add("write", _on_change)

    def _get_area_value(self, area, key_name, field_name):
        if area == "policy":
            return self._config_data["policies"][key_name].get(field_name)
        if area == "pageType":
            return self._config_data["pageTypes"][key_name].get(field_name)
        return self._config_data["targets"][key_name].get(field_name)

    def _set_policy_value(self, policy_name, field_name, value):
        self._config_data["policies"][policy_name][field_name] = value
        self._touch()

    def _set_area_value(self, area, key_name, field_name, value):
        if area == "policy":
            self._config_data["policies"][key_name][field_name] = value
        elif area == "pageType":
            self._config_data["pageTypes"][key_name][field_name] = value
        else:
            self._config_data["targets"][key_name][field_name] = value
        self._touch()

    def _add_target(self):
        next_index = len(self._config_data["targets"]) + 1
        self._config_data["targets"].append({
            "id": f"new-target-{next_index}",
            "label": f"New Target {next_index}",
            "pathPatterns": ["/new-path/*"],
            "pageType": "sitePages",
        })
        self._active_target_index = len(self._config_data["targets"]) - 1
        self._touch()

    def _delete_target(self):
        if len(self._config_data["targets"]) <= 1:
            self._app.toast.show("Keep at least one route target", C.PEACH)
            return
        del self._config_data["targets"][self._active_target_index]
        self._active_target_index = max(0, self._active_target_index - 1)
        self._touch()

    def _refresh_preview(self):
        lines = ["Document Types", ""]
        for policy_name in POLICY_NAMES:
            policy = self._config_data["policies"][policy_name]
            lines.append(f"{policy_name}: {build_policy_preview(policy)}")
            lines.append(
                f"  varyQuery={policy['varyQuery']} varyHeaders={', '.join(policy['varyHeaders']) or 'none'}"
            )
        lines.extend(["", "Page Types", ""])
        for page_type_name in PAGE_TYPE_NAMES:
            page_type = self._config_data["pageTypes"][page_type_name]
            patterns = list_page_type_targets(self._config_data, page_type_name)
            lines.append(f"{page_type_name}: {page_type['policy']}  -  {page_type['label']}")
            lines.append(f"  routes={', '.join(patterns) if patterns else 'none'}")
        self._set_text(self._preview_text, "\n".join(lines))

    def _refresh_audit(self):
        issues = audit_cache_cdn_config(self._config_data)
        if not issues:
            self._set_text(self._audit_text, "No issues detected.")
            return
        self._set_text(self._audit_text, "\n".join(f"- {issue}" for issue in issues))

    def _set_text(self, widget, value: str):
        widget.configure(state="normal")
        widget.delete("1.0", "end")
        widget.insert("1.0", value)
        widget.configure(state="disabled")

    def _touch(self):
        self._config_data = normalize_cache_cdn_config(self._config_data)
        self._active_target_index = min(
            self._active_target_index,
            max(0, len(self._config_data["targets"]) - 1),
        )
        self._refresh_policy_list()
        self._show_policy_detail(self._active_policy)
        self._refresh_page_type_list()
        self._show_page_type_detail(self._active_page_type)
        self._refresh_target_list()
        self._show_target_detail(self._active_target_index)
        self._refresh_preview()
        self._refresh_audit()
        self._app.update_changes_badge()
