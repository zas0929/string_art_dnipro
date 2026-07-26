import assert from "node:assert/strict";
import test from "node:test";

import { createInstructionPages } from "../core/print-instruction.js";

test("splits printable steps into columns and pages", () => {
  const sequence = [1, ...Array.from({ length: 13 }, (_, index) => index + 10)];
  const pages = createInstructionPages(sequence, {
    startStep: 2,
    endStep: 13,
    rowsPerColumn: 3,
    columnsPerPage: 2,
  });

  assert.equal(pages.length, 2);
  assert.deepEqual(pages[0][0], [
    { step: 2, point: 11 },
    { step: 3, point: 12 },
    { step: 4, point: 13 },
  ]);
  assert.deepEqual(pages[1][1], [
    { step: 11, point: 20 },
    { step: 12, point: 21 },
    { step: 13, point: 22 },
  ]);
});

test("clamps printable range to the available scheme", () => {
  const pages = createInstructionPages([1, 50, 25], {
    startStep: -10,
    endStep: 99,
  });

  assert.deepEqual(pages, [[[
    { step: 1, point: 50 },
    { step: 2, point: 25 },
  ]]]);
});
