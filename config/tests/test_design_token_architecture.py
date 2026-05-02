"""Design token architecture guardrails for React UI panels."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
UI_DIR = ROOT / "ui"
APP_CSS = UI_DIR / "app.css"
APP_TSX = UI_DIR / "app.tsx"
PANELS_TSX = UI_DIR / "panels.tsx"
SHARED_UI_TSX = UI_DIR / "shared-ui.tsx"


def _extract_theme_block(css: str, selector: str) -> str:
    marker = f"{selector} {{"
    start = css.find(marker)
    assert start != -1, f"Missing theme selector: {selector}"

    block_start = start + len(marker)
    depth = 1
    idx = block_start
    while idx < len(css) and depth > 0:
        char = css[idx]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
        idx += 1
    assert depth == 0, f"Unclosed CSS block for {selector}"
    return css[block_start : idx - 1]


def test_theme_token_sets_cover_skin_and_skeleton_contract():
    css = APP_CSS.read_text(encoding="utf-8")
    legacy = _extract_theme_block(css, "html[data-theme=\"legacy-clone\"]")
    arcade = _extract_theme_block(css, "html[data-theme=\"arcade-neon\"]")

    required_legacy_tokens = [
        # Palette
        "--color-base",
        "--color-mantle",
        "--color-crust",
        "--color-surface-0",
        "--color-surface-1",
        "--color-surface-2",
        "--color-overlay-0",
        "--color-overlay-1",
        "--color-text",
        "--color-subtext-0",
        "--color-subtext-1",
        "--theme-site-primary",
        "--theme-site-secondary",
        "--status-success",
        "--status-warning",
        "--status-error",
        "--status-neutral",
        # Typography
        "--font-ui",
        "--font-mono",
        "--font-weight-regular",
        "--font-weight-medium",
        "--font-weight-bold",
        "--font-size-body",
        "--font-size-small",
        "--font-size-tiny",
        # Elevation + geometry
        "--border-width-hairline",
        "--border-width-strong",
        "--radius-control",
        "--radius-surface",
        "--radius-dialog",
        "--radius-round",
        "--shadow-none",
        "--shadow-card",
        "--shadow-dialog",
        "--shadow-toast",
        "--z-shell",
        "--z-dialog",
        "--z-toast",
        # Opacity
        "--opacity-drag-ghost",
        "--opacity-dragging",
        "--opacity-muted",
        "--opacity-disabled-card",
        "--opacity-disabled",
        "--opacity-disabled-deep",
        "--opacity-placeholder",
        # Color-mix intensity
        "--tint-8",
        "--tint-12",
        "--tint-20",
        "--tint-70",
        # Iconography tokens
        "--sidebar-icon-stroke-width",
        "--inline-icon-stroke-width",
        "--category-preview-icon-size",
        "--category-preview-icon-stroke-width",
        # Skeleton density controls
        "--sidebar-width",
        "--context-height",
        "--status-height",
        "--page-padding-x",
        "--page-padding-y",
        "--card-grid-gap",
        "--content-pool-row-height",
        "--content-pool-type-col-width",
    ]

    for token in required_legacy_tokens:
        assert token in legacy, f"Missing legacy-clone token: {token}"

    required_skin_tokens = [
        "--font-ui",
        "--font-mono",
        "--font-weight-regular",
        "--font-weight-medium",
        "--font-weight-bold",
        "--color-base",
        "--color-mantle",
        "--color-crust",
        "--color-surface-0",
        "--color-surface-1",
        "--color-surface-2",
        "--color-overlay-0",
        "--color-overlay-1",
        "--color-text",
        "--color-subtext-0",
        "--color-subtext-1",
        "--theme-site-primary",
        "--theme-site-secondary",
        "--theme-site-primary-hover",
        "--theme-site-primary-dark",
        "--status-success",
        "--status-warning",
        "--status-error",
        "--status-neutral",
        "--radius-control",
        "--radius-surface",
        "--radius-dialog",
        "--shadow-card",
        "--shadow-dialog",
        "--shadow-toast",
        "--sidebar-icon-stroke-width",
        "--inline-icon-stroke-width",
        "--category-preview-icon-size",
        "--category-preview-icon-stroke-width",
    ]

    pipboy = _extract_theme_block(css, "html[data-theme=\"pip-boy\"]")

    for token in required_skin_tokens:
        assert token in arcade, f"Missing arcade-neon skin token override: {token}"
    for token in required_skin_tokens:
        assert token in pipboy, f"Missing pip-boy skin token override: {token}"

    locked_skeleton_tokens = [
        "--sidebar-width",
        "--context-height",
        "--status-height",
        "--content-pool-row-height",
        "--content-pool-type-col-width",
        "--card-grid-gap",
    ]
    for token in locked_skeleton_tokens:
        assert token not in arcade, f"Skeleton token drifted into arcade override: {token}"
    for token in locked_skeleton_tokens:
        assert token not in pipboy, f"Skeleton token drifted into pip-boy override: {token}"


def test_legacy_clone_theme_is_hard_locked_flat():
    css = APP_CSS.read_text(encoding="utf-8")
    legacy = _extract_theme_block(css, "html[data-theme=\"legacy-clone\"]")

    assert "--radius-control: 0px;" in legacy
    assert "--radius-surface: 0px;" in legacy
    assert "--radius-dialog: 0px;" in legacy
    assert "--shadow-none: none;" in legacy
    assert "--shadow-card: none;" in legacy
    assert "--shadow-dialog: none;" in legacy
    assert "--shadow-toast: none;" in legacy


def test_react_components_do_not_hardcode_skin_visual_values():
    pattern = re.compile(
        r"(#[0-9a-fA-F]{3,8})|"
        r"(rgba?\()|"
        r"(boxShadow\s*:)|"
        r"(borderRadius\s*:)|"
        r"(fontFamily\s*:)",
        re.MULTILINE,
    )

    # Strip THEME_REGISTRY metadata from app.tsx — preview swatches contain hex
    # values by design (they describe theme identity, not style components)
    registry_pattern = re.compile(
        r"const THEME_REGISTRY.*?^];",
        re.MULTILINE | re.DOTALL,
    )

    for path in [APP_TSX, PANELS_TSX, SHARED_UI_TSX]:
        text = path.read_text(encoding="utf-8")
        if path == APP_TSX:
            text = registry_pattern.sub("", text)
        assert not pattern.search(text), f"Hardcoded visual value detected in {path.name}"


def test_css_rules_do_not_hardcode_border_radius_or_opacity():
    """CSS rules (outside token definitions) must use var() for border-radius and opacity."""
    css = APP_CSS.read_text(encoding="utf-8")

    # Strip both theme definition blocks — only check usage rules
    stripped = css
    for selector in [
        ':root,\nhtml[data-theme="legacy-clone"]',
        'html[data-theme="arcade-neon"]',
        'html[data-theme="pip-boy"]',
    ]:
        block = _extract_theme_block(stripped, selector)
        stripped = stripped.replace(block, "")

    # border-radius: must use var() — allow only 0 (explicit reset, though we prefer tokens)
    hardcoded_radius = re.findall(
        r"border-radius:\s*(\d+(?:\.\d+)?(?:px|em|rem|%));",
        stripped,
    )
    assert not hardcoded_radius, (
        f"Hardcoded border-radius in CSS rules (use token): {hardcoded_radius}"
    )

    # opacity: must use var() — allow 0 and 1 (structural show/hide transitions)
    hardcoded_opacity = re.findall(
        r"opacity:\s*(0\.\d+);",
        stripped,
    )
    assert not hardcoded_opacity, (
        f"Hardcoded opacity in CSS rules (use token): {hardcoded_opacity}"
    )


def test_iconography_is_theme_wired_for_nav_action_and_status_icons():
    app_text = APP_TSX.read_text(encoding="utf-8")
    shared_text = SHARED_UI_TSX.read_text(encoding="utf-8")
    panels_text = PANELS_TSX.read_text(encoding="utf-8")

    assert "const NAV_ICON_SETS: Record<IconThemeId" in app_text
    assert "'legacy-clone': LEGACY_NAV_ICONS" in app_text
    assert "'arcade-neon': ARCADE_NEON_NAV_ICONS" in app_text
    assert "'pip-boy': LEGACY_NAV_ICONS" in app_text

    assert "const ICON_PATHS: Record<IconThemeId" in shared_text
    assert "PinIcon" in shared_text
    assert "LockIcon" in shared_text
    assert "AutoIcon" in shared_text
    assert "StarIcon" in shared_text
    assert "CategoryPreviewIcon" in shared_text
    assert "CATEGORY_PREVIEW_PATHS: Record<IconThemeId" in shared_text

    assert "import {" in panels_text and "CategoryPreviewIcon" in panels_text
