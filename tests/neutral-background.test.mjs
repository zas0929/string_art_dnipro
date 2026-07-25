import assert from "node:assert/strict";
import test from "node:test";

import {
  neutralizeConnectedLightBackground,
} from "../core/neutral-background.js";

test("selects the neutral level from portrait tones instead of a fixed value", () => {
  const darkPortrait = createPortraitFixture({ subjectLevel: 72 });
  const lightPortrait = createPortraitFixture({ subjectLevel: 168 });

  const darkResult = neutralizeConnectedLightBackground(
    darkPortrait.gray,
    darkPortrait.rgba,
    darkPortrait.mask,
    darkPortrait.size,
  );
  const lightResult = neutralizeConnectedLightBackground(
    lightPortrait.gray,
    lightPortrait.rgba,
    lightPortrait.mask,
    lightPortrait.size,
  );

  assert.notEqual(darkResult.level, 145);
  assert.notEqual(lightResult.level, 145);
  assert.notEqual(darkResult.level, lightResult.level);
  assert.ok(darkResult.level >= 105 && darkResult.level <= 195);
  assert.ok(lightResult.level >= 105 && lightResult.level <= 195);
});

test("keeps the legacy fixed level available for v4", () => {
  const fixture = createPortraitFixture({ subjectLevel: 92 });
  const result = neutralizeConnectedLightBackground(
    fixture.gray,
    fixture.rgba,
    fixture.mask,
    fixture.size,
    { automatic: false },
  );

  assert.equal(result.level, 145);
  assert.ok(result.backgroundPixelCount > 0);
  for (let index = 0; index < result.gray.length; index++) {
    if (fixture.mask[index] && fixture.gray[index] === 242) {
      assert.equal(result.gray[index], 145);
    }
  }
});

test("does not rewrite a portrait without connected light background", () => {
  const fixture = createPortraitFixture({
    subjectLevel: 96,
    backgroundLevel: 172,
  });
  const result = neutralizeConnectedLightBackground(
    fixture.gray,
    fixture.rgba,
    fixture.mask,
    fixture.size,
  );

  assert.equal(result.level, null);
  assert.equal(result.backgroundPixelCount, 0);
  assert.deepEqual(result.gray, fixture.gray);
});

function createPortraitFixture({
  subjectLevel,
  backgroundLevel = 242,
  size = 48,
}) {
  const gray = new Float32Array(size * size);
  const rgba = new Uint8ClampedArray(size * size * 4);
  const mask = new Uint8Array(size * size);
  const center = size / 2;
  const canvasRadius = center - 1;
  const subjectRadiusX = size * 0.22;
  const subjectRadiusY = size * 0.36;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      const dx = x - center;
      const dy = y - center;
      const insideCanvas = dx * dx + dy * dy <= canvasRadius * canvasRadius;
      const insideSubject = (
        dx * dx / (subjectRadiusX * subjectRadiusX)
        + dy * dy / (subjectRadiusY * subjectRadiusY)
      ) <= 1;
      const level = insideSubject
        ? Math.min(255, subjectLevel + Math.round((dy + subjectRadiusY) * 0.8))
        : backgroundLevel;

      mask[index] = insideCanvas ? 1 : 0;
      gray[index] = level;
      rgba[index * 4] = level;
      rgba[index * 4 + 1] = level;
      rgba[index * 4 + 2] = level;
      rgba[index * 4 + 3] = 255;
    }
  }

  return { gray, rgba, mask, size };
}
