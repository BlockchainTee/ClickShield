import { compileDomainIntelSnapshot } from './lib/shared-rules.js';

const DEFAULT_MISSING_SECTION_STATES = Object.freeze({
  maliciousDomains: 'missing',
  allowlists: 'missing',
});

function resolveNow(input) {
  if (typeof input === 'function') {
    return input();
  }

  return input;
}

function resolveTimestampIso(input) {
  const resolved = resolveNow(input);
  const date =
    resolved instanceof Date
      ? resolved
      : typeof resolved === 'number'
        ? new Date(resolved)
        : typeof resolved === 'string'
          ? new Date(resolved)
          : new Date();

  return date.toISOString();
}

function isUsableMaliciousState(state) {
  return state === 'fresh' || state === 'stale';
}

function isUsableAllowlistState(state) {
  return state === 'fresh';
}

function sectionStatesFromSnapshot(snapshot) {
  if (!snapshot) {
    return DEFAULT_MISSING_SECTION_STATES;
  }

  return {
    maliciousDomains: snapshot.sections.maliciousDomains.state,
    allowlists: snapshot.sections.allowlists.state,
  };
}

function degradedProtectionFromStates(sectionStates) {
  return (
    !isUsableMaliciousState(sectionStates.maliciousDomains) ||
    !isUsableAllowlistState(sectionStates.allowlists)
  );
}

function versionsFromSnapshot(snapshot) {
  if (!snapshot) {
    return {
      schemaVersion: null,
      bundleVersion: null,
      feedVersions: {
        maliciousDomains: null,
        allowlists: null,
      },
      aggregateVersion: null,
    };
  }

  const maliciousVersion = snapshot.sections.maliciousDomains.feedVersion ?? 'none';
  const allowlistVersion = snapshot.sections.allowlists.feedVersion ?? 'none';

  return {
    schemaVersion: snapshot.schemaVersion,
    bundleVersion: snapshot.bundleVersion,
    feedVersions: {
      maliciousDomains: snapshot.sections.maliciousDomains.feedVersion ?? null,
      allowlists: snapshot.sections.allowlists.feedVersion ?? null,
    },
    aggregateVersion: [
      `schema:${snapshot.schemaVersion}`,
      `bundle:${snapshot.bundleVersion}`,
      `maliciousDomains:${maliciousVersion}`,
      `allowlists:${allowlistVersion}`,
    ].join('|'),
  };
}

function isActivatableDomainSnapshot(snapshot) {
  const maliciousState = snapshot.sections.maliciousDomains.state;
  return maliciousState !== 'missing' && maliciousState !== 'invalid';
}

export class NavigationIntelFeedManager {
  constructor(options) {
    this.seedBundle = options.seedBundle;
    this.storage = options.storage;
    this.signatureVerifier = options.signatureVerifier;
    this.now = options.now;
    this.activeSnapshot = null;
    this.activeSource = null;
    this.activeIssues = [];
    this.inactiveSectionStates = DEFAULT_MISSING_SECTION_STATES;
    this.inactiveIssues = [];
    this.storageMetadata = null;

    if (options.activateSeed !== false) {
      this.activateSeedSnapshot();
    }
  }

  activateSeedSnapshot() {
    const result = this.compileBundle(this.seedBundle);
    if (!result.ok) {
      this.inactiveSectionStates = {
        maliciousDomains: 'invalid',
        allowlists: 'missing',
      };
      this.inactiveIssues = result.issues;
      return {
        ok: false,
        source: this.activeSource,
        issues: result.issues,
        state: this.getState(),
      };
    }

    if (!isActivatableDomainSnapshot(result.snapshot)) {
      this.inactiveSectionStates = sectionStatesFromSnapshot(result.snapshot);
      this.inactiveIssues = result.issues;
      return {
        ok: false,
        source: this.activeSource,
        issues: result.issues,
        state: this.getState(),
      };
    }

    this.activeSnapshot = result.snapshot;
    this.activeSource = 'seed';
    this.activeIssues = result.issues;
    this.inactiveSectionStates = DEFAULT_MISSING_SECTION_STATES;
    this.inactiveIssues = [];

    return {
      ok: true,
      source: 'seed',
      issues: result.issues,
      state: this.getState(),
    };
  }

  compileBundle(bundle) {
    return compileDomainIntelSnapshot(bundle, {
      now: resolveNow(this.now),
      signatureVerifier: this.signatureVerifier,
    });
  }

  getActiveSnapshot() {
    return this.activeSnapshot;
  }

  getState() {
    const sectionStates = this.activeSnapshot
      ? sectionStatesFromSnapshot(this.activeSnapshot)
      : this.inactiveSectionStates;

    return {
      active: this.activeSnapshot !== null,
      source: this.activeSource,
      bundleVersion: this.activeSnapshot?.bundleVersion ?? null,
      sectionStates,
      degradedProtection: degradedProtectionFromStates(sectionStates),
      versions: versionsFromSnapshot(this.activeSnapshot),
      issues: this.activeSnapshot ? this.activeIssues : this.inactiveIssues,
      metadata: this.storageMetadata,
    };
  }

  async initialize() {
    const attemptedSources = [];
    const [metadata, cachedBundle, lastKnownGoodBundle] = await Promise.all([
      this.storage.loadMetadata(),
      this.storage.loadRawBundle('cache'),
      this.storage.loadRawBundle('lastKnownGood'),
    ]);

    this.storageMetadata = metadata;

    if (cachedBundle !== null) {
      attemptedSources.push('cache');
      const cachedResult = await this.activateBundleInternal(cachedBundle, 'cache', {
        persistCache: false,
        persistLastKnownGood: true,
      });
      if (cachedResult.ok) {
        return {
          ...cachedResult,
          attemptedSources,
        };
      }
    }

    if (lastKnownGoodBundle !== null) {
      attemptedSources.push('lastKnownGood');
      const lastKnownGoodResult = await this.activateBundleInternal(
        lastKnownGoodBundle,
        'lastKnownGood',
        {
          persistCache: false,
          persistLastKnownGood: false,
        },
      );
      if (lastKnownGoodResult.ok) {
        return {
          ...lastKnownGoodResult,
          attemptedSources,
        };
      }
    }

    if (this.activeSource === 'seed' && this.activeSnapshot) {
      return {
        ok: true,
        source: 'seed',
        issues: this.activeIssues,
        state: this.getState(),
        attemptedSources,
      };
    }

    attemptedSources.push('seed');
    const seedResult = this.activateSeedSnapshot();

    return {
      ...seedResult,
      attemptedSources,
    };
  }

  async activateBundle(bundle) {
    return this.activateBundleInternal(bundle, 'refresh', {
      persistCache: true,
      persistLastKnownGood: true,
    });
  }

  async activateBundleInternal(bundle, source, options) {
    if (options.persistCache) {
      await this.storage.saveRawBundle('cache', bundle);
      this.storageMetadata = {
        ...(this.storageMetadata ?? {}),
        cacheUpdatedAt: resolveTimestampIso(this.now),
      };
    }

    const result = this.compileBundle(bundle);

    if (!result.ok) {
      if (this.activeSnapshot === null) {
        this.inactiveSectionStates = {
          maliciousDomains: 'invalid',
          allowlists: 'missing',
        };
        this.inactiveIssues = result.issues;
      }

      if (this.storageMetadata) {
        await this.storage.saveMetadata(this.storageMetadata);
      }

      return {
        ok: false,
        source: this.activeSource,
        issues: result.issues,
        state: this.getState(),
      };
    }

    if (!isActivatableDomainSnapshot(result.snapshot)) {
      if (this.activeSnapshot === null) {
        this.inactiveSectionStates = sectionStatesFromSnapshot(result.snapshot);
        this.inactiveIssues = result.issues;
      }

      if (options.persistCache) {
        this.storageMetadata = {
          ...(this.storageMetadata ?? {}),
          cacheBundleVersion: result.snapshot.bundleVersion,
        };
      }

      if (this.storageMetadata) {
        await this.storage.saveMetadata(this.storageMetadata);
      }

      return {
        ok: false,
        source: this.activeSource,
        issues: result.issues,
        state: this.getState(),
      };
    }

    this.activeSnapshot = result.snapshot;
    this.activeSource = source;
    this.activeIssues = result.issues;
    this.inactiveSectionStates = DEFAULT_MISSING_SECTION_STATES;
    this.inactiveIssues = [];

    const metadata = {
      ...(this.storageMetadata ?? {}),
      lastActivationAt: resolveTimestampIso(this.now),
      lastActivationSource: source,
      lastActivatedBundleVersion: result.snapshot.bundleVersion,
      ...(options.persistCache
        ? {
            cacheUpdatedAt: resolveTimestampIso(this.now),
            cacheBundleVersion: result.snapshot.bundleVersion,
          }
        : {}),
      ...(options.persistLastKnownGood
        ? {
            lastKnownGoodUpdatedAt: resolveTimestampIso(this.now),
            lastKnownGoodBundleVersion: result.snapshot.bundleVersion,
          }
        : {}),
    };

    if (options.persistLastKnownGood) {
      await this.storage.saveRawBundle('lastKnownGood', bundle);
    }

    this.storageMetadata = metadata;
    await this.storage.saveMetadata(metadata);

    return {
      ok: true,
      source,
      issues: result.issues,
      state: this.getState(),
    };
  }
}
