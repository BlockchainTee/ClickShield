export type DomainIntelSectionName = "maliciousDomains" | "allowlists";

export type Layer2SectionState =
  | "fresh"
  | "stale"
  | "expired"
  | "missing"
  | "invalid";

export type DomainLookupDisposition =
  | "malicious"
  | "allowlisted"
  | "no_match"
  | "unavailable";

export interface DomainIntelSectionMetadata {
  readonly feedVersion: string;
  readonly itemCount: number;
  readonly sha256: string;
  readonly staleAfter: string;
  readonly expiresAt: string;
}

export interface MaliciousDomainFeedItem {
  readonly id: string;
  readonly type: "exact_host" | "registrable_domain";
  readonly identity: string;
  readonly source: string;
  readonly reasonCode: string;
  readonly confidence: number;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly domain: string;
  readonly scope: "exact_host" | "registrable_domain";
  readonly classification: string;
}

export interface DomainAllowlistFeedItem {
  readonly id: string;
  readonly type: "domain_exact_host" | "domain_registrable_domain";
  readonly identity: string;
  readonly source: string;
  readonly reasonCode: string;
  readonly confidence: number;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly targetKind: "domain";
  readonly target: string;
  readonly scope: "exact_host" | "registrable_domain";
  readonly justification: string;
}

export interface MaliciousDomainsSection
  extends DomainIntelSectionMetadata {
  readonly feedType: "maliciousDomains";
  readonly items: readonly MaliciousDomainFeedItem[];
}

export interface DomainAllowlistsSection
  extends DomainIntelSectionMetadata {
  readonly feedType: "allowlists";
  readonly items: readonly DomainAllowlistFeedItem[];
}

export interface DomainIntelBundle {
  readonly schemaVersion: string;
  readonly bundleVersion: string;
  readonly generatedAt: string;
  readonly publisher: string;
  readonly signingKeyId: string;
  readonly sections: Partial<
    Readonly<Record<DomainIntelSectionName, DomainIntelSectionMetadata>>
  >;
  readonly signature: string;
  readonly maliciousDomains?: MaliciousDomainsSection;
  readonly allowlists?: DomainAllowlistsSection;
}

export interface IntelValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface DomainIntelSectionValidationReport {
  readonly state: "valid" | "missing" | "invalid";
  readonly issues: readonly IntelValidationIssue[];
}

export interface DomainIntelValidationReport {
  readonly isEnvelopeValid: boolean;
  readonly issues: readonly IntelValidationIssue[];
  readonly sections: Readonly<
    Record<DomainIntelSectionName, DomainIntelSectionValidationReport>
  >;
}

export interface CompiledMaliciousDomainItem
  extends MaliciousDomainFeedItem {
  readonly domain: string;
  readonly registrableDomain: string;
}

export interface CompiledDomainAllowlistItem
  extends DomainAllowlistFeedItem {
  readonly target: string;
  readonly registrableDomain: string;
}

export interface CompiledMaliciousDomainsSection {
  readonly name: "maliciousDomains";
  readonly state: Layer2SectionState;
  readonly feedVersion?: string;
  readonly staleAfter?: string;
  readonly expiresAt?: string;
  readonly itemCount: number;
  readonly issues: readonly IntelValidationIssue[];
  readonly items: readonly CompiledMaliciousDomainItem[];
  readonly exactHostIndex: ReadonlyMap<string, CompiledMaliciousDomainItem>;
  readonly registrableDomainIndex: ReadonlyMap<string, CompiledMaliciousDomainItem>;
}

export interface CompiledDomainAllowlistsSection {
  readonly name: "allowlists";
  readonly state: Layer2SectionState;
  readonly feedVersion?: string;
  readonly staleAfter?: string;
  readonly expiresAt?: string;
  readonly itemCount: number;
  readonly issues: readonly IntelValidationIssue[];
  readonly items: readonly CompiledDomainAllowlistItem[];
  readonly exactHostIndex: ReadonlyMap<string, CompiledDomainAllowlistItem>;
  readonly registrableDomainIndex: ReadonlyMap<string, CompiledDomainAllowlistItem>;
}

export interface CompiledDomainIntelSnapshot {
  readonly schemaVersion: string;
  readonly bundleVersion: string;
  readonly generatedAt: string;
  readonly publisher: string;
  readonly signingKeyId: string;
  readonly signature: string;
  readonly sections: {
    readonly maliciousDomains: CompiledMaliciousDomainsSection;
    readonly allowlists: CompiledDomainAllowlistsSection;
  };
}

export interface DomainIntelCompileSuccess {
  readonly ok: true;
  readonly snapshot: CompiledDomainIntelSnapshot;
  readonly issues: readonly IntelValidationIssue[];
}

export interface DomainIntelCompileFailure {
  readonly ok: false;
  readonly issues: readonly IntelValidationIssue[];
}

export type DomainIntelCompileResult =
  | DomainIntelCompileSuccess
  | DomainIntelCompileFailure;

export interface DomainLookupResult {
  readonly lookupFamily: "domain";
  readonly matched: boolean;
  readonly disposition: DomainLookupDisposition;
  readonly matchType?:
    | MaliciousDomainFeedItem["type"]
    | DomainAllowlistFeedItem["type"];
  readonly matchedSection?: DomainIntelSectionName;
  readonly matchedItemId?: string;
  readonly identity?: string;
  readonly feedVersion?: string;
  readonly allowlistFeedVersion?: string;
  readonly sectionState: Layer2SectionState;
  readonly degradedProtection: boolean;
}

export interface DomainIntelSignatureEnvelope {
  readonly schemaVersion: string;
  readonly bundleVersion: string;
  readonly generatedAt: string;
  readonly publisher: string;
  readonly signingKeyId: string;
  readonly sections: Partial<
    Readonly<Record<DomainIntelSectionName, DomainIntelSectionMetadata>>
  >;
  readonly signature: string;
}

export interface DomainIntelValidationOptions {
  readonly signatureVerifier: (
    envelope: DomainIntelSignatureEnvelope
  ) => boolean;
}

export interface CompileDomainIntelSnapshotOptions
  extends DomainIntelValidationOptions {
  readonly now?: Date | number | string;
}
