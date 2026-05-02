"""
Artifact tests for the GUI test completion package.

These tests lock the deliverables requested for the deploy-dashboard QA pass:
- one canonical GUI test ledger/checklist
- realistic markdown and data sample content used to document/demo states
"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
LEDGER_PATH = ROOT / "docs" / "GUI-TEST-LEDGER.md"
SAMPLE_ROOT = ROOT / "docs" / "sample-content"


CHECKLIST_AREAS = [
    "A. App boot and baseline rendering",
    "B. Top bar / sticky header",
    "C. Deployment Vitals panel",
    "D. S3 State & Sync panel",
    "E. Lambda Command Center",
    "F. Action buttons",
    "G. Operation Storyboard",
    "H. Terminal Log tab",
    "I. Page Build Matrix tab",
    "J. Category Rings tab",
    "K. S3 Sync tab",
    "L. CDN tab",
    "M. Completion Summary",
    "N. Right Sidebar",
    "O. Footer",
    "P. Visual system and UI quality",
    "Q. Responsiveness and resilience",
    "R. API and backend contract validation",
    "S. SSE behavior",
    "T. Polling behavior",
    "U. Full end-to-end scenario runs",
]


SCENARIOS = [
    "1. Clean idle dashboard",
    "2. Pending file changes detected",
    "3. Product data changes detected",
    "4. Lambda changes detected",
    "5. Quick publish success",
    "6. Full rebuild success",
    "7. CDN-only invalidation success",
    "8. Cache purge success",
    "9. Build failure path",
    "10. Sync failure path",
    "11. CDN failure path",
    "12. Reset during active build",
    "13. Reset after failed build",
    "14. Re-run after failure and succeed",
    "15. Long, noisy log stream under load",
    "16. Large page matrix data set",
    "17. Large changed-files data set",
    "18. Mixed upload/delete S3 run",
    "19. Lambda deploy simulated success",
    "20. Lambda deploy simulated failure",
]


def test_gui_ledger_exists():
    assert LEDGER_PATH.is_file(), f"Missing canonical GUI test ledger: {LEDGER_PATH}"


def test_gui_ledger_contains_full_checklist():
    text = LEDGER_PATH.read_text(encoding="utf-8")

    for heading in [
        "## Execution Summary",
        "## Checklist Coverage",
        "## Sample Content Inventory",
        "## Automated Suite",
        "## Live GUI Suite",
        "## Defects / Fixes / Retests",
        "## Final Conclusion",
    ]:
        assert heading in text, f"Missing ledger heading: {heading}"

    for area in CHECKLIST_AREAS:
        assert area in text, f"Missing checklist area: {area}"

    for scenario in SCENARIOS:
        assert scenario in text, f"Missing scenario line: {scenario}"


def test_gui_ledger_records_green_results():
    text = LEDGER_PATH.read_text(encoding="utf-8")

    assert "2026-03-07" in text
    assert "python -m pytest tests -q" in text
    assert "138 passed" in text
    assert "python tests/live_gui_runner.py" in text
    assert "93/93 passed (100.0%)" in text
    assert (
        "All GUI areas, states, interactions, streams, buttons, panels, tabs, "
        "and supporting test scenarios have been fully tested, defects were "
        "fixed as found, regression was re-run, and the dashboard reached a "
        "100% success rate."
    ) in text


def test_markdown_samples_exist_and_are_realistic():
    markdown_samples = {
        SAMPLE_ROOT / "reviews" / "razer-viper-v3-pro.md": [
            "title:",
            "slug:",
            "category: review",
            "## Verdict",
        ],
        SAMPLE_ROOT / "guides" / "best-gaming-mice-2026.md": [
            "title:",
            "slug:",
            "category: guide",
            "## How we tested",
        ],
        SAMPLE_ROOT / "news" / "march-deploy-readiness.md": [
            "title:",
            "slug:",
            "category: news",
            "## Why it matters",
        ],
    }

    for path, required_tokens in markdown_samples.items():
        assert path.is_file(), f"Missing markdown sample: {path}"
        text = path.read_text(encoding="utf-8")
        assert len(text.split()) >= 80, f"Sample is too thin: {path}"
        for token in required_tokens:
            assert token in text, f"Missing token '{token}' in {path}"


def test_data_samples_cover_product_and_changed_file_states():
    product_path = SAMPLE_ROOT / "data-products" / "mice" / "razer-viper-v3-pro.json"
    changed_files_path = SAMPLE_ROOT / "status" / "changed-files.json"

    assert product_path.is_file(), f"Missing product data sample: {product_path}"
    product = json.loads(product_path.read_text(encoding="utf-8"))
    for key in ["slug", "sku", "brand", "category", "name", "price", "specs"]:
        assert key in product, f"Missing product field '{key}'"
    assert product["category"] == "mouse"
    assert isinstance(product["specs"], dict) and product["specs"]

    assert changed_files_path.is_file(), f"Missing changed-files sample: {changed_files_path}"
    changed_files = json.loads(changed_files_path.read_text(encoding="utf-8"))
    assert isinstance(changed_files, list) and len(changed_files) >= 12

    categories = {item["category"] for item in changed_files}
    for required in {"api", "auth", "search", "product", "review", "guide", "news", "shared", "image"}:
        assert required in categories, f"Missing changed-file category '{required}'"
