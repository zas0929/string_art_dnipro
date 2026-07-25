import assert from "node:assert/strict";
import test from "node:test";

import {
  ReferenceThreadPlanner,
  createReferenceTarget,
} from "../core/reference-thread-planner.js";

test("reference target preserves the half-range grayscale model", () => {
  const rgba = Uint8ClampedArray.from([
    0, 0, 0, 255,
    128, 128, 128, 255,
    254, 254, 254, 255,
    255, 255, 255, 255,
  ]);

  assert.deepEqual(
    Array.from(createReferenceTarget(rgba, 2)),
    [127, 63, 0, -0.5],
  );
});

test("reference route uses the fixed opening and 100-step peg memory", () => {
  const first = buildSequence();
  const second = buildSequence();

  assert.deepEqual(first, second);
  assert.deepEqual(first.slice(0, 2), [0, 49]);

  const lastVisit = new Map();
  for (let index = 0; index < first.length; index++) {
    const point = first[index];
    if (lastVisit.has(point)) {
      assert.ok(index - lastVisit.get(point) > 100);
    }
    if (index > 0) {
      assert.ok(circularDistance(first[index - 1], point, 240) >= 15);
    }
    lastVisit.set(point, index);
  }
});

function buildSequence() {
  const size = 48;
  const target = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - size * 0.58) / size;
      const dy = (y - size * 0.46) / size;
      const portrait = Math.exp(-(dx * dx * 16 + dy * dy * 23));
      const diagonal = Math.max(0, 1 - Math.abs(x - y * 0.72 - 8) / 5);
      target[y * size + x] = portrait * 100 + diagonal * 28 + 8;
    }
  }

  const planner = new ReferenceThreadPlanner({
    pointCount: 240,
    size,
    target,
    minSkip: 15,
  });
  for (let line = 0; line < 260; line++) {
    const next = planner.findNext();
    assert.notEqual(next, -1);
    planner.commit(next);
  }
  return planner.sequence;
}

function circularDistance(a, b, count) {
  const direct = Math.abs(a - b);
  return Math.min(direct, count - direct);
}
