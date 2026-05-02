import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bindInvalidationToActiveGroup,
  createEmptyCdnPathResolutionState,
  getCdnPathStateLabel,
  rememberCdnGroupPaths,
  resolveInvalidationPaths,
} from "../../ui/cdn-path-status.ts";

describe("cdn path status resolution", () => {
  it("marks each path in a completed invalidation group as cleared", () => {
    const grouped = rememberCdnGroupPaths(
      createEmptyCdnPathResolutionState(),
      ["/reviews/*", "/guides/*"],
    );
    const bound = bindInvalidationToActiveGroup(grouped, "I123");
    const resolved = resolveInvalidationPaths(bound, "I123", "COMPLETED");

    assert.equal(getCdnPathStateLabel(resolved, "/reviews/*"), "cleared");
    assert.equal(getCdnPathStateLabel(resolved, "/guides/*"), "cleared");
    assert.deepEqual(resolved.activeGroupPaths, []);
  });

  it("marks unverified invalidation paths distinctly", () => {
    const grouped = rememberCdnGroupPaths(
      createEmptyCdnPathResolutionState(),
      ["/api/*", "/api/search*"],
    );
    const bound = bindInvalidationToActiveGroup(grouped, "I999");
    const resolved = resolveInvalidationPaths(bound, "I999", "UNVERIFIED");

    assert.equal(getCdnPathStateLabel(resolved, "/api/*"), "unverified");
    assert.equal(getCdnPathStateLabel(resolved, "/api/search*"), "unverified");
  });

  it("shows paths in the current group as in-flight before completion", () => {
    const grouped = rememberCdnGroupPaths(
      createEmptyCdnPathResolutionState(),
      ["/static/*"],
    );

    assert.equal(getCdnPathStateLabel(grouped, "/static/*"), "in-flight");
    assert.equal(getCdnPathStateLabel(grouped, "/fonts/*"), "planned");
  });
});

