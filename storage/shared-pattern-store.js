import { createClient } from "../lib/supabase/client.js";
import { isSupabaseConfigured } from "../lib/supabase/config.js";

export async function loadOwnedShare(projectId) {
  if (!isSupabaseConfigured() || !projectId) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shared_patterns")
    .select("public_token,active,updated_at")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw error;
  return data ? {
    token: data.public_token,
    active: data.active,
    updatedAt: data.updated_at,
  } : null;
}

export async function publishSharedPattern(projectId) {
  if (!isSupabaseConfigured()) throw new Error("Cloud accounts are not configured");
  const supabase = createClient();
  const { data, error } = await supabase.rpc("publish_shared_pattern", {
    p_project_id: projectId,
  });
  if (error) throw error;
  if (!data) throw new Error("The public link was not created");
  return String(data);
}

export async function revokeSharedPattern(projectId) {
  if (!isSupabaseConfigured()) throw new Error("Cloud accounts are not configured");
  const supabase = createClient();
  const { error } = await supabase
    .from("shared_patterns")
    .update({ active: false })
    .eq("project_id", projectId);
  if (error) throw error;
}

export async function loadPublicSharedPattern(token) {
  if (!isSupabaseConfigured()) throw new Error("Cloud accounts are not configured");
  const normalizedToken = String(token || "").trim();
  if (!/^[a-f0-9]{32}$/i.test(normalizedToken)) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_shared_pattern", {
    p_public_token: normalizedToken,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return sharedRowToPattern(row, normalizedToken);
}

export function sharedRowToPattern(row, token) {
  return {
    id: row.project_id,
    name: row.name,
    sequence: row.sequence,
    pointCount: row.point_count,
    lineCount: row.line_count,
    algorithm: "shared-pattern",
    sharedToken: token,
    createdAt: row.updated_at,
    updatedAt: row.updated_at,
  };
}

export function createSharedPatternUrl(token, origin) {
  const base = String(origin || "").replace(/\/$/, "");
  return `${base}/s/${encodeURIComponent(token)}`;
}
