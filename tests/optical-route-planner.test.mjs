import assert from "node:assert/strict";
import test from "node:test";

import {
  createSubpixelLineKernel,
  getOpticalThreadCoverage,
} from "../core/line-kernel.js";
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

test("reference profile moves from local strokes to structured finishing", () => {
  const planner = createProfilePlanner();
  const early = planner.getRouteProfile(0.04);
  const middle = planner.getRouteProfile(0.2);
  const finishing = planner.getRouteProfile(0.98);

  assert.equal(early.targetNailDistance, 40);
  assert.ok(middle.targetNailDistance > 65 && middle.targetNailDistance < 76);
  assert.ok(Math.abs(finishing.targetNailDistance - 76) < 1e-9);
  assert.ok(early.parallelPenaltyLimit < middle.parallelPenaltyLimit);
  assert.ok(middle.parallelPenaltyLimit < finishing.parallelPenaltyLimit);
  assert.ok(early.nailBalanceMultiplier < finishing.nailBalanceMultiplier);
  assert.equal(finishing.repeatBiasStep, 0);
  assert.equal(finishing.repeatBiasLimit, 0);
});

test("reference-calibrated route profile improves route balance", () => {
  const benchmark = {
    pointCount: 96,
    size: 64,
    subpixelCoverage: getOpticalThreadCoverage(0.19),
  };
  const baselineRun = buildRoute({}, 800, benchmark);
  const calibratedRun = buildRoute({
    nailBalanceMultiplier: 1.4,
    directionBalanceStrength: 0.0011,
    directionBalanceLimit: 0.035,
    parallelPenaltyImmediate: 0.055,
    parallelPenaltyHistory: 0.0045,
    parallelPenaltyLimit: 0.095,
    repeatBiasStep: 0.11,
    repeatBiasLimit: 0.34,
  }, 800, benchmark);
  const baseline = analyzeRoute(baselineRun.sequence, benchmark.pointCount);
  const calibrated = analyzeRoute(calibratedRun.sequence, benchmark.pointCount);

  assert.ok(
    calibrated.directionCv < baseline.directionCv,
    `expected more even directions: ${JSON.stringify({ baseline, calibrated })}`,
  );
  assert.ok(
    calibrated.nailVisitCv <= baseline.nailVisitCv,
    `expected more even nail usage: ${JSON.stringify({ baseline, calibrated })}`,
  );
  assert.ok(
    calibrated.nearParallelRatio <= baseline.nearParallelRatio + 0.006,
    `expected no material increase in parallel steps: ${JSON.stringify({ baseline, calibrated })}`,
  );
  assert.ok(
    calibratedRun.residualError <= baselineRun.residualError * 1.02,
    `expected image error within 2% of baseline: ${JSON.stringify({ baselineRun, calibratedRun })}`,
  );
});

function createProfilePlanner() {
  const size = 8;
  return new OpticalRoutePlanner({
    points: [
      { x: 1, y: 4 },
      { x: 4, y: 1 },
      { x: 7, y: 4 },
      { x: 4, y: 7 },
    ],
    lineCount: 100,
    minSkip: 1,
    size,
    target: new Float32Array(size * size),
    importance: new Float32Array(size * size).fill(1),
    getLineSamples: () => Int32Array.of(0),
    scaleFactors: [1],
    adaptiveRouteProfile: "reference-v1",
  });
}

test("optional weak-segment refinement is deterministic and reversible by sequence", () => {
  const configuration = {
    pointCount: 72,
    size: 56,
    subpixelCoverage: getOpticalThreadCoverage(0.19),
    optimize: {
      windowLimit: 36,
      shortlistSize: 8,
    },
  };
  const first = buildRoute({}, 420, configuration);
  const second = buildRoute({}, 420, configuration);

  assert.deepEqual(first.sequenceBeforeOptimization, second.sequenceBeforeOptimization);
  assert.deepEqual(first.sequence, second.sequence);
  assert.deepEqual(first.optimization, second.optimization);
  assert.equal(first.sequence.length, first.sequenceBeforeOptimization.length);
  assert.ok(
    first.optimization.accepted > 0,
    `expected at least one optional replacement: ${JSON.stringify(first.optimization)}`,
  );
  assert.ok(
    first.residualError < first.residualErrorBeforeOptimization,
    `expected lower mathematical residual: ${JSON.stringify(first)}`,
  );
  for (let index = 1; index < first.sequence.length - 1; index++) {
    assert.notEqual(first.sequence[index - 1], first.sequence[index + 1]);
  }
});

function buildSequence(plannerOptions = {}, lineCount = 80, configuration = {}) {
  return buildRoute(plannerOptions, lineCount, configuration).sequence;
}

function buildRoute(plannerOptions = {}, lineCount = 80, configuration = {}) {
  const size = configuration.size ?? 32;
  const pointCount = configuration.pointCount ?? 24;
  const modelCoverage = configuration.subpixelCoverage ?? 1;
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
      target[index] = (
        2.5 + Math.exp(-(dx * dx * 18 + dy * dy * 26)) * 4
      ) * modelCoverage;
      importance[index] = 1 + Math.exp(-(dx * dx * 28 + dy * dy * 38));
    }
  }

  const lineCache = new Map();
  const planner = new OpticalRoutePlanner({
    points,
    lineCount,
    minSkip: 2,
    size,
    target,
    importance,
    getLineSamples: (from, to) => {
      const key = from < to ? `${from}:${to}` : `${to}:${from}`;
      if (lineCache.has(key)) return lineCache.get(key);
      const kernel = configuration.subpixelCoverage
        ? createSubpixelLineKernel(
            points[from],
            points[to],
            size,
            configuration.subpixelCoverage,
          )
        : getLineSamples(from, to, points, size, lineCache);
      lineCache.set(key, kernel);
      return kernel;
    },
    scaleFactors: [1, 2, 4],
    lookaheadInterval: 4,
    detailBoost: 0.08,
    targetNailDistance: pointCount * 0.3125,
    ...plannerOptions,
  });

  for (let line = 0; line < lineCount; line++) {
    const next = planner.findNext(line / lineCount);
    assert.notEqual(next, -1);
    planner.commit(next);
  }
  const sequenceBeforeOptimization = planner.sequence.slice();
  const residualErrorBeforeOptimization = calculateResidualError(planner.scales[0]);
  const optimization = configuration.optimize
    ? planner.optimizeWeakVertices(configuration.optimize)
    : null;
  const residualError = calculateResidualError(planner.scales[0]);

  return {
    sequence: planner.sequence,
    sequenceBeforeOptimization,
    residualError,
    residualErrorBeforeOptimization,
    optimization,
  };
}

function calculateResidualError(fineScale) {
  let weightedError = 0;
  let totalImportance = 0;
  for (let index = 0; index < fineScale.residual.length; index++) {
    const pixelImportance = fineScale.importance[index];
    weightedError += pixelImportance * fineScale.residual[index] ** 2;
    totalImportance += pixelImportance;
  }
  return weightedError / Math.max(1, totalImportance);
}

function analyzeRoute(sequence, pointCount) {
  const visits = new Uint32Array(pointCount);
  const directionBins = new Uint32Array(18);
  const directions = [];
  let nearParallel = 0;

  for (let index = 1; index < sequence.length; index++) {
    const from = sequence[index - 1];
    const to = sequence[index];
    visits[to]++;
    const fromAngle = from / pointCount * Math.PI * 2;
    const toAngle = to / pointCount * Math.PI * 2;
    let direction = Math.atan2(
      Math.sin(toAngle) - Math.sin(fromAngle),
      Math.cos(toAngle) - Math.cos(fromAngle),
    ) % Math.PI;
    if (direction < 0) direction += Math.PI;
    const bin = Math.min(directionBins.length - 1, Math.floor(direction / Math.PI * directionBins.length));
    directionBins[bin]++;
    if (directions.length > 0) {
      const directDelta = Math.abs(direction - directions[directions.length - 1]);
      const angleDelta = Math.min(directDelta, Math.PI - directDelta);
      if (angleDelta < Math.PI / 36) nearParallel++;
    }
    directions.push(direction);
  }

  return {
    nearParallelRatio: nearParallel / Math.max(1, directions.length - 1),
    directionCv: coefficientOfVariation(directionBins),
    nailVisitCv: coefficientOfVariation(visits),
  };
}

function coefficientOfVariation(values) {
  let total = 0;
  for (const value of values) total += value;
  const average = total / Math.max(1, values.length);
  let variance = 0;
  for (const value of values) variance += (value - average) ** 2;
  return Math.sqrt(variance / Math.max(1, values.length)) / Math.max(1e-9, average);
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
