const NETWORK_ERROR_PATTERN = /(?:failed to fetch|fetch failed|network ?error|network request failed|load failed|connection (?:lost|refused|reset)|timed? ?out|timeout)/i;

export const EMPTY_CLOUD_SYNC_QUEUE = Object.freeze({
  projects: Object.freeze([]),
  progress: Object.freeze([]),
  deletions: Object.freeze([]),
});

export function isRetryableCloudError(error, online = true) {
  if (online === false) return true;
  const status = Number(error?.status || error?.statusCode || 0);
  if (status === 0 && NETWORK_ERROR_PATTERN.test(String(error?.message || error || ""))) {
    return true;
  }
  return status === 408 || status === 429 || status >= 500;
}

export function normalizeCloudSyncQueue(queue) {
  return {
    projects: normalizeIds(queue?.projects),
    progress: normalizeIds(queue?.progress),
    deletions: normalizeIds(queue?.deletions),
  };
}

export function enqueueCloudSync(queue, type, id) {
  const next = normalizeCloudSyncQueue(queue);
  if (!Object.hasOwn(next, type) || typeof id !== "string" || !id) return next;
  next[type] = [...new Set([...next[type], id])];
  if (type === "deletions") {
    next.projects = next.projects.filter((projectId) => projectId !== id);
    next.progress = next.progress.filter((projectId) => projectId !== id);
  }
  return next;
}

export function dequeueCloudSync(queue, type, id) {
  const next = normalizeCloudSyncQueue(queue);
  if (!Object.hasOwn(next, type)) return next;
  next[type] = next[type].filter((entryId) => entryId !== id);
  return next;
}

export function newestProgress(localProgress, cloudProgress) {
  if (!localProgress) return cloudProgress || null;
  if (!cloudProgress) return localProgress;
  const localTime = Date.parse(localProgress.updatedAt || "") || 0;
  const cloudTime = Date.parse(cloudProgress.updatedAt || "") || 0;
  return localTime >= cloudTime ? localProgress : cloudProgress;
}

function normalizeIds(ids) {
  return [...new Set(
    (Array.isArray(ids) ? ids : []).filter((id) => typeof id === "string" && id),
  )];
}
