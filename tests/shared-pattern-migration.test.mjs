import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/202607310002_shared_patterns.sql",
  import.meta.url,
);

test("exposes buyer patterns through a token RPC without anonymous table access", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /security definer[\s\S]+get_shared_pattern/i);
  assert.match(sql, /grant execute on function public\.get_shared_pattern\(text\) to anon, authenticated/i);
  assert.doesNotMatch(sql, /grant\s+select[^;]+shared_patterns[^;]+to\s+anon/i);
});
