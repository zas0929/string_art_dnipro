import assert from "node:assert/strict";
import test from "node:test";

import {
  SUPPORTED_ALGORITHMS,
  canRefineAlgorithm,
  isStableV5Algorithm,
  isMultiScaleAlgorithm,
  isOpticalAlgorithm,
  usesAutomaticNeutralBackground,
  usesImprovedOpticalKernel,
} from "../core/algorithm-mode.js";

test("keeps v5 stable and gates weak-segment refinement to v6", () => {
  assert.deepEqual(SUPPORTED_ALGORITHMS, [
    "portrait-v4",
    "portrait-v5",
    "portrait-v6",
  ]);
  assert.equal(isOpticalAlgorithm("portrait-v5"), true);
  assert.equal(isMultiScaleAlgorithm("portrait-v5"), true);
  assert.equal(isStableV5Algorithm("portrait-v5"), true);
  assert.equal(usesAutomaticNeutralBackground("portrait-v5"), true);
  assert.equal(usesImprovedOpticalKernel("portrait-v5"), false);
  assert.equal(canRefineAlgorithm("portrait-v5"), false);
  assert.equal(isOpticalAlgorithm("portrait-v6"), true);
  assert.equal(isMultiScaleAlgorithm("portrait-v6"), true);
  assert.equal(isStableV5Algorithm("portrait-v6"), false);
  assert.equal(usesAutomaticNeutralBackground("portrait-v6"), true);
  assert.equal(usesImprovedOpticalKernel("portrait-v6"), true);
  assert.equal(canRefineAlgorithm("portrait-v6"), true);
  assert.equal(usesAutomaticNeutralBackground("portrait-v4"), false);
});
