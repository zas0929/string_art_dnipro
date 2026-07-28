import assert from "node:assert/strict";
import test from "node:test";

import { getMigrationCandidates } from "../core/project-migration.js";

test("migrates only local projects that do not already exist in the cloud", () => {
  const local = [{ id: "one" }, { id: "two" }, { id: "three" }];
  const cloud = [{ id: "two" }, { id: "four" }];

  assert.deepEqual(getMigrationCandidates(local, cloud), [
    { id: "one" },
    { id: "three" },
  ]);
});

test("handles empty project collections", () => {
  assert.deepEqual(getMigrationCandidates(null, null), []);
});
