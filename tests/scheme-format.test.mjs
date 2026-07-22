import assert from "node:assert/strict";
import test from "node:test";

import { formatCsvText, formatSchemeText, parseSchemeText } from "../core/scheme-format.js";

test("formats the reference TXT sequence with point 1 at step 0", () => {
  assert.equal(
    formatSchemeText([0, 49, 24, 42]),
    [
      "Points______Lines/n1____0/",
      "50____  1",
      "25____  2",
      "43____  3",
    ].join("\n"),
  );
});

test("formats CSV connections from consecutive points", () => {
  assert.equal(
    formatCsvText([0, 49, 24]),
    [
      "step,from,to",
      "1,1,50",
      "2,50,25",
    ].join("\n"),
  );
});

test("parses the reference TXT sequence", () => {
  assert.deepEqual(
    parseSchemeText("Points______Lines/n1____0/\n50____  1\n25____  2"),
    [1, 50, 25],
  );
});

test("parses exported CSV and checks continuity", () => {
  assert.deepEqual(
    parseSchemeText("step,from,to\n1,1,50\n2,50,25"),
    [1, 50, 25],
  );
  assert.throws(
    () => parseSchemeText("step,from,to\n1,1,50\n2,49,25"),
    /нарушена последовательность/,
  );
});
