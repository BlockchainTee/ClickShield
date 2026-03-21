// background.js - ClickShield backend proxy + local shared-rules evaluation
//
// Layer 1: Local deterministic evaluation via @clickshield/shared-rules
// Layer 2: Backend enrichment (domain age, feed data, AI narrative)
// Local rules run first and block/warn immediately. Backend results
// may upgrade a verdict but never downgrade a block.

import {
  evaluate,
  buildNavigationContext,
  contextToInput,
  getReasonMessage,
  getVerdictTitle,
  riskBadgeLabel,
  extractRegistrableDomain,
  compileDomainIntelSnapshot,
  resolveDomainIntel as resolveSnapshotDomainIntel,
} from './lib/shared-rules.js';

const API_BASE = 'http://localhost:4000';
const SIGNAL_TIMEOUT_MS = 1_500;
const DOMAIN_AGE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const REDIRECT_CHAIN_MAX_AGE_MS = 15_000;
const MISSING_DOMAIN_INTEL_SECTION_STATES = Object.freeze({
  maliciousDomains: 'missing',
  allowlists: 'missing',
});
const BUNDLED_NAVIGATION_INTEL_BUNDLE = Object.freeze({
  schemaVersion: '1.0.0',
  bundleVersion: '2026-03-21T18:00:00Z.extension-bundled-navigation-intel',
  generatedAt: '2026-03-21T18:00:00Z',
  publisher: 'clickshield-intel',
  signingKeyId: 'clickshield-extension-bundled-v1',
  sections: {
    maliciousDomains: {
      feedVersion: '2026-03-21.0',
      itemCount: 0,
      sha256: '96f9f3d640a33a173673d7a6f12ae251492c0b0300a27dcc28309051d5d19ffc',
      staleAfter: '2026-03-22T18:00:00Z',
      expiresAt: '2026-03-24T18:00:00Z',
    },
    allowlists: {
      feedVersion: '2026-03-21.0',
      itemCount: 0,
      sha256: 'd63f22eec1411074d6664f5c82377bd42555b5370e50c9304790a78aac3e4a88',
      staleAfter: '2026-03-22T18:00:00Z',
      expiresAt: '2026-03-23T18:00:00Z',
    },
  },
  signature: 'clickshield-extension-bundled-navigation-intel-v1',
  maliciousDomains: {
    feedType: 'maliciousDomains',
    feedVersion: '2026-03-21.0',
    itemCount: 0,
    sha256: '96f9f3d640a33a173673d7a6f12ae251492c0b0300a27dcc28309051d5d19ffc',
    staleAfter: '2026-03-22T18:00:00Z',
    expiresAt: '2026-03-24T18:00:00Z',
    items: [],
  },
  allowlists: {
    feedType: 'allowlists',
    feedVersion: '2026-03-21.0',
    itemCount: 0,
    sha256: 'd63f22eec1411074d6664f5c82377bd42555b5370e50c9304790a78aac3e4a88',
    staleAfter: '2026-03-22T18:00:00Z',
    expiresAt: '2026-03-23T18:00:00Z',
    items: [],
  },
});

// Backend connectivity state (shared with popup via chrome.runtime messages)
let backendOnline = false;
let lastHealthCheck = null;

// Shield mode state (synced from backend on startup + every scan response)
let currentShieldMode = 'normal';

function nowMs() {
  return Date.now();
}

function safeHostname(rawUrl) {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function safeUrlWithoutHash(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    return u.toString();
  } catch {
    return rawUrl || '';
  }
}

function isFresh(entry, ttlMs) {
  if (!entry) return false;
  return nowMs() - entry.fetchedAt < ttlMs;
}

async function fetchJsonWithTimeout(url, timeoutMs = SIGNAL_TIMEOUT_MS, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Redirect-chain tracking (main frame only) ───────────────────────────────
//
// WHAT IS COUNTED:
// - Only true HTTP redirect transitions observed by webRequest.onBeforeRedirect
// - Only main-frame requests (details.type === 'main_frame')
//
// WHAT IS NOT COUNTED:
// - In-page SPA route changes (history.pushState)
// - Hash/fragment-only changes
// - Reloads unrelated to the same requestId chain
//
// This keeps redirectCount deterministic and avoids polluting unrelated navs.
export class MainFrameRedirectTracker {
  constructor(maxAgeMs = REDIRECT_CHAIN_MAX_AGE_MS) {
    this.maxAgeMs = maxAgeMs;
    this.activeByRequestId = new Map();
    this.latestByTabId = new Map();
  }

  onBeforeRequest(details) {
    if (details.type !== 'main_frame') return;
    if (typeof details.tabId !== 'number' || details.tabId < 0) return;

    const existing = this.activeByRequestId.get(details.requestId);
    if (existing) {
      // Chrome may emit onBeforeRequest for each hop in a redirect chain
      // using the same requestId. Never reset redirectCount/initialUrl here.
      existing.finalUrl = details.url || existing.finalUrl;
      existing.lastUpdatedAt = nowMs();
      return;
    }

    this.activeByRequestId.set(details.requestId, {
      requestId: details.requestId,
      tabId: details.tabId,
      initialUrl: details.url,
      finalUrl: details.url,
      redirectCount: 0,
      startedAt: typeof details.timeStamp === 'number' ? details.timeStamp : nowMs(),
      lastUpdatedAt: nowMs(),
    });
  }

  onBeforeRedirect(details) {
    if (details.type !== 'main_frame') return;
    const chain = this.activeByRequestId.get(details.requestId);
    if (!chain) return;

    chain.redirectCount += 1;
    chain.finalUrl = details.redirectUrl || chain.finalUrl;
    chain.lastUpdatedAt = nowMs();
  }

  onCompleted(details) {
    if (details.type !== 'main_frame') return;
    const chain = this.activeByRequestId.get(details.requestId);
    if (!chain) return;

    chain.finalUrl = details.url || chain.finalUrl;
    chain.completedAt = nowMs();
    chain.lastUpdatedAt = chain.completedAt;

    this.latestByTabId.set(chain.tabId, { ...chain });
    this.activeByRequestId.delete(details.requestId);
  }

  onErrorOccurred(details) {
    if (details.type !== 'main_frame') return;
    const chain = this.activeByRequestId.get(details.requestId);
    if (!chain) return;

    this.activeByRequestId.delete(details.requestId);
  }

  onTabRemoved(tabId) {
    this.latestByTabId.delete(tabId);
  }

  getChainForTabUrl(tabId, currentUrl) {
    const chain = this.latestByTabId.get(tabId);
    if (!chain) return null;

    const ageMs = nowMs() - (chain.completedAt || chain.lastUpdatedAt || chain.startedAt || 0);
    if (ageMs > this.maxAgeMs) {
      this.latestByTabId.delete(tabId);
      return null;
    }

    const expected = safeUrlWithoutHash(chain.finalUrl);
    const actual = safeUrlWithoutHash(currentUrl);

    if (expected && actual && expected === actual) {
      return chain;
    }

    // Do not fallback to hostname-only matches. That can leak a previous
    // redirect chain into an unrelated same-domain navigation.
    return null;
  }
}

const redirectTracker = new MainFrameRedirectTracker();

// ── Layer 2 domain intel surface adapter ────────────────────────────────────

let activeNavigationIntelSnapshot = null;
let lastNavigationIntelActivationFailure = null;

function domainSectionStates(snapshot) {
  if (!snapshot) {
    return MISSING_DOMAIN_INTEL_SECTION_STATES;
  }

  return {
    maliciousDomains: snapshot.sections.maliciousDomains.state,
    allowlists: snapshot.sections.allowlists.state,
  };
}

function usableMaliciousFeedVersion(snapshot) {
  if (!snapshot) return null;
  const section = snapshot.sections.maliciousDomains;
  return section.state === 'fresh' || section.state === 'stale'
    ? section.feedVersion ?? null
    : null;
}

function usableDomainAllowlistVersion(snapshot) {
  if (!snapshot) return null;
  const section = snapshot.sections.allowlists;
  return section.state === 'fresh' ? section.feedVersion ?? null : null;
}

function unavailableDomainLookup(sectionState = 'missing') {
  return {
    lookupFamily: 'domain',
    matched: false,
    disposition: 'unavailable',
    sectionState,
    degradedProtection: true,
  };
}

function noMatchDomainLookup(sectionState, degradedProtection, allowlistFeedVersion) {
  const lookup = {
    lookupFamily: 'domain',
    matched: false,
    disposition: 'no_match',
    sectionState,
    degradedProtection,
  };

  if (allowlistFeedVersion) {
    lookup.allowlistFeedVersion = allowlistFeedVersion;
  }

  return lookup;
}

export function clearNavigationIntelSnapshot() {
  activeNavigationIntelSnapshot = null;
  lastNavigationIntelActivationFailure = null;
}

export function getNavigationIntelSnapshotState() {
  if (!activeNavigationIntelSnapshot) {
    const inactiveSectionState =
      lastNavigationIntelActivationFailure?.sectionState ?? 'missing';
    return {
      active: false,
      bundleVersion: null,
      sectionStates: {
        maliciousDomains: inactiveSectionState,
        allowlists: MISSING_DOMAIN_INTEL_SECTION_STATES.allowlists,
      },
      issues: lastNavigationIntelActivationFailure?.issues ?? [],
    };
  }

  return {
    active: true,
    bundleVersion: activeNavigationIntelSnapshot.bundleVersion,
    sectionStates: domainSectionStates(activeNavigationIntelSnapshot),
    issues: [],
  };
}

export function loadNavigationIntelSnapshot(bundle, deps = {}) {
  const compileResult = compileDomainIntelSnapshot(bundle, {
    now: deps.now,
    signatureVerifier:
      typeof deps.signatureVerifier === 'function'
        ? deps.signatureVerifier
        : () => false,
  });

  if (!compileResult.ok) {
    lastNavigationIntelActivationFailure = {
      sectionState: 'invalid',
      issues: compileResult.issues,
    };
    return {
      ok: false,
      issues: compileResult.issues,
      activeSnapshot: getNavigationIntelSnapshotState(),
    };
  }

  const maliciousDomainState = compileResult.snapshot.sections.maliciousDomains.state;
  if (maliciousDomainState === 'missing' || maliciousDomainState === 'invalid') {
    lastNavigationIntelActivationFailure = {
      sectionState: maliciousDomainState,
      issues: compileResult.issues,
    };
    return {
      ok: false,
      issues: compileResult.issues,
      bundleVersion: compileResult.snapshot.bundleVersion,
      sectionStates: domainSectionStates(compileResult.snapshot),
      activeSnapshot: getNavigationIntelSnapshotState(),
    };
  }

  activeNavigationIntelSnapshot = compileResult.snapshot;
  lastNavigationIntelActivationFailure = null;

  return {
    ok: true,
    issues: compileResult.issues,
    bundleVersion: compileResult.snapshot.bundleVersion,
    sectionStates: domainSectionStates(compileResult.snapshot),
  };
}

function verifyBundledNavigationIntelEnvelope(envelope) {
  return (
    envelope.schemaVersion === BUNDLED_NAVIGATION_INTEL_BUNDLE.schemaVersion &&
    envelope.bundleVersion === BUNDLED_NAVIGATION_INTEL_BUNDLE.bundleVersion &&
    envelope.generatedAt === BUNDLED_NAVIGATION_INTEL_BUNDLE.generatedAt &&
    envelope.publisher === BUNDLED_NAVIGATION_INTEL_BUNDLE.publisher &&
    envelope.signingKeyId === BUNDLED_NAVIGATION_INTEL_BUNDLE.signingKeyId &&
    envelope.signature === BUNDLED_NAVIGATION_INTEL_BUNDLE.signature
  );
}

export function activateRuntimeNavigationIntelSnapshot(deps = {}) {
  const bundle = deps.bundle ?? BUNDLED_NAVIGATION_INTEL_BUNDLE;
  const result = loadNavigationIntelSnapshot(bundle, {
    now: deps.now,
    signatureVerifier:
      typeof deps.signatureVerifier === 'function'
        ? deps.signatureVerifier
        : verifyBundledNavigationIntelEnvelope,
  });

  if (!result.ok) {
    console.warn(
      '[ClickShield][BG] Navigation intel activation failed:',
      result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ') || 'unknown error',
    );
  } else {
    console.log('[ClickShield][BG] Navigation intel activated:', result.bundleVersion);
  }

  return result;
}

export function resolveNavigationDomainIntel(rawUrl) {
  const domain = safeHostname(rawUrl);
  const snapshot = activeNavigationIntelSnapshot;
  const sectionStates = getNavigationIntelSnapshotState().sectionStates;
  const feedVersion = usableMaliciousFeedVersion(snapshot);
  const domainAllowlistVersion = usableDomainAllowlistVersion(snapshot);

  if (!domain) {
    return {
      domain: '',
      feedVersion,
      domainAllowlistVersion,
      degradedProtection: false,
      bundleVersion: snapshot?.bundleVersion ?? null,
      sectionStates,
      domainLookup: noMatchDomainLookup(
        sectionStates.maliciousDomains,
        snapshot ? sectionStates.allowlists !== 'fresh' : false,
        domainAllowlistVersion ?? undefined,
      ),
      isKnownMaliciousDomain: false,
    };
  }

  if (!snapshot) {
    return {
      domain,
      feedVersion: null,
      domainAllowlistVersion: null,
      degradedProtection: true,
      bundleVersion: null,
      sectionStates,
      domainLookup: unavailableDomainLookup(sectionStates.maliciousDomains),
      isKnownMaliciousDomain: false,
    };
  }

  const domainLookup = resolveSnapshotDomainIntel(snapshot, domain);

  return {
    domain,
    feedVersion,
    domainAllowlistVersion,
    degradedProtection: domainLookup.degradedProtection === true,
    bundleVersion: snapshot.bundleVersion,
    sectionStates,
    domainLookup,
    isKnownMaliciousDomain: domainLookup.disposition === 'malicious',
  };
}

// ── Layer 1 signal cache + lookup ───────────────────────────────────────────

const domainAgeCache = new Map();

async function lookupDomainAge(domain, fetchImpl = fetch) {
  const cached = domainAgeCache.get(domain);
  if (isFresh(cached, DOMAIN_AGE_CACHE_TTL_MS)) {
    return { value: cached.value, status: 'cached' };
  }

  try {
    const data = await fetchJsonWithTimeout(
      `${API_BASE}/intel/domain-age?domain=${encodeURIComponent(domain)}`,
      SIGNAL_TIMEOUT_MS,
      fetchImpl,
    );
    const ageHours = typeof data.ageHours === 'number' ? data.ageHours : null;
    domainAgeCache.set(domain, { value: ageHours, fetchedAt: nowMs() });
    return { value: ageHours, status: 'resolved' };
  } catch {
    if (cached) return { value: cached.value, status: 'stale' };
    return { value: null, status: 'failed' };
  }
}

export async function resolveNavigationIntel(rawUrl, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const domainIntel = resolveNavigationDomainIntel(rawUrl);
  if (!domainIntel.domain) {
    return {
      ...domainIntel,
      domainAgeHours: null,
      failures: ['DOMAIN_PARSE_FAILED'],
    };
  }

  const domainAge = await lookupDomainAge(domainIntel.domain, fetchImpl);

  const failures = [];
  if (domainAge.status === 'failed') failures.push('DOMAIN_AGE_LOOKUP_FAILED');

  return {
    ...domainIntel,
    domainAgeHours: domainAge.value,
    failures,
  };
}

export function shouldFailSafeWarnOnSignalFailure(localVerdict, intelState) {
  // If local evaluation already warns/blocks, keep that stronger signal.
  if (localVerdict.status !== 'allow') return false;

  if (Array.isArray(intelState)) {
    return intelState.length > 0;
  }

  if (!intelState) {
    return false;
  }

  if (Array.isArray(intelState.failures) && intelState.failures.length > 0) {
    return true;
  }

  return intelState.degradedProtection === true;
}

function intelFailureReason(intelState) {
  const failures = Array.isArray(intelState) ? intelState : intelState?.failures;
  if ((!Array.isArray(failures) || failures.length === 0) && !intelState?.degradedProtection) {
    return 'ClickShield could not complete all protection checks for this page.';
  }

  if (intelState?.degradedProtection) {
    const maliciousState = intelState.sectionStates?.maliciousDomains;
    if (maliciousState === 'expired') {
      return 'ClickShield could not verify the current domain threat-intelligence snapshot because it has expired.';
    }
    if (maliciousState === 'invalid') {
      return 'ClickShield could not verify the current domain threat-intelligence snapshot because validation failed.';
    }
    if (maliciousState === 'missing') {
      return 'ClickShield could not verify the current domain threat-intelligence snapshot for this page.';
    }

    const allowlistState = intelState.sectionStates?.allowlists;
    if (allowlistState && allowlistState !== 'fresh') {
      return 'ClickShield could not verify current domain allowlist intelligence for this page.';
    }
  }

  if (Array.isArray(failures) && failures.includes('DOMAIN_AGE_LOOKUP_FAILED')) {
    return 'ClickShield could not verify domain-age intelligence for this page.';
  }

  return 'ClickShield could not complete all protection checks for this page.';
}

export function buildFailSafeScan(url, reason, details = {}) {
  return {
    url,
    riskLevel: 'SUSPICIOUS',
    riskScore: 55,
    threatType: 'DEGRADED_PROTECTION',
    reason,
    shortAdvice: 'Proceed only if you fully trust the source and expect this destination.',
    ruleReason: 'Protection checks incomplete',
    detectedBy: 'shared-rules-failsafe',
    ruleName: 'L1_DEGRADED_PROTECTION',
    degradedProtection: true,
    ...details,
  };
}

// Detect browser from service worker context
function detectBrowser() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (ua.includes('Brave')) return 'brave';
  if (ua.includes('Edg')) return 'edge';
  return 'chrome';
}

const detectedBrowser = detectBrowser();

// ── Local shared-rules evaluation ──

/**
 * Run local deterministic evaluation using shared-rules.
 * This is Layer 1 — no network calls, pure and synchronous.
 *
 * @param {string} url - The URL to evaluate.
 * @param {object} opts - Optional domain context overrides.
 * @returns {{ verdict, reasonMessage, title, badge, context }} Local evaluation result.
 */
export function evaluateLocally(url, opts = {}) {
  const ctx = buildNavigationContext({
    rawUrl: url,
    domainAgeHours: opts.domainAgeHours ?? null,
    isKnownMaliciousDomain: opts.isKnownMalicious ?? false,
    redirectCount: opts.redirectCount ?? 0,
    finalDomain: opts.finalDomain,
    feedVersion: opts.feedVersion,
    domainAllowlistVersion: opts.domainAllowlistVersion,
  });

  const input = contextToInput(ctx);
  const result = evaluate(input);
  const verdict = result.verdict;

  // Build human-readable fields from the primary reason code
  const primaryReason = verdict.reasonCodes[0] || '';
  const reasonMessage = getReasonMessage(primaryReason);
  const title = getVerdictTitle(verdict.status, primaryReason);
  const badge = riskBadgeLabel(verdict.riskLevel);

  return {
    verdict,
    reasonMessage,
    title,
    badge,
    context: ctx,
  };
}

/**
 * Map shared-rules verdict to extension risk level format.
 */
function verdictToRiskLevel(verdict) {
  if (verdict.status === 'block') return 'DANGEROUS';
  if (verdict.status === 'warn') return 'SUSPICIOUS';
  return 'SAFE';
}

// ── Backend communication ──

// Fetch shield mode from backend
async function fetchShieldMode() {
  try {
    const res = await fetch(`${API_BASE}/shield-mode`);
    if (res.ok) {
      const data = await res.json();
      if (data.shieldMode === 'normal' || data.shieldMode === 'paranoid') {
        currentShieldMode = data.shieldMode;
        console.log('[ClickShield][BG] Shield mode updated:', currentShieldMode);
      }
    }
  } catch (err) {
    console.warn('[ClickShield][BG] Could not fetch shield-mode:', err?.message || err);
  }
}

// Health check: ping backend and update status
async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      backendOnline = data.status === 'ok';
    } else {
      backendOnline = false;
    }
  } catch {
    backendOnline = false;
  }
  lastHealthCheck = new Date().toISOString();
  console.log(`[ClickShield][BG] Health check: backend ${backendOnline ? 'ONLINE' : 'OFFLINE'}`);
}

// Scan with one retry
async function scanUrlBackend(url, browserName) {
  const doFetch = () =>
    fetch(`${API_BASE}/scan-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-clickshield-org-id': 'demo-acme',
        'x-org-id': 'demo-acme',
      },
      body: JSON.stringify({
        url,
        userType: 'consumer',
        userId: 'browser-extension-user',
        userEmail: 'browser-extension@clickshield.app',
        deviceId: `browser-${browserName}`,
        source: 'browser-extension',
      }),
    });

  let res;
  try {
    res = await doFetch();
  } catch (err) {
    // First attempt failed — wait 2s and retry once
    console.warn('[ClickShield][BG] Scan fetch failed, retrying in 2s:', err?.message);
    await new Promise((r) => setTimeout(r, 2000));
    res = await doFetch();
  }

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Backend error ${res.status}: ${txt}`);
  }
  return res.json();
}

function buildRedirectContextForScan(tabId, currentUrl) {
  if (typeof tabId !== 'number' || tabId < 0) {
    return {
      redirectCount: 0,
      finalDomain: undefined,
      initialUrl: null,
    };
  }

  const chain = redirectTracker.getChainForTabUrl(tabId, currentUrl);
  if (!chain) {
    return {
      redirectCount: 0,
      finalDomain: undefined,
      initialUrl: null,
    };
  }

  const finalHost = safeHostname(chain.finalUrl);
  const finalRegistrable = finalHost ? extractRegistrableDomain(finalHost) : '';

  return {
    redirectCount: chain.redirectCount,
    finalDomain: finalRegistrable || finalHost || undefined,
    initialUrl: chain.initialUrl || null,
  };
}

function attachRuntimeListeners() {
  activateRuntimeNavigationIntelSnapshot();

  // ── Redirect tracking via webRequest ──
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => redirectTracker.onBeforeRequest(details),
    { urls: ['<all_urls>'], types: ['main_frame'] },
  );

  chrome.webRequest.onBeforeRedirect.addListener(
    (details) => redirectTracker.onBeforeRedirect(details),
    { urls: ['<all_urls>'], types: ['main_frame'] },
  );

  chrome.webRequest.onCompleted.addListener(
    (details) => redirectTracker.onCompleted(details),
    { urls: ['<all_urls>'], types: ['main_frame'] },
  );

  chrome.webRequest.onErrorOccurred.addListener(
    (details) => redirectTracker.onErrorOccurred(details),
    { urls: ['<all_urls>'], types: ['main_frame'] },
  );

  chrome.tabs.onRemoved.addListener((tabId) => {
    redirectTracker.onTabRemoved(tabId);
  });

  // Run health check + fetch shield mode on install and startup
  chrome.runtime.onInstalled.addListener(() => {
    console.log('ClickShield Web3 Protection installed.');
    activateRuntimeNavigationIntelSnapshot();
    void checkBackendHealth();
    void fetchShieldMode();
  });

  chrome.runtime.onStartup.addListener(() => {
    console.log('ClickShield Web3 Protection started.');
    activateRuntimeNavigationIntelSnapshot();
    void checkBackendHealth();
    void fetchShieldMode();
  });

  // Re-check health every 60 seconds via alarm
  chrome.alarms.create('healthCheck', { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'healthCheck') {
      void checkBackendHealth();
    }
  });

  // Listen for scan requests from content scripts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'SCAN_URL') {
      const url = message.url;
      const browserName = message.browser || detectedBrowser;

      console.log('[ClickShield][BG] Scanning URL from content script:', url);

      (async () => {
        const tabId = sender.tab?.id;
        const redirectCtx = buildRedirectContextForScan(tabId, url);

        const intel = await resolveNavigationIntel(url);

        let localResult;
        try {
          localResult = evaluateLocally(url, {
            domainAgeHours: intel.domainAgeHours,
            isKnownMalicious: intel.isKnownMaliciousDomain,
            redirectCount: redirectCtx.redirectCount,
            finalDomain: redirectCtx.finalDomain,
            feedVersion: intel.feedVersion,
            domainAllowlistVersion: intel.domainAllowlistVersion,
          });

          // Redirect-chain probe uses the original URL so shared-rules can
          // compare original registrable domain vs final registrable domain.
          if (
            redirectCtx.redirectCount >= 3 &&
            redirectCtx.initialUrl &&
            redirectCtx.finalDomain
          ) {
            const redirectProbe = evaluateLocally(redirectCtx.initialUrl, {
              domainAgeHours: null,
              isKnownMalicious: false,
              redirectCount: redirectCtx.redirectCount,
              finalDomain: redirectCtx.finalDomain,
              feedVersion: intel.feedVersion,
              domainAllowlistVersion: intel.domainAllowlistVersion,
            });
            if (
              redirectProbe.verdict.reasonCodes.includes('SUSPICIOUS_REDIRECT_CHAIN') &&
              localResult.verdict.status === 'allow'
            ) {
              localResult = redirectProbe;
            }
          }
        } catch (err) {
          console.warn('[ClickShield][BG] Local evaluation failed:', err?.message || err);
          sendResponse({
            ok: true,
            data: {
              ok: true,
              scan: buildFailSafeScan(
                url,
                'ClickShield could not complete local protection checks for this page.',
                { runtimeError: true },
              ),
            },
            shieldMode: currentShieldMode,
            degradedProtection: true,
          });
          return;
        }

        const localVerdict = localResult.verdict;

        console.log('[ClickShield][BG] Local verdict:', localVerdict.status, localVerdict.reasonCodes);

        if (shouldFailSafeWarnOnSignalFailure(localVerdict, intel)) {
          sendResponse({
            ok: true,
            data: {
              ok: true,
              scan: buildFailSafeScan(
                url,
                intelFailureReason(intel),
                {
                  intelFailures: intel.failures,
                  domainIntel: {
                    disposition: intel.domainLookup?.disposition,
                    sectionState: intel.domainLookup?.sectionState,
                    bundleVersion: intel.bundleVersion,
                    sectionStates: intel.sectionStates,
                  },
                  redirectCount: redirectCtx.redirectCount,
                  finalDomain: redirectCtx.finalDomain,
                },
              ),
            },
            shieldMode: currentShieldMode,
            degradedProtection: true,
            localVerdict: {
              status: localVerdict.status,
              riskLevel: localVerdict.riskLevel,
              reasonCodes: localVerdict.reasonCodes,
              matchedRules: localVerdict.matchedRules,
            },
          });
          return;
        }

        // If local rules block, respond immediately — don't wait for backend
        if (localVerdict.status === 'block') {
          console.log('[ClickShield][BG] Local BLOCK — responding immediately');
          sendResponse({
            ok: true,
            data: {
              ok: true,
              scan: {
                url,
                riskLevel: 'DANGEROUS',
                riskScore: 90,
                threatType: localResult.badge,
                reason: localResult.reasonMessage.reason,
                shortAdvice: localResult.reasonMessage.reason,
                ruleReason: localResult.title,
                detectedBy: 'shared-rules',
                ruleName: localVerdict.matchedRules[0] || 'PHISHING_BLOCK',
              },
            },
            shieldMode: currentShieldMode,
            localVerdict: {
              status: localVerdict.status,
              riskLevel: localVerdict.riskLevel,
              reasonCodes: localVerdict.reasonCodes,
              matchedRules: localVerdict.matchedRules,
            },
          });
          return;
        }

        // If local rules warn, respond with warning immediately
        if (localVerdict.status === 'warn') {
          console.log('[ClickShield][BG] Local WARN — responding with warning');
          sendResponse({
            ok: true,
            data: {
              ok: true,
              scan: {
                url,
                riskLevel: 'SUSPICIOUS',
                riskScore: 65,
                threatType: localResult.badge,
                reason: localResult.reasonMessage.reason,
                shortAdvice: localResult.reasonMessage.reason,
                ruleReason: localResult.title,
                detectedBy: 'shared-rules',
                ruleName: localVerdict.matchedRules[0] || 'PHISHING_WARN',
              },
            },
            shieldMode: currentShieldMode,
            localVerdict: {
              status: localVerdict.status,
              riskLevel: localVerdict.riskLevel,
              reasonCodes: localVerdict.reasonCodes,
              matchedRules: localVerdict.matchedRules,
            },
          });
          return;
        }

        // ── Layer 2: Local allow — fall through to backend for enrichment ──
        scanUrlBackend(url, browserName)
          .then((data) => {
            backendOnline = true;
            console.log('[ClickShield][BG] Backend scan success:', data);

            // Update local shield mode from scan response
            if (data.shieldMode === 'normal' || data.shieldMode === 'paranoid') {
              currentShieldMode = data.shieldMode;
            }

            sendResponse({
              ok: true,
              data,
              shieldMode: currentShieldMode,
              localVerdict: {
                status: localVerdict.status,
                riskLevel: localVerdict.riskLevel,
                reasonCodes: localVerdict.reasonCodes,
                matchedRules: localVerdict.matchedRules,
              },
            });
          })
          .catch((err) => {
            backendOnline = false;
            console.error('[ClickShield][BG] Backend scan failed:', err?.message || err);
            // Backend offline — respond with local allow verdict
            sendResponse({
              ok: true,
              data: {
                ok: true,
                scan: {
                  url,
                  riskLevel: verdictToRiskLevel(localVerdict),
                  riskScore: 10,
                  threatType: 'GENERIC',
                  reason: 'Local evaluation passed. Backend unavailable for enrichment.',
                  shortAdvice: 'Link appears low-risk based on local analysis.',
                  detectedBy: 'shared-rules-local',
                  ruleName: 'LOCAL_ALLOW',
                },
              },
              shieldMode: currentShieldMode,
              backendOffline: true,
              localVerdict: {
                status: localVerdict.status,
                riskLevel: localVerdict.riskLevel,
                reasonCodes: localVerdict.reasonCodes,
                matchedRules: localVerdict.matchedRules,
              },
            });
          });
      })().catch((err) => {
        console.error('[ClickShield][BG] Unhandled scan path error:', err?.message || err);
        sendResponse({
          ok: true,
          data: {
            ok: true,
            scan: buildFailSafeScan(
              url,
              'ClickShield encountered an internal protection error for this page.',
              { runtimeError: true },
            ),
          },
          shieldMode: currentShieldMode,
          degradedProtection: true,
        });
      });

      // Tell Chrome we will reply asynchronously
      return true;
    }

    // Handle status queries from popup
    if (message && message.type === 'GET_STATUS') {
      sendResponse({
        backendOnline,
        lastHealthCheck,
        browser: detectedBrowser,
        apiBase: API_BASE,
        shieldMode: currentShieldMode,
      });
      return false;
    }

    return false;
  });
}

// Guard side effects for test environments where chrome APIs are unavailable.
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.webRequest) {
  attachRuntimeListeners();
}
