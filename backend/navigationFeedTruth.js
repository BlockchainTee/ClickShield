const fs = require('fs');
const path = require('path');

function isRecordObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function readFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readNavigationSectionMetadata(value) {
  if (!isRecordObject(value)) {
    return null;
  }

  const feedVersion = readNonEmptyString(value.feedVersion);
  const sha256 = readNonEmptyString(value.sha256);
  const staleAfter = readNonEmptyString(value.staleAfter);
  const expiresAt = readNonEmptyString(value.expiresAt);
  const itemCount = readFiniteNumber(value.itemCount);

  if (
    feedVersion === null ||
    sha256 === null ||
    staleAfter === null ||
    expiresAt === null ||
    itemCount === null ||
    !Number.isInteger(itemCount) ||
    itemCount < 0
  ) {
    return null;
  }

  return {
    feedVersion,
    itemCount,
    sha256,
    staleAfter,
    expiresAt,
  };
}

function navigationSectionMetadataMatches(left, right) {
  return (
    left !== null &&
    right !== null &&
    left.feedVersion === right.feedVersion &&
    left.itemCount === right.itemCount &&
    left.sha256 === right.sha256 &&
    left.staleAfter === right.staleAfter &&
    left.expiresAt === right.expiresAt
  );
}

function deriveNavigationSectionFreshness(metadata, nowMs) {
  const staleAfterMs = Date.parse(metadata.staleAfter);
  const expiresAtMs = Date.parse(metadata.expiresAt);

  if (!Number.isFinite(staleAfterMs) || !Number.isFinite(expiresAtMs)) {
    return 'invalid';
  }

  if (staleAfterMs >= expiresAtMs) {
    return 'invalid';
  }

  if (nowMs >= expiresAtMs) {
    return 'expired';
  }

  if (nowMs >= staleAfterMs) {
    return 'stale';
  }

  return 'fresh';
}

function buildNavigationSectionTruth(sectionName, manifestMetadata, bundleMetadata, payload, nowMs) {
  const issues = [];

  if (manifestMetadata === null && bundleMetadata === null && typeof payload === 'undefined') {
    return {
      name: sectionName,
      state: 'missing',
      freshness: null,
      itemCount: 0,
      feedVersion: null,
      staleAfter: null,
      expiresAt: null,
      issues,
    };
  }

  if (manifestMetadata === null) {
    issues.push(`Manifest metadata missing for ${sectionName}`);
  }
  if (bundleMetadata === null) {
    issues.push(`Bundle metadata missing for ${sectionName}`);
  }
  if (
    manifestMetadata !== null &&
    bundleMetadata !== null &&
    !navigationSectionMetadataMatches(manifestMetadata, bundleMetadata)
  ) {
    issues.push(`Manifest/bundle metadata mismatch for ${sectionName}`);
  }

  if (!isRecordObject(payload)) {
    issues.push(`Bundle payload missing for ${sectionName}`);
  }

  const payloadMetadata = isRecordObject(payload)
    ? readNavigationSectionMetadata(payload)
    : null;

  if (isRecordObject(payload) && payloadMetadata === null) {
    issues.push(`Bundle payload metadata invalid for ${sectionName}`);
  }

  if (isRecordObject(payload) && payload.feedType !== sectionName) {
    issues.push(`Bundle payload feedType mismatch for ${sectionName}`);
  }

  if (
    bundleMetadata !== null &&
    payloadMetadata !== null &&
    !navigationSectionMetadataMatches(bundleMetadata, payloadMetadata)
  ) {
    issues.push(`Bundle metadata/payload mismatch for ${sectionName}`);
  }

  const items = isRecordObject(payload) && Array.isArray(payload.items) ? payload.items : null;
  if (isRecordObject(payload) && items === null) {
    issues.push(`Bundle items missing for ${sectionName}`);
  }

  const canonicalMetadata = bundleMetadata ?? manifestMetadata;
  if (issues.length > 0 || canonicalMetadata === null || items === null) {
    return {
      name: sectionName,
      state: 'invalid',
      freshness: null,
      itemCount: canonicalMetadata?.itemCount ?? 0,
      feedVersion: canonicalMetadata?.feedVersion ?? null,
      staleAfter: canonicalMetadata?.staleAfter ?? null,
      expiresAt: canonicalMetadata?.expiresAt ?? null,
      issues,
    };
  }

  if (items.length !== canonicalMetadata.itemCount) {
    issues.push(`Bundle itemCount mismatch for ${sectionName}`);
  }

  const freshness = deriveNavigationSectionFreshness(canonicalMetadata, nowMs);
  if (freshness === 'invalid') {
    issues.push(`Freshness metadata invalid for ${sectionName}`);
  }

  if (issues.length > 0 || freshness === 'invalid') {
    return {
      name: sectionName,
      state: 'invalid',
      freshness: null,
      itemCount: canonicalMetadata.itemCount,
      feedVersion: canonicalMetadata.feedVersion,
      staleAfter: canonicalMetadata.staleAfter,
      expiresAt: canonicalMetadata.expiresAt,
      issues,
    };
  }

  return {
    name: sectionName,
    state: items.length === 0 ? 'empty' : freshness,
    freshness,
    itemCount: items.length,
    feedVersion: canonicalMetadata.feedVersion,
    staleAfter: canonicalMetadata.staleAfter,
    expiresAt: canonicalMetadata.expiresAt,
    issues,
  };
}

function deriveNavigationFeedDisposition(sections, issues) {
  if (issues.length > 0) {
    return 'invalid';
  }

  const maliciousState = sections.maliciousDomains.state;
  const allowlistState = sections.allowlists.state;

  if (
    maliciousState === 'missing' ||
    maliciousState === 'invalid' ||
    maliciousState === 'expired'
  ) {
    return 'unavailable';
  }

  if (maliciousState === 'empty') {
    return 'empty';
  }

  if (maliciousState === 'stale') {
    return 'stale';
  }

  if (allowlistState !== 'fresh') {
    return 'degraded';
  }

  return 'fresh';
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readNavigationFeedTruth(options = {}) {
  const nowMs =
    options.now instanceof Date
      ? options.now.getTime()
      : typeof options.now === 'number'
        ? options.now
        : typeof options.now === 'string'
          ? Date.parse(options.now)
          : Date.now();
  const checkedAt = new Date(Number.isFinite(nowMs) ? nowMs : Date.now()).toISOString();
  const feedsRoot = options.feedsRoot;
  const manifestPath = path.join(feedsRoot, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    return {
      httpStatus: 503,
      payload: {
        ok: false,
        disposition: 'unavailable',
        checkedAt,
        bundleVersion: null,
        degradedProtection: true,
        issues: ['Navigation feed manifest not found'],
        sections: {
          maliciousDomains: {
            name: 'maliciousDomains',
            state: 'missing',
            freshness: null,
            itemCount: 0,
            feedVersion: null,
            staleAfter: null,
            expiresAt: null,
            issues: [],
          },
          allowlists: {
            name: 'allowlists',
            state: 'missing',
            freshness: null,
            itemCount: 0,
            feedVersion: null,
            staleAfter: null,
            expiresAt: null,
            issues: [],
          },
        },
      },
    };
  }

  let manifest;
  try {
    manifest = readJsonFile(manifestPath);
  } catch (error) {
    return {
      httpStatus: 503,
      payload: {
        ok: false,
        disposition: 'invalid',
        checkedAt,
        bundleVersion: null,
        degradedProtection: true,
        issues: [`Navigation feed manifest parse failed: ${error.message || String(error)}`],
        sections: {
          maliciousDomains: {
            name: 'maliciousDomains',
            state: 'invalid',
            freshness: null,
            itemCount: 0,
            feedVersion: null,
            staleAfter: null,
            expiresAt: null,
            issues: [],
          },
          allowlists: {
            name: 'allowlists',
            state: 'invalid',
            freshness: null,
            itemCount: 0,
            feedVersion: null,
            staleAfter: null,
            expiresAt: null,
            issues: [],
          },
        },
      },
    };
  }

  const issues = [];
  const bundleVersion = readNonEmptyString(manifest.bundleVersion);
  if (bundleVersion === null) {
    issues.push('Manifest bundleVersion missing');
  }

  const bundlePath =
    bundleVersion === null
      ? null
      : path.join(feedsRoot, 'bundles', bundleVersion, 'bundle.json');

  if (bundlePath === null || !fs.existsSync(bundlePath)) {
    return {
      httpStatus: 503,
      payload: {
        ok: false,
        disposition: 'unavailable',
        checkedAt,
        bundleVersion,
        degradedProtection: true,
        issues: issues.concat('Navigation feed bundle not found'),
        sections: {
          maliciousDomains: {
            name: 'maliciousDomains',
            state: 'missing',
            freshness: null,
            itemCount: 0,
            feedVersion: null,
            staleAfter: null,
            expiresAt: null,
            issues: [],
          },
          allowlists: {
            name: 'allowlists',
            state: 'missing',
            freshness: null,
            itemCount: 0,
            feedVersion: null,
            staleAfter: null,
            expiresAt: null,
            issues: [],
          },
        },
      },
    };
  }

  let bundle;
  try {
    bundle = readJsonFile(bundlePath);
  } catch (error) {
    return {
      httpStatus: 503,
      payload: {
        ok: false,
        disposition: 'invalid',
        checkedAt,
        bundleVersion,
        degradedProtection: true,
        issues: issues.concat(`Navigation feed bundle parse failed: ${error.message || String(error)}`),
        sections: {
          maliciousDomains: {
            name: 'maliciousDomains',
            state: 'invalid',
            freshness: null,
            itemCount: 0,
            feedVersion: null,
            staleAfter: null,
            expiresAt: null,
            issues: [],
          },
          allowlists: {
            name: 'allowlists',
            state: 'invalid',
            freshness: null,
            itemCount: 0,
            feedVersion: null,
            staleAfter: null,
            expiresAt: null,
            issues: [],
          },
        },
      },
    };
  }

  if (readNonEmptyString(bundle.bundleVersion) !== bundleVersion) {
    issues.push('Manifest/bundle version mismatch');
  }
  if (readNonEmptyString(bundle.generatedAt) !== readNonEmptyString(manifest.generatedAt)) {
    issues.push('Manifest/bundle generatedAt mismatch');
  }
  if (readNonEmptyString(bundle.publisher) !== readNonEmptyString(manifest.publisher)) {
    issues.push('Manifest/bundle publisher mismatch');
  }
  if (readNonEmptyString(bundle.signingKeyId) !== readNonEmptyString(manifest.signingKeyId)) {
    issues.push('Manifest/bundle signingKeyId mismatch');
  }

  const sections = {
    maliciousDomains: buildNavigationSectionTruth(
      'maliciousDomains',
      readNavigationSectionMetadata(manifest.sections?.maliciousDomains),
      readNavigationSectionMetadata(bundle.sections?.maliciousDomains),
      bundle.maliciousDomains,
      nowMs,
    ),
    allowlists: buildNavigationSectionTruth(
      'allowlists',
      readNavigationSectionMetadata(manifest.sections?.allowlists),
      readNavigationSectionMetadata(bundle.sections?.allowlists),
      bundle.allowlists,
      nowMs,
    ),
  };

  const allIssues = issues
    .concat(sections.maliciousDomains.issues)
    .concat(sections.allowlists.issues);
  const disposition = deriveNavigationFeedDisposition(sections, allIssues);
  const active =
    disposition === 'fresh' || disposition === 'stale' || disposition === 'degraded';

  return {
    httpStatus: active ? 200 : 503,
    payload: {
      ok: active,
      active,
      disposition,
      bundleVersion,
      checkedAt,
      degradedProtection: disposition !== 'fresh',
      issues: allIssues,
      sections,
    },
  };
}

module.exports = {
  readNavigationFeedTruth,
};
