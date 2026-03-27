import { parseDomainIntelBundle } from "./validate.js";
import type {
  CompileDomainIntelSnapshotOptions,
  CompiledDomainAllowlistsSection,
  CompiledDomainIntelSnapshot,
  CompiledMaliciousDomainsSection,
  DomainIntelCompileResult,
  DomainIntelSectionMetadata,
  Layer2SectionState,
} from "./types.js";

function resolveNow(input: Date | number | string | undefined): number {
  if (input instanceof Date) {
    return input.getTime();
  }

  if (typeof input === "number") {
    return input;
  }

  if (typeof input === "string") {
    return Date.parse(input);
  }

  return Date.now();
}

function deriveFreshnessState(
  metadata: DomainIntelSectionMetadata
): (nowMs: number) => Layer2SectionState {
  const staleAfterMs = Date.parse(metadata.staleAfter);
  const expiresAtMs = Date.parse(metadata.expiresAt);

  return (nowMs: number) => {
    if (nowMs >= expiresAtMs) {
      return "expired";
    }

    if (nowMs >= staleAfterMs) {
      return "stale";
    }

    return "fresh";
  };
}

function deriveSectionState(
  metadata: DomainIntelSectionMetadata,
  itemCount: number,
  nowMs: number
): Layer2SectionState {
  if (itemCount === 0) {
    return "empty";
  }

  return deriveFreshnessState(metadata)(nowMs);
}

function buildMaliciousDomainsSection(
  parsed: ReturnType<typeof parseDomainIntelBundle>["maliciousDomains"],
  nowMs: number
): CompiledMaliciousDomainsSection {
  if (parsed.state === "missing") {
    return {
      name: "maliciousDomains",
      state: "missing",
      itemCount: 0,
      issues: parsed.issues,
      items: [],
      exactHostIndex: new Map(),
      registrableDomainIndex: new Map(),
    };
  }

  if (parsed.state === "invalid" || !parsed.metadata) {
    return {
      name: "maliciousDomains",
      state: "invalid",
      itemCount: 0,
      issues: parsed.issues,
      items: [],
      exactHostIndex: new Map(),
      registrableDomainIndex: new Map(),
      feedVersion: parsed.metadata?.feedVersion,
      staleAfter: parsed.metadata?.staleAfter,
      expiresAt: parsed.metadata?.expiresAt,
    };
  }

  const exactHostIndex = new Map();
  const registrableDomainIndex = new Map();

  for (const item of parsed.items) {
    if (item.type === "exact_host") {
      exactHostIndex.set(item.domain, item);
    } else {
      registrableDomainIndex.set(item.domain, item);
    }
  }

  return {
    name: "maliciousDomains",
    state: deriveSectionState(parsed.metadata, parsed.items.length, nowMs),
    feedVersion: parsed.metadata.feedVersion,
    staleAfter: parsed.metadata.staleAfter,
    expiresAt: parsed.metadata.expiresAt,
    itemCount: parsed.items.length,
    issues: parsed.issues,
    items: parsed.items,
    exactHostIndex,
    registrableDomainIndex,
  };
}

function buildAllowlistsSection(
  parsed: ReturnType<typeof parseDomainIntelBundle>["allowlists"],
  nowMs: number
): CompiledDomainAllowlistsSection {
  if (parsed.state === "missing") {
    return {
      name: "allowlists",
      state: "missing",
      itemCount: 0,
      issues: parsed.issues,
      items: [],
      exactHostIndex: new Map(),
      registrableDomainIndex: new Map(),
    };
  }

  if (parsed.state === "invalid" || !parsed.metadata) {
    return {
      name: "allowlists",
      state: "invalid",
      itemCount: 0,
      issues: parsed.issues,
      items: [],
      exactHostIndex: new Map(),
      registrableDomainIndex: new Map(),
      feedVersion: parsed.metadata?.feedVersion,
      staleAfter: parsed.metadata?.staleAfter,
      expiresAt: parsed.metadata?.expiresAt,
    };
  }

  const exactHostIndex = new Map();
  const registrableDomainIndex = new Map();

  for (const item of parsed.items) {
    if (item.scope === "exact_host") {
      exactHostIndex.set(item.target, item);
    } else {
      registrableDomainIndex.set(item.target, item);
    }
  }

  return {
    name: "allowlists",
    state: deriveSectionState(parsed.metadata, parsed.items.length, nowMs),
    feedVersion: parsed.metadata.feedVersion,
    staleAfter: parsed.metadata.staleAfter,
    expiresAt: parsed.metadata.expiresAt,
    itemCount: parsed.items.length,
    issues: parsed.issues,
    items: parsed.items,
    exactHostIndex,
    registrableDomainIndex,
  };
}

export function compileDomainIntelSnapshot(
  bundle: unknown,
  options: CompileDomainIntelSnapshotOptions
): DomainIntelCompileResult {
  const parsed = parseDomainIntelBundle(bundle, options);
  const issues = [
    ...parsed.envelope.issues,
    ...parsed.maliciousDomains.issues,
    ...parsed.allowlists.issues,
  ];

  if (parsed.envelope.issues.length > 0) {
    return {
      ok: false,
      issues,
    };
  }

  const nowMs = resolveNow(options.now);
  const snapshot: CompiledDomainIntelSnapshot = {
    schemaVersion: parsed.envelope.metadata.schemaVersion,
    bundleVersion: parsed.envelope.metadata.bundleVersion,
    generatedAt: parsed.envelope.metadata.generatedAt,
    publisher: parsed.envelope.metadata.publisher,
    signingKeyId: parsed.envelope.metadata.signingKeyId,
    signature: parsed.envelope.metadata.signature,
    sections: {
      maliciousDomains: buildMaliciousDomainsSection(
        parsed.maliciousDomains,
        nowMs
      ),
      allowlists: buildAllowlistsSection(parsed.allowlists, nowMs),
    },
  };

  return {
    ok: true,
    snapshot,
    issues,
  };
}
