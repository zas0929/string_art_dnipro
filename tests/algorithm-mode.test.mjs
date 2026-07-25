import assert from "node:assert/strict";
import test from "node:test";

import {
  SUPPORTED_ALGORITHMS,
  canRefineAlgorithm,
  isReferenceAlgorithm,
  isStableV5Algorithm,
  isMultiScaleAlgorithm,
  isOpticalAlgorithm,
  usesAutomaticNeutralBackground,
  usesImprovedOpticalKernel,
  usesReferenceCalibratedRoute,
} from "../core/algorithm-mode.js";

test("keeps v5 stable and gates weak-segment refinement to v6", () => {
  assert.deepEqual(SUPPORTED_ALGORITHMS, [
    "portrait-v4",
    "portrait-v5",
    "portrait-v6",
    "reference-v7",
  ]);
  assert.equal(isOpticalAlgorithm("portrait-v5"), true);
  assert.equal(isMultiScaleAlgorithm("portrait-v5"), true);
  assert.equal(isStableV5Algorithm("portrait-v5"), true);
  assert.equal(usesAutomaticNeutralBackground("portrait-v5"), true);
  assert.equal(usesImprovedOpticalKernel("portrait-v5"), false);
  assert.equal(usesReferenceCalibratedRoute("portrait-v5"), false);
  assert.equal(canRefineAlgorithm("portrait-v5"), false);
  assert.equal(isOpticalAlgorithm("portrait-v6"), true);
  assert.equal(isMultiScaleAlgorithm("portrait-v6"), true);
  assert.equal(isStableV5Algorithm("portrait-v6"), false);
  assert.equal(usesAutomaticNeutralBackground("portrait-v6"), true);
  assert.equal(usesImprovedOpticalKernel("portrait-v6"), false);
  assert.equal(usesReferenceCalibratedRoute("portrait-v6"), true);
  assert.equal(canRefineAlgorithm("portrait-v6"), true);
  assert.equal(usesAutomaticNeutralBackground("portrait-v4"), false);
  assert.equal(isReferenceAlgorithm("reference-v7"), true);
  assert.equal(isOpticalAlgorithm("reference-v7"), false);
  assert.equal(isMultiScaleAlgorithm("reference-v7"), false);
  assert.equal(usesAutomaticNeutralBackground("reference-v7"), false);
  assert.equal(canRefineAlgorithm("reference-v7"), false);
});
