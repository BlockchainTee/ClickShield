const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { readNavigationFeedTruth } = require('../navigationFeedTruth.js');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function createFeedFixture(root, { bundleVersion, generatedAt, maliciousCount, allowlistCount }) {
  const manifestPath = path.join(root, 'manifest.json');
  const bundlePath = path.join(root, 'bundles', bundleVersion, 'bundle.json');
  const maliciousDomains = {
    feedType: 'maliciousDomains',
    feedVersion: '2026-03-21.1',
    itemCount: maliciousCount,
    sha256: 'sha-malicious',
    staleAfter: '2026-03-22T18:00:00Z',
    expiresAt: '2026-03-24T18:00:00Z',
    items: Array.from({ length: maliciousCount }, (_, index) => ({
      id: `dom_${index}`,
      identity: `exact_host:bad-${index}.example`,
      type: 'exact_host',
      source: 'fixture',
      reasonCode: 'KNOWN_PHISHING_DOMAIN',
      confidence: 0.99,
      firstSeenAt: '2026-03-20T00:00:00Z',
      lastSeenAt: generatedAt,
      domain: `bad-${index}.example`,
      scope: 'exact_host',
      classification: 'phishing',
    })),
  };
  const allowlists = {
    feedType: 'allowlists',
    feedVersion: '2026-03-21.5',
    itemCount: allowlistCount,
    sha256: 'sha-allowlists',
    staleAfter: '2026-03-22T18:00:00Z',
    expiresAt: '2026-03-23T18:00:00Z',
    items: Array.from({ length: allowlistCount }, (_, index) => ({
      id: `allow_${index}`,
      identity: `domain_exact_host:trusted-${index}.example`,
      type: 'domain_exact_host',
      source: 'fixture',
      reasonCode: 'KNOWN_SAFE_EXCEPTION',
      confidence: 0.95,
      firstSeenAt: '2026-03-20T00:00:00Z',
      lastSeenAt: generatedAt,
      targetKind: 'domain',
      target: `trusted-${index}.example`,
      scope: 'exact_host',
      justification: 'Fixture allowlist',
    })),
  };

  writeJson(manifestPath, {
    schemaVersion: '1.0.0',
    bundleFamily: 'navigation',
    bundleVersion,
    generatedAt,
    publisher: 'clickshield-intel',
    signingKeyId: 'clickshield-static-v1',
    bundleUrl: `/intel/feeds/navigation/bundles/${bundleVersion}/bundle.json`,
    sections: {
      maliciousDomains: {
        feedVersion: maliciousDomains.feedVersion,
        itemCount: maliciousDomains.itemCount,
        sha256: maliciousDomains.sha256,
        staleAfter: maliciousDomains.staleAfter,
        expiresAt: maliciousDomains.expiresAt,
      },
      allowlists: {
        feedVersion: allowlists.feedVersion,
        itemCount: allowlists.itemCount,
        sha256: allowlists.sha256,
        staleAfter: allowlists.staleAfter,
        expiresAt: allowlists.expiresAt,
      },
    },
    signature: 'fixture-manifest-signature',
  });

  writeJson(bundlePath, {
    schemaVersion: '1.0.0',
    bundleVersion,
    generatedAt,
    publisher: 'clickshield-intel',
    signingKeyId: 'clickshield-static-v1',
    sections: {
      maliciousDomains: {
        feedVersion: maliciousDomains.feedVersion,
        itemCount: maliciousDomains.itemCount,
        sha256: maliciousDomains.sha256,
        staleAfter: maliciousDomains.staleAfter,
        expiresAt: maliciousDomains.expiresAt,
      },
      allowlists: {
        feedVersion: allowlists.feedVersion,
        itemCount: allowlists.itemCount,
        sha256: allowlists.sha256,
        staleAfter: allowlists.staleAfter,
        expiresAt: allowlists.expiresAt,
      },
    },
    signature: 'fixture-bundle-signature',
    maliciousDomains,
    allowlists,
  });
}

test('readNavigationFeedTruth reports a populated bundle as fresh', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'clickshield-navigation-feed-'));
  createFeedFixture(tempRoot, {
    bundleVersion: '2026-03-21T19:00:00Z.navigation-test',
    generatedAt: '2026-03-21T19:00:00Z',
    maliciousCount: 1,
    allowlistCount: 1,
  });

  const truth = readNavigationFeedTruth({
    feedsRoot: tempRoot,
    now: '2026-03-21T20:00:00Z',
  });

  assert.equal(truth.httpStatus, 200);
  assert.equal(truth.payload.ok, true);
  assert.equal(truth.payload.disposition, 'fresh');
  assert.equal(truth.payload.sections.maliciousDomains.state, 'fresh');
  assert.equal(truth.payload.sections.allowlists.state, 'fresh');
  assert.deepEqual(truth.payload.issues, []);
});

test('readNavigationFeedTruth reports the checked-in bundle as empty and unavailable', () => {
  const truth = readNavigationFeedTruth({
    feedsRoot: path.join(__dirname, '..', 'feeds', 'navigation'),
    now: '2026-03-21T20:00:00Z',
  });

  assert.equal(truth.httpStatus, 503);
  assert.equal(truth.payload.ok, false);
  assert.equal(truth.payload.disposition, 'empty');
  assert.equal(truth.payload.sections.maliciousDomains.state, 'empty');
  assert.equal(truth.payload.sections.allowlists.state, 'empty');
  assert.equal(truth.payload.degradedProtection, true);
});
