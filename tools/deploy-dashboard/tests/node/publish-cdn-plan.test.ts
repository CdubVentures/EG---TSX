import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildInstantPublishCdnPlan } from "../../ui/publish-cdn-plan.ts";

describe("buildInstantPublishCdnPlan", () => {
  it("builds a smart data publish plan from pending content files", () => {
    const plan = buildInstantPublishCdnPlan({
      pendingFiles: [
        { path: "src/content/reviews/logitech/g502x/index.mdx", category: "content", file_type: "MODIFIED" },
        { path: "src/content/guides/mice/index.mdx", category: "content", file_type: "MODIFIED" },
      ],
      profile: "s3-data-publish",
    });

    assert.equal(plan.mode, "SMART");
    assert.deepEqual(plan.paths, ["/reviews/*", "/guides/*", "/_astro/*"]);
  });

  it("builds a smart image publish plan from pending image files", () => {
    const plan = buildInstantPublishCdnPlan({
      pendingFiles: [
        { path: "public/images/reviews/logitech/g502x/hero.webp", category: "image", file_type: "MODIFIED" },
      ],
      profile: "s3-image-publish",
    });

    assert.equal(plan.mode, "SMART");
    assert.deepEqual(plan.paths, ["/reviews/logitech/g502x*"]);
  });

  it("builds the same smart data queue plan for s3 data rebuild", () => {
    const plan = buildInstantPublishCdnPlan({
      pendingFiles: [
        { path: "src/content/reviews/logitech/g502x/index.mdx", category: "content", file_type: "MODIFIED" },
        { path: "src/content/guides/mice/index.mdx", category: "content", file_type: "MODIFIED" },
      ],
      profile: "s3-data-rebuild",
    });

    assert.equal(plan.mode, "SMART");
    assert.deepEqual(plan.paths, ["/reviews/*", "/guides/*", "/_astro/*"]);
  });

  it("builds the same smart image queue plan for s3 image rebuild", () => {
    const plan = buildInstantPublishCdnPlan({
      pendingFiles: [
        { path: "public/images/reviews/logitech/g502x/hero.webp", category: "image", file_type: "MODIFIED" },
      ],
      profile: "s3-image-rebuild",
    });

    assert.equal(plan.mode, "SMART");
    assert.deepEqual(plan.paths, ["/reviews/logitech/g502x*"]);
  });

  it("returns no plan when there is no supported publish scope", () => {
    const plan = buildInstantPublishCdnPlan({
      pendingFiles: [
        { path: "src/content/reviews/logitech/g502x/index.mdx", category: "content", file_type: "MODIFIED" },
      ],
      profile: "astro-publish",
    });

    assert.deepEqual(plan.paths, []);
  });
});

