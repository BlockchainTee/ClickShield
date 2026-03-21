import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMemoryNavigationIntelStorage,
  createNavigationIntelFeedStorage,
} from '../navigationIntelStorage.js';

function createFakeStorageArea() {
  const state = new Map();

  return {
    async get(keys) {
      const result = {};
      for (const key of keys) {
        result[key] = state.has(key) ? state.get(key) : undefined;
      }
      return result;
    },
    async set(values) {
      for (const [key, value] of Object.entries(values)) {
        state.set(key, value);
      }
    },
  };
}

test('browser storage adapter persists cache and metadata deterministically', async () => {
  const storage = createNavigationIntelFeedStorage(createFakeStorageArea());
  const bundle = {
    bundleVersion: '2026-03-21T18:00:00Z.cache',
    maliciousDomains: {
      items: [],
    },
  };
  const metadata = {
    cacheUpdatedAt: '2026-03-21T18:00:00.000Z',
    cacheBundleVersion: '2026-03-21T18:00:00Z.cache',
  };

  await storage.saveRawBundle('cache', bundle);
  await storage.saveMetadata(metadata);

  assert.deepEqual(await storage.loadRawBundle('cache'), bundle);
  assert.deepEqual(await storage.loadMetadata(), metadata);
});

test('memory storage adapter returns null for missing slots and round-trips last-known-good', async () => {
  const storage = createMemoryNavigationIntelStorage();

  assert.equal(await storage.loadRawBundle('cache'), null);
  assert.equal(await storage.loadMetadata(), null);

  await storage.saveRawBundle('lastKnownGood', {
    bundleVersion: '2026-03-21T19:00:00Z.last-known-good',
  });

  assert.deepEqual(await storage.loadRawBundle('lastKnownGood'), {
    bundleVersion: '2026-03-21T19:00:00Z.last-known-good',
  });
});
