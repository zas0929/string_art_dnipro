import assert from "node:assert/strict";
import test from "node:test";

import { applyImageEnhancements } from "../core/image-enhancements.js";

test("leaves pixels unchanged when both enhancements are disabled", () => {
  const data = new Uint8ClampedArray([
    20, 20, 20, 255,
    180, 180, 180, 255,
  ]);
  const imageData = { data };
  applyImageEnhancements(imageData, 2, 1, { sharpness: 0, clarity: 0 });
  assert.deepEqual([...data], [20, 20, 20, 255, 180, 180, 180, 255]);
});

test("sharpness increases contrast around an edge without changing alpha", () => {
  const width = 5;
  const height = 3;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) {
    const x = pixel % width;
    const value = x < 2 ? 70 : 170;
    data.set([value, value, value, 255], pixel * 4);
  }

  applyImageEnhancements({ data }, width, height, { sharpness: 100 });

  assert.ok(data[(1 * width + 1) * 4] < 70);
  assert.ok(data[(1 * width + 2) * 4] > 170);
  assert.equal(data[(1 * width + 2) * 4 + 3], 255);
});

test("clarity separates local detail from its surrounding tone", () => {
  const width = 5;
  const height = 5;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) {
    data.set([100, 100, 100, 255], pixel * 4);
  }
  const centerOffset = (2 * width + 2) * 4;
  data.set([140, 140, 140, 255], centerOffset);

  applyImageEnhancements({ data }, width, height, { clarity: 100 });

  assert.ok(data[centerOffset] > 140);
  assert.ok(data[centerOffset] - data[0] > 40);
  assert.equal(data[3], 255);
});
