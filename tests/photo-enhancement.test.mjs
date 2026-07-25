import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDetailPriorityMap,
  composeAnalysisPreviewGray,
  enhanceAnalysisGray,
} from "../core/photo-enhancement.js";

test("adaptive contrast expands tones around the image median", () => {
  const size = 7;
  const gray = new Float32Array(size * size);
  const mask = new Uint8Array(size * size).fill(1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) gray[y * size + x] = 80 + x * 15;
  }

  const enhanced = enhanceAnalysisGray(gray, mask, size, {
    contrast: 0.6,
    sharpness: 0,
  });
  const centerIndex = Math.floor(size * size / 2);

  assert.ok(enhanced[1] < gray[1]);
  assert.ok(enhanced[size - 2] > gray[size - 2]);
  assert.ok(Math.abs(enhanced[centerIndex] - gray[centerIndex]) < 1);
});

test("limited unsharp mask strengthens an edge without clipping it", () => {
  const size = 11;
  const gray = new Float32Array(size * size);
  const mask = new Uint8Array(size * size).fill(1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) gray[y * size + x] = x < 5 ? 105 : 150;
  }

  const enhanced = enhanceAnalysisGray(gray, mask, size, {
    contrast: 0,
    sharpness: 0.7,
  });
  const row = Math.floor(size / 2) * size;

  assert.ok(enhanced[row + 4] < gray[row + 4]);
  assert.ok(enhanced[row + 5] > gray[row + 5]);
  assert.ok(enhanced[row + 4] >= 0);
  assert.ok(enhanced[row + 5] <= 255);
});

test("uniform regions and pixels outside the mask remain unchanged", () => {
  const size = 9;
  const gray = new Float32Array(size * size).fill(132);
  const mask = new Uint8Array(size * size);
  for (let y = 2; y < 7; y++) {
    for (let x = 2; x < 7; x++) mask[y * size + x] = 1;
  }

  const enhanced = enhanceAnalysisGray(gray, mask, size, {
    contrast: 0.8,
    sharpness: 0.8,
  });

  assert.deepEqual(enhanced, gray);
});

test("detail priority favors a coherent dark contour over flat tones", () => {
  const size = 25;
  const gray = new Float32Array(size * size).fill(190);
  const mask = new Uint8Array(size * size).fill(1);
  for (let y = 4; y < size - 4; y++) {
    gray[y * size + 12] = 105;
    gray[y * size + 13] = 112;
  }

  const priority = buildDetailPriorityMap(gray, mask, size, 0.7);
  let contourTotal = 0;
  let flatTotal = 0;
  let contourCount = 0;
  let flatCount = 0;

  for (let y = 5; y < size - 5; y++) {
    for (let x = 2; x < size - 2; x++) {
      const value = priority[y * size + x];
      if (x >= 10 && x <= 15) {
        contourTotal += value;
        contourCount++;
      } else if (x <= 5 || x >= 20) {
        flatTotal += value;
        flatCount++;
      }
    }
  }

  assert.ok(contourTotal / contourCount > 0.12);
  assert.ok(contourTotal / contourCount > (flatTotal / flatCount) * 8);
});

test("detail priority scales with the requested strength", () => {
  const size = 17;
  const gray = new Float32Array(size * size).fill(185);
  const mask = new Uint8Array(size * size).fill(1);
  for (let x = 3; x < size - 3; x++) gray[8 * size + x] = 95;

  const low = buildDetailPriorityMap(gray, mask, size, 0.25);
  const high = buildDetailPriorityMap(gray, mask, size, 0.75);
  const sample = 7 * size + 8;

  assert.ok(low[sample] > 0);
  assert.ok(Math.abs(high[sample] / low[sample] - 3) < 0.001);
});

test("analysis preview makes prioritized details visible", () => {
  const gray = new Float32Array([180, 180, 180, 180]);
  const priority = new Float32Array([0, 0.25, 0.5, 0]);
  const mask = new Uint8Array([1, 1, 1, 0]);

  const preview = composeAnalysisPreviewGray(gray, priority, mask);

  assert.deepEqual(Array.from(preview), [180, 156, 132, 18]);
});
