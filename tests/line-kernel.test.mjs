import assert from "node:assert/strict";
import test from "node:test";

import {
  createSubpixelLineKernel,
  getOpticalThreadCoverage,
} from "../core/line-kernel.js";
import { OpticalRoutePlanner } from "../core/optical-route-planner.js";

test("subpixel kernel conserves the requested thread coverage", () => {
  const coverage = getOpticalThreadCoverage(0.19);
  const kernel = createSubpixelLineKernel(
    { x: 1, y: 1 },
    { x: 9, y: 4 },
    12,
    coverage,
  );

  assert.equal(kernel.length, 9);
  assert.ok(kernel.fractions.some((fraction) => fraction > 0 && fraction < 255));
  assert.ok(Math.abs(kernelWeightSum(kernel) - kernel.length * coverage) < 1e-6);
});

test("multiscale kernels conserve area-averaged optical density", () => {
  const size = 16;
  const coverage = getOpticalThreadCoverage(0.19);
  const points = [{ x: 1, y: 2 }, { x: 14, y: 11 }];
  const kernel = createSubpixelLineKernel(points[0], points[1], size, coverage);
  const planner = new OpticalRoutePlanner({
    points,
    lineCount: 1,
    minSkip: 1,
    size,
    target: new Float32Array(size * size),
    importance: new Float32Array(size * size).fill(1),
    getLineSamples: () => kernel,
    scaleFactors: [1, 2, 4],
  });

  const fullWeight = kernelWeightSum(planner.getScaleLineKernel(0, 1, planner.scales[0]));
  const halfWeight = kernelWeightSum(planner.getScaleLineKernel(0, 1, planner.scales[1]));
  const quarterWeight = kernelWeightSum(planner.getScaleLineKernel(0, 1, planner.scales[2]));

  assert.ok(Math.abs(halfWeight - fullWeight / 4) < 1e-5);
  assert.ok(Math.abs(quarterWeight - fullWeight / 16) < 1e-5);
});

function kernelWeightSum(kernel) {
  if (kernel.fractions) return kernel.length * kernel.coverage;
  if (kernel.weights) {
    let total = 0;
    for (const weight of kernel.weights) total += weight;
    return total;
  }
  return kernel.indices.length;
}
