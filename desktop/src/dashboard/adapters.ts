import type {
  ThreatDecision,
  ThreatFailSafeState,
  ThreatLayer,
  ThreatLogEntry,
  ThreatProviderState,
  ThreatSeverity,
  ThreatSurface,
  ThreatSystemStatus,
  ThreatTruthState,
} from "./types";
import { parseThreatTimestamp } from "./selectors";

export interface ThreatDashboardScanSource {
  readonly id: string;
  readonly url: string;
  readonly riskLevel: string;
  readonly riskScore: number;
  readonly threatType: string;
  readonly checkedAt: string;
  readonly source: string;
  readonly engine: string;
  readonly userEmail: string;
  readonly userType: string;
  readonly orgName: string | null;
  readonly deviceId: string | null;
  readonly ruleReason?: string | null;
  readonly shortAdvice?: string | null;
  readonly detectedBy?: string | null;
  readonly detectedByType?: string | null;
  readonly ruleName?: string | null;
  readonly filename?: string | null;
  readonly mimeType?: string | null;
  readonly layer?: string | null;
  readonly decision?: string | null;
  readonly severity?: string | null;
  readonly surface?: string | null;
}

export interface NavigationManifestSnapshot {
  readonly bundleVersion: string | null;
  readonly generatedAt: string | null;
  readonly maliciousFeedVersion: string | null;
  readonly allowlistFeedVersion: string | null;
  readonly maliciousStaleAfter: string | null;
  readonly maliciousExpiresAt: string | null;
  readonly allowlistStaleAfter: string | null;
  readonly allowlistExpiresAt: string | null;
  readonly availableSectionCount: number;
}

export interface EngineStatusSnapshot {
  readonly mode: "RULE_ONLY" | "RULE_PLUS_AI" | null;
  readonly engineState: "ACTIVE" | "DEGRADED" | null;
  readonly ruleEngine: "AVAILABLE" | "UNAVAILABLE" | null;
  readonly aiEngine: "AVAILABLE" | "UNAVAILABLE" | null;
  readonly database: "AVAILABLE" | "UNAVAILABLE" | null;
  readonly checkedAt: string | null;
}

export interface BackendHealthSnapshot {
  readonly status: "ok" | "error" | "unknown";
  readonly dbAvailable: boolean | null;
  readonly checkedAt: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function normalizeThreatToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatThreatTypeLabel(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return "Unknown activity";
  }

  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function readThreatLayer(value: string | null | undefined): ThreatLayer {
  return value === "layer1" || value === "layer3" || value === "layer4" ? value : "unknown";
}

function readThreatDecision(value: string | null | undefined): ThreatDecision {
  return value === "observed" ||
    value === "reviewed" ||
    value === "reported" ||
    value === "degraded"
    ? value
    : "unknown";
}

function readThreatSeverity(value: string | null | undefined): ThreatSeverity {
  return value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "critical"
    ? value
    : "unknown";
}

function readThreatSurface(value: string | null | undefined): ThreatSurface {
  if (
    value === "browser" ||
    value === "wallet" ||
    value === "desktop" ||
    value === "document" ||
    value === "api"
  ) {
    return value;
  }

  return "unknown";
}

function buildEntryTitle(scan: ThreatDashboardScanSource, surface: ThreatSurface): string {
  const threatLabel = formatThreatTypeLabel(scan.threatType);
  if (surface === "document") {
    return `Document activity loaded: ${threatLabel}`;
  }
  if (surface === "browser") {
    return `Browser activity loaded: ${threatLabel}`;
  }
  if (surface === "wallet") {
    return `Wallet activity loaded: ${threatLabel}`;
  }
  if (surface === "api") {
    return `API activity loaded: ${threatLabel}`;
  }
  if (surface === "desktop") {
    return `Desktop activity loaded: ${threatLabel}`;
  }
  return `Observed scan activity: ${threatLabel}`;
}

function buildEntrySummary(scan: ThreatDashboardScanSource): string {
  if (scan.ruleReason && scan.ruleReason.trim()) {
    return scan.ruleReason.trim();
  }

  if (scan.shortAdvice && scan.shortAdvice.trim()) {
    return scan.shortAdvice.trim();
  }

  return "Dashboard entry loaded from the current desktop scan history.";
}

function buildReasonCodes(
  scan: ThreatDashboardScanSource,
  layer: ThreatLayer,
  decision: ThreatDecision,
  severity: ThreatSeverity,
  surface: ThreatSurface,
): readonly string[] {
  const reasonCodes = new Set<string>();
  const threatCode = normalizeThreatToken(scan.threatType);
  if (threatCode) {
    reasonCodes.add(`threat:${threatCode}`);
  }

  const detectedBy = normalizeThreatToken(scan.detectedBy ?? "");
  if (detectedBy) {
    reasonCodes.add(`detected_by:${detectedBy}`);
  }

  const detectedByType = normalizeThreatToken(scan.detectedByType ?? "");
  if (detectedByType) {
    reasonCodes.add(`detector_type:${detectedByType}`);
  }

  const ruleName = normalizeThreatToken(scan.ruleName ?? "");
  if (ruleName) {
    reasonCodes.add(`rule:${ruleName}`);
  }

  reasonCodes.add(`surface:${surface}`);
  reasonCodes.add(`layer:${layer}`);
  reasonCodes.add(`decision:${decision}`);
  reasonCodes.add(`severity:${severity}`);

  return Array.from(reasonCodes);
}

function buildEvidencePreview(
  scan: ThreatDashboardScanSource,
  surface: ThreatSurface,
): readonly string[] {
  const evidence: string[] = [];

  evidence.push(`Surface: ${surface}.`);
  evidence.push(`Source: ${scan.source || "unknown"}.`);
  evidence.push(`Engine: ${scan.engine || "unknown"}.`);

  if (scan.ruleName && scan.ruleName.trim()) {
    evidence.push(`Rule: ${scan.ruleName.trim()}.`);
  }

  if (scan.detectedBy && scan.detectedBy.trim()) {
    evidence.push(`Detector: ${scan.detectedBy.trim()}.`);
  }

  if (scan.deviceId && scan.deviceId.trim()) {
    evidence.push(`Device: ${scan.deviceId.trim()}.`);
  }

  if (scan.userEmail && scan.userEmail.trim()) {
    evidence.push(`User: ${scan.userEmail.trim()}.`);
  }

  evidence.push(`Risk level: ${scan.riskLevel || "unknown"}.`);
  evidence.push(`Risk score: ${String(scan.riskScore)}.`);

  return evidence;
}

/**
 * Maps restored desktop scan history into the normalized dashboard feed model without
 * inventing layer, decision, or severity truth.
 */
export function mapScansToThreatLogEntries(
  scans: readonly ThreatDashboardScanSource[],
): ThreatLogEntry[] {
  return scans.map((scan) => {
    const layer = readThreatLayer(scan.layer);
    const decision = readThreatDecision(scan.decision);
    const severity = readThreatSeverity(scan.severity);
    const surface = readThreatSurface(scan.surface);
    const targetLabel =
      scan.url && scan.url !== "(document)"
        ? scan.url
        : scan.filename && scan.filename.trim()
        ? scan.filename.trim()
        : null;

    return {
      id: scan.id,
      occurredAt: scan.checkedAt,
      layer,
      decision,
      severity,
      surface,
      title: buildEntryTitle(scan, surface),
      summary: buildEntrySummary(scan),
      reasonCodes: buildReasonCodes(scan, layer, decision, severity, surface),
      targetLabel,
      reportId: scan.id || null,
      evidencePreview: buildEvidencePreview(scan, surface),
    };
  });
}

/**
 * Parses the backend health payload into a narrow snapshot.
 */
export function parseBackendHealthSnapshot(value: unknown): BackendHealthSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    status: value.status === "ok" ? "ok" : value.status === "error" ? "error" : "unknown",
    dbAvailable: readBoolean(value.dbAvailable),
    checkedAt: readString(value.checkedAt),
  };
}

/**
 * Parses the backend engine status payload into a narrow status snapshot.
 */
export function parseEngineStatusSnapshot(value: unknown): EngineStatusSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  const engine = isRecord(value.engine) ? value.engine : null;
  return {
    mode: value.mode === "RULE_ONLY" || value.mode === "RULE_PLUS_AI" ? value.mode : null,
    engineState:
      engine?.state === "ACTIVE" || engine?.state === "DEGRADED" ? engine.state : null,
    ruleEngine:
      engine?.ruleEngine === "AVAILABLE" || engine?.ruleEngine === "UNAVAILABLE"
        ? engine.ruleEngine
        : null,
    aiEngine:
      engine?.aiEngine === "AVAILABLE" || engine?.aiEngine === "UNAVAILABLE"
        ? engine.aiEngine
        : null,
    database:
      engine?.database === "AVAILABLE" || engine?.database === "UNAVAILABLE"
        ? engine.database
        : null,
    checkedAt: readString(value.checkedAt),
  };
}

/**
 * Parses the navigation manifest payload into a narrow intel snapshot.
 */
export function parseNavigationManifestSnapshot(
  value: unknown,
): NavigationManifestSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  const sections = isRecord(value.sections) ? value.sections : null;
  const malicious = isRecord(sections?.maliciousDomains) ? sections.maliciousDomains : null;
  const allowlists = isRecord(sections?.allowlists) ? sections.allowlists : null;

  let availableSectionCount = 0;
  if (malicious) {
    availableSectionCount += 1;
  }
  if (allowlists) {
    availableSectionCount += 1;
  }

  return {
    bundleVersion: readString(value.bundleVersion),
    generatedAt: readString(value.generatedAt),
    maliciousFeedVersion: readString(malicious?.feedVersion),
    allowlistFeedVersion: readString(allowlists?.feedVersion),
    maliciousStaleAfter: readString(malicious?.staleAfter),
    maliciousExpiresAt: readString(malicious?.expiresAt),
    allowlistStaleAfter: readString(allowlists?.staleAfter),
    allowlistExpiresAt: readString(allowlists?.expiresAt),
    availableSectionCount,
  };
}

function reduceTruthState(
  states: readonly ThreatTruthState[],
  fallback: ThreatTruthState,
): ThreatTruthState {
  const precedence: ThreatTruthState[] = [
    "unavailable",
    "stale",
    "degraded",
    "partial",
    "unknown",
    "loading",
    "loaded",
    "available",
  ];

  for (const candidate of precedence) {
    if (states.includes(candidate)) {
      return candidate;
    }
  }

  return fallback;
}

function resolveIntelState(
  manifest: NavigationManifestSnapshot | null,
  referenceTime: string | null,
  isLoading: boolean,
  health: "unknown" | "ok" | "error",
): ThreatTruthState {
  if (health === "error") {
    return "unavailable";
  }
  if (!manifest) {
    return isLoading ? "loading" : health === "ok" ? "unavailable" : "unknown";
  }
  if (manifest.availableSectionCount < 2) {
    return "partial";
  }

  const referenceTimestamp = parseThreatTimestamp(referenceTime);
  const expiresAtCandidates = [
    manifest.maliciousExpiresAt,
    manifest.allowlistExpiresAt,
  ].map(parseThreatTimestamp);
  const staleAfterCandidates = [
    manifest.maliciousStaleAfter,
    manifest.allowlistStaleAfter,
  ].map(parseThreatTimestamp);

  if (
    referenceTimestamp > 0 &&
    expiresAtCandidates.some(
      (expiresAtTimestamp) => expiresAtTimestamp > 0 && referenceTimestamp >= expiresAtTimestamp,
    )
  ) {
    return "unavailable";
  }

  if (
    referenceTimestamp > 0 &&
    staleAfterCandidates.some(
      (staleAfterTimestamp) =>
        staleAfterTimestamp > 0 && referenceTimestamp >= staleAfterTimestamp,
    )
  ) {
    return "stale";
  }

  if (!manifest.bundleVersion || !manifest.generatedAt) {
    return "partial";
  }

  return "loaded";
}

function resolveProviderState(
  engine: EngineStatusSnapshot | null,
  isLoading: boolean,
  health: "unknown" | "ok" | "error",
): ThreatProviderState {
  if (health === "error") {
    return "unavailable";
  }
  if (!engine) {
    return isLoading ? "loading" : health === "ok" ? "partial" : "unknown";
  }
  if (
    engine.mode == null ||
    engine.engineState == null ||
    engine.ruleEngine == null ||
    engine.aiEngine == null ||
    engine.database == null
  ) {
    return "partial";
  }
  if (engine.engineState === "DEGRADED") {
    return "degraded";
  }
  if (engine.mode === "RULE_PLUS_AI") {
    return "rule-plus-ai";
  }
  if (engine.mode === "RULE_ONLY") {
    return "rule-only";
  }
  return "unknown";
}

function resolveDatabaseState(
  engine: EngineStatusSnapshot | null,
  healthSnapshot: BackendHealthSnapshot | null,
): "available" | "unavailable" | "unknown" | "partial" {
  const engineDatabase = engine?.database;
  const healthDatabase = healthSnapshot?.dbAvailable;

  if (engineDatabase === "AVAILABLE" && healthDatabase !== false) {
    return "available";
  }
  if (engineDatabase === "UNAVAILABLE" || healthDatabase === false) {
    return "unavailable";
  }
  if (engineDatabase == null && healthDatabase == null) {
    return "unknown";
  }
  return "partial";
}

function buildTruthSignals(params: {
  readonly intelState: ThreatTruthState;
  readonly providerState: ThreatProviderState;
  readonly failSafeState: ThreatFailSafeState;
  readonly databaseState: "available" | "unavailable" | "unknown" | "partial";
}): readonly string[] {
  const signals: string[] = [];

  if (params.intelState === "unavailable") {
    signals.push("Navigation intel snapshot is unavailable.");
  } else if (params.intelState === "stale") {
    signals.push("Navigation intel snapshot is stale.");
  } else if (params.intelState === "partial") {
    signals.push("Navigation intel snapshot is only partially available.");
  } else if (params.intelState === "unknown") {
    signals.push("Navigation intel snapshot state is unknown.");
  }

  if (params.providerState === "partial") {
    signals.push("Provider state is only partially available.");
  } else if (params.providerState === "degraded") {
    signals.push("Provider state is degraded.");
  } else if (params.providerState === "unavailable") {
    signals.push("Provider state is unavailable.");
  } else if (params.providerState === "unknown") {
    signals.push("Provider state is unknown.");
  }

  if (params.failSafeState === "unknown") {
    signals.push("Fail-safe state is unavailable in the current runtime contract.");
  } else if (params.failSafeState === "partial" || params.failSafeState === "degraded") {
    signals.push("Fail-safe state is not fully available.");
  } else if (params.failSafeState === "unavailable") {
    signals.push("Fail-safe state is unavailable.");
  }

  if (params.databaseState === "partial") {
    signals.push("Database status is only partially available.");
  } else if (params.databaseState === "unavailable") {
    signals.push("Database status is unavailable.");
  } else if (params.databaseState === "unknown") {
    signals.push("Database status is unknown.");
  }

  return signals;
}

function mapFailSafeTruthState(state: ThreatFailSafeState): ThreatTruthState {
  if (state === "unavailable") {
    return "unavailable";
  }
  if (state === "partial") {
    return "partial";
  }
  if (state === "degraded") {
    return "degraded";
  }
  if (state === "unknown") {
    return "partial";
  }
  return "available";
}

/**
 * Builds the calm dashboard system status panel state from backend snapshots
 * without inferring fail-safe or event truth that the runtime does not expose.
 */
export function buildThreatSystemStatus(params: {
  readonly health: "unknown" | "ok" | "error";
  readonly healthSnapshot: BackendHealthSnapshot | null;
  readonly shieldMode: "normal" | "paranoid";
  readonly manifest: NavigationManifestSnapshot | null;
  readonly engine: EngineStatusSnapshot | null;
  readonly referenceTime: string | null;
  readonly isLoading: boolean;
}): ThreatSystemStatus {
  const intelState = resolveIntelState(
    params.manifest,
    params.referenceTime,
    params.isLoading,
    params.health,
  );
  const providerState = resolveProviderState(
    params.engine,
    params.isLoading,
    params.health,
  );
  const databaseState = resolveDatabaseState(params.engine, params.healthSnapshot);
  const failSafeState: ThreatFailSafeState =
    params.health === "error" ? "unavailable" : params.isLoading ? "unknown" : "unknown";
  const dataTruthState = reduceTruthState(
    [
      intelState,
      providerState === "degraded"
        ? "degraded"
        : providerState === "partial"
        ? "partial"
        : providerState === "unavailable"
        ? "unavailable"
        : providerState === "unknown"
        ? "unknown"
        : "available",
      databaseState === "unavailable"
        ? "unavailable"
        : databaseState === "partial"
        ? "partial"
        : databaseState === "unknown"
        ? "unknown"
        : "available",
    ],
    "unknown",
  );
  const dashboardTruthState = reduceTruthState(
    [
      dataTruthState,
      mapFailSafeTruthState(failSafeState),
    ],
    "unknown",
  );
  const truthSignals = buildTruthSignals({
    intelState,
    providerState,
    failSafeState,
    databaseState,
  });

  return {
    dashboardTruthState,
    dataTruthState,
    intelState,
    snapshotVersion:
      params.manifest?.maliciousFeedVersion ??
      params.manifest?.bundleVersion ??
      null,
    lastRefresh:
      params.manifest?.generatedAt ??
      params.engine?.checkedAt ??
      params.healthSnapshot?.checkedAt ??
      null,
    providerState,
    failSafeState,
    engineState:
      params.health === "error"
        ? "unavailable"
        : params.engine?.engineState === "ACTIVE"
        ? "active"
        : params.engine?.engineState === "DEGRADED"
        ? "degraded"
        : "unknown",
    shieldMode: params.shieldMode,
    databaseState,
    truthSummary:
      truthSignals[0] ??
      "Dashboard status is loaded from the current desktop runtime contracts.",
    truthSignals,
  };
}
