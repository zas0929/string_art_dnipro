export function patternToCloudProject(pattern, userId, previewPaths = {}) {
  return {
    id: pattern.id,
    user_id: userId,
    name: pattern.name || "Untitled project",
    sequence: pattern.sequence,
    point_count: pattern.pointCount,
    line_count: pattern.lineCount,
    algorithm: pattern.algorithm || "reference-v7",
    settings: {
      threadMm: pattern.threadMm,
      sharpness: pattern.sharpness,
      clarity: pattern.clarity,
    },
    source_preview_path: previewPaths.source || null,
    artwork_preview_path: previewPaths.artwork || null,
  };
}

export function cloudProjectToPattern(row, previewUrls = {}) {
  return {
    id: row.id,
    ownerId: row.user_id,
    name: row.name,
    sequence: row.sequence,
    pointCount: row.point_count,
    lineCount: row.line_count,
    algorithm: row.algorithm,
    threadMm: row.settings?.threadMm,
    sharpness: row.settings?.sharpness,
    clarity: row.settings?.clarity,
    sourcePreviewDataUrl: previewUrls.source || null,
    artworkPreviewDataUrl: previewUrls.artwork || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function progressToCloudRow(progress, userId) {
  return {
    project_id: progress.patternId,
    user_id: userId,
    step_index: progress.stepIndex,
    speed_ms: progress.speedMs,
    voice_enabled: progress.voiceEnabled,
  };
}

export function cloudRowToProgress(row) {
  if (!row) return null;
  return {
    patternId: row.project_id,
    stepIndex: row.step_index,
    speedMs: row.speed_ms,
    voiceEnabled: row.voice_enabled,
    updatedAt: row.updated_at,
  };
}
