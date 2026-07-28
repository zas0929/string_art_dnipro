import {
  cloudProjectToPattern,
  cloudRowToProgress,
  patternToCloudProject,
  progressToCloudRow,
} from "../core/cloud-project-mapper.js";

const PREVIEW_BUCKET = "project-previews";
const PROJECT_COLUMNS = [
  "id",
  "name",
  "sequence",
  "point_count",
  "line_count",
  "algorithm",
  "settings",
  "source_preview_path",
  "artwork_preview_path",
  "created_at",
  "updated_at",
].join(",");

export function createCloudProjectStore(supabase, userId) {
  if (!supabase || !userId) throw new Error("Cloud project storage requires an authenticated user");

  return {
    async listProjects() {
      const { data, error } = await supabase
        .from("projects")
        .select(PROJECT_COLUMNS)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return Promise.all((data || []).map(hydratePattern));
    },

    async loadProject(projectId) {
      const { data, error } = await supabase
        .from("projects")
        .select(PROJECT_COLUMNS)
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return hydratePattern(data);
    },

    async saveProject(pattern) {
      const { data: existing, error: lookupError } = await supabase
        .from("projects")
        .select("id,source_preview_path,artwork_preview_path")
        .eq("id", pattern.id)
        .maybeSingle();
      if (lookupError) throw lookupError;

      const previewPaths = await uploadPreviews(pattern, userId, supabase, {
        source: existing?.source_preview_path || null,
        artwork: existing?.artwork_preview_path || null,
      });
      const row = patternToCloudProject(pattern, userId, previewPaths);

      const query = existing
        ? supabase.from("projects").update(row).eq("id", pattern.id)
        : supabase.from("projects").insert(row);
      const { data, error } = await query.select(PROJECT_COLUMNS).single();
      if (error) throw error;
      return hydratePattern(data);
    },

    async renameProject(projectId, name) {
      const normalizedName = String(name || "").trim() || "Untitled project";
      const { data, error } = await supabase
        .from("projects")
        .update({ name: normalizedName })
        .eq("id", projectId)
        .select(PROJECT_COLUMNS)
        .single();
      if (error) throw error;
      return hydratePattern(data);
    },

    async deleteProject(projectId) {
      const { error } = await supabase.from("projects").delete().eq("id", projectId);
      if (error) throw error;
      const { error: storageError } = await supabase.storage
        .from(PREVIEW_BUCKET)
        .remove([
          `${userId}/${projectId}/source.jpg`,
          `${userId}/${projectId}/artwork.png`,
        ]);
      if (storageError) throw storageError;
    },

    async saveProgress(progress) {
      const { error } = await supabase
        .from("build_progress")
        .upsert(progressToCloudRow(progress, userId), { onConflict: "project_id" });
      if (error) throw error;
    },

    async loadProgress(projectId) {
      const { data, error } = await supabase
        .from("build_progress")
        .select("project_id,step_index,speed_ms,voice_enabled,updated_at")
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) throw error;
      return cloudRowToProgress(data);
    },
  };

  async function hydratePattern(row) {
    const [source, artwork] = await Promise.all([
      createSignedPreviewUrl(supabase, row.source_preview_path),
      createSignedPreviewUrl(supabase, row.artwork_preview_path),
    ]);
    return cloudProjectToPattern(row, { source, artwork });
  }
}

async function uploadPreviews(pattern, userId, supabase, existingPaths = {}) {
  const paths = { ...existingPaths };
  if (pattern.sourcePreviewDataUrl) {
    paths.source = `${userId}/${pattern.id}/source.jpg`;
    await uploadDataUrl(supabase, paths.source, pattern.sourcePreviewDataUrl);
  }
  if (pattern.artworkPreviewDataUrl) {
    paths.artwork = `${userId}/${pattern.id}/artwork.png`;
    await uploadDataUrl(supabase, paths.artwork, pattern.artworkPreviewDataUrl);
  }
  return paths;
}

async function uploadDataUrl(supabase, path, dataUrl) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const { error } = await supabase.storage
    .from(PREVIEW_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: true });
  if (error) throw error;
}

async function createSignedPreviewUrl(supabase, path) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(PREVIEW_BUCKET)
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
