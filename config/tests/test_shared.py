"""Tests for lib/shared.py — color tokens, font tokens, color helpers."""

import sys
from pathlib import Path

# Add config/ to path so lib imports work
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.shared import (
    C, F, hex_to_rgb, rgb_to_hsl, hsl_to_hex, derive_colors, darken,
    COLL_COLORS, COLL_LABELS, COLL_SHORT,
)


# ── Color Tokens ────────────────────────────────────────────────────────────

class TestColorTokens:
    EXPECTED = [
        "BASE", "MANTLE", "CRUST", "SURFACE0", "SURFACE1", "SURFACE2",
        "OVERLAY0", "OVERLAY1", "TEXT", "SUBTEXT1", "SUBTEXT0",
        "BLUE", "SAPPHIRE", "GREEN", "PEACH", "RED", "MAUVE", "TEAL",
        "YELLOW", "DROP", "CARD_BORDER",
    ]

    def test_has_all_tokens(self):
        for name in self.EXPECTED:
            assert hasattr(C, name), f"Missing C.{name}"

    def test_all_are_hex_strings(self):
        for name in self.EXPECTED:
            val = getattr(C, name)
            assert isinstance(val, str), f"C.{name} is not str"
            assert val.startswith("#"), f"C.{name} does not start with #"
            assert len(val) == 7, f"C.{name} length is {len(val)}, expected 7"

    def test_known_values(self):
        assert C.BASE == "#11111b"
        assert C.MANTLE == "#181825"
        assert C.TEXT == "#cdd6f4"
        assert C.GREEN == "#a6e3a1"
        assert C.PEACH == "#fab387"


# ── Font Tokens ─────────────────────────────────────────────────────────────

class TestFontTokens:
    EXPECTED = [
        "TITLE", "HEADING", "SUBHEADING", "BODY", "BODY_BOLD",
        "SMALL", "TINY", "MONO", "MONO_BOLD", "MONO_SMALL",
    ]

    def test_has_all_tokens(self):
        for name in self.EXPECTED:
            assert hasattr(F, name), f"Missing F.{name}"

    def test_all_are_tuples(self):
        for name in self.EXPECTED:
            val = getattr(F, name)
            assert isinstance(val, tuple), f"F.{name} is not tuple"
            assert len(val) in (2, 3), f"F.{name} has {len(val)} elements"
            assert isinstance(val[0], str), f"F.{name}[0] is not str"
            assert isinstance(val[1], int), f"F.{name}[1] is not int"


# ── Collection Constants ───────────────────────────────────────────────────

class TestCollectionConstants:
    def test_coll_colors_has_all(self):
        for key in ["reviews", "guides", "news", "brands", "games"]:
            assert key in COLL_COLORS

    def test_coll_labels_has_all(self):
        for key in ["reviews", "guides", "news", "brands", "games"]:
            assert key in COLL_LABELS

    def test_coll_short_has_all(self):
        for key in ["reviews", "guides", "news", "brands", "games"]:
            assert key in COLL_SHORT


# ── hex_to_rgb ──────────────────────────────────────────────────────────────

class TestHexToRgb:
    def test_red(self):
        assert hex_to_rgb("#ff0000") == (255, 0, 0)

    def test_black(self):
        assert hex_to_rgb("#000000") == (0, 0, 0)

    def test_white(self):
        assert hex_to_rgb("#ffffff") == (255, 255, 255)

    def test_blue_accent(self):
        assert hex_to_rgb("#89b4fa") == (137, 180, 250)

    def test_no_hash(self):
        assert hex_to_rgb("ff0000") == (255, 0, 0)


# ── rgb_to_hsl ──────────────────────────────────────────────────────────────

class TestRgbToHsl:
    def test_pure_red(self):
        h, s, l = rgb_to_hsl(255, 0, 0)
        assert abs(h - 0) < 1
        assert abs(s - 100) < 1
        assert abs(l - 50) < 1

    def test_pure_green(self):
        h, s, l = rgb_to_hsl(0, 255, 0)
        assert abs(h - 120) < 1
        assert abs(s - 100) < 1
        assert abs(l - 50) < 1

    def test_pure_blue(self):
        h, s, l = rgb_to_hsl(0, 0, 255)
        assert abs(h - 240) < 1
        assert abs(s - 100) < 1
        assert abs(l - 50) < 1

    def test_white(self):
        h, s, l = rgb_to_hsl(255, 255, 255)
        assert abs(s - 0) < 1
        assert abs(l - 100) < 1

    def test_black(self):
        h, s, l = rgb_to_hsl(0, 0, 0)
        assert abs(s - 0) < 1
        assert abs(l - 0) < 1


# ── hsl_to_hex ──────────────────────────────────────────────────────────────

class TestHslToHex:
    def test_pure_red(self):
        assert hsl_to_hex(0, 100, 50) == "#ff0000"

    def test_pure_green(self):
        assert hsl_to_hex(120, 100, 50) == "#00ff00"

    def test_pure_blue(self):
        assert hsl_to_hex(240, 100, 50) == "#0000ff"

    def test_roundtrip(self):
        """hex -> rgb -> hsl -> hex should be close to original."""
        for color in ["#ff9ff3", "#89b4fa", "#a6e3a1", "#fab387"]:
            r, g, b = hex_to_rgb(color)
            h, s, l = rgb_to_hsl(r, g, b)
            result = hsl_to_hex(h, s, l)
            # Allow ±1 in each channel due to rounding
            rr, rg, rb = hex_to_rgb(result)
            assert abs(rr - r) <= 1, f"{color}: R {r} -> {rr}"
            assert abs(rg - g) <= 1, f"{color}: G {g} -> {rg}"
            assert abs(rb - b) <= 1, f"{color}: B {b} -> {rb}"


# ── derive_colors ───────────────────────────────────────────────────────────

class TestDeriveColors:
    def test_returns_all_keys(self):
        result = derive_colors("#ff9ff3")
        expected_keys = {"base", "accent", "dark", "hover", "grad-start",
                         "soft", "highlight", "glow", "score-start",
                         "score-end", "score-rgba"}
        assert set(result.keys()) == expected_keys

    def test_base_equals_input(self):
        assert derive_colors("#ff9ff3")["base"] == "#ff9ff3"
        assert derive_colors("#89b4fa")["base"] == "#89b4fa"

    def test_score_start_equals_input(self):
        assert derive_colors("#ff9ff3")["score-start"] == "#ff9ff3"

    def test_hover_is_darker_than_base(self):
        result = derive_colors("#ff9ff3")
        base_r, _, _ = hex_to_rgb(result["base"])
        hover_r, _, _ = hex_to_rgb(result["hover"])
        # Hover should generally be darker (lower lightness)
        base_l = rgb_to_hsl(*hex_to_rgb(result["base"]))[2]
        hover_l = rgb_to_hsl(*hex_to_rgb(result["hover"]))[2]
        assert hover_l < base_l

    def test_highlight_is_rgba(self):
        result = derive_colors("#ff9ff3")
        assert result["highlight"].startswith("rgba(")

    def test_glow_is_rgba(self):
        result = derive_colors("#ff9ff3")
        assert result["glow"].startswith("rgba(")


# ── darken ──────────────────────────────────────────────────────────────────

class TestDarken:
    def test_white_half(self):
        result = darken("#ffffff", 0.5)
        r, g, b = hex_to_rgb(result)
        assert r == 127 and g == 127 and b == 127

    def test_red_seventy(self):
        result = darken("#ff0000", 0.7)
        r, g, b = hex_to_rgb(result)
        assert r == 178 and g == 0 and b == 0

    def test_black_stays_black(self):
        assert darken("#000000", 0.5) == "#000000"

    def test_default_factor(self):
        result = darken("#ffffff")
        r, g, b = hex_to_rgb(result)
        assert r == 178  # 255 * 0.7 = 178.5 -> 178
