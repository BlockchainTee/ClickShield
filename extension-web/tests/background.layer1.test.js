import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  activateRuntimeNavigationIntelSnapshot,
  MainFrameRedirectTracker,
  buildFailSafeScan,
  clearNavigationIntelSnapshot,
  evaluateLocally,
  getNavigationIntelSnapshotState,
  loadNavigationIntelSnapshot,
  resolveNavigationDomainIntel,
  resolveNavigationIntel,
  shouldFailSafeWarnOnSignalFailure,
} from '../background.js';

const NOW = '2026-03-21T18:00:00Z';

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

function allowlistItem(overrides = {}) {
  const scope = overrides.scope ?? 'exact_host';
  const target = overrides.target ?? 'safe.example';
  const type =
    overrides.type ??
    (scope === 'registrable_domain'
      ? 'domain_registrable_domain'
      : 'domain_exact_host');

  return {
    id: overrides.id ?? `allow_${scope}_${target}`,
    type,
    identity: overrides.identity ?? `${type}:${target}`,
    source: overrides.source ?? 'clickshield-curated',
    reasonCode: overrides.reasonCode ?? 'KNOWN_SAFE_EXCEPTION',
    confidence: overrides.confidence ?? 0.95,
    firstSeenAt: overrides.firstSeenAt ?? '2026-03-20T00:00:00Z',
    lastSeenAt: overrides.lastSeenAt ?? NOW,
    targetKind: 'domain',
    target,
    scope,
    justification: overrides.justification ?? 'Trusted property',
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

function bundleFromSections(input) {
  const sections = {};

  if (input.maliciousDomains) {
    sections.maliciousDomains = {
      feedVersion: input.maliciousDomains.feedVersion,
      itemCount: input.maliciousDomains.itemCount,
      sha256: input.maliciousDomains.sha256,
      staleAfter: input.maliciousDomains.staleAfter,
      expiresAt: input.maliciousDomains.expiresAt,
    };
  }

  if (input.allowlists) {
    sections.allowlists = {
      feedVersion: input.allowlists.feedVersion,
      itemCount: input.allowlists.itemCount,
      sha256: input.allowlists.sha256,
      staleAfter: input.allowlists.staleAfter,
      expiresAt: input.allowlists.expiresAt,
    };
  }

  return {
    schemaVersion: '1.0.0',
    bundleVersion: '2026-03-21T18:00:00Z.extension-test-bundle',
    generatedAt: NOW,
    publisher: 'clickshield-intel',
    signingKeyId: 'clickshield-ed25519-v1',
    sections,
    signature: 'test-signature',
    maliciousDomains: input.maliciousDomains,
    allowlists: input.allowlists,
  };
}

test('block verdict maps to dangerous overlay path', () => {
  const result = evaluateLocally('https://known-bad.example/drain', {
    isKnownMalicious: true,
  });

  assert.equal(result.verdict.status, 'block');
  assert.ok(result.verdict.reasonCodes.includes('PHISH_KNOWN_MALICIOUS_DOMAIN'));
});

test('warn verdict maps to warning path with deliberate proceed', () => {
  const result = evaluateLocally('https://free-token-claim.xyz/mint-airdrop', {
    isKnownMalicious: false,
  });

  assert.equal(result.verdict.status, 'warn');
  assert.ok(result.verdict.reasonCodes.includes('PHISH_SUSPICIOUS_TLD_MINT_KEYWORD'));
});

test('allow verdict preserves normal browsing path', () => {
  const result = evaluateLocally('https://docs.github.com/en/actions', {
    isKnownMalicious: false,
  });

  assert.equal(result.verdict.status, 'allow');
});

test('validated snapshot is loaded outside evaluation and drives navigation intel synchronously', async () => {
  const loadResult = loadNavigationIntelSnapshot(
    bundleFromSections({
      maliciousDomains: maliciousSection([
        maliciousItem({
          domain: 'intel-signal-test.example',
          type: 'exact_host',
          identity: 'exact_host:intel-signal-test.example',
        }),
      ]),
      allowlists: allowlistsSection([]),
    }),
    {
      now: NOW,
      signatureVerifier: () => true,
    },
  );

  assert.equal(loadResult.ok, true);
  assert.deepEqual(getNavigationIntelSnapshotState(), {
    active: true,
    bundleVersion: '2026-03-21T18:00:00Z.extension-test-bundle',
    sectionStates: {
      maliciousDomains: 'fresh',
      allowlists: 'fresh',
    },
    issues: [],
  });

  const domainIntel = resolveNavigationDomainIntel('https://intel-signal-test.example/connect-wallet');
  assert.equal(domainIntel.domainLookup.disposition, 'malicious');
  assert.equal(domainIntel.isKnownMaliciousDomain, true);
  assert.equal(domainIntel.feedVersion, '2026-03-21.1');
  assert.equal(domainIntel.domainAllowlistVersion, '2026-03-21.5');

  const intel = await resolveNavigationIntel('https://intel-signal-test.example/connect-wallet', {
    fetchImpl: async (url) => {
      const requestUrl = new URL(url);
      if (requestUrl.pathname === '/intel/domain-age') {
        return makeJsonResponse({ ok: true, domain: 'intel-signal-test.example', ageHours: 6 });
      }
      return makeJsonResponse({ ok: false }, 404);
    },
  });

  assert.equal(intel.isKnownMaliciousDomain, true);
  assert.equal(intel.domainAgeHours, 6);
  assert.equal(intel.feedVersion, '2026-03-21.1');
  assert.equal(intel.domainAllowlistVersion, '2026-03-21.5');
  assert.deepEqual(intel.failures, []);

  const result = evaluateLocally('https://intel-signal-test.example/connect-wallet', {
    domainAgeHours: intel.domainAgeHours,
    isKnownMalicious: intel.isKnownMaliciousDomain,
    feedVersion: intel.feedVersion,
    domainAllowlistVersion: intel.domainAllowlistVersion,
  });

  assert.equal(result.verdict.status, 'block');
  assert.equal(result.context.intel.feedVersion, '2026-03-21.1');
  assert.equal(result.context.intel.domainAllowlistVersion, '2026-03-21.5');
});

test('runtime activation path loads the live snapshot used by otherwise-allow navigation', async () => {
  const activationResult = activateRuntimeNavigationIntelSnapshot({
    bundle: bundleFromSections({
      maliciousDomains: maliciousSection([]),
      allowlists: allowlistsSection([]),
    }),
    now: NOW,
    signatureVerifier: () => true,
  });

  assert.equal(activationResult.ok, true);
  assert.deepEqual(getNavigationIntelSnapshotState(), {
    active: true,
    bundleVersion: '2026-03-21T18:00:00Z.extension-test-bundle',
    sectionStates: {
      maliciousDomains: 'fresh',
      allowlists: 'fresh',
    },
    issues: [],
  });

  const intel = await resolveNavigationIntel('https://safe-site.example/docs', {
    fetchImpl: async (url) => {
      const requestUrl = new URL(url);
      if (requestUrl.pathname === '/intel/domain-age') {
        return makeJsonResponse({ ok: true, domain: 'safe-site.example', ageHours: 240 });
      }
      return makeJsonResponse({ ok: false }, 404);
    },
  });

  assert.equal(intel.degradedProtection, false);
  assert.equal(intel.domainLookup.disposition, 'no_match');
  assert.equal(intel.failures.length, 0);

  const localResult = evaluateLocally('https://safe-site.example/docs', {
    domainAgeHours: intel.domainAgeHours,
    isKnownMalicious: intel.isKnownMaliciousDomain,
    feedVersion: intel.feedVersion,
    domainAllowlistVersion: intel.domainAllowlistVersion,
  });

  assert.equal(localResult.verdict.status, 'allow');
  assert.equal(shouldFailSafeWarnOnSignalFailure(localResult.verdict, intel), false);
});

test('allowlist exact-host resolution beats a broader malicious registrable-domain match at the adapter boundary', () => {
  const loadResult = loadNavigationIntelSnapshot(
    bundleFromSections({
      maliciousDomains: maliciousSection([
        maliciousItem({
          domain: 'bad-example.com',
          type: 'registrable_domain',
          identity: 'registrable_domain:bad-example.com',
        }),
      ]),
      allowlists: allowlistsSection([
        allowlistItem({
          target: 'app.bad-example.com',
          scope: 'exact_host',
          type: 'domain_exact_host',
          identity: 'domain_exact_host:app.bad-example.com',
        }),
      ]),
    }),
    {
      now: NOW,
      signatureVerifier: () => true,
    },
  );

  assert.equal(loadResult.ok, true);

  const intel = resolveNavigationDomainIntel('https://app.bad-example.com/docs');
  assert.equal(intel.domainLookup.disposition, 'allowlisted');
  assert.equal(intel.domainLookup.matchedSection, 'allowlists');
  assert.equal(intel.isKnownMaliciousDomain, false);

  const result = evaluateLocally('https://app.bad-example.com/docs', {
    isKnownMalicious: intel.isKnownMaliciousDomain,
    feedVersion: intel.feedVersion,
    domainAllowlistVersion: intel.domainAllowlistVersion,
  });

  assert.equal(result.verdict.status, 'allow');
  assert.equal(result.context.intel.domainAllowlistVersion, '2026-03-21.5');
});

test('domain-age signal still activates new-domain phishing rules', () => {
  const result = evaluateLocally('https://openseaa.io/connect-wallet', {
    domainAgeHours: 10,
    isKnownMalicious: false,
  });

  assert.equal(result.verdict.status, 'block');
  assert.ok(
    result.verdict.reasonCodes.includes('PHISH_IMPERSONATION_NEW_DOMAIN') ||
      result.verdict.reasonCodes.includes('NEW_DOMAIN_WALLET_CONNECT'),
  );
});

test('missing snapshot drives degraded protection at the extension boundary', () => {
  const intel = resolveNavigationDomainIntel('https://safe-site.example');

  assert.equal(intel.domainLookup.disposition, 'unavailable');
  assert.equal(intel.domainLookup.sectionState, 'missing');
  assert.equal(intel.degradedProtection, true);

  const allowVerdict = evaluateLocally('https://safe-site.example').verdict;
  assert.equal(shouldFailSafeWarnOnSignalFailure(allowVerdict, intel), true);

  const failSafe = buildFailSafeScan('https://safe-site.example', 'intel unavailable', {
    domainIntel: intel.domainLookup,
  });
  assert.equal(failSafe.riskLevel, 'SUSPICIOUS');
  assert.equal(failSafe.degradedProtection, true);
});

test('invalid snapshot load is rejected and leaves the surface in degraded protection', () => {
  const loadResult = loadNavigationIntelSnapshot(
    bundleFromSections({
      maliciousDomains: maliciousSection([]),
      allowlists: allowlistsSection([]),
    }),
    {
      now: NOW,
    },
  );

  assert.equal(loadResult.ok, false);
  assert.equal(getNavigationIntelSnapshotState().active, false);
  assert.equal(getNavigationIntelSnapshotState().sectionStates.maliciousDomains, 'invalid');

  const intel = resolveNavigationDomainIntel('https://safe-site.example');
  assert.equal(intel.domainLookup.disposition, 'unavailable');
  assert.equal(intel.domainLookup.sectionState, 'invalid');
  assert.equal(intel.degradedProtection, true);
});

test('expired snapshot keeps lookup deterministic and unavailable', () => {
  const loadResult = loadNavigationIntelSnapshot(
    bundleFromSections({
      maliciousDomains: maliciousSection([], {
        staleAfter: '2026-03-20T18:00:00Z',
        expiresAt: '2026-03-21T17:00:00Z',
      }),
      allowlists: allowlistsSection([]),
    }),
    {
      now: NOW,
      signatureVerifier: () => true,
    },
  );

  assert.equal(loadResult.ok, true);

  const intel = resolveNavigationDomainIntel('https://safe-site.example');
  assert.equal(intel.domainLookup.disposition, 'unavailable');
  assert.equal(intel.domainLookup.sectionState, 'expired');
  assert.equal(intel.degradedProtection, true);
});

test('stronger Layer 1 warn/block outcomes are preserved when intel is degraded', () => {
  const degradedIntel = resolveNavigationDomainIntel('https://safe-site.example');

  const warnVerdict = evaluateLocally('https://free-token-claim.xyz/mint-airdrop').verdict;
  assert.equal(shouldFailSafeWarnOnSignalFailure(warnVerdict, degradedIntel), false);

  const blockVerdict = evaluateLocally('https://openseaa.io/connect-wallet', {
    domainAgeHours: 10,
  }).verdict;
  assert.equal(shouldFailSafeWarnOnSignalFailure(blockVerdict, degradedIntel), false);
});

test('redirect tracker counts true redirect transitions and enables redirect-chain warning', () => {
  const tracker = new MainFrameRedirectTracker();
  const ts = Date.now();

  tracker.onBeforeRequest({
    type: 'main_frame',
    requestId: 'req-redirect-1',
    tabId: 44,
    url: 'https://origin-safe.example/start',
    timeStamp: ts,
  });

  tracker.onBeforeRedirect({
    type: 'main_frame',
    requestId: 'req-redirect-1',
    tabId: 44,
    url: 'https://origin-safe.example/start',
    redirectUrl: 'https://hop-one.example/r',
  });
  tracker.onBeforeRedirect({
    type: 'main_frame',
    requestId: 'req-redirect-1',
    tabId: 44,
    url: 'https://hop-one.example/r',
    redirectUrl: 'https://hop-two.example/r',
  });
  tracker.onBeforeRedirect({
    type: 'main_frame',
    requestId: 'req-redirect-1',
    tabId: 44,
    url: 'https://hop-two.example/r',
    redirectUrl: 'https://evil-phish.xyz/landing',
  });
  tracker.onCompleted({
    type: 'main_frame',
    requestId: 'req-redirect-1',
    tabId: 44,
    url: 'https://evil-phish.xyz/landing',
  });

  const chain = tracker.getChainForTabUrl(44, 'https://evil-phish.xyz/landing');
  assert.ok(chain);
  assert.equal(chain.redirectCount, 3);

  const redirectEval = evaluateLocally(chain.initialUrl, {
    redirectCount: chain.redirectCount,
    finalDomain: 'evil-phish.xyz',
    domainAgeHours: null,
    isKnownMalicious: false,
  });

  assert.equal(redirectEval.verdict.status, 'warn');
  assert.ok(redirectEval.verdict.reasonCodes.includes('SUSPICIOUS_REDIRECT_CHAIN'));
});

test('redirect tracker preserves redirect count when onBeforeRequest repeats for each hop', () => {
  const tracker = new MainFrameRedirectTracker();
  const tabId = 22;
  const requestId = 'req-repeat-before-request';

  tracker.onBeforeRequest({
    type: 'main_frame',
    requestId,
    tabId,
    url: 'https://origin.example/start',
    timeStamp: Date.now(),
  });

  tracker.onBeforeRedirect({
    type: 'main_frame',
    requestId,
    tabId,
    url: 'https://origin.example/start',
    redirectUrl: 'https://hop-1.example/r',
  });
  tracker.onBeforeRequest({
    type: 'main_frame',
    requestId,
    tabId,
    url: 'https://hop-1.example/r',
  });

  tracker.onBeforeRedirect({
    type: 'main_frame',
    requestId,
    tabId,
    url: 'https://hop-1.example/r',
    redirectUrl: 'https://hop-2.example/r',
  });
  tracker.onBeforeRequest({
    type: 'main_frame',
    requestId,
    tabId,
    url: 'https://hop-2.example/r',
  });

  tracker.onBeforeRedirect({
    type: 'main_frame',
    requestId,
    tabId,
    url: 'https://hop-2.example/r',
    redirectUrl: 'https://final-destination.evil.xyz/landing',
  });
  tracker.onCompleted({
    type: 'main_frame',
    requestId,
    tabId,
    url: 'https://final-destination.evil.xyz/landing',
  });

  const chain = tracker.getChainForTabUrl(tabId, 'https://final-destination.evil.xyz/landing');
  assert.ok(chain);
  assert.equal(chain.redirectCount, 3);
  assert.equal(chain.initialUrl, 'https://origin.example/start');
});

test('redirect tracker does not leak previous chain into unrelated same-host navigations', () => {
  const tracker = new MainFrameRedirectTracker();
  const tabId = 77;
  const requestId = 'req-no-host-fallback';

  tracker.onBeforeRequest({
    type: 'main_frame',
    requestId,
    tabId,
    url: 'https://evil-phish.xyz/landing',
    timeStamp: Date.now(),
  });
  tracker.onBeforeRedirect({
    type: 'main_frame',
    requestId,
    tabId,
    url: 'https://evil-phish.xyz/landing',
    redirectUrl: 'https://evil-phish.xyz/final',
  });
  tracker.onCompleted({
    type: 'main_frame',
    requestId,
    tabId,
    url: 'https://evil-phish.xyz/final',
  });

  const unrelated = tracker.getChainForTabUrl(tabId, 'https://evil-phish.xyz/other-path');
  assert.equal(unrelated, null);
});

test('redirect tracker ignores non-main-frame events', () => {
  const tracker = new MainFrameRedirectTracker();
  const requestId = 'subframe-request';

  tracker.onBeforeRequest({
    type: 'sub_frame',
    requestId,
    tabId: 9,
    url: 'https://example.com/frame',
    timeStamp: Date.now(),
  });
  tracker.onBeforeRedirect({
    type: 'sub_frame',
    requestId,
    tabId: 9,
    url: 'https://example.com/frame',
    redirectUrl: 'https://example.com/frame2',
  });
  tracker.onCompleted({
    type: 'sub_frame',
    requestId,
    tabId: 9,
    url: 'https://example.com/frame2',
  });

  assert.equal(tracker.getChainForTabUrl(9, 'https://example.com/frame2'), null);
});

test('domain-age lookup failure still drives fail-safe warning for otherwise-allow traffic', async () => {
  loadNavigationIntelSnapshot(
    bundleFromSections({
      maliciousDomains: maliciousSection([]),
      allowlists: allowlistsSection([]),
    }),
    {
      now: NOW,
      signatureVerifier: () => true,
    },
  );

  const intel = await resolveNavigationIntel('https://lookup-failure.example', {
    fetchImpl: async () => {
      throw new Error('network down');
    },
  });

  assert.ok(intel.failures.includes('DOMAIN_AGE_LOOKUP_FAILED'));

  const allowVerdict = evaluateLocally('https://safe-site.example').verdict;
  assert.equal(shouldFailSafeWarnOnSignalFailure(allowVerdict, intel), true);

  const failSafe = buildFailSafeScan('https://safe-site.example', 'intel unavailable', {
    intelFailures: intel.failures,
  });
  assert.equal(failSafe.riskLevel, 'SUSPICIOUS');
  assert.equal(failSafe.degradedProtection, true);
});
