import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(new URL(
  "../supabase/migrations/202609170001_admin_shared_patterns.sql", import.meta.url,
), "utf8");
const collaboration = await readFile(new URL(
  "../supabase/migrations/202608220001_admin_project_collaboration.sql", import.meta.url,
), "utf8");

test("buyer publishing allows owners or the existing admin collaboration predicate", () => {
  assert.match(sql, /projects\.user_id = \(select auth\.uid\(\)\)\s+or public\.can_admin_collaborate_on_project\(projects\.id\)/);
  const helper = collaboration.split("create or replace function public.can_admin_collaborate_on_project")[1].split("$$;")[0];
  assert.match(helper, /public\.is_admin\(\(select auth\.uid\(\)\)\)/);
  assert.match(helper, /public\.is_admin\(projects\.user_id\)/);
  assert.match(sql, /if \(select auth\.uid\(\)\) is null then\s+raise exception/);
});

test("collaborators can read and revoke shares only for eligible projects", () => {
  assert.match(sql, /for select\s+to authenticated\s+using \(public\.can_admin_collaborate_on_project\(project_id\)\)/);
  assert.match(sql, /for update\s+to authenticated\s+using \(public\.can_admin_collaborate_on_project\(project_id\)\)\s+with check/);
  assert.match(sql, /owner_id = \(\s+select projects\.user_id/);
  assert.doesNotMatch(sql, /for (insert|delete)/i);
  assert.doesNotMatch(sql, /grant[^;]+to anon/i);
});

test("refresh preserves the buyer token and original owner", () => {
  assert.match(sql, /select\s+projects\.id,\s+projects\.user_id,/);
  const update = sql.split("on conflict (project_id) do update set")[1].split("returning")[0];
  assert.doesNotMatch(update, /(?:public_token|owner_id|project_id)\s*=/);
  assert.match(update, /active = true/);
  assert.match(sql, /security definer\s+set search_path = ''/);
  assert.match(sql, /revoke execute[^;]+from public, anon, authenticated/);
});
