import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/202608220001_admin_project_collaboration.sql",
  import.meta.url,
);

test("admin collaboration migration shares admin projects without sharing deletion", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /create policy "Admins can read admin projects"/i);
  assert.match(sql, /create policy "Admins can update admin projects"/i);
  assert.doesNotMatch(sql, /Admins can delete admin projects/i);
  assert.match(sql, /create or replace function public\.save_project_progress/i);
  assert.match(sql, /Project ownership cannot be changed/i);
  assert.match(sql, /Admins can read admin preview files/i);
  assert.match(sql, /is_admin_id_text/i);
});
