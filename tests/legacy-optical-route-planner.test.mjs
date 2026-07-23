import assert from "node:assert/strict";
import test from "node:test";

import { createDiscreteLineSamples } from "../core/line-kernel.js";
import { LegacyOpticalRoutePlanner } from "../core/legacy-optical-route-planner.js";

const STABLE_V5_SEQUENCE = [
  0, 18, 1, 20, 3, 22, 6, 24, 10, 27, 13, 28, 15, 29, 14, 31, 17, 2, 19,
  0, 18, 3, 21, 5, 24, 8, 25, 11, 27, 9, 26, 12, 29, 16, 30, 14, 0, 17, 1,
  21, 4, 20, 5, 23, 7, 22, 2, 16, 26, 7, 25, 10, 23, 31, 19, 8, 21, 11, 28,
  6, 27, 15, 30, 12, 16, 3, 13, 26, 10, 4, 29, 17, 24, 9, 28, 5, 9, 15, 25,
  3, 30, 11, 22, 19, 12, 8, 28, 18, 23, 1, 13, 24, 20, 6, 26, 31, 2,
];

test("v5 keeps the route fingerprint from commit 3423ba4", () => {
  assert.deepEqual(buildStableV5Sequence(), STABLE_V5_SEQUENCE);
});

function buildStableV5Sequence() {
  const size = 40;
  const pointCount = 32;
  const lineCount = 96;
  const points = Array.from({ length: pointCount }, (_, index) => {
    const angle = index / pointCount * Math.PI * 2;
    return {
      x: Math.round(size / 2 + Math.cos(angle) * 18),
      y: Math.round(size / 2 + Math.sin(angle) * 18),
    };
  });
  const target = new Float32Array(size * size);
  const importance = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      const dx = (x - size * 0.52) / size;
      const dy = (y - size * 0.44) / size;
      const face = Math.exp(-(dx * dx * 20 + dy * dy * 27));
      const eyeLeft = feature(x, y, size, 0.43, 0.4, 900, 1400);
      const eyeRight = feature(x, y, size, 0.59, 0.4, 900, 1400);
      const mouth = feature(x, y, size, 0.52, 0.57, 550, 1800);
      target[index] = 2.2 + face * 3.6 + (eyeLeft + eyeRight) * 2.2 + mouth * 1.4;
      importance[index] = 0.8 + face * 0.45 + (eyeLeft + eyeRight) * 1.5 + mouth;
    }
  }

  const lineCache = new Map();
  const planner = new LegacyOpticalRoutePlanner({
    points,
    lineCount,
    minSkip: 3,
    size,
    target,
    importance,
    getLineSamples: (from, to) => {
      const key = from < to ? `${from}:${to}` : `${to}:${from}`;
      if (!lineCache.has(key)) {
        lineCache.set(
          key,
          createDiscreteLineSamples(points[from], points[to], size),
        );
      }
      return lineCache.get(key);
    },
    scaleFactors: [1, 2, 4],
    lookaheadInterval: 8,
    detailBoost: 0.08,
    targetNailDistance: 75.5,
    distancePenaltyStrength: 0.000055,
    distanceFeedbackStrength: 0.0024,
  });

  for (let line = 0; line < lineCount; line++) {
    const next = planner.findNext(line / lineCount);
    assert.notEqual(next, -1);
    planner.commit(next);
  }
  return planner.sequence;
}

function feature(x, y, size, centerX, centerY, strengthX, strengthY) {
  const dx = (x - size * centerX) / size;
  const dy = (y - size * centerY) / size;
  return Math.exp(-(dx * dx * strengthX + dy * dy * strengthY));
}
