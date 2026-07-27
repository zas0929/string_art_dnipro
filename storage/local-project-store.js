const DATABASE_NAME = "string-art-generator";
const DATABASE_VERSION = 1;
const STORE_NAME = "local-project";
const LATEST_PATTERN_KEY = "latest-pattern";

export async function saveLatestPattern(pattern) {
  return putRecord(LATEST_PATTERN_KEY, pattern);
}

export async function loadLatestPattern() {
  return getRecord(LATEST_PATTERN_KEY);
}

export async function saveBuildProgress(progress) {
  return putRecord(`build-progress:${progress.patternId}`, progress);
}

export async function loadBuildProgress(patternId) {
  return getRecord(`build-progress:${patternId}`);
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
