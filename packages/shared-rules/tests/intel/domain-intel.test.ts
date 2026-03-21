import { describe, expect, it } from "vitest";

import {
  compileDomainIntelSnapshot,
  resolveDomainIntel,
  validateDomainIntelBundle,
} from "../../src/index.js";
import { serializeCanonicalJson, sha256Hex } from "../../src/intel/hash.js";
import type {
  DomainAllowlistsSection,
  DomainIntelBundle,
  DomainAllowlistFeedItem,
  DomainIntelValidationOptions,
  MaliciousDomainFeedItem,
  MaliciousDomainsSection,
} from "../../src/intel/types.js";

const NOW = "2026-03-21T18:00:00Z";
const VALIDATION_OPTIONS: DomainIntelValidationOptions = {
  signatureVerifier: () => true,
};

function maliciousItem(
  overrides: Partial<MaliciousDomainFeedItem> = {}
): MaliciousDomainFeedItem {
  const domain = overrides.domain ?? "bad.example";
  const type = overrides.type ?? "exact_host";

  return {
    id: overrides.id ?? `dom_${type}_${domain}`,
    type,
    identity:
      overrides.identity ??
      `${type}:${type === "registrable_domain" ? domain : domain}`,
    source: overrides.source ?? "clickshield-curated",
    reasonCode: overrides.reasonCode ?? "KNOWN_PHISHING_DOMAIN",
    confidence: overrides.confidence ?? 0.99,
    firstSeenAt: overrides.firstSeenAt ?? "2026-03-20T00:00:00Z",
    lastSeenAt: overrides.lastSeenAt ?? NOW,
    domain,
    scope: overrides.scope ?? type,
    classification: overrides.classification ?? "phishing",
  };
}

function allowlistItem(
  overrides: Partial<DomainAllowlistFeedItem> = {}
): DomainAllowlistFeedItem {
  const scope = overrides.scope ?? "exact_host";
  const target = overrides.target ?? "safe.example";
  const type =
    overrides.type ??
    (scope === "registrable_domain"
      ? "domain_registrable_domain"
      : "domain_exact_host");

  return {
    id: overrides.id ?? `allow_${scope}_${target}`,
    type,
    identity:
      overrides.identity ??
      `${type}:${scope === "registrable_domain" ? target : target}`,
    source: overrides.source ?? "clickshield-curated",
    reasonCode: overrides.reasonCode ?? "KNOWN_SAFE_EXCEPTION",
    confidence: overrides.confidence ?? 0.95,
    firstSeenAt: overrides.firstSeenAt ?? "2026-03-20T00:00:00Z",
    lastSeenAt: overrides.lastSeenAt ?? NOW,
    targetKind: "domain",
    target,
    scope,
    justification: overrides.justification ?? "Trusted property",
  };
}

function maliciousSection(
  items: readonly MaliciousDomainFeedItem[],
  overrides: Partial<MaliciousDomainsSection> = {}
): MaliciousDomainsSection {
  const feedVersion = overrides.feedVersion ?? "2026-03-21.1";
  const staleAfter = overrides.staleAfter ?? "2026-03-22T18:00:00Z";
  const expiresAt = overrides.expiresAt ?? "2026-03-24T18:00:00Z";

  const canonical = {
    feedType: "maliciousDomains",
    feedVersion,
    itemCount: items.length,
    staleAfter,
    expiresAt,
    items,
  } as const;

  return {
    feedType: "maliciousDomains",
    feedVersion,
    itemCount: items.length,
    sha256: sha256Hex(serializeCanonicalJson(canonical)),
    staleAfter,
    expiresAt,
    items,
  };
}

function allowlistsSection(
  items: readonly DomainAllowlistFeedItem[],
  overrides: Partial<DomainAllowlistsSection> = {}
): DomainAllowlistsSection {
  const feedVersion = overrides.feedVersion ?? "2026-03-21.1";
  const staleAfter = overrides.staleAfter ?? "2026-03-22T18:00:00Z";
  const expiresAt = overrides.expiresAt ?? "2026-03-23T18:00:00Z";

  const canonical = {
    feedType: "allowlists",
    feedVersion,
    itemCount: items.length,
    staleAfter,
    expiresAt,
    items,
  } as const;

  return {
    feedType: "allowlists",
    feedVersion,
    itemCount: items.length,
    sha256: sha256Hex(serializeCanonicalJson(canonical)),
    staleAfter,
    expiresAt,
    items,
  };
}

function bundleFromSections(input: {
  maliciousDomains?: MaliciousDomainsSection;
  allowlists?: DomainAllowlistsSection;
}): DomainIntelBundle {
  const sections: DomainIntelBundle["sections"] = {};

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
    schemaVersion: "1.0.0",
    bundleVersion: "2026-03-21T18:00:00Z.test-bundle",
    generatedAt: NOW,
    publisher: "clickshield-intel",
    signingKeyId: "clickshield-ed25519-v1",
    sections,
    signature: "test-signature",
    maliciousDomains: input.maliciousDomains,
    allowlists: input.allowlists,
  };
}

describe("Layer 2 domain intel foundation", () => {
  it("validates and resolves exact malicious matches ahead of exact allowlists", () => {
    const bundle = bundleFromSections({
      maliciousDomains: maliciousSection([
        maliciousItem({
          domain: "app.bad-example.com",
          type: "exact_host",
          identity: "exact_host:app.bad-example.com",
        }),
      ]),
      allowlists: allowlistsSection([
        allowlistItem({
          target: "app.bad-example.com",
          scope: "exact_host",
          type: "domain_exact_host",
          identity: "domain_exact_host:app.bad-example.com",
        }),
      ]),
    });

    const report = validateDomainIntelBundle(bundle, VALIDATION_OPTIONS);
    expect(report.isEnvelopeValid).toBe(true);
    expect(report.issues).toEqual([]);

    const compiled = compileDomainIntelSnapshot(bundle, {
      now: NOW,
      ...VALIDATION_OPTIONS,
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compile success");
    }

    const result = resolveDomainIntel(
      compiled.snapshot,
      "https://app.bad-example.com/connect"
    );

    expect(result).toEqual({
      lookupFamily: "domain",
      matched: true,
      disposition: "malicious",
      matchType: "exact_host",
      matchedSection: "maliciousDomains",
      matchedItemId: "dom_exact_host_app.bad-example.com",
      identity: "exact_host:app.bad-example.com",
      feedVersion: "2026-03-21.1",
      allowlistFeedVersion: "2026-03-21.1",
      sectionState: "fresh",
      degradedProtection: false,
    });
  });

  it("lets an exact allowlist suppress a broader registrable malicious-domain match", () => {
    const bundle = bundleFromSections({
      maliciousDomains: maliciousSection([
        maliciousItem({
          domain: "bad-example.com",
          type: "registrable_domain",
          identity: "registrable_domain:bad-example.com",
        }),
      ]),
      allowlists: allowlistsSection([
        allowlistItem({
          target: "app.bad-example.com",
          scope: "exact_host",
          type: "domain_exact_host",
          identity: "domain_exact_host:app.bad-example.com",
        }),
      ]),
    });

    const compiled = compileDomainIntelSnapshot(bundle, {
      now: NOW,
      ...VALIDATION_OPTIONS,
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compile success");
    }

    const result = resolveDomainIntel(compiled.snapshot, "app.bad-example.com");

    expect(result.disposition).toBe("allowlisted");
    expect(result.matchedSection).toBe("allowlists");
    expect(result.identity).toBe("domain_exact_host:app.bad-example.com");
    expect(result.sectionState).toBe("fresh");
    expect(result.degradedProtection).toBe(false);
  });

  it("keeps registrable malicious matches ahead of registrable allowlist matches on the same domain", () => {
    const bundle = bundleFromSections({
      maliciousDomains: maliciousSection([
        maliciousItem({
          domain: "bad-example.com",
          type: "registrable_domain",
          identity: "registrable_domain:bad-example.com",
        }),
      ]),
      allowlists: allowlistsSection([
        allowlistItem({
          target: "bad-example.com",
          scope: "registrable_domain",
          type: "domain_registrable_domain",
          identity: "domain_registrable_domain:bad-example.com",
        }),
      ]),
    });

    const compiled = compileDomainIntelSnapshot(bundle, {
      now: NOW,
      ...VALIDATION_OPTIONS,
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compile success");
    }

    const result = resolveDomainIntel(compiled.snapshot, "foo.bad-example.com");

    expect(result.disposition).toBe("malicious");
    expect(result.matchedSection).toBe("maliciousDomains");
    expect(result.identity).toBe("registrable_domain:bad-example.com");
  });

  it("ignores stale allowlists while marking degraded protection", () => {
    const bundle = bundleFromSections({
      maliciousDomains: maliciousSection([
        maliciousItem({
          domain: "bad-example.com",
          type: "registrable_domain",
          identity: "registrable_domain:bad-example.com",
        }),
      ]),
      allowlists: allowlistsSection(
        [
          allowlistItem({
            target: "app.bad-example.com",
            scope: "exact_host",
            type: "domain_exact_host",
            identity: "domain_exact_host:app.bad-example.com",
          }),
        ],
        {
          staleAfter: "2026-03-21T17:00:00Z",
          expiresAt: "2026-03-22T17:00:00Z",
        }
      ),
    });

    const compiled = compileDomainIntelSnapshot(bundle, {
      now: NOW,
      ...VALIDATION_OPTIONS,
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compile success");
    }

    expect(compiled.snapshot.sections.allowlists.state).toBe("stale");

    const result = resolveDomainIntel(compiled.snapshot, "app.bad-example.com");

    expect(result.disposition).toBe("malicious");
    expect(result.allowlistFeedVersion).toBeUndefined();
    expect(result.degradedProtection).toBe(true);
  });

  it("returns unavailable when malicious-domain intel is expired", () => {
    const bundle = bundleFromSections({
      maliciousDomains: maliciousSection(
        [
          maliciousItem({
            domain: "app.bad-example.com",
            type: "exact_host",
            identity: "exact_host:app.bad-example.com",
          }),
        ],
        {
          staleAfter: "2026-03-20T18:00:00Z",
          expiresAt: "2026-03-21T17:00:00Z",
        }
      ),
      allowlists: allowlistsSection([]),
    });

    const compiled = compileDomainIntelSnapshot(bundle, {
      now: NOW,
      ...VALIDATION_OPTIONS,
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compile success");
    }

    const result = resolveDomainIntel(compiled.snapshot, "app.bad-example.com");

    expect(result).toEqual({
      lookupFamily: "domain",
      matched: false,
      disposition: "unavailable",
      sectionState: "expired",
      degradedProtection: true,
    });
  });

  it("marks duplicate malicious identities invalid and refuses to resolve from that section", () => {
    const invalidBundle = bundleFromSections({
      maliciousDomains: maliciousSection([
        maliciousItem({
          id: "dom_1",
          domain: "app.bad-example.com",
          type: "exact_host",
          identity: "exact_host:app.bad-example.com",
        }),
        maliciousItem({
          id: "dom_2",
          domain: "app.bad-example.com",
          type: "exact_host",
          identity: "exact_host:app.bad-example.com",
        }),
      ]),
      allowlists: allowlistsSection([]),
    });

    const report = validateDomainIntelBundle(invalidBundle, VALIDATION_OPTIONS);
    expect(report.sections.maliciousDomains.state).toBe("invalid");

    const compiled = compileDomainIntelSnapshot(invalidBundle, {
      now: NOW,
      ...VALIDATION_OPTIONS,
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compile success");
    }

    expect(compiled.snapshot.sections.maliciousDomains.state).toBe("invalid");
    expect(resolveDomainIntel(compiled.snapshot, "app.bad-example.com")).toEqual({
      lookupFamily: "domain",
      matched: false,
      disposition: "unavailable",
      sectionState: "invalid",
      degradedProtection: true,
    });
  });

  it("surfaces missing malicious-domain sections explicitly", () => {
    const bundle = bundleFromSections({
      allowlists: allowlistsSection([]),
    });

    const compiled = compileDomainIntelSnapshot(bundle, {
      now: NOW,
      ...VALIDATION_OPTIONS,
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compile success");
    }

    expect(compiled.snapshot.sections.maliciousDomains.state).toBe("missing");
    expect(resolveDomainIntel(compiled.snapshot, "safe.example.com")).toEqual({
      lookupFamily: "domain",
      matched: false,
      disposition: "unavailable",
      sectionState: "missing",
      degradedProtection: true,
    });
  });

  it("fails validation when no signature verifier is supplied", () => {
    const bundle = bundleFromSections({
      maliciousDomains: maliciousSection([]),
      allowlists: allowlistsSection([]),
    });

    const report = validateDomainIntelBundle(
      bundle,
      {} as unknown as DomainIntelValidationOptions
    );

    expect(report.isEnvelopeValid).toBe(false);
    expect(report.issues).toContainEqual({
      path: "signatureVerifier",
      message: "Signature verification function is required",
    });

    const compiled = compileDomainIntelSnapshot(bundle, {
      now: NOW,
      ...({} as unknown as DomainIntelValidationOptions),
    });
    expect(compiled.ok).toBe(false);
  });

  it("fails validation when the signature field is missing", () => {
    const bundle = {
      ...bundleFromSections({
        maliciousDomains: maliciousSection([]),
        allowlists: allowlistsSection([]),
      }),
      signature: "",
    };

    const report = validateDomainIntelBundle(bundle, VALIDATION_OPTIONS);

    expect(report.isEnvelopeValid).toBe(false);
    expect(report.issues).toContainEqual({
      path: ".signature",
      message: "Expected a non-empty string",
    });
  });

  it("fails validation when signature verification fails", () => {
    const bundle = bundleFromSections({
      maliciousDomains: maliciousSection([]),
      allowlists: allowlistsSection([]),
    });

    const report = validateDomainIntelBundle(bundle, {
      signatureVerifier: () => false,
    });

    expect(report.isEnvelopeValid).toBe(false);
    expect(report.issues).toContainEqual({
      path: "signature",
      message: "Signature verification failed",
    });

    const compiled = compileDomainIntelSnapshot(bundle, {
      now: NOW,
      signatureVerifier: () => false,
    });
    expect(compiled.ok).toBe(false);
  });

  it("derives registrable domains correctly for co.il and com.hk", () => {
    const bundle = bundleFromSections({
      maliciousDomains: maliciousSection([
        maliciousItem({
          domain: "bar.co.il",
          type: "registrable_domain",
          identity: "registrable_domain:bar.co.il",
        }),
        maliciousItem({
          domain: "example.com.hk",
          type: "registrable_domain",
          identity: "registrable_domain:example.com.hk",
        }),
      ]),
      allowlists: allowlistsSection([]),
    });

    const compiled = compileDomainIntelSnapshot(bundle, {
      now: NOW,
      ...VALIDATION_OPTIONS,
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compile success");
    }

    expect(resolveDomainIntel(compiled.snapshot, "foo.bar.co.il").identity).toBe(
      "registrable_domain:bar.co.il"
    );
    expect(
      resolveDomainIntel(compiled.snapshot, "app.example.com.hk").identity
    ).toBe("registrable_domain:example.com.hk");
  });

  it("preserves precedence after PSL-backed normalization for real suffixes", () => {
    const bundle = bundleFromSections({
      maliciousDomains: maliciousSection([
        maliciousItem({
          domain: "bar.co.il",
          type: "registrable_domain",
          identity: "registrable_domain:bar.co.il",
        }),
      ]),
      allowlists: allowlistsSection([
        allowlistItem({
          target: "wallet.bar.co.il",
          scope: "exact_host",
          type: "domain_exact_host",
          identity: "domain_exact_host:wallet.bar.co.il",
        }),
      ]),
    });

    const compiled = compileDomainIntelSnapshot(bundle, {
      now: NOW,
      ...VALIDATION_OPTIONS,
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compile success");
    }

    const result = resolveDomainIntel(compiled.snapshot, "wallet.bar.co.il");
    expect(result.disposition).toBe("allowlisted");
    expect(result.identity).toBe("domain_exact_host:wallet.bar.co.il");
  });
});
