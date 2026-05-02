"""Tests for panels/cache_cdn.py — contract helpers and preview/audit logic."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from panels.cache_cdn import (
    DEFAULT_CACHE_CDN,
    DEFAULT_PAGE_TYPES,
    normalize_cache_cdn_config,
    build_policy_preview,
    list_page_type_targets,
    audit_cache_cdn_config,
)


class TestDefaults:
    def test_default_page_types_cover_semantic_route_groups(self):
        assert list(DEFAULT_PAGE_TYPES.keys()) == [
            "sitePages",
            "hubPages",
            "staticAssets",
            "images",
            "searchApi",
            "authAndSession",
            "userData",
            "apiFallback",
        ]

    def test_default_contract_uses_page_types_on_targets(self):
        targets = DEFAULT_CACHE_CDN["targets"]
        assert all("pageType" in target for target in targets)
        assert all("policy" not in target for target in targets)

    def test_default_contract_uses_best_practice_html_and_image_cache_rules(self):
        policies = DEFAULT_CACHE_CDN["policies"]
        assert policies["staticPages"]["mustRevalidate"] is True
        assert policies["hubPages"]["mustRevalidate"] is True
        assert policies["images"]["varyQuery"] == "none"


class TestNormalizeCacheCdnConfig:
    def test_adds_page_types_when_missing(self):
        result = normalize_cache_cdn_config({
            "policies": DEFAULT_CACHE_CDN["policies"],
            "targets": DEFAULT_CACHE_CDN["targets"],
        })

        assert result["pageTypes"] == DEFAULT_PAGE_TYPES

    def test_migrates_legacy_target_policy_to_page_type(self):
        result = normalize_cache_cdn_config({
            "policies": DEFAULT_CACHE_CDN["policies"],
            "targets": [
                {
                    "id": "search-api",
                    "label": "Search API",
                    "pathPatterns": ["/api/search*"],
                    "policy": "searchApi",
                }
            ],
        })

        assert result["targets"][0]["pageType"] == "searchApi"
        assert "policy" not in result["targets"][0]


class TestBuildPolicyPreview:
    def test_html_policy_preview_includes_must_revalidate(self):
        preview = build_policy_preview(DEFAULT_CACHE_CDN["policies"]["staticPages"])
        assert preview == "public, max-age=0, s-maxage=86400, must-revalidate"

    def test_public_policy_preview(self):
        preview = build_policy_preview(DEFAULT_CACHE_CDN["policies"]["searchApi"])
        assert preview == "public, max-age=60, s-maxage=300, stale-while-revalidate=300"

    def test_no_store_policy_preview(self):
        preview = build_policy_preview(DEFAULT_CACHE_CDN["policies"]["dynamicApis"])
        assert preview == "no-store"


class TestPageTypeTargets:
    def test_lists_targets_for_selected_page_type(self):
        patterns = list_page_type_targets(DEFAULT_CACHE_CDN, "userData")
        assert patterns == ["/api/user/*", "/api/vault/*"]


class TestAuditCacheCdnConfig:
    def test_flags_html_policies_without_must_revalidate(self):
        issues = audit_cache_cdn_config({
            **DEFAULT_CACHE_CDN,
            "policies": {
                **DEFAULT_CACHE_CDN["policies"],
                "staticPages": {
                    **DEFAULT_CACHE_CDN["policies"]["staticPages"],
                    "mustRevalidate": False,
                },
            },
        })

        assert any("must-revalidate" in issue.lower() for issue in issues)

    def test_flags_duplicate_path_patterns(self):
        issues = audit_cache_cdn_config({
            **DEFAULT_CACHE_CDN,
            "targets": [
                DEFAULT_CACHE_CDN["targets"][0],
                {
                    "id": "duplicate",
                    "label": "Duplicate",
                    "pageType": "sitePages",
                    "pathPatterns": ["*"],
                },
            ],
        })

        assert any("Duplicate path pattern" in issue for issue in issues)

    def test_flags_unknown_page_type_reference(self):
        issues = audit_cache_cdn_config({
            **DEFAULT_CACHE_CDN,
            "targets": [
                {
                    "id": "broken",
                    "label": "Broken",
                    "pageType": "missingPageType",
                    "pathPatterns": ["/broken/*"],
                }
            ],
        })

        assert any("unknown page type" in issue.lower() for issue in issues)
