import {
  cloudProjectToPattern,
  cloudRowToProgress,
  patternToCloudProject,
  progressToCloudRow,
} from "../core/cloud-project-mapper.js";

const PREVIEW_BUCKET = "project-previews";
const PROJECT_COLUMNS = [
  "id",
  "user_id",
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
    async getAccount() {
      const { data, error } = await supabase
        .from("profiles")
        .select("role,plan")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      const unlimited = data?.role === "admin" || data?.plan === "unlimited";
      return {
        mode: "cloud",
        role: data?.role || "user",
        plan: data?.plan || "free",
        projectLimit: unlimited ? null : 5,
      };
    },

    async listProjects() {
      const [projectsResult, progressResult] = await Promise.all([
        supabase
          .from("projects")
          .select(PROJECT_COLUMNS)
          .order("updated_at", { ascending: false }),
        supabase
          .from("build_progress")
          .select("project_id,step_index,speed_ms,voice_enabled,updated_at"),
      ]);
      if (projectsResult.error) throw projectsResult.error;
      if (progressResult.error) throw progressResult.error;

      const progressByProject = new Map(
        (progressResult.data || []).map((row) => [row.project_id, cloudRowToProgress(row)]),
      );
      return Promise.all((projectsResult.data || []).map(async (row) => ({
        ...await hydratePattern(row),
        buildProgress: progressByProject.get(row.id) || null,
      })));
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

    async findProject(projectId) {
      const { data, error } = await supabase
        .from("projects")
        .select(PROJECT_COLUMNS)
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data ? hydratePattern(data) : null;
    },

    async saveProject(pattern) {
      let effectivePattern = pattern;
      let existing = await findProjectRow(supabase, pattern.id);

      if (!existing) {
        const initialRow = patternToCloudProject(pattern, userId);
        const { error: insertError } = await supabase.from("projects").insert(initialRow);

        if (insertError && !isUniqueViolation(insertError)) throw insertError;
        if (insertError) {
          existing = await findProjectRow(supabase, pattern.id);
          if (!existing) {
            effectivePattern = { ...pattern, id: crypto.randomUUID() };
            const { error: retryError } = await supabase
              .from("projects")
              .insert(patternToCloudProject(effectivePattern, userId));
            if (retryError) throw retryError;
          }
        }
      }

      const previewPaths = await uploadPreviews(effectivePattern, userId, supabase, {
        source: existing?.source_preview_path || null,
        artwork: existing?.artwork_preview_path || null,
      });
      const row = patternToCloudProject(effectivePattern, userId, previewPaths);
      const { user_id: _ownerId, ...updateRow } = row;
      const { data, error } = await supabase
        .from("projects")
        .update(updateRow)
        .eq("id", effectivePattern.id)
        .select(PROJECT_COLUMNS)
        .single();
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
      const row = progressToCloudRow(progress, userId);
      const { error } = await supabase.rpc("save_project_progress", {
        p_project_id: row.project_id,
        p_step_index: row.step_index,
        p_speed_ms: row.speed_ms,
        p_voice_enabled: row.voice_enabled,
      });
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

async function findProjectRow(supabase, projectId) {
  const { data, error } = await supabase
    .from("projects")
    .select("id,user_id,source_preview_path,artwork_preview_path")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function isUniqueViolation(error) {
  return error?.code === "23505";
}

async function uploadPreviews(pattern, userId, supabase, existingPaths = {}) {
  const paths = { ...existingPaths };
  const uploads = [];
  if (pattern.sourcePreviewDataUrl) uploads.push((async () => {
    const path = `${userId}/${pattern.id}/source.jpg`;
    if (await uploadDataUrl(supabase, path, pattern.sourcePreviewDataUrl)) {
      paths.source = path;
    }
  })());
  if (pattern.artworkPreviewDataUrl) uploads.push((async () => {
    const path = `${userId}/${pattern.id}/artwork.png`;
    if (await uploadDataUrl(supabase, path, pattern.artworkPreviewDataUrl)) {
      paths.artwork = path;
    }
  })());
  await Promise.all(uploads);
  return paths;
}

async function uploadDataUrl(supabase, path, dataUrl) {
  const response = await fetch(dataUrl);
  if (!response.ok) return false;
  const blob = await response.blob();
  if (!blob.type.toLowerCase().startsWith("image/")) return false;
  const { error } = await supabase.storage
    .from(PREVIEW_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: true });
  if (error) throw error;
  return true;
}

async function createSignedPreviewUrl(supabase, path) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(PREVIEW_BUCKET)
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
