import {
  LOCAL_PROJECT_LIMIT,
  removeProjectFromIndex,
  updateProjectIndex,
} from "../core/project-library.js";
import {
  dequeueCloudSync,
  enqueueCloudSync,
  normalizeCloudSyncQueue,
} from "../core/cloud-sync.js";

const DATABASE_NAME = "string-art-generator";
const DATABASE_VERSION = 1;
const STORE_NAME = "local-project";
const LATEST_PATTERN_KEY = "latest-pattern";
const PROJECT_INDEX_KEY = "project-index";
const CLOUD_SYNC_QUEUE_KEY = "cloud-sync-queue";

export { LOCAL_PROJECT_LIMIT };

export async function saveLatestPattern(pattern) {
  const existing = await getRecord(projectKey(pattern.id));
  const now = new Date().toISOString();
  const savedPattern = {
    ...pattern,
    createdAt: existing?.createdAt || pattern.createdAt || now,
    updatedAt: now,
  };
  await putRecord(LATEST_PATTERN_KEY, savedPattern);
  const library = await saveProjectRecord(savedPattern);
  return { pattern: savedPattern, savedToLibrary: library.saved };
}

export async function loadLatestPattern() {
  return getRecord(LATEST_PATTERN_KEY);
}

export async function listLocalProjects() {
  let index = await getRecord(PROJECT_INDEX_KEY);
  if (!Array.isArray(index) || index.length === 0) {
    const legacyPattern = await loadLatestPattern();
    if (legacyPattern?.id) {
      await saveProjectRecord(legacyPattern);
      index = await getRecord(PROJECT_INDEX_KEY);
    }
  }
  return Array.isArray(index) ? index : [];
}

export async function loadLocalProject(projectId) {
  if (!projectId) return null;
  return getRecord(projectKey(projectId));
}

export async function cacheLocalProject(pattern) {
  if (!pattern?.id) return null;
  await saveProjectRecord(pattern);
  const latest = await loadLatestPattern();
  if (latest?.id === pattern.id) await putRecord(LATEST_PATTERN_KEY, pattern);
  return pattern;
}

export async function activateLocalProject(projectId) {
  const project = await loadLocalProject(projectId);
  if (!project) return null;
  await putRecord(LATEST_PATTERN_KEY, project);
  return project;
}

export async function renameLocalProject(projectId, name) {
  const project = await loadLocalProject(projectId);
  if (!project) return null;
  const updated = {
    ...project,
    name: String(name || "").trim() || project.name,
    updatedAt: new Date().toISOString(),
  };
  await putRecord(projectKey(projectId), updated);
  const index = await getRecord(PROJECT_INDEX_KEY);
  const nextIndex = updateProjectIndex(index, updated).entries;
  await putRecord(PROJECT_INDEX_KEY, nextIndex);
  const latest = await loadLatestPattern();
  if (latest?.id === projectId) await putRecord(LATEST_PATTERN_KEY, updated);
  return updated;
}

export async function deleteLocalProject(projectId) {
  const index = await getRecord(PROJECT_INDEX_KEY);
  const nextIndex = removeProjectFromIndex(index, projectId);
  await deleteRecord(projectKey(projectId));
  await deleteRecord(`build-progress:${projectId}`);
  await putRecord(PROJECT_INDEX_KEY, nextIndex);

  const latest = await loadLatestPattern();
  if (latest?.id === projectId) {
    const replacement = nextIndex.length ? await loadLocalProject(nextIndex[0].id) : null;
    if (replacement) await putRecord(LATEST_PATTERN_KEY, replacement);
    else await deleteRecord(LATEST_PATTERN_KEY);
  }
}

export async function saveBuildProgress(progress) {
  return putRecord(`build-progress:${progress.patternId}`, progress);
}

export async function loadBuildProgress(patternId) {
  return getRecord(`build-progress:${patternId}`);
}

export async function loadCloudSyncQueue(scope) {
  return normalizeCloudSyncQueue(await getRecord(cloudSyncQueueKey(scope)));
}

export async function queueCloudSync(scope, type, id) {
  return updateRecord(cloudSyncQueueKey(scope), (queue) => (
    enqueueCloudSync(queue, type, id)
  ));
}

export async function completeCloudSync(scope, type, id) {
  return updateRecord(cloudSyncQueueKey(scope), (queue) => (
    dequeueCloudSync(queue, type, id)
  ));
}

async function saveProjectRecord(pattern) {
  const index = await getRecord(PROJECT_INDEX_KEY);
  const next = updateProjectIndex(index, pattern);
  if (!next.saved) return next;
  await putRecord(projectKey(pattern.id), pattern);
  await putRecord(PROJECT_INDEX_KEY, next.entries);
  return next;
}

function projectKey(projectId) {
  return `project:${projectId}`;
}

function cloudSyncQueueKey(scope) {
  return `${CLOUD_SYNC_QUEUE_KEY}:${scope || "default"}`;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Local storage did not respond in time"));
    }, 10000);
    const finish = (callback, value) => {
      if (settled) {
        if (value && typeof value.close === "function") value.close();
        return;
      }
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => finish(resolve, request.result);
    request.onerror = () => finish(
      reject,
      request.error || new Error("Could not open local storage"),
    );
    request.onblocked = () => finish(
      reject,
      new Error("Local storage is locked by another tab"),
    );
  });
}

async function putRecord(key, value) {
  if (typeof indexedDB === "undefined") return;
  const database = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not save data"));
      transaction.onabort = () => reject(transaction.error || new Error("Save was cancelled"));
    });
  } finally {
    database.close();
  }
}

async function getRecord(key) {
  if (typeof indexedDB === "undefined") return null;
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Could not read data"));
    });
  } finally {
    database.close();
  }
}

async function updateRecord(key, updater) {
  if (typeof indexedDB === "undefined") return updater(null);
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      let nextValue;
      request.onsuccess = () => {
        try {
          nextValue = updater(request.result || null);
          store.put(nextValue, key);
        } catch (error) {
          transaction.abort();
          reject(error);
        }
      };
      request.onerror = () => reject(request.error || new Error("Could not read data"));
      transaction.oncomplete = () => resolve(nextValue);
      transaction.onerror = () => reject(
        transaction.error || new Error("Could not update data"),
      );
      transaction.onabort = () => reject(
        transaction.error || new Error("Update was cancelled"),
      );
    });
  } finally {
    database.close();
  }
}

async function deleteRecord(key) {
  if (typeof indexedDB === "undefined") return;
  const database = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not delete data"));
      transaction.onabort = () => reject(transaction.error || new Error("Delete was cancelled"));
    });
  } finally {
    database.close();
  }
}
