import assert from "node:assert/strict";
import test from "node:test";

import {
  dequeueCloudSync,
  enqueueCloudSync,
  isRetryableCloudError,
  newestProgress,
  normalizeCloudSyncQueue,
} from "../core/cloud-sync.js";

test("retries network and temporary server failures without hiding permission errors", () => {
  assert.equal(isRetryableCloudError(new Error("Failed to fetch")), true);
  assert.equal(isRetryableCloudError({ status: 503, message: "Unavailable" }), true);
  assert.equal(isRetryableCloudError({ status: 403, code: "42501", message: "RLS" }), false);
  assert.equal(isRetryableCloudError(new Error("Anything"), false), true);
});

test("queues each project once and deletion supersedes pending writes", () => {
  let queue = normalizeCloudSyncQueue(null);
  queue = enqueueCloudSync(queue, "projects", "one");
  queue = enqueueCloudSync(queue, "projects", "one");
  queue = enqueueCloudSync(queue, "progress", "one");
  queue = enqueueCloudSync(queue, "deletions", "one");

  assert.deepEqual(queue, {
    projects: [],
    progress: [],
    deletions: ["one"],
  });
  assert.deepEqual(dequeueCloudSync(queue, "deletions", "one").deletions, []);
});

test("keeps the newest local or cloud build progress", () => {
  const local = { stepIndex: 20, updatedAt: "2026-08-20T12:00:00.000Z" };
  const cloud = { stepIndex: 10, updatedAt: "2026-08-20T11:00:00.000Z" };
  assert.equal(newestProgress(local, cloud), local);
  assert.equal(newestProgress(cloud, local), local);
});
