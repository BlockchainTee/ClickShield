import { serializeCanonicalJson, sha256Hex } from "./hash.js";
import {
  buildDomainAllowlistIdentity,
  buildMaliciousDomainIdentity,
  normalizeIntelDomain,
  toRegistrableIntelDomain,
} from "./normalize.js";
import type {
  CompiledDomainAllowlistItem,
  CompiledMaliciousDomainItem,
  DomainAllowlistsSection,
  DomainIntelBundle,
  DomainIntelSectionMetadata,
  DomainIntelSectionName,
  DomainIntelSectionValidationReport,
  DomainIntelValidationOptions,
  DomainIntelValidationReport,
  IntelValidationIssue,
  MaliciousDomainsSection,
} from "./types.js";

interface ParsedEnvelope {
  readonly metadata: {
    readonly schemaVersion: string;
    readonly bundleVersion: string;
    readonly generatedAt: string;
    readonly publisher: string;
    readonly signingKeyId: string;
    readonly sections: Partial<
      Readonly<Record<DomainIntelSectionName, DomainIntelSectionMetadata>>
    >;
    readonly signature: string;
  };
  readonly issues: readonly IntelValidationIssue[];
  readonly rawBundle: DomainIntelBundle;
}

interface ParsedSectionResult<TItem> {
  readonly state: "valid" | "missing" | "invalid";
  readonly metadata?: DomainIntelSectionMetadata;
  readonly items: readonly TItem[];
  readonly issues: readonly IntelValidationIssue[];
}

export interface ParsedDomainIntelBundle {
  readonly envelope: ParsedEnvelope;
  readonly maliciousDomains: ParsedSectionResult<CompiledMaliciousDomainItem>;
  readonly allowlists: ParsedSectionResult<CompiledDomainAllowlistItem>;
}

const ENVELOPE_KEYS = [
  "schemaVersion",
  "bundleVersion",
  "generatedAt",
  "publisher",
  "signingKeyId",
  "sections",
  "signature",
  "maliciousDomains",
  "allowlists",
] as const;

const SECTION_METADATA_KEYS = [
  "feedVersion",
  "itemCount",
  "sha256",
  "staleAfter",
  "expiresAt",
] as const;

const MALICIOUS_SECTION_KEYS = [
  "feedType",
  "feedVersion",
  "itemCount",
  "sha256",
  "staleAfter",
  "expiresAt",
  "items",
] as const;

const ALLOWLIST_SECTION_KEYS = MALICIOUS_SECTION_KEYS;

const MALICIOUS_ITEM_KEYS = [
  "id",
  "type",
  "identity",
  "source",
  "reasonCode",
  "confidence",
  "firstSeenAt",
  "lastSeenAt",
  "domain",
  "scope",
  "classification",
] as const;

const ALLOWLIST_ITEM_KEYS = [
  "id",
  "type",
  "identity",
  "source",
  "reasonCode",
  "confidence",
  "firstSeenAt",
  "lastSeenAt",
  "targetKind",
  "target",
  "scope",
  "justification",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pushIssue(
  issues: IntelValidationIssue[],
  path: string,
  message: string
): void {
  issues.push({ path, message });
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
  issues: IntelValidationIssue[]
): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      pushIssue(issues, `${path}.${key}`, "Unknown field");
    }
  }
}

function readRequiredString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: IntelValidationIssue[]
): string | null {
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate.trim() === "") {
    pushIssue(issues, `${path}.${key}`, "Expected a non-empty string");
    return null;
  }

  return candidate;
}

function readRequiredNumber(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: IntelValidationIssue[]
): number | null {
  const candidate = value[key];
  if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
    pushIssue(issues, `${path}.${key}`, "Expected a finite number");
    return null;
  }

  return candidate;
}

function isValidUtcTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

function readRequiredTimestamp(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: IntelValidationIssue[]
): string | null {
  const candidate = readRequiredString(value, key, path, issues);
  if (candidate === null) {
    return null;
  }

  if (!isValidUtcTimestamp(candidate)) {
    pushIssue(issues, `${path}.${key}`, "Expected an ISO-8601 UTC timestamp");
    return null;
  }

  return candidate;
}

function readMetadata(
  value: unknown,
  path: string,
  issues: IntelValidationIssue[]
): DomainIntelSectionMetadata | null {
  if (!isRecord(value)) {
    pushIssue(issues, path, "Expected section metadata object");
    return null;
  }

  assertExactKeys(value, SECTION_METADATA_KEYS, path, issues);

  const feedVersion = readRequiredString(value, "feedVersion", path, issues);
  const itemCount = readRequiredNumber(value, "itemCount", path, issues);
  const sha256 = readRequiredString(value, "sha256", path, issues);
  const staleAfter = readRequiredTimestamp(value, "staleAfter", path, issues);
  const expiresAt = readRequiredTimestamp(value, "expiresAt", path, issues);

  if (
    feedVersion === null ||
    itemCount === null ||
    sha256 === null ||
    staleAfter === null ||
    expiresAt === null
  ) {
    return null;
  }

  if (!Number.isInteger(itemCount) || itemCount < 0) {
    pushIssue(issues, `${path}.itemCount`, "Expected a non-negative integer");
  }

  if (Date.parse(staleAfter) >= Date.parse(expiresAt)) {
    pushIssue(issues, path, "Expected staleAfter to be earlier than expiresAt");
  }

  return {
    feedVersion,
    itemCount,
    sha256,
    staleAfter,
    expiresAt,
  };
}

function parseSchemaVersion(
  value: string,
  issues: IntelValidationIssue[]
): void {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) {
    pushIssue(issues, "schemaVersion", "Expected semantic version format");
    return;
  }

  if (match[1] !== "1") {
    pushIssue(issues, "schemaVersion", "Unsupported schema major version");
  }
}

function parseEnvelope(
  bundle: unknown,
  options: DomainIntelValidationOptions
): ParsedEnvelope {
  const issues: IntelValidationIssue[] = [];

  if (!isRecord(bundle)) {
    pushIssue(issues, "", "Expected bundle object");
    return {
      metadata: {
        schemaVersion: "",
        bundleVersion: "",
        generatedAt: "",
        publisher: "",
        signingKeyId: "",
        sections: {},
        signature: "",
      },
      issues,
      rawBundle: {
        schemaVersion: "",
        bundleVersion: "",
        generatedAt: "",
        publisher: "",
        signingKeyId: "",
        sections: {},
        signature: "",
      },
    };
  }

  assertExactKeys(bundle, ENVELOPE_KEYS, "", issues);

  const schemaVersion = readRequiredString(bundle, "schemaVersion", "", issues);
  const bundleVersion = readRequiredString(bundle, "bundleVersion", "", issues);
  const generatedAt = readRequiredTimestamp(bundle, "generatedAt", "", issues);
  const publisher = readRequiredString(bundle, "publisher", "", issues);
  const signingKeyId = readRequiredString(bundle, "signingKeyId", "", issues);
  const signature = readRequiredString(bundle, "signature", "", issues);

  if (typeof options.signatureVerifier !== "function") {
    pushIssue(
      issues,
      "signatureVerifier",
      "Signature verification function is required"
    );
  }

  if (schemaVersion !== null) {
    parseSchemaVersion(schemaVersion, issues);
  }

  const rawSections = bundle.sections;
  const sections: Partial<Record<DomainIntelSectionName, DomainIntelSectionMetadata>> =
    {};

  if (!isRecord(rawSections)) {
    pushIssue(issues, "sections", "Expected sections metadata object");
  } else {
    const allowedSections: readonly DomainIntelSectionName[] = [
      "maliciousDomains",
      "allowlists",
    ];

    assertExactKeys(rawSections, allowedSections, "sections", issues);

    for (const sectionName of allowedSections) {
      const metadata = rawSections[sectionName];
      if (metadata === undefined) {
        continue;
      }

      const parsedMetadata = readMetadata(
        metadata,
        `sections.${sectionName}`,
        issues
      );

      if (parsedMetadata) {
        sections[sectionName] = parsedMetadata;
      }
    }
  }

  if (
    signature !== null &&
    schemaVersion !== null &&
    bundleVersion !== null &&
    generatedAt !== null &&
    publisher !== null &&
    signingKeyId !== null &&
    typeof options.signatureVerifier === "function" &&
    !options.signatureVerifier({
      schemaVersion,
      bundleVersion,
      generatedAt,
      publisher,
      signingKeyId,
      sections,
      signature,
    })
  ) {
    pushIssue(issues, "signature", "Signature verification failed");
  }

  return {
    metadata: {
      schemaVersion: schemaVersion ?? "",
      bundleVersion: bundleVersion ?? "",
      generatedAt: generatedAt ?? "",
      publisher: publisher ?? "",
      signingKeyId: signingKeyId ?? "",
      sections,
      signature: signature ?? "",
    },
    issues,
    rawBundle: bundle as unknown as DomainIntelBundle,
  };
}

function readItemsArray(
  value: Record<string, unknown>,
  path: string,
  issues: IntelValidationIssue[]
): readonly unknown[] | null {
  const items = value.items;
  if (!Array.isArray(items)) {
    pushIssue(issues, `${path}.items`, "Expected items array");
    return null;
  }

  return items;
}

function canonicalMaliciousSection(
  section: Omit<MaliciousDomainsSection, "sha256"> & {
    readonly items: readonly CompiledMaliciousDomainItem[];
  }
): string {
  return serializeCanonicalJson({
    feedType: section.feedType,
    feedVersion: section.feedVersion,
    itemCount: section.itemCount,
    staleAfter: section.staleAfter,
    expiresAt: section.expiresAt,
    items: section.items.map((item) => ({
      id: item.id,
      type: item.type,
      identity: item.identity,
      source: item.source,
      reasonCode: item.reasonCode,
      confidence: item.confidence,
      firstSeenAt: item.firstSeenAt,
      lastSeenAt: item.lastSeenAt,
      domain: item.domain,
      scope: item.scope,
      classification: item.classification,
    })),
  });
}

function canonicalAllowlistSection(
  section: Omit<DomainAllowlistsSection, "sha256"> & {
    readonly items: readonly CompiledDomainAllowlistItem[];
  }
): string {
  return serializeCanonicalJson({
    feedType: section.feedType,
    feedVersion: section.feedVersion,
    itemCount: section.itemCount,
    staleAfter: section.staleAfter,
    expiresAt: section.expiresAt,
    items: section.items.map((item) => ({
      id: item.id,
      type: item.type,
      identity: item.identity,
      source: item.source,
      reasonCode: item.reasonCode,
      confidence: item.confidence,
      firstSeenAt: item.firstSeenAt,
      lastSeenAt: item.lastSeenAt,
      targetKind: item.targetKind,
      target: item.target,
      scope: item.scope,
      justification: item.justification,
    })),
  });
}

function validateSectionHeader(
  section: Record<string, unknown>,
  metadata: DomainIntelSectionMetadata,
  path: string,
  issues: IntelValidationIssue[]
): {
  readonly feedVersion: string;
  readonly itemCount: number;
  readonly staleAfter: string;
  readonly expiresAt: string;
  readonly sha256: string;
} | null {
  const feedVersion = readRequiredString(section, "feedVersion", path, issues);
  const itemCount = readRequiredNumber(section, "itemCount", path, issues);
  const sha256 = readRequiredString(section, "sha256", path, issues);
  const staleAfter = readRequiredTimestamp(section, "staleAfter", path, issues);
  const expiresAt = readRequiredTimestamp(section, "expiresAt", path, issues);

  if (
    feedVersion === null ||
    itemCount === null ||
    sha256 === null ||
    staleAfter === null ||
    expiresAt === null
  ) {
    return null;
  }

  if (feedVersion !== metadata.feedVersion) {
    pushIssue(issues, `${path}.feedVersion`, "Section feedVersion does not match bundle metadata");
  }

  if (itemCount !== metadata.itemCount) {
    pushIssue(issues, `${path}.itemCount`, "Section itemCount does not match bundle metadata");
  }

  if (sha256 !== metadata.sha256) {
    pushIssue(issues, `${path}.sha256`, "Section sha256 does not match bundle metadata");
  }

  if (staleAfter !== metadata.staleAfter) {
    pushIssue(issues, `${path}.staleAfter`, "Section staleAfter does not match bundle metadata");
  }

  if (expiresAt !== metadata.expiresAt) {
    pushIssue(issues, `${path}.expiresAt`, "Section expiresAt does not match bundle metadata");
  }

  return {
    feedVersion,
    itemCount,
    sha256,
    staleAfter,
    expiresAt,
  };
}

function parseMaliciousItems(
  rawItems: readonly unknown[],
  path: string,
  issues: IntelValidationIssue[]
): readonly CompiledMaliciousDomainItem[] | null {
  const normalizedItems: CompiledMaliciousDomainItem[] = [];
  const seenIds = new Set<string>();
  const seenIdentities = new Set<string>();

  rawItems.forEach((rawItem, index) => {
    const itemPath = `${path}.items[${index}]`;
    if (!isRecord(rawItem)) {
      pushIssue(issues, itemPath, "Expected malicious-domain item object");
      return;
    }

    assertExactKeys(rawItem, MALICIOUS_ITEM_KEYS, itemPath, issues);

    const id = readRequiredString(rawItem, "id", itemPath, issues);
    const type = readRequiredString(rawItem, "type", itemPath, issues);
    const identity = readRequiredString(rawItem, "identity", itemPath, issues);
    const source = readRequiredString(rawItem, "source", itemPath, issues);
    const reasonCode = readRequiredString(rawItem, "reasonCode", itemPath, issues);
    const confidence = readRequiredNumber(rawItem, "confidence", itemPath, issues);
    const firstSeenAt = readRequiredTimestamp(rawItem, "firstSeenAt", itemPath, issues);
    const lastSeenAt = readRequiredTimestamp(rawItem, "lastSeenAt", itemPath, issues);
    const domain = readRequiredString(rawItem, "domain", itemPath, issues);
    const scope = readRequiredString(rawItem, "scope", itemPath, issues);
    const classification = readRequiredString(rawItem, "classification", itemPath, issues);

    if (
      id === null ||
      type === null ||
      identity === null ||
      source === null ||
      reasonCode === null ||
      confidence === null ||
      firstSeenAt === null ||
      lastSeenAt === null ||
      domain === null ||
      scope === null ||
      classification === null
    ) {
      return;
    }

    if (confidence < 0 || confidence > 1) {
      pushIssue(issues, `${itemPath}.confidence`, "Expected confidence within [0, 1]");
    }

    if (Date.parse(firstSeenAt) > Date.parse(lastSeenAt)) {
      pushIssue(issues, itemPath, "Expected firstSeenAt to be earlier than or equal to lastSeenAt");
    }

    if (type !== "exact_host" && type !== "registrable_domain") {
      pushIssue(issues, `${itemPath}.type`, "Unsupported malicious-domain item type");
      return;
    }

    if (scope !== type) {
      pushIssue(issues, `${itemPath}.scope`, "Scope must match malicious-domain type");
      return;
    }

    const normalizedDomain = normalizeIntelDomain(domain);
    if (!normalizedDomain) {
      pushIssue(issues, `${itemPath}.domain`, "Expected a valid normalized hostname");
      return;
    }

    const registrableDomain = toRegistrableIntelDomain(normalizedDomain);
    if (!registrableDomain) {
      pushIssue(issues, `${itemPath}.domain`, "Could not derive registrable domain");
      return;
    }

    const canonicalDomain =
      type === "registrable_domain" ? registrableDomain : normalizedDomain;
    const canonicalIdentity = buildMaliciousDomainIdentity(type, canonicalDomain);

    if (type === "registrable_domain" && normalizedDomain !== registrableDomain) {
      pushIssue(
        issues,
        `${itemPath}.domain`,
        "Registrable-domain indicators must store the registrable domain"
      );
    }

    if (identity !== canonicalIdentity) {
      pushIssue(issues, `${itemPath}.identity`, "Identity does not match canonical malicious-domain identity");
    }

    if (seenIds.has(id)) {
      pushIssue(issues, `${itemPath}.id`, "Duplicate item id");
    }

    if (seenIdentities.has(canonicalIdentity)) {
      pushIssue(issues, `${itemPath}.identity`, "Duplicate malicious-domain identity");
    }

    seenIds.add(id);
    seenIdentities.add(canonicalIdentity);

    normalizedItems.push({
      id,
      type,
      identity: canonicalIdentity,
      source,
      reasonCode,
      confidence,
      firstSeenAt,
      lastSeenAt,
      domain: canonicalDomain,
      scope: type,
      classification,
      registrableDomain,
    });
  });

  return issues.some((issue) => issue.path.startsWith(path))
    ? null
    : normalizedItems;
}

function parseAllowlistItems(
  rawItems: readonly unknown[],
  path: string,
  issues: IntelValidationIssue[]
): readonly CompiledDomainAllowlistItem[] | null {
  const normalizedItems: CompiledDomainAllowlistItem[] = [];
  const seenIds = new Set<string>();
  const seenIdentities = new Set<string>();

  rawItems.forEach((rawItem, index) => {
    const itemPath = `${path}.items[${index}]`;
    if (!isRecord(rawItem)) {
      pushIssue(issues, itemPath, "Expected allowlist item object");
      return;
    }

    assertExactKeys(rawItem, ALLOWLIST_ITEM_KEYS, itemPath, issues);

    const id = readRequiredString(rawItem, "id", itemPath, issues);
    const type = readRequiredString(rawItem, "type", itemPath, issues);
    const identity = readRequiredString(rawItem, "identity", itemPath, issues);
    const source = readRequiredString(rawItem, "source", itemPath, issues);
    const reasonCode = readRequiredString(rawItem, "reasonCode", itemPath, issues);
    const confidence = readRequiredNumber(rawItem, "confidence", itemPath, issues);
    const firstSeenAt = readRequiredTimestamp(rawItem, "firstSeenAt", itemPath, issues);
    const lastSeenAt = readRequiredTimestamp(rawItem, "lastSeenAt", itemPath, issues);
    const targetKind = readRequiredString(rawItem, "targetKind", itemPath, issues);
    const target = readRequiredString(rawItem, "target", itemPath, issues);
    const scope = readRequiredString(rawItem, "scope", itemPath, issues);
    const justification = readRequiredString(rawItem, "justification", itemPath, issues);

    if (
      id === null ||
      type === null ||
      identity === null ||
      source === null ||
      reasonCode === null ||
      confidence === null ||
      firstSeenAt === null ||
      lastSeenAt === null ||
      targetKind === null ||
      target === null ||
      scope === null ||
      justification === null
    ) {
      return;
    }

    if (confidence < 0 || confidence > 1) {
      pushIssue(issues, `${itemPath}.confidence`, "Expected confidence within [0, 1]");
    }

    if (Date.parse(firstSeenAt) > Date.parse(lastSeenAt)) {
      pushIssue(issues, itemPath, "Expected firstSeenAt to be earlier than or equal to lastSeenAt");
    }

    if (targetKind !== "domain") {
      pushIssue(issues, `${itemPath}.targetKind`, "Phase A allowlists only support domain targets");
      return;
    }

    const normalizedTarget = normalizeIntelDomain(target);
    if (!normalizedTarget) {
      pushIssue(issues, `${itemPath}.target`, "Expected a valid normalized hostname");
      return;
    }

    const registrableDomain = toRegistrableIntelDomain(normalizedTarget);
    if (!registrableDomain) {
      pushIssue(issues, `${itemPath}.target`, "Could not derive registrable domain");
      return;
    }

    let canonicalScope: "exact_host" | "registrable_domain";
    if (type === "domain_exact_host" && scope === "exact_host") {
      canonicalScope = "exact_host";
    } else if (
      type === "domain_registrable_domain" &&
      scope === "registrable_domain"
    ) {
      canonicalScope = "registrable_domain";
    } else {
      pushIssue(issues, `${itemPath}.type`, "Allowlist type and scope must align");
      return;
    }

    const canonicalTarget =
      canonicalScope === "registrable_domain"
        ? registrableDomain
        : normalizedTarget;

    if (
      canonicalScope === "registrable_domain" &&
      normalizedTarget !== registrableDomain
    ) {
      pushIssue(
        issues,
        `${itemPath}.target`,
        "Registrable-domain allowlists must store the registrable domain"
      );
    }

    const canonicalIdentity = buildDomainAllowlistIdentity(
      canonicalScope,
      canonicalTarget
    );

    if (identity !== canonicalIdentity) {
      pushIssue(issues, `${itemPath}.identity`, "Identity does not match canonical allowlist identity");
    }

    if (seenIds.has(id)) {
      pushIssue(issues, `${itemPath}.id`, "Duplicate item id");
    }

    if (seenIdentities.has(canonicalIdentity)) {
      pushIssue(issues, `${itemPath}.identity`, "Duplicate allowlist identity");
    }

    seenIds.add(id);
    seenIdentities.add(canonicalIdentity);

    normalizedItems.push({
      id,
      type,
      identity: canonicalIdentity,
      source,
      reasonCode,
      confidence,
      firstSeenAt,
      lastSeenAt,
      targetKind: "domain",
      target: canonicalTarget,
      scope: canonicalScope,
      justification,
      registrableDomain,
    });
  });

  return issues.some((issue) => issue.path.startsWith(path))
    ? null
    : normalizedItems;
}

function parseMaliciousDomainsSection(
  bundle: DomainIntelBundle,
  metadata: DomainIntelSectionMetadata | undefined
): ParsedSectionResult<CompiledMaliciousDomainItem> {
  const path = "maliciousDomains";
  const issues: IntelValidationIssue[] = [];
  const section = bundle.maliciousDomains;
  const sectionMetadata = metadata;

  if (!sectionMetadata && !section) {
    return { state: "missing", items: [], issues };
  }

  if (!sectionMetadata && section) {
    pushIssue(issues, path, "Section payload exists without bundle metadata");
    return { state: "invalid", items: [], issues };
  }

  if (sectionMetadata && !section) {
    return {
      state: "missing",
      metadata: sectionMetadata,
      items: [],
      issues: [{ path, message: "Section metadata exists but payload is missing" }],
    };
  }

  if (!isRecord(section)) {
    pushIssue(issues, path, "Expected maliciousDomains section object");
    return { state: "invalid", metadata: sectionMetadata, items: [], issues };
  }

  if (!sectionMetadata) {
    pushIssue(issues, path, "Missing section metadata");
    return { state: "invalid", items: [], issues };
  }

  assertExactKeys(section, MALICIOUS_SECTION_KEYS, path, issues);

  const feedType = readRequiredString(section, "feedType", path, issues);
  if (feedType !== "maliciousDomains") {
    pushIssue(issues, `${path}.feedType`, "Expected feedType to equal maliciousDomains");
  }

  const header = validateSectionHeader(section, sectionMetadata, path, issues);
  const items = readItemsArray(section, path, issues);
  if (!header || !items) {
    return { state: "invalid", metadata: sectionMetadata, items: [], issues };
  }

  const parsedItems = parseMaliciousItems(items, path, issues);
  if (!parsedItems) {
    return { state: "invalid", metadata: sectionMetadata, items: [], issues };
  }

  if (header.itemCount !== parsedItems.length) {
    pushIssue(issues, `${path}.itemCount`, "itemCount does not match actual item count");
  }

  const canonicalSha = sha256Hex(
    canonicalMaliciousSection({
      feedType: "maliciousDomains",
      feedVersion: header.feedVersion,
      itemCount: parsedItems.length,
      staleAfter: header.staleAfter,
      expiresAt: header.expiresAt,
      items: parsedItems,
    })
  );

  if (header.sha256 !== canonicalSha) {
    pushIssue(issues, `${path}.sha256`, "sha256 does not match canonical serialized content");
  }

  return issues.length > 0
    ? { state: "invalid", metadata: sectionMetadata, items: [], issues }
    : { state: "valid", metadata: sectionMetadata, items: parsedItems, issues };
}

function parseAllowlistsSection(
  bundle: DomainIntelBundle,
  metadata: DomainIntelSectionMetadata | undefined
): ParsedSectionResult<CompiledDomainAllowlistItem> {
  const path = "allowlists";
  const issues: IntelValidationIssue[] = [];
  const section = bundle.allowlists;
  const sectionMetadata = metadata;

  if (!sectionMetadata && !section) {
    return { state: "missing", items: [], issues };
  }

  if (!sectionMetadata && section) {
    pushIssue(issues, path, "Section payload exists without bundle metadata");
    return { state: "invalid", items: [], issues };
  }

  if (sectionMetadata && !section) {
    return {
      state: "missing",
      metadata: sectionMetadata,
      items: [],
      issues: [{ path, message: "Section metadata exists but payload is missing" }],
    };
  }

  if (!isRecord(section)) {
    pushIssue(issues, path, "Expected allowlists section object");
    return { state: "invalid", metadata: sectionMetadata, items: [], issues };
  }

  if (!sectionMetadata) {
    pushIssue(issues, path, "Missing section metadata");
    return { state: "invalid", items: [], issues };
  }

  assertExactKeys(section, ALLOWLIST_SECTION_KEYS, path, issues);

  const feedType = readRequiredString(section, "feedType", path, issues);
  if (feedType !== "allowlists") {
    pushIssue(issues, `${path}.feedType`, "Expected feedType to equal allowlists");
  }

  const header = validateSectionHeader(section, sectionMetadata, path, issues);
  const items = readItemsArray(section, path, issues);
  if (!header || !items) {
    return { state: "invalid", metadata: sectionMetadata, items: [], issues };
  }

  const parsedItems = parseAllowlistItems(items, path, issues);
  if (!parsedItems) {
    return { state: "invalid", metadata: sectionMetadata, items: [], issues };
  }

  if (header.itemCount !== parsedItems.length) {
    pushIssue(issues, `${path}.itemCount`, "itemCount does not match actual item count");
  }

  const canonicalSha = sha256Hex(
    canonicalAllowlistSection({
      feedType: "allowlists",
      feedVersion: header.feedVersion,
      itemCount: parsedItems.length,
      staleAfter: header.staleAfter,
      expiresAt: header.expiresAt,
      items: parsedItems,
    })
  );

  if (header.sha256 !== canonicalSha) {
    pushIssue(issues, `${path}.sha256`, "sha256 does not match canonical serialized content");
  }

  return issues.length > 0
    ? { state: "invalid", metadata: sectionMetadata, items: [], issues }
    : { state: "valid", metadata: sectionMetadata, items: parsedItems, issues };
}

export function parseDomainIntelBundle(
  bundle: unknown,
  options: DomainIntelValidationOptions
): ParsedDomainIntelBundle {
  const envelope = parseEnvelope(bundle, options);
  const rawBundle = envelope.rawBundle;
  const metadata = envelope.metadata.sections;

  return {
    envelope,
    maliciousDomains: parseMaliciousDomainsSection(
      rawBundle,
      metadata.maliciousDomains
    ),
    allowlists: parseAllowlistsSection(rawBundle, metadata.allowlists),
  };
}

function toSectionReport(
  section: ParsedSectionResult<unknown>
): DomainIntelSectionValidationReport {
  return {
    state: section.state,
    issues: section.issues,
  };
}

export function validateDomainIntelBundle(
  bundle: unknown,
  options: DomainIntelValidationOptions
): DomainIntelValidationReport {
  const parsed = parseDomainIntelBundle(bundle, options);
  const issues = [
    ...parsed.envelope.issues,
    ...parsed.maliciousDomains.issues,
    ...parsed.allowlists.issues,
  ];

  return {
    isEnvelopeValid: parsed.envelope.issues.length === 0,
    issues,
    sections: {
      maliciousDomains: toSectionReport(parsed.maliciousDomains),
      allowlists: toSectionReport(parsed.allowlists),
    },
  };
}
