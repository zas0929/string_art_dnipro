import assert from "node:assert/strict";
import test from "node:test";

import { createCirclePoints } from "../core/string-art-renderer.js";

test("places point 1 at three o'clock and numbers clockwise", () => {
  const points = createCirclePoints(240, 272, 280, 280);
  assert.deepEqual(points[0], { x: 552, y: 280 });
  assert.deepEqual(points[60], { x: 280, y: 552 });
  assert.deepEqual(points[120], { x: 8, y: 280 });
});
