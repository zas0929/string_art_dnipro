import test from "node:test";
import assert from "node:assert/strict";
import { getCrossedBuildCheckpoints } from "../core/build-checkpoints.js";

test("reports a checkpoint when build progress crosses it", () => {
  assert.deepEqual(getCrossedBuildCheckpoints(3480, 3520, 5000), [3500]);
});

test("reports both checkpoints when a seek crosses both", () => {
  assert.deepEqual(getCrossedBuildCheckpoints(3400, 4050, 5000), [3500, 4000]);
});

test("does not report checkpoints while rewinding or beyond the pattern length", () => {
  assert.deepEqual(getCrossedBuildCheckpoints(3700, 3400, 5000), []);
  assert.deepEqual(getCrossedBuildCheckpoints(3900, 4100, 3800), []);
});
