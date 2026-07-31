import assert from "node:assert/strict";
import test from "node:test";

import {
  createCirclePoints,
  renderStringArtBase,
  renderStringArtLines,
} from "../core/string-art-renderer.js";

test("places point 1 at three o'clock and numbers clockwise", () => {
  const points = createCirclePoints(240, 272, 280, 280);
  assert.deepEqual(points[0], { x: 552, y: 280 });
  assert.deepEqual(points[60], { x: 280, y: 552 });
  assert.deepEqual(points[120], { x: 8, y: 280 });
});

test("renders only the requested line range", () => {
  let strokes = 0;
  const context = {
    canvas: { width: 760 },
    save() {},
    beginPath() {},
    arc() {},
    clip() {},
    moveTo() {},
    lineTo() {},
    stroke() { strokes++; },
    restore() {},
  };
  const points = createCirclePoints(4, 100, 100, 100);
  renderStringArtLines(context, [[0, 2], [2, 1], [1, 3]], points, {
    canvasSize: 760,
    workSize: 200,
    endIndex: 0,
  });
  assert.equal(strokes, 0);

  renderStringArtLines(context, [[0, 2], [2, 1], [1, 3]], points, {
    canvasSize: 760,
    workSize: 200,
    startIndex: 1,
    endIndex: 3,
  });
  assert.equal(strokes, 2);
});

test("can render the String Art base without an opaque background", () => {
  let clears = 0;
  let fills = 0;
  const context = {
    canvas: { width: 200 },
    clearRect() { clears++; },
    fillRect() { fills++; },
    save() {},
    beginPath() {},
    arc() {},
    clip() {},
    restore() {},
    stroke() {},
    fill() {},
  };

  renderStringArtBase(context, 4, 200, {
    showLabels: false,
    background: false,
  });

  assert.equal(clears, 1);
  assert.equal(fills, 0);
});

test("can render nails without connecting them with an outline", () => {
  let strokes = 0;
  let fills = 0;
  const context = {
    canvas: { width: 200 },
    clearRect() {},
    fillRect() {},
    save() {},
    beginPath() {},
    arc() {},
    clip() {},
    restore() {},
    stroke() { strokes++; },
    fill() { fills++; },
  };

  renderStringArtBase(context, 4, 200, {
    showLabels: false,
    outline: false,
  });

  assert.equal(strokes, 0);
  assert.equal(fills, 4);
});
