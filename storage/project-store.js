import { getMigrationCandidates } from "../core/project-migration.js";
import { createClient } from "../lib/supabase/client.js";
import { isSupabaseConfigured } from "../lib/supabase/config.js";
import { createCloudProjectStore } from "./cloud-project-store.js";
import {
  activateLocalProject,
  cacheLocalProject,
  completeCloudSync,
  deleteLocalProject,
  listLocalProjects,
  loadCloudSyncQueue,
  loadBuildProgress,
  loadLatestPattern,
  loadLocalProject,
  queueCloudSync,
  renameLocalProject,
  saveBuildProgress,
  saveLatestPattern,
} from "./local-project-store.js";
import {
  isRetryableCloudError,
  newestProgress,
} from "../core/cloud-sync.js";

const MIGRATION_KEY_PREFIX = "string-art-cloud-migration";
let activeStorePromise;
let activeStoreIdentity;
let removeOnlineSyncListener;

export async function getProjectStore() {
  const identity = await resolveProjectIdentity();
  if (!activeStorePromise || activeStoreIdentity !== identity.key) {
    removeOnlineSyncListener?.();
    removeOnlineSyncListener = undefined;
    activeStoreIdentity = identity.key;
    activeStorePromise = createProjectStore(identity);
  }
  return activeStorePromise;
}

export function resetProjectStore() {
  removeOnlineSyncListener?.();
  removeOnlineSyncListener = undefined;
  activeStorePromise = undefined;
  activeStoreIdentity = undefined;
}

async function resolveProjectIdentity() {
  if (!isSupabaseConfigured()) {
    return { key: "local:unconfigured", supabase: null, userId: null };
  }
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  const userId = data?.session?.user?.id;
  if (error || !userId) {
    return { key: "local:guest", supabase: null, userId: null };
  }
  return { key: `cloud:${userId}`, supabase, userId };
}

async function createProjectStore({ supabase, userId }) {
  if (!supabase || !userId) {
    removeOnlineSyncListener?.();
    removeOnlineSyncListener = undefined;
    return createLocalAdapter();
  }

  const cloud = createCloudProjectStore(supabase, userId);
  const store = createCloudAdapter(cloud, userId);
  await migrateLocalProjects(cloud, userId, store);
  installOnlineSync(store);
  void store.syncPending().catch((error) => {
    store.syncError = error;
  });
  return store;
}

function createLocalAdapter() {
  return {
    mode: "local",
    migrationError: null,
    getAccount: async () => ({ mode: "local", role: "guest", plan: "free", projectLimit: 5 }),
    async listProjects() {
      const projects = await listLocalProjects();
      return Promise.all(projects.map(async (project) => ({
        ...project,
        buildProgress: await loadBuildProgress(project.id),
      })));
    },
    loadLatestPattern,
    saveLatestPattern,
    activateProject: activateLocalProject,
    renameProject: renameLocalProject,
    deleteProject: deleteLocalProject,
    saveProgress: saveBuildProgress,
    loadProgress: loadBuildProgress,
  };
}

function createCloudAdapter(cloud, userId) {
  let syncPromise;
  const store = {
    mode: "cloud",
    migrationError: null,
    syncError: null,
    async getAccount() {
      try {
        return await cloud.getAccount();
      } catch (error) {
        if (!canRetry(error)) throw error;
        return { mode: "cloud", role: "user", plan: "free", projectLimit: 5, offline: true };
      }
    },
    async listProjects() {
      try {
        const projects = await cloud.listProjects();
        await Promise.all(projects.map(async (project) => {
          await cacheLocalProject(project);
          if (project.buildProgress) await saveBuildProgress(project.buildProgress);
        }));
        return projects;
      } catch (error) {
        if (!canRetry(error)) throw error;
        return listCachedProjects();
      }
    },
    async loadLatestPattern() {
      const localPattern = await loadLatestPattern();
      if (!localPattern) return null;
      const pending = await loadCloudSyncQueue(userId);
      if (pending.projects.includes(localPattern.id)) {
        void store.syncPending().catch((error) => {
          store.syncError = error;
        });
        return localPattern;
      }

      try {
        const cloudPattern = await cloud.findProject(localPattern.id);
        if (cloudPattern) {
          await saveLatestPattern(cloudPattern);
          return cloudPattern;
        }

        await queueCloudSync(userId, "projects", localPattern.id);
        const savedPattern = await cloud.saveProject(localPattern);
        const synced = await completeProjectSyncIfCurrent(
          userId,
          localPattern,
          savedPattern,
          true,
        );
        return synced ? savedPattern : loadLatestPattern();
      } catch (error) {
        if (!canRetry(error)) throw error;
        await queueCloudSync(userId, "projects", localPattern.id);
        return localPattern;
      }
    },
    async saveLatestPattern(pattern) {
      const localResult = await saveLatestPattern(pattern);
      await queueCloudSync(userId, "projects", localResult.pattern.id);
      try {
        const savedPattern = await cloud.saveProject(localResult.pattern);
        const synced = await completeProjectSyncIfCurrent(
          userId,
          localResult.pattern,
          savedPattern,
          true,
        );
        return {
          ...localResult,
          pattern: synced ? savedPattern : await loadLatestPattern(),
          savedToCloud: synced,
          pendingSync: !synced,
        };
      } catch (error) {
        if (!canRetry(error)) throw error;
        return { ...localResult, savedToCloud: false, pendingSync: true };
      }
    },
    async activateProject(projectId) {
      try {
        const project = await cloud.loadProject(projectId);
        await saveLatestPattern(project);
        return project;
      } catch (error) {
        if (!canRetry(error)) throw error;
        return activateLocalProject(projectId);
      }
    },
    async renameProject(projectId, name) {
      const localProject = await renameLocalProject(projectId, name);
      if (!localProject) {
        const project = await cloud.renameProject(projectId, name);
        await cacheLocalProject(project);
        return project;
      }
      await queueCloudSync(userId, "projects", projectId);
      try {
        const project = await cloud.saveProject(localProject);
        const synced = await completeProjectSyncIfCurrent(userId, localProject, project);
        return synced ? project : loadLocalProject(projectId);
      } catch (error) {
        if (!canRetry(error)) throw error;
        return localProject;
      }
    },
    async deleteProject(projectId) {
      await deleteLocalProject(projectId);
      await queueCloudSync(userId, "deletions", projectId);
      try {
        await cloud.deleteProject(projectId);
        await completeCloudSync(userId, "deletions", projectId);
      } catch (error) {
        if (!canRetry(error)) throw error;
      }
    },
    async saveProgress(progress) {
      await saveBuildProgress(progress);
      await queueCloudSync(userId, "progress", progress.patternId);
      try {
        await cloud.saveProgress(progress);
        await completeProgressSyncIfCurrent(userId, progress);
      } catch (error) {
        if (!canRetry(error)) throw error;
      }
    },
    async loadProgress(projectId) {
      const localProgress = await loadBuildProgress(projectId);
      try {
        const cloudProgress = await cloud.loadProgress(projectId);
        const progress = newestProgress(localProgress, cloudProgress);
        if (progress === localProgress && localProgress !== cloudProgress) {
          await queueCloudSync(userId, "progress", projectId);
        } else if (progress) {
          await saveBuildProgress(progress);
        }
        return progress;
      } catch (error) {
        if (!canRetry(error)) throw error;
        return localProgress;
      }
    },
    async syncPending() {
      if (!syncPromise) {
        syncPromise = (async () => {
          await migrateLocalProjects(cloud, userId, store);
          await flushPendingCloudSync(cloud, userId);
          store.syncError = null;
        })().finally(() => {
          syncPromise = undefined;
        });
      }
      return syncPromise;
    },
  };
  return store;

  function canRetry(error) {
    const online = typeof navigator === "undefined" ? true : navigator.onLine;
    return isRetryableCloudError(error, online);
  }
}

async function listCachedProjects() {
  const projects = await listLocalProjects();
  return Promise.all(projects.map(async (project) => ({
    ...project,
    buildProgress: await loadBuildProgress(project.id),
  })));
}

async function flushPendingCloudSync(cloud, userId) {
  const queue = await loadCloudSyncQueue(userId);

  for (const projectId of queue.deletions) {
    await cloud.deleteProject(projectId);
    await completeCloudSync(userId, "deletions", projectId);
  }

  for (const projectId of queue.projects) {
    const pattern = await loadLocalProject(projectId);
    if (!pattern) {
      await completeCloudSync(userId, "projects", projectId);
      continue;
    }
    const savedPattern = await cloud.saveProject(pattern);
    await completeProjectSyncIfCurrent(userId, pattern, savedPattern);
  }

  for (const projectId of queue.progress) {
    const progress = await loadBuildProgress(projectId);
    if (!progress) {
      await completeCloudSync(userId, "progress", projectId);
      continue;
    }
    await cloud.saveProgress(progress);
    await completeProgressSyncIfCurrent(userId, progress);
  }
}

async function completeProjectSyncIfCurrent(
  userId,
  sourcePattern,
  savedPattern,
  activate = false,
) {
  let current = await loadLocalProject(sourcePattern.id);
  if (!current) {
    const latest = await loadLatestPattern();
    if (latest?.id === sourcePattern.id) current = latest;
  }
  if (!hasSameRevision(current, sourcePattern)) return false;

  await completeCloudSync(userId, "projects", sourcePattern.id);
  if (savedPattern.id !== sourcePattern.id) {
    await completeCloudSync(userId, "projects", savedPattern.id);
  }
  await cacheLocalProject(savedPattern);
  if (activate) await activateLocalProject(savedPattern.id);
  return true;
}

async function completeProgressSyncIfCurrent(userId, progress) {
  const current = await loadBuildProgress(progress.patternId);
  if (!hasSameRevision(current, progress)) return false;
  await completeCloudSync(userId, "progress", progress.patternId);
  return true;
}

function hasSameRevision(current, saved) {
  return Boolean(current && current.updatedAt === saved.updatedAt);
}

function installOnlineSync(store) {
  removeOnlineSyncListener?.();
  removeOnlineSyncListener = undefined;
  if (typeof window === "undefined") return;

  const handleOnline = () => {
    void store.syncPending().catch((error) => {
      store.syncError = error;
    });
  };
  window.addEventListener("online", handleOnline);
  removeOnlineSyncListener = () => window.removeEventListener("online", handleOnline);
}

async function migrateLocalProjects(cloud, userId, store) {
  const migrationKey = `${MIGRATION_KEY_PREFIX}:${userId}`;
  if (window.localStorage.getItem(migrationKey) === "complete") return;

  try {
    const [localEntries, cloudProjects] = await Promise.all([
      listLocalProjects(),
      cloud.listProjects(),
    ]);
    const localProjects = (await Promise.all(
      localEntries.map(({ id }) => loadLocalProject(id)),
    )).filter(Boolean);
    const candidates = getMigrationCandidates(localProjects, cloudProjects);
    for (const project of candidates) await cloud.saveProject(project);
    window.localStorage.setItem(migrationKey, "complete");
  } catch (error) {
    store.migrationError = error;
  }
}
