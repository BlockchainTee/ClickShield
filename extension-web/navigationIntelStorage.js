const CACHE_BUNDLE_KEY = 'clickshield.navigation-intel.cache.bundle';
const LAST_KNOWN_GOOD_BUNDLE_KEY = 'clickshield.navigation-intel.last-known-good.bundle';
const METADATA_KEY = 'clickshield.navigation-intel.metadata';

function cloneJsonValue(value) {
  if (value === null) {
    return null;
  }

  const serialized = JSON.stringify(value);
  if (typeof serialized !== 'string') {
    return null;
  }

  return JSON.parse(serialized);
}

function memoryState() {
  return {
    [CACHE_BUNDLE_KEY]: null,
    [LAST_KNOWN_GOOD_BUNDLE_KEY]: null,
    [METADATA_KEY]: null,
  };
}

export function createMemoryNavigationIntelStorage() {
  const state = memoryState();

  return {
    async loadRawBundle(slot) {
      const key = slot === 'cache' ? CACHE_BUNDLE_KEY : LAST_KNOWN_GOOD_BUNDLE_KEY;
      return cloneJsonValue(state[key]);
    },
    async saveRawBundle(slot, bundle) {
      const key = slot === 'cache' ? CACHE_BUNDLE_KEY : LAST_KNOWN_GOOD_BUNDLE_KEY;
      state[key] = cloneJsonValue(bundle);
    },
    async loadMetadata() {
      return cloneJsonValue(state[METADATA_KEY]);
    },
    async saveMetadata(metadata) {
      state[METADATA_KEY] = cloneJsonValue(metadata);
    },
  };
}

function defaultStorageArea() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return chrome.storage.local;
  }

  return null;
}

export function createNavigationIntelFeedStorage(storageArea = defaultStorageArea()) {
  if (!storageArea) {
    return createMemoryNavigationIntelStorage();
  }

  return {
    async loadRawBundle(slot) {
      const key = slot === 'cache' ? CACHE_BUNDLE_KEY : LAST_KNOWN_GOOD_BUNDLE_KEY;
      const values = await storageArea.get([key]);
      return cloneJsonValue(values[key] ?? null);
    },
    async saveRawBundle(slot, bundle) {
      const key = slot === 'cache' ? CACHE_BUNDLE_KEY : LAST_KNOWN_GOOD_BUNDLE_KEY;
      await storageArea.set({
        [key]: cloneJsonValue(bundle),
      });
    },
    async loadMetadata() {
      const values = await storageArea.get([METADATA_KEY]);
      return cloneJsonValue(values[METADATA_KEY] ?? null);
    },
    async saveMetadata(metadata) {
      await storageArea.set({
        [METADATA_KEY]: cloneJsonValue(metadata),
      });
    },
  };
}
