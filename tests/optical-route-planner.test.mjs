import assert from "node:assert/strict";
import test from "node:test";

import { OpticalRoutePlanner } from "../core/optical-route-planner.js";

test("multiscale planner is deterministic and avoids immediate backtracking", () => {
  const first = buildSequence();
  const second = buildSequence();

  assert.deepEqual(first, second);
  assert.equal(first.length, 81);
  for (let index = 1; index < first.length - 1; index++) {
    assert.notEqual(first[index - 1], first[index + 1]);
  }
});

function buildSequence() {
  const size = 32;
  const pointCount = 24;
  const points = Array.from({ length: pointCount }, (_, index) => {
    const angle = index / pointCount * Math.PI * 2;
    return {
      x: Math.round(size / 2 + Math.cos(angle) * 14),
      y: Math.round(size / 2 + Math.sin(angle) * 14),
    };
  });
  const target = new Float32Array(size * size);
  const importance = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      const dx = (x - size / 2) / size;
      const dy = (y - size * 0.44) / size;
      target[index] = 2.5 + Math.exp(-(dx * dx * 18 + dy * dy * 26)) * 4;
      importance[index] = 1 + Math.exp(-(dx * dx * 28 + dy * dy * 38));
    }
  }

  const lineCache = new Map();
  const planner = new OpticalRoutePlanner({
    points,
    lineCount: 80,
    minSkip: 2,
    size,
    target,
    importance,
    getLineSamples: (from, to) => getLineSamples(from, to, points, size, lineCache),
    scaleFactors: [1, 2, 4],
    lookaheadInterval: 4,
    detailBoost: 0.08,
    targetNailDistance: 7.5,
  });

  for (let line = 0; line < 80; line++) {
    const next = planner.findNext(line / 80);
    assert.notEqual(next, -1);
    planner.commit(next);
  }
  return planner.sequence;
}

function getLineSamples(from, to, points, size, cache) {
  const key = from < to ? `${from}:${to}` : `${to}:${from}`;
  if (cache.has(key)) return cache.get(key);
  const first = points[from];
  const second = points[to];
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  const samples = [];

  for (let step = 0; step <= steps; step++) {
    const progress = step / Math.max(1, steps);
    const x = Math.round(first.x + dx * progress);
    const y = Math.round(first.y + dy * progress);
    const index = y * size + x;
    if (samples[samples.length - 1] !== index) samples.push(index);
  }

  const packed = Int32Array.from(samples);
  cache.set(key, packed);
  return packed;
}
