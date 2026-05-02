import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendQueuedCdnPlan,
  createEmptyQueuedCdnState,
  hydrateQueuedCdnState,
  markQueuedCdnStateRunning,
} from "../../ui/queued-cdn-state.ts";

describe("appendQueuedCdnPlan", () => {
  it("accumulates smart publish paths across standalone split publishes", () => {
    const firstState = appendQueuedCdnPlan(createEmptyQueuedCdnState(), {
      label: "S3 Data Publish",
      plan: {
        mode: "SMART",
        paths: ["/reviews/*", "/guides/*", "/_astro/*"],
        reason: "",
        sourceProfile: "s3-data-publish",
      },
    });

    const secondState = appendQueuedCdnPlan(firstState, {
      label: "S3 Image Publish",
      plan: {
        mode: "SMART",
        paths: ["/reviews/logitech/g502x*", "/_astro/*"],
        reason: "",
        sourceProfile: "s3-image-publish",
      },
    });

    assert.equal(secondState.mode, "SMART");
    assert.deepEqual(secondState.paths, [
      "/reviews/*",
      "/guides/*",
      "/_astro/*",
      "/reviews/logitech/g502x*",
    ]);
    assert.equal(secondState.entries.length, 2);
    assert.equal(secondState.logLines.length, 2);
    assert.equal(secondState.status, "QUEUED");
  });

  it("promotes the queued state to full when any queued plan requires a full invalidation", () => {
    const state = appendQueuedCdnPlan(createEmptyQueuedCdnState(), {
      label: "S3 Data Publish",
      plan: {
        mode: "FULL",
        paths: ["/reviews/*", "/guides/*"],
        reason: "",
        sourceProfile: "s3-data-publish",
      },
    });

    assert.equal(state.mode, "FULL");
    assert.deepEqual(state.paths, ["/reviews/*", "/guides/*"]);
    assert.equal(state.logLines[0], "[queue] S3 Data Publish queued 2 CDN path(s)");
    assert.equal(state.entries[0].status, "QUEUED");
  });

  it("ignores empty publish plans", () => {
    const state = appendQueuedCdnPlan(createEmptyQueuedCdnState(), {
      label: "S3 Data Publish",
      plan: {
        mode: "",
        paths: [],
        reason: "",
        sourceProfile: "s3-data-publish",
      },
    });

    assert.deepEqual(state, createEmptyQueuedCdnState());
  });
});

describe("hydrateQueuedCdnState", () => {
  it("restores persisted queue entries from the backend payload", () => {
    const state = hydrateQueuedCdnState({
      activeAction: "",
      entries: [
        {
          id: "queue-1",
          label: "S3 Data Publish",
          mode: "SMART",
          paths: ["/guides/*", "/_astro/*"],
          reason: "Built CDN-facing routes from the static sync diff.",
          sourceProfile: "s3-data-publish",
          status: "QUEUED",
          queuedAt: "2026-03-08T00:00:00Z",
          startedAt: "",
        },
      ],
    });

    assert.equal(state.status, "QUEUED");
    assert.equal(state.entries.length, 1);
    assert.equal(state.entries[0].label, "S3 Data Publish");
    assert.equal(state.logLines[0], "[queue] S3 Data Publish queued 2 CDN path(s)");
  });
});

describe("markQueuedCdnStateRunning", () => {
  it("marks queued entries as running without clearing their planned paths", () => {
    const queuedState = appendQueuedCdnPlan(createEmptyQueuedCdnState(), {
      label: "S3 Image Publish",
      plan: {
        mode: "SMART",
        paths: ["/news/mouse/*"],
        reason: "",
        sourceProfile: "s3-image-publish",
      },
    });

    const runningState = markQueuedCdnStateRunning(queuedState, "CDN Publish");

    assert.equal(runningState.status, "RUNNING");
    assert.equal(runningState.activeAction, "CDN Publish");
    assert.equal(runningState.entries[0].status, "RUNNING");
    assert.equal(runningState.logLines[0], "[queue] S3 Image Publish running 1 CDN path(s)");
    assert.deepEqual(runningState.paths, ["/news/mouse/*"]);
  });
});

