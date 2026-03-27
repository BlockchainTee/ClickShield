import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  activateRuntimeNavigationIntelSnapshot,
  bootstrapRuntimeNavigationIntel,
  clearNavigationIntelSnapshot,
  getNavigationIntelSnapshotState,
  refreshNavigationIntelFromBackend,
  resolveNavigationDomainIntel,
  resolveNavigationIntelRefreshIntervalMinutes,
} from '../background.js';

const NOW = '2026-03-21T18:00:00Z';
const NOW_ISO = '2026-03-21T18:00:00.000Z';
const STATIC_KEY_ID = 'clickshield-static-v1';

beforeEach(() => {
  clearNavigationIntelSnapshot();
});

function makeJsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    },
  };
}

function serializeCanonicalJson(value) {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(serializeCanonicalJson).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${serializeCanonicalJson(value[key])}`);
  return `{${entries.join(',')}}`;
}

function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

function maliciousItem(overrides = {}) {
  const domain = overrides.domain ?? 'bad.example';
  const type = overrides.type ?? 'exact_host';

  return {
    id: overrides.id ?? `dom_${type}_${domain}`,
    type,
    identity: overrides.identity ?? `${type}:${domain}`,
    source: overrides.source ?? 'clickshield-curated',
    reasonCode: overrides.reasonCode ?? 'KNOWN_PHISHING_DOMAIN',
    confidence: overrides.confidence ?? 0.99,
    firstSeenAt: overrides.firstSeenAt ?? '2026-03-20T00:00:00Z',
    lastSeenAt: overrides.lastSeenAt ?? NOW,
    domain,
    scope: overrides.scope ?? type,
    classification: overrides.classification ?? 'phishing',
  };
}

function allowlistsSection(items, overrides = {}) {
  const feedVersion = overrides.feedVersion ?? '2026-03-21.5';
  const staleAfter = overrides.staleAfter ?? '2026-03-22T18:00:00Z';
  const expiresAt = overrides.expiresAt ?? '2026-03-23T18:00:00Z';
  const canonical = {
    feedType: 'allowlists',
    feedVersion,
    itemCount: items.length,
    staleAfter,
    expiresAt,
    items,
  };

  return {
    feedType: 'allowlists',
    feedVersion,
    itemCount: items.length,
    sha256: sha256Hex(serializeCanonicalJson(canonical)),
    staleAfter,
    expiresAt,
    items,
  };
}

function maliciousSection(items, overrides = {}) {
  const feedVersion = overrides.feedVersion ?? '2026-03-21.1';
  const staleAfter = overrides.staleAfter ?? '2026-03-22T18:00:00Z';
  const expiresAt = overrides.expiresAt ?? '2026-03-24T18:00:00Z';
  const canonical = {
    feedType: 'maliciousDomains',
    feedVersion,
    itemCount: items.length,
    staleAfter,
    expiresAt,
    items,
  };

  return {
    feedType: 'maliciousDomains',
    feedVersion,
    itemCount: items.length,
    sha256: sha256Hex(serializeCanonicalJson(canonical)),
    staleAfter,
    expiresAt,
    items,
  };
}

function bundleSignature(bundle) {
  return [
    STATIC_KEY_ID,
    `schemaVersion=${bundle.schemaVersion}`,
    `bundleVersion=${bundle.bundleVersion}`,
    `generatedAt=${bundle.generatedAt}`,
    `publisher=${bundle.publisher}`,
    `signingKeyId=${bundle.signingKeyId}`,
    `maliciousDomains=${bundle.sections.maliciousDomains.feedVersion}:${bundle.sections.maliciousDomains.sha256}`,
    `allowlists=${bundle.sections.allowlists.feedVersion}:${bundle.sections.allowlists.sha256}`,
  ].join('|');
}

function manifestSignature(manifest) {
  return [
    STATIC_KEY_ID,
    `bundleFamily=${manifest.bundleFamily}`,
    `schemaVersion=${manifest.schemaVersion}`,
    `bundleVersion=${manifest.bundleVersion}`,
    `generatedAt=${manifest.generatedAt}`,
    `publisher=${manifest.publisher}`,
    `signingKeyId=${manifest.signingKeyId}`,
    `bundleUrl=${manifest.bundleUrl}`,
    `maliciousDomains=${manifest.sections.maliciousDomains.feedVersion}:${manifest.sections.maliciousDomains.sha256}`,
    `allowlists=${manifest.sections.allowlists.feedVersion}:${manifest.sections.allowlists.sha256}`,
  ].join('|');
}

function bundleFromSections(input, overrides = {}) {
  const bundleVersion =
    overrides.bundleVersion ?? '2026-03-21T18:30:00Z.navigation-refresh-test';
  const generatedAt = overrides.generatedAt ?? '2026-03-21T18:30:00Z';
  const sections = {
    maliciousDomains: {
      feedVersion: input.maliciousDomains.feedVersion,
      itemCount: input.maliciousDomains.itemCount,
      sha256: input.maliciousDomains.sha256,
      staleAfter: input.maliciousDomains.staleAfter,
      expiresAt: input.maliciousDomains.expiresAt,
    },
    allowlists: {
      feedVersion: input.allowlists.feedVersion,
      itemCount: input.allowlists.itemCount,
      sha256: input.allowlists.sha256,
      staleAfter: input.allowlists.staleAfter,
      expiresAt: input.allowlists.expiresAt,
    },
  };

  const bundle = {
    schemaVersion: '1.0.0',
    bundleVersion,
    generatedAt,
    publisher: 'clickshield-intel',
    signingKeyId: STATIC_KEY_ID,
    sections,
    maliciousDomains: input.maliciousDomains,
    allowlists: input.allowlists,
  };

  return {
    ...bundle,
    signature: overrides.signature ?? bundleSignature(bundle),
  };
}

function manifestFromBundle(bundle, overrides = {}) {
  const manifest = {
    schemaVersion: '1.0.0',
    bundleFamily: 'navigation',
    bundleVersion: bundle.bundleVersion,
    generatedAt: overrides.generatedAt ?? bundle.generatedAt,
    publisher: 'clickshield-intel',
    signingKeyId: STATIC_KEY_ID,
    bundleUrl:
      overrides.bundleUrl ??
      `/intel/feeds/navigation/bundles/${bundle.bundleVersion}/bundle.json`,
    sections: bundle.sections,
  };

  return {
    ...manifest,
    signature: overrides.signature ?? manifestSignature(manifest),
  };
}

function createInMemoryFeedStorage({ cache = null, lastKnownGood = null, metadata = null } = {}) {
  const state = {
    cache,
    lastKnownGood,
    metadata,
  };

  return {
    state,
    storage: {
      async loadRawBundle(slot) {
        return slot === 'cache' ? state.cache : state.lastKnownGood;
      },
      async saveRawBundle(slot, bundle) {
        if (slot === 'cache') {
          state.cache = bundle;
          return;
        }
        state.lastKnownGood = bundle;
      },
      async loadMetadata() {
        return state.metadata;
      },
      async saveMetadata(nextMetadata) {
        state.metadata = nextMetadata;
      },
    },
  };
}

function createAlarmRecorder() {
  const calls = [];
  return {
    calls,
    api: {
      create(name, options) {
        calls.push({ name, options });
      },
    },
  };
}

function createFetchImpl(routes) {
  return async (url) => {
    const { pathname } = new URL(url);
    const handler = routes[pathname];
    if (!handler) {
      throw new Error(`Unhandled fetch for ${pathname}`);
    }

    return handler(url);
  };
}

test('manifest fetch success without version change skips bundle download', async () => {
  const bundle = bundleFromSections({
    maliciousDomains: maliciousSection([
      maliciousItem({
        domain: 'unchanged-hit.example',
        identity: 'exact_host:unchanged-hit.example',
      }),
    ]),
    allowlists: allowlistsSection([]),
  });

  const activation = await activateRuntimeNavigationIntelSnapshot({
    bundle,
    now: NOW,
  });

  assert.equal(activation.ok, true);

  let bundleFetches = 0;
  const refresh = await refreshNavigationIntelFromBackend({
    now: NOW,
    fetchImpl: createFetchImpl({
      '/intel/feeds/navigation/manifest.json': async () =>
        makeJsonResponse(manifestFromBundle(bundle)),
      [`/intel/feeds/navigation/bundles/${bundle.bundleVersion}/bundle.json`]: async () => {
        bundleFetches += 1;
        return makeJsonResponse(bundle);
      },
    }),
  });

  assert.equal(refresh.ok, true);
  assert.equal(refresh.updated, false);
  assert.equal(refresh.stage, 'manifest');
  assert.equal(bundleFetches, 0);
});

test('successful refresh fetches bundle, activates it, and persists metadata', async () => {
  const nextBundle = bundleFromSections({
    maliciousDomains: maliciousSection([
      maliciousItem({
        domain: 'refresh-hit.example',
        identity: 'exact_host:refresh-hit.example',
      }),
    ]),
    allowlists: allowlistsSection([]),
  });
  const { storage, state } = createInMemoryFeedStorage();
  const alarms = createAlarmRecorder();

  const runtime = await bootstrapRuntimeNavigationIntel({
    now: NOW,
    storage,
    alarmsApi: alarms.api,
    fetchImpl: createFetchImpl({
      '/intel/feeds/navigation/manifest.json': async () =>
        makeJsonResponse(manifestFromBundle(nextBundle)),
      [`/intel/feeds/navigation/bundles/${nextBundle.bundleVersion}/bundle.json`]: async () =>
        makeJsonResponse(nextBundle),
    }),
  });

  assert.equal(runtime.activation.ok, false);
  assert.equal(runtime.refresh.ok, true);
  assert.equal(runtime.refresh.updated, true);
  assert.equal(getNavigationIntelSnapshotState().bundleVersion, nextBundle.bundleVersion);
  assert.equal(resolveNavigationDomainIntel('https://refresh-hit.example').isKnownMaliciousDomain, true);
  assert.equal(state.cache.bundleVersion, nextBundle.bundleVersion);
  assert.equal(state.lastKnownGood.bundleVersion, nextBundle.bundleVersion);
  assert.equal(state.metadata.lastSuccessfulRefreshBundleVersion, nextBundle.bundleVersion);
  assert.equal(state.metadata.lastSuccessfulRefreshAt, NOW_ISO);
  assert.equal(state.metadata.lastManifestCheckAt, NOW_ISO);
  assert.equal(alarms.calls.at(-1).name, 'navigationIntelRefresh');
  assert.equal(alarms.calls.at(-1).options.periodInMinutes, 15);
});

test('failed manifest fetch retains the current active snapshot', async () => {
  const currentBundle = bundleFromSections({
    maliciousDomains: maliciousSection([
      maliciousItem({
        domain: 'current-hit.example',
        identity: 'exact_host:current-hit.example',
      }),
    ]),
    allowlists: allowlistsSection([]),
  });

  await activateRuntimeNavigationIntelSnapshot({
    bundle: currentBundle,
    now: NOW,
  });

  const refresh = await refreshNavigationIntelFromBackend({
    now: NOW,
    fetchImpl: async () => {
      throw new Error('backend offline');
    },
  });

  assert.equal(refresh.ok, false);
  assert.equal(refresh.stage, 'manifest');
  assert.equal(getNavigationIntelSnapshotState().bundleVersion, currentBundle.bundleVersion);
});

test('failed bundle fetch retains the current active snapshot', async () => {
  const currentBundle = bundleFromSections({
    maliciousDomains: maliciousSection([
      maliciousItem({
        domain: 'current-hit.example',
        identity: 'exact_host:current-hit.example',
      }),
    ]),
    allowlists: allowlistsSection([]),
  });
  const nextBundle = bundleFromSections(
    {
      maliciousDomains: maliciousSection([]),
      allowlists: allowlistsSection([]),
    },
    {
      bundleVersion: '2026-03-21T19:00:00Z.navigation-refresh-test',
      generatedAt: '2026-03-21T19:00:00Z',
    },
  );

  await activateRuntimeNavigationIntelSnapshot({
    bundle: currentBundle,
    now: NOW,
  });

  const refresh = await refreshNavigationIntelFromBackend({
    now: NOW,
    fetchImpl: createFetchImpl({
      '/intel/feeds/navigation/manifest.json': async () =>
        makeJsonResponse(manifestFromBundle(nextBundle)),
      [`/intel/feeds/navigation/bundles/${nextBundle.bundleVersion}/bundle.json`]: async () => {
        throw new Error('bundle timeout');
      },
    }),
  });

  assert.equal(refresh.ok, false);
  assert.equal(refresh.stage, 'bundle');
  assert.equal(getNavigationIntelSnapshotState().bundleVersion, currentBundle.bundleVersion);
});

test('refresh rejects a fetched bundle whose bundleVersion differs from the signed manifest', async () => {
  const currentBundle = bundleFromSections({
    maliciousDomains: maliciousSection([
      maliciousItem({
        domain: 'current-hit.example',
        identity: 'exact_host:current-hit.example',
      }),
    ]),
    allowlists: allowlistsSection([]),
  });
  const manifestBundle = bundleFromSections(
    {
      maliciousDomains: maliciousSection([]),
      allowlists: allowlistsSection([]),
    },
    {
      bundleVersion: '2026-03-21T19:05:00Z.navigation-refresh-test',
      generatedAt: '2026-03-21T19:05:00Z',
    },
  );
  const fetchedBundle = bundleFromSections(
    {
      maliciousDomains: maliciousSection([]),
      allowlists: allowlistsSection([]),
    },
    {
      bundleVersion: '2026-03-21T19:06:00Z.navigation-refresh-test',
      generatedAt: '2026-03-21T19:06:00Z',
    },
  );

  await activateRuntimeNavigationIntelSnapshot({
    bundle: currentBundle,
    now: NOW,
  });

  const refresh = await refreshNavigationIntelFromBackend({
    now: NOW,
    fetchImpl: createFetchImpl({
      '/intel/feeds/navigation/manifest.json': async () =>
        makeJsonResponse(manifestFromBundle(manifestBundle)),
      [`/intel/feeds/navigation/bundles/${manifestBundle.bundleVersion}/bundle.json`]: async () =>
        makeJsonResponse(fetchedBundle),
    }),
  });

  assert.equal(refresh.ok, false);
  assert.equal(refresh.stage, 'coherence');
  assert.match(refresh.issues[0], /bundleVersion/);
  assert.equal(getNavigationIntelSnapshotState().bundleVersion, currentBundle.bundleVersion);
});

test('refresh rejects a fetched bundle whose metadata does not match the signed manifest', async () => {
  const currentBundle = bundleFromSections({
    maliciousDomains: maliciousSection([
      maliciousItem({
        domain: 'current-hit.example',
        identity: 'exact_host:current-hit.example',
      }),
    ]),
    allowlists: allowlistsSection([]),
  });
  const manifestBundle = bundleFromSections(
    {
      maliciousDomains: maliciousSection([]),
      allowlists: allowlistsSection([]),
    },
    {
      bundleVersion: '2026-03-21T19:10:00Z.navigation-refresh-test',
      generatedAt: '2026-03-21T19:10:00Z',
    },
  );
  const fetchedBundle = bundleFromSections(
    {
      maliciousDomains: maliciousSection([], {
        feedVersion: '2026-03-21.9',
      }),
      allowlists: allowlistsSection([]),
    },
    {
      bundleVersion: manifestBundle.bundleVersion,
      generatedAt: manifestBundle.generatedAt,
    },
  );

  await activateRuntimeNavigationIntelSnapshot({
    bundle: currentBundle,
    now: NOW,
  });

  const refresh = await refreshNavigationIntelFromBackend({
    now: NOW,
    fetchImpl: createFetchImpl({
      '/intel/feeds/navigation/manifest.json': async () =>
        makeJsonResponse(manifestFromBundle(manifestBundle)),
      [`/intel/feeds/navigation/bundles/${manifestBundle.bundleVersion}/bundle.json`]: async () =>
        makeJsonResponse(fetchedBundle),
    }),
  });

  assert.equal(refresh.ok, false);
  assert.equal(refresh.stage, 'coherence');
  assert.match(refresh.issues[0], /maliciousDomains/);
  assert.equal(getNavigationIntelSnapshotState().bundleVersion, currentBundle.bundleVersion);
});

test('invalid bundle is rejected, current snapshot is retained, and cache keeps the failed download', async () => {
  const currentBundle = bundleFromSections({
    maliciousDomains: maliciousSection([
      maliciousItem({
        domain: 'current-hit.example',
        identity: 'exact_host:current-hit.example',
      }),
    ]),
    allowlists: allowlistsSection([]),
  });
  const invalidBundle = bundleFromSections(
    {
      maliciousDomains: maliciousSection([]),
      allowlists: allowlistsSection([]),
    },
    {
      bundleVersion: '2026-03-21T19:15:00Z.navigation-refresh-test',
      generatedAt: '2026-03-21T19:15:00Z',
      signature: 'invalid-signature',
    },
  );
  const { storage, state } = createInMemoryFeedStorage();

  await activateRuntimeNavigationIntelSnapshot({
    bundle: currentBundle,
    now: NOW,
    storage,
  });

  const refresh = await refreshNavigationIntelFromBackend({
    now: NOW,
    storage,
    fetchImpl: createFetchImpl({
      '/intel/feeds/navigation/manifest.json': async () =>
        makeJsonResponse(manifestFromBundle(invalidBundle)),
      [`/intel/feeds/navigation/bundles/${invalidBundle.bundleVersion}/bundle.json`]: async () =>
        makeJsonResponse(invalidBundle),
    }),
  });

  assert.equal(refresh.ok, false);
  assert.equal(refresh.stage, 'activation');
  assert.equal(getNavigationIntelSnapshotState().bundleVersion, currentBundle.bundleVersion);
  assert.equal(state.cache.bundleVersion, invalidBundle.bundleVersion);
  assert.equal(state.lastKnownGood.bundleVersion, currentBundle.bundleVersion);
});

test('bootstrap uses last-known-good when cache is invalid and refresh then fails', async () => {
  const invalidCache = bundleFromSections({
    maliciousDomains: maliciousSection([]),
    allowlists: allowlistsSection([]),
  }, {
    signature: 'invalid-signature',
  });
  const lastKnownGood = bundleFromSections({
    maliciousDomains: maliciousSection([
      maliciousItem({
        domain: 'last-known-good-refresh.example',
        identity: 'exact_host:last-known-good-refresh.example',
      }),
    ]),
    allowlists: allowlistsSection([]),
  });
  const { storage } = createInMemoryFeedStorage({
    cache: invalidCache,
    lastKnownGood,
  });

  const runtime = await bootstrapRuntimeNavigationIntel({
    now: NOW,
    storage,
    fetchImpl: async () => {
      throw new Error('manifest unavailable');
    },
  });

  assert.equal(runtime.activation.ok, true);
  assert.equal(runtime.refresh.ok, false);
  assert.equal(getNavigationIntelSnapshotState().bundleVersion, lastKnownGood.bundleVersion);
  assert.equal(
    resolveNavigationDomainIntel('https://last-known-good-refresh.example').isKnownMaliciousDomain,
    true,
  );
});

test('startup with valid cache does not overwrite a distinct valid last-known-good snapshot', async () => {
  const cacheBundle = bundleFromSections(
    {
      maliciousDomains: maliciousSection([
        maliciousItem({
          domain: 'cache-hit.example',
          identity: 'exact_host:cache-hit.example',
        }),
      ]),
      allowlists: allowlistsSection([]),
    },
    {
      bundleVersion: '2026-03-21T19:20:00Z.navigation-refresh-test',
      generatedAt: '2026-03-21T19:20:00Z',
    },
  );
  const lastKnownGood = bundleFromSections(
    {
      maliciousDomains: maliciousSection([
        maliciousItem({
          domain: 'lkg-hit.example',
          identity: 'exact_host:lkg-hit.example',
        }),
      ]),
      allowlists: allowlistsSection([]),
    },
    {
      bundleVersion: '2026-03-21T19:21:00Z.navigation-refresh-test',
      generatedAt: '2026-03-21T19:21:00Z',
    },
  );
  const { storage, state } = createInMemoryFeedStorage({
    cache: cacheBundle,
    lastKnownGood,
    metadata: {
      lastKnownGoodBundleVersion: lastKnownGood.bundleVersion,
      lastKnownGoodUpdatedAt: NOW_ISO,
    },
  });

  const runtime = await bootstrapRuntimeNavigationIntel({
    now: NOW,
    storage,
    fetchImpl: async () => {
      throw new Error('manifest unavailable');
    },
  });

  assert.equal(runtime.activation.ok, true);
  assert.equal(runtime.refresh.ok, false);
  assert.equal(getNavigationIntelSnapshotState().bundleVersion, cacheBundle.bundleVersion);
  assert.equal(state.lastKnownGood.bundleVersion, lastKnownGood.bundleVersion);
  assert.equal(state.metadata.lastKnownGoodBundleVersion, lastKnownGood.bundleVersion);
  assert.equal(resolveNavigationDomainIntel('https://cache-hit.example').isKnownMaliciousDomain, true);
  assert.equal(resolveNavigationDomainIntel('https://lkg-hit.example').isKnownMaliciousDomain, false);
});

test('bootstrap leaves the bundled empty seed inactive when no persisted snapshot exists and refresh fails', async () => {
  const runtime = await bootstrapRuntimeNavigationIntel({
    now: NOW,
    fetchImpl: async () => {
      throw new Error('manifest unavailable');
    },
  });

  assert.equal(runtime.activation.ok, false);
  assert.equal(runtime.refresh.ok, false);
  assert.equal(getNavigationIntelSnapshotState().active, false);
  assert.equal(getNavigationIntelSnapshotState().bundleVersion, null);
  assert.equal(getNavigationIntelSnapshotState().sectionStates.maliciousDomains, 'empty');
});

test('refresh interval policy uses recovery cadence for expired, empty, or inactive malicious domain state', () => {
  assert.equal(
    resolveNavigationIntelRefreshIntervalMinutes({
      active: true,
      sectionStates: {
        maliciousDomains: 'fresh',
        allowlists: 'fresh',
      },
    }),
    15,
  );

  assert.equal(
    resolveNavigationIntelRefreshIntervalMinutes({
      active: true,
      sectionStates: {
        maliciousDomains: 'expired',
        allowlists: 'fresh',
      },
    }),
    5,
  );

  assert.equal(
    resolveNavigationIntelRefreshIntervalMinutes({
      active: true,
      sectionStates: {
        maliciousDomains: 'empty',
        allowlists: 'empty',
      },
    }),
    5,
  );

  assert.equal(
    resolveNavigationIntelRefreshIntervalMinutes({
      active: false,
      sectionStates: {
        maliciousDomains: 'missing',
        allowlists: 'missing',
      },
    }),
    5,
  );
});
