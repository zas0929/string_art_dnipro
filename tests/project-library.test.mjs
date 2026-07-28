import assert from "node:assert/strict";
import test from "node:test";

import {
  LOCAL_PROJECT_LIMIT,
  removeProjectFromIndex,
  updateProjectIndex,
} from "../core/project-library.js";

function project(id, updatedAt = `2026-07-${id.padStart(2, "0")}T12:00:00.000Z`) {
  return {
    id,
    name: `Project ${id}`,
    pointCount: 240,
    lineCount: 4000,
    createdAt: updatedAt,
    updatedAt,
  };
}

test("keeps the newest project first and updates an existing slot", () => {
  const first = updateProjectIndex([], project("1"));
  const second = updateProjectIndex(first.entries, project("2"));
  const renamed = updateProjectIndex(second.entries, {
    ...project("1", "2026-07-20T12:00:00.000Z"),
    name: "Renamed",
  });

  assert.equal(renamed.saved, true);
  assert.deepEqual(renamed.entries.map(({ id }) => id), ["1", "2"]);
  assert.equal(renamed.entries[0].name, "Renamed");
});

test("rejects a sixth project without removing the existing five", () => {
  let entries = [];
  for (let index = 1; index <= LOCAL_PROJECT_LIMIT; index++) {
    entries = updateProjectIndex(entries, project(String(index))).entries;
  }

  const result = updateProjectIndex(entries, project("6"));
  assert.equal(result.saved, false);
  assert.deepEqual(result.entries, entries);
});

test("removes a project from the local index", () => {
  const entries = [project("1"), project("2")];
  assert.deepEqual(
    removeProjectFromIndex(entries, "1").map(({ id }) => id),
    ["2"],
  );
});
