import assert from "node:assert/strict";
import test from "node:test";

import {
  cloudProjectToPattern,
  cloudRowToProgress,
  patternToCloudProject,
  progressToCloudRow,
} from "../core/cloud-project-mapper.js";

test("maps a local pattern to the cloud schema and back", () => {
  const pattern = {
    id: "58ceea09-a4da-4f45-b2ba-9a92454fcbf1",
    name: "Portrait",
    sequence: [1, 50, 25],
    pointCount: 240,
    lineCount: 2,
    algorithm: "reference-v7",
    threadMm: 0.19,
    sharpness: 15,
    clarity: 10,
  };
  const row = patternToCloudProject(pattern, "user-id", {
    source: "user-id/project/source.jpg",
    artwork: "user-id/project/artwork.png",
  });

  assert.equal(row.user_id, "user-id");
  assert.deepEqual(row.settings, { threadMm: 0.19, sharpness: 15, clarity: 10 });
  assert.deepEqual(cloudProjectToPattern({
    ...row,
    created_at: "2026-07-28T10:00:00Z",
    updated_at: "2026-07-28T11:00:00Z",
  }, { artwork: "signed-artwork" }), {
    ...pattern,
    sourcePreviewDataUrl: null,
    artworkPreviewDataUrl: "signed-artwork",
    createdAt: "2026-07-28T10:00:00Z",
    updatedAt: "2026-07-28T11:00:00Z",
  });
});

test("maps build progress in both directions", () => {
  const progress = {
    patternId: "project-id",
    stepIndex: 120,
    speedMs: 1500,
    voiceEnabled: false,
  };
  const row = progressToCloudRow(progress, "user-id");
  assert.deepEqual(row, {
    project_id: "project-id",
    user_id: "user-id",
    step_index: 120,
    speed_ms: 1500,
    voice_enabled: false,
  });
  assert.deepEqual(cloudRowToProgress({ ...row, updated_at: "now" }), {
    ...progress,
    updatedAt: "now",
  });
});
