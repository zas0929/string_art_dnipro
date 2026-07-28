import { getMigrationCandidates } from "../core/project-migration.js";
import { createClient } from "../lib/supabase/client.js";
import { isSupabaseConfigured } from "../lib/supabase/config.js";
import { createCloudProjectStore } from "./cloud-project-store.js";
import {
  activateLocalProject,
  deleteLocalProject,
  listLocalProjects,
  loadBuildProgress,
  loadLatestPattern,
  loadLocalProject,
  renameLocalProject,
  saveBuildProgress,
  saveLatestPattern,
} from "./local-project-store.js";

const MIGRATION_KEY_PREFIX = "string-art-cloud-migration";
let activeStorePromise;
let activeStoreIdentity;

export async function getProjectStore() {
  const identity = await resolveProjectIdentity();
  if (!activeStorePromise || activeStoreIdentity !== identity.key) {
    activeStoreIdentity = identity.key;
    activeStorePromise = createProjectStore(identity);
  }
  return activeStorePromise;
}

export function resetProjectStore() {
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
  if (!supabase || !userId) return createLocalAdapter();

  const cloud = createCloudProjectStore(supabase, userId);
  const store = createCloudAdapter(cloud);
  await migrateLocalProjects(cloud, userId, store);
  return store;
}

function createLocalAdapter() {
  return {
    mode: "local",
    migrationError: null,
    getAccount: async () => ({ mode: "local", role: "guest", plan: "free", projectLimit: 5 }),
    listProjects: listLocalProjects,
    loadLatestPattern,
    saveLatestPattern,
    activateProject: activateLocalProject,
    renameProject: renameLocalProject,
    deleteProject: deleteLocalProject,
    saveProgress: saveBuildProgress,
    loadProgress: loadBuildProgress,
  };
}

function createCloudAdapter(cloud) {
  return {
    mode: "cloud",
    migrationError: null,
    getAccount: () => cloud.getAccount(),
    listProjects: () => cloud.listProjects(),
    loadLatestPattern,
    async saveLatestPattern(pattern) {
      const localResult = await saveLatestPattern(pattern);
      const savedPattern = await cloud.saveProject(localResult.pattern);
      return { ...localResult, pattern: savedPattern, savedToCloud: true };
    },
    async activateProject(projectId) {
      const project = await cloud.loadProject(projectId);
      await saveLatestPattern(project);
      return project;
    },
    async renameProject(projectId, name) {
      const project = await cloud.renameProject(projectId, name);
      await renameLocalProject(projectId, project.name);
      return project;
    },
    async deleteProject(projectId) {
      await cloud.deleteProject(projectId);
      await deleteLocalProject(projectId);
    },
    async saveProgress(progress) {
      await saveBuildProgress(progress);
      await cloud.saveProgress(progress);
    },
    async loadProgress(projectId) {
      return (await cloud.loadProgress(projectId)) || loadBuildProgress(projectId);
    },
  };
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
