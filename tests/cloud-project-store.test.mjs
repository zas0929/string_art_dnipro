import assert from "node:assert/strict";
import test from "node:test";
import { createCloudProjectStore } from "../storage/cloud-project-store.js";

test("project migration skips a stale preview that resolves to JSON", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ message: "Object not found" }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const uploads = [];
  const insertedRows = [];
  const updatedRows = [];
  const supabase = createSupabaseStub({ uploads, insertedRows, updatedRows });
  const store = createCloudProjectStore(supabase, "user-1");

  const saved = await store.saveProject({
    id: "project-1",
    name: "Migrated project",
    sequence: [1, 2, 3],
    pointCount: 240,
    lineCount: 2,
    sourcePreviewDataUrl: "https://example.test/expired-preview",
    artworkPreviewDataUrl: null,
    settings: {},
  });

  assert.equal(uploads.length, 0);
  assert.equal(insertedRows.length, 1);
  assert.equal(insertedRows[0].source_preview_path, null);
  assert.equal(updatedRows.length, 1);
  assert.equal(saved.sourcePreviewDataUrl, null);
});

test("project migration assigns a new id when another account owns the local id", async () => {
  const insertedRows = [];
  const updatedRows = [];
  const supabase = createSupabaseStub({
    uploads: [],
    insertedRows,
    updatedRows,
    hiddenProjectCollision: true,
  });
  const store = createCloudProjectStore(supabase, "user-2");

  const saved = await store.saveProject({
    id: "project-owned-by-another-user",
    name: "Imported project",
    sequence: [1, 2, 3],
    pointCount: 240,
    lineCount: 2,
    sourcePreviewDataUrl: null,
    artworkPreviewDataUrl: null,
    settings: {},
  });

  assert.equal(insertedRows.length, 2);
  assert.equal(insertedRows[0].id, "project-owned-by-another-user");
  assert.notEqual(insertedRows[1].id, insertedRows[0].id);
  assert.equal(saved.id, insertedRows[1].id);
});

function createSupabaseStub({
  uploads,
  insertedRows,
  updatedRows,
  hiddenProjectCollision = false,
}) {
  let collisionReturned = false;
  const savedRow = (row) => ({
    ...row,
    created_at: "2026-08-14T12:00:00.000Z",
    updated_at: "2026-08-14T12:00:00.000Z",
  });

  return {
    from(table) {
      assert.equal(table, "projects");
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        insert(row) {
          insertedRows.push(row);
          if (hiddenProjectCollision && !collisionReturned) {
            collisionReturned = true;
            return Promise.resolve({
              data: null,
              error: { code: "23505", message: "duplicate key value" },
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
        update(row) {
          updatedRows.push(row);
          return {
            eq() {
              return {
                select() {
                  return {
                    async single() {
                      return { data: savedRow(row), error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    storage: {
      from() {
        return {
          async upload(path, blob, options) {
            uploads.push({ path, blob, options });
            return { error: null };
          },
          async createSignedUrl() {
            throw new Error("No preview should have been persisted");
          },
        };
      },
    },
  };
}
