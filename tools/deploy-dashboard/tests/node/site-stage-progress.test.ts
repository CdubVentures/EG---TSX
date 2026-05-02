import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applySiteStageProgressEvent,
  createEmptySiteStageProgress,
} from "../../ui/site-stage-progress.ts";

describe("applySiteStageProgressEvent", () => {
  it("does not regress manual CDN flush progress when invalidation submission restarts at zero", () => {
    const before = {
      ...createEmptySiteStageProgress(),
      cdn: 12,
    };

    const after = applySiteStageProgressEvent(before, {
      progress: 0,
      stage: "cdn",
    });

    assert.deepEqual(after, before);
  });

  it("advances CDN progress once CloudFront polling reports forward movement", () => {
    const before = {
      ...createEmptySiteStageProgress(),
      cdn: 12,
    };

    const after = applySiteStageProgressEvent(before, {
      progress: 30,
      stage: "cdn",
    });

    assert.equal(after.cdn, 30);
  });

  it("clamps invalid stage progress values into the dashboard range", () => {
    const after = applySiteStageProgressEvent(createEmptySiteStageProgress(), {
      progress: 101.8,
      stage: "sync",
    });

    assert.equal(after.sync, 100);
  });
});

