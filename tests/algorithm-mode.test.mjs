import assert from "node:assert/strict";
import test from "node:test";

import {
  SUPPORTED_ALGORITHMS,
  canRefineAlgorithm,
  isMultiScaleAlgorithm,
  isOpticalAlgorithm,
} from "../core/algorithm-mode.js";

test("keeps v5 stable and gates weak-segment refinement to v6", () => {
  assert.deepEqual(SUPPORTED_ALGORITHMS, [
    "portrait-v4",
    "portrait-v5",
    "portrait-v6",
  ]);
  assert.equal(isOpticalAlgorithm("portrait-v5"), true);
  assert.equal(isMultiScaleAlgorithm("portrait-v5"), true);
  assert.equal(canRefineAlgorithm("portrait-v5"), false);
  assert.equal(isOpticalAlgorithm("portrait-v6"), true);
  assert.equal(isMultiScaleAlgorithm("portrait-v6"), true);
  assert.equal(canRefineAlgorithm("portrait-v6"), true);
});
