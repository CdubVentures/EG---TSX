"""Tests for the React desktop config shell backend."""

import json
import shutil
import sys
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "app"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import main
from runtime import ConfigRuntime


def _make_test_root(tmp: Path) -> Path:
    data_dir = tmp / "config" / "data"
    data_dir.mkdir(parents=True)

    categories = {
        "siteColors": {"primary": "#a6e3a1", "secondary": "#21c55e"},
        "categories": [
            {
                "id": "mouse",
                "label": "Mouse",
                "plural": "Mice",
                "color": "#00aeff",
                "product": {"production": True, "vite": True},
                "content": {"production": True, "vite": True},
                "collections": {
                    "dataProducts": True,
                    "reviews": True,
                    "guides": True,
                    "news": True,
                },
            }
        ],
    }
    (data_dir / "categories.json").write_text(
        json.dumps(categories, indent=2),
        encoding="utf-8",
    )

    content = {"slots": {}, "pinned": [], "badges": {}, "excluded": []}
    (data_dir / "content.json").write_text(
        json.dumps(content, indent=2),
        encoding="utf-8",
    )

    for name in [
        "slideshow.json",
        "hub-tools.json",
        "navbar-guide-sections.json",
        "image-defaults.json",
        "ads-registry.json",
        "inline-ads-config.json",
        "cache-cdn.json",
        "direct-sponsors.json",
    ]:
        (data_dir / name).write_text("{}", encoding="utf-8")

    (data_dir / "settings.json").write_text(
        '{"theme": "legacy-clone"}', encoding="utf-8"
    )

    (tmp / "src" / "content").mkdir(parents=True)
    (tmp / "public" / "images" / "navbar").mkdir(parents=True)
    return tmp


class TestReactDesktopApi:
    def test_bootstrap_endpoint_reflects_checked_in_theme_setting(self):
        client = TestClient(main.app)

        response = client.get("/api/bootstrap")

        assert response.status_code == 200
        payload = response.json()
        settings_path = Path(main.runtime.project_root) / "config" / "data" / "settings.json"
        settings = json.loads(settings_path.read_text(encoding="utf-8"))
        assert payload["shell"]["theme"]["id"] == settings["theme"]
        assert payload["panels"]["categories"]["categoryCount"] >= 1

    def test_runtime_auto_discovers_missing_categories(self):
        tmp = Path(tempfile.mkdtemp())
        try:
            root = _make_test_root(tmp)
            review_dir = root / "src" / "content" / "reviews" / "new-monitor"
            review_dir.mkdir(parents=True)
            (review_dir / "index.md").write_text(
                "---\ncategory: monitor\n---\nBody",
                encoding="utf-8",
            )

            runtime = ConfigRuntime(root)
            payload = runtime.get_categories_payload()
            category_ids = {category["id"] for category in payload["categories"]}

            assert "monitor" in category_ids
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_runtime_save_categories_writes_normalized_payload(self):
        tmp = Path(tempfile.mkdtemp())
        try:
            root = _make_test_root(tmp)
            runtime = ConfigRuntime(root)

            response = runtime.save_categories({
                "siteColors": {"primary": "#ABCDEF", "secondary": "123456"},
                "categories": [
                    {
                        "id": "mouse",
                        "label": "Mouse",
                        "plural": "Mice",
                        "color": "ff00ff",
                        "product": {"production": True},
                        "content": {"vite": True},
                        "collections": {"reviews": True},
                    }
                ],
            })

            on_disk = json.loads(
                (root / "config" / "data" / "categories.json").read_text(
                    encoding="utf-8"
                )
            )

            assert on_disk["siteColors"]["primary"] == "#abcdef"
            assert on_disk["siteColors"]["secondary"] == "#123456"
            assert on_disk["categories"][0]["color"] == "#ff00ff"
            assert on_disk["categories"][0]["collections"] == {
                "dataProducts": False,
                "reviews": True,
                "guides": False,
                "news": False,
            }
            assert response["panel"]["categoryCount"] == 1
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_runtime_hub_tools_payload_scaffolds_defaults_for_product_categories(self):
        tmp = Path(tempfile.mkdtemp())
        try:
            root = _make_test_root(tmp)
            runtime = ConfigRuntime(root)

            payload = runtime.get_hub_tools_payload()

            assert any(category["id"] == "mouse" for category in payload["categories"])
            assert len(payload["toolTypes"]) == 5
            assert "mouse" in payload["tools"]
            assert len(payload["tools"]["mouse"]) == 5
            assert payload["tools"]["mouse"][0]["tool"] == "hub"
            assert payload["tools"]["mouse"][0]["url"] == "/hubs/mouse"
            assert "hub" in payload["tooltips"]
            assert "all" in payload["index"]
            assert "hub" in payload["index"]
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_runtime_preview_hub_tools_does_not_mutate_disk(self):
        tmp = Path(tempfile.mkdtemp())
        try:
            root = _make_test_root(tmp)
            runtime = ConfigRuntime(root)
            hub_tools_path = root / "config" / "data" / "hub-tools.json"

            before_disk = hub_tools_path.read_text(encoding="utf-8")
            baseline = runtime.get_hub_tools_payload()

            response = runtime.preview_hub_tools({
                "tools": {
                    "mouse": [
                        {
                            **baseline["tools"]["mouse"][0],
                            "title": "Mouse Hub Preview",
                        }
                    ]
                },
                "tooltips": {
                    **baseline["tooltips"],
                    "hub": "Preview tooltip",
                },
                "index": {
                    **baseline["index"],
                    "all": ["mouse:hub"],
                    "hub": ["mouse:hub"],
                },
            })

            assert response["panel"]["tools"]["mouse"][0]["title"] == "Mouse Hub Preview"
            assert response["panel"]["tooltips"]["hub"] == "Preview tooltip"
            assert response["panel"]["index"]["hub"] == ["mouse:hub"]
            assert hub_tools_path.read_text(encoding="utf-8") == before_disk
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_runtime_save_hub_tools_persists_tools_tooltips_and_index(self):
        tmp = Path(tempfile.mkdtemp())
        try:
            root = _make_test_root(tmp)
            runtime = ConfigRuntime(root)
            hub_tools_path = root / "config" / "data" / "hub-tools.json"
            baseline = runtime.get_hub_tools_payload()

            response = runtime.save_hub_tools({
                "tools": {
                    "mouse": [
                        {
                            **baseline["tools"]["mouse"][0],
                            "title": "Mouse Hub Saved",
                            "navbar": False,
                        }
                    ]
                },
                "tooltips": {
                    **baseline["tooltips"],
                    "hub": "Saved tooltip copy",
                },
                "index": {
                    **baseline["index"],
                    "all": ["mouse:hub"],
                    "hub": ["mouse:hub"],
                },
            })

            on_disk = json.loads(hub_tools_path.read_text(encoding="utf-8"))

            assert response["panel"]["tools"]["mouse"][0]["title"] == "Mouse Hub Saved"
            assert response["panel"]["tools"]["mouse"][0]["navbar"] is False
            assert response["panel"]["tooltips"]["hub"] == "Saved tooltip copy"
            assert response["panel"]["index"]["hub"] == ["mouse:hub"]
            assert on_disk["mouse"][0]["title"] == "Mouse Hub Saved"
            assert on_disk["mouse"][0]["navbar"] is False
            assert on_disk["_tooltips"]["hub"] == "Saved tooltip copy"
            assert on_disk["_index"]["hub"] == ["mouse:hub"]
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_content_preview_exclusions_propagate_to_index_heroes_before_save(self):
        tmp = Path(tempfile.mkdtemp())
        try:
            root = _make_test_root(tmp)
            review_dir = root / "src" / "content" / "reviews" / "review-a"
            review_dir.mkdir(parents=True)
            (review_dir / "index.md").write_text(
                "\n".join([
                    "---",
                    "title: Review A",
                    "category: mouse",
                    "datePublished: 2025-01-02",
                    "hero: review-a",
                    "publish: true",
                    "draft: false",
                    "---",
                    "Body",
                    "",
                ]),
                encoding="utf-8",
            )

            runtime = ConfigRuntime(root)

            before = runtime.get_index_heroes_payload()
            assert [item["key"] for item in before["pools"]["reviews"]] == [
                "reviews:review-a"
            ]

            runtime.preview_content({
                "manualSlots": {},
                "pinned": [],
                "badges": {},
                "excluded": ["reviews:review-a"],
            })

            after = runtime.get_index_heroes_payload()
            assert [item["key"] for item in after["pools"]["reviews"]] == []
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_content_preview_pins_and_badges_propagate_to_index_heroes_before_save(self):
        tmp = Path(tempfile.mkdtemp())
        try:
            root = _make_test_root(tmp)
            review_dir = root / "src" / "content" / "reviews" / "review-a"
            review_dir.mkdir(parents=True)
            (review_dir / "index.md").write_text(
                "\n".join([
                    "---",
                    "title: Review A",
                    "category: mouse",
                    "datePublished: 2025-01-02",
                    "hero: review-a",
                    "publish: true",
                    "draft: false",
                    "---",
                    "Body",
                    "",
                ]),
                encoding="utf-8",
            )

            runtime = ConfigRuntime(root)

            runtime.preview_content({
                "manualSlots": {},
                "pinned": ["reviews:review-a"],
                "badges": {"reviews:review-a": "Preview Badge"},
                "excluded": [],
            })

            panel = runtime.get_index_heroes_payload()
            review = panel["pools"]["reviews"][0]
            assert review["key"] == "reviews:review-a"
            assert review["isPinned"] is True
            assert review["badge"] == "Preview Badge"
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_save_theme_persists_and_reflects_in_shell(self):
        tmp = Path(tempfile.mkdtemp())
        try:
            root = _make_test_root(tmp)
            rt = ConfigRuntime(root)

            shell = rt.get_shell_payload()
            assert shell["theme"]["id"] == "legacy-clone-dark"

            updated_shell = rt.save_theme("pip-boy-dark")
            assert updated_shell["theme"]["id"] == "pip-boy-dark"
            assert updated_shell["theme"]["label"] == "Pip-Boy Dark"

            settings_path = root / "config" / "data" / "settings.json"
            on_disk = json.loads(settings_path.read_text(encoding="utf-8"))
            assert on_disk["theme"] == "pip-boy-dark"

            refreshed = rt.get_shell_payload()
            assert refreshed["theme"]["id"] == "pip-boy-dark"

            rt.save_theme("invalid-theme")
            fallback = rt.get_shell_payload()
            assert fallback["theme"]["id"] == "legacy-clone-dark"
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
