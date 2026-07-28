export const LOCAL_PROJECT_LIMIT = 5;

export function updateProjectIndex(index, project, limit = LOCAL_PROJECT_LIMIT) {
  const entries = Array.isArray(index) ? index.filter(isProjectEntry) : [];
  const existingIndex = entries.findIndex((entry) => entry.id === project.id);
  const entry = toProjectEntry(project);

  if (existingIndex >= 0) {
    entries.splice(existingIndex, 1);
  } else if (entries.length >= limit) {
    return { entries, saved: false };
  }

  entries.unshift(entry);
  return {
    entries: entries.slice(0, limit),
    saved: true,
  };
}

export function removeProjectFromIndex(index, projectId) {
  return (Array.isArray(index) ? index : []).filter((entry) => entry?.id !== projectId);
}

export function toProjectEntry(project) {
  return {
    id: project.id,
    name: project.name,
    pointCount: project.pointCount,
    lineCount: project.lineCount,
    artworkPreviewDataUrl: project.artworkPreviewDataUrl || null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt || project.createdAt,
  };
}

function isProjectEntry(entry) {
  return Boolean(entry && typeof entry.id === "string" && entry.id);
}
