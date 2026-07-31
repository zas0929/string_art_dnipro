import assert from "node:assert/strict";
import test from "node:test";

import {
  createSharedPatternUrl,
  sharedRowToPattern,
} from "../storage/shared-pattern-store.js";

test("maps a public RPC row to a read-only build pattern", () => {
  const pattern = sharedRowToPattern({
    project_id: "a2d5e131-5257-4ee8-939d-d19033956921",
    name: "Buyer portrait",
    sequence: [1, 50, 25],
    point_count: 240,
    line_count: 2,
    updated_at: "2026-07-31T10:00:00.000Z",
  }, "0123456789abcdef0123456789abcdef");

  assert.deepEqual(pattern.sequence, [1, 50, 25]);
  assert.equal(pattern.pointCount, 240);
  assert.equal(pattern.lineCount, 2);
  assert.equal(pattern.algorithm, "shared-pattern");
  assert.equal(pattern.sharedToken, "0123456789abcdef0123456789abcdef");
});

test("creates the short buyer URL without a trailing slash", () => {
  assert.equal(
    createSharedPatternUrl(
      "0123456789abcdef0123456789abcdef",
      "https://string-art.example/",
    ),
    "https://string-art.example/s/0123456789abcdef0123456789abcdef",
  );
});
