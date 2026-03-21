import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MainFrameRedirectTracker,
  evaluateLocally,
  resolveNavigationIntel,
  shouldFailSafeWarnOnSignalFailure,
  buildFailSafeScan,
} from '../background.js';

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

test('intel wiring resolves known-malicious and domain-age signals when available', async () => {
  const domain = 'intel-signal-test.example';
  const intel = await resolveNavigationIntel(`https://${domain}/connect-wallet`, {
    fetchImpl: async (url) => {
      const u = new URL(url);
      if (u.pathname === '/intel/domain-check') {
        return makeJsonResponse({ ok: true, domain, isKnownMalicious: true, source: 'test-feed' });
      }
      if (u.pathname === '/intel/domain-age') {
        return makeJsonResponse({ ok: true, domain, ageHours: 6, source: 'test-whois' });
      }
      if (u.pathname === '/intel/feed-version') {
        return makeJsonResponse({ ok: true, feedVersion: '2026-03-13-test' });
      }
      return makeJsonResponse({ ok: false }, 404);
    },
  });

  assert.equal(intel.isKnownMaliciousDomain, true);
  assert.equal(intel.domainAgeHours, 6);
  assert.equal(intel.feedVersion, '2026-03-13-test');
  assert.deepEqual(intel.failures, []);
});

test('domain-age signal activates new-domain phishing rules', () => {
  const result = evaluateLocally('https://openseaa.io/connect-wallet', {
    domainAgeHours: 10,
    isKnownMalicious: false,
  });

  assert.equal(result.verdict.status, 'block');
  assert.ok(
    result.verdict.reasonCodes.includes('PHISH_IMPERSONATION_NEW_DOMAIN') ||
      result.verdict.reasonCodes.includes('NEW_DOMAIN_WALLET_CONNECT')
  );
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

test('signal lookup failure drives fail-safe warning (no silent fail-open)', async () => {
  const intel = await resolveNavigationIntel('https://lookup-failure.example', {
    fetchImpl: async () => {
      throw new Error('network down');
    },
  });

  assert.ok(intel.failures.includes('DOMAIN_CHECK_LOOKUP_FAILED'));
  assert.ok(intel.failures.includes('DOMAIN_AGE_LOOKUP_FAILED'));

  const allowVerdict = evaluateLocally('https://safe-site.example').verdict;
  assert.equal(shouldFailSafeWarnOnSignalFailure(allowVerdict, intel.failures), true);

  const failSafe = buildFailSafeScan('https://safe-site.example', 'intel unavailable', {
    intelFailures: intel.failures,
  });
  assert.equal(failSafe.riskLevel, 'SUSPICIOUS');
  assert.equal(failSafe.degradedProtection, true);
});
