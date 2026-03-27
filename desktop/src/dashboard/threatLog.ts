import type {
  BackendHealthSnapshot,
  EngineStatusSnapshot,
  NavigationManifestSnapshot,
  ThreatDashboardScanSource,
} from "./adapters";
import type {
  WalletLayer4Output,
  WalletReportClassification,
} from "../lib/shared-rules";
import { validateLayer4ThreatLogPayload } from "./layer4Runtime";
import type { ValidatedThreatLayer4Payload } from "./layer4Runtime";
import { parseThreatTimestamp } from "./time";
import type {
  ThreatLogEntry,
  ThreatDecision,
  ThreatEventKind,
  ThreatLayer,
  ThreatLogState,
  ThreatSeverity,
  ThreatSourceCoverageSummary,
  ThreatSourceSurface,
  ThreatSurface,
  ThreatSystemStatus,
  ThreatTruthState,
} from "./types";

const EMPTY_SOURCE_SURFACE_BREAKDOWN: Record<ThreatSourceSurface, number> = {
  desktop: 0,
  extension: 0,
  mobile: 0,
  manual_scan: 0,
  unknown: 0,
};

const ACTIVITY_EVENT_KINDS: readonly ThreatEventKind[] = [
  "navigation_decision",
  "transaction_decision",
  "scan_result",
];

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function freezeEntry(entry: ThreatLogEntry): ThreatLogEntry {
  return Object.freeze({
    ...entry,
    reasonCodes: freezeArray(entry.reasonCodes),
    evidencePreview: freezeArray(entry.evidencePreview),
    truthGaps: freezeArray(entry.truthGaps),
  });
}

function freezeSourceCoverage(
  sourceCoverage: ThreatSourceCoverageSummary,
): ThreatSourceCoverageSummary {
  return Object.freeze({
    ...sourceCoverage,
    sourceSurfaceBreakdown: Object.freeze({
      ...sourceCoverage.sourceSurfaceBreakdown,
    }),
  });
}

function freezeThreatLogState(state: ThreatLogState): ThreatLogState {
  return Object.freeze({
    ...state,
    entries: freezeArray(state.entries.map((entry) => freezeEntry(entry))),
    sourceCoverage: freezeSourceCoverage(state.sourceCoverage),
    truthGaps: freezeArray(state.truthGaps),
  });
}

function compareThreatLogEntries(left: ThreatLogEntry, right: ThreatLogEntry): number {
  const timestampDelta =
    parseThreatTimestamp(right.occurredAt) - parseThreatTimestamp(left.occurredAt);
  if (timestampDelta !== 0) {
    return timestampDelta;
  }

  return left.id.localeCompare(right.id);
}

function normalizeThreatToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function titleize(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function readThreatLayer(value: string | null | undefined): ThreatLayer {
  return value === "layer1" || value === "layer3" || value === "layer4" ? value : "unknown";
}

function readThreatDecision(value: string | null | undefined): ThreatDecision {
  return value === "allowed" ||
    value === "warned" ||
    value === "blocked" ||
    value === "scan_result" ||
    value === "observed" ||
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
    value === "critical" ||
    value === "no_issues_detected" ||
    value === "issues_detected" ||
    value === "manual_action_required" ||
    value === "execution_reported"
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

function readThreatSourceSurface(value: string | null | undefined): ThreatSourceSurface {
  if (
    value === "desktop" ||
    value === "extension" ||
    value === "mobile" ||
    value === "manual_scan"
  ) {
    return value;
  }

  return "unknown";
}

function resolveScanEventKind(
  layer: ThreatLayer,
  decision: ThreatDecision,
): ThreatEventKind {
  if (layer === "layer1" && decision !== "unknown") {
    return "navigation_decision";
  }
  if (layer === "layer3" && decision !== "unknown") {
    return "transaction_decision";
  }
  return "scan_result";
}

function buildScanTitle(
  scan: ThreatDashboardScanSource,
  eventKind: ThreatEventKind,
  sourceSurface: ThreatSourceSurface,
): string {
  const threatLabel = titleize(scan.threatType.trim() || "unknown activity");
  if (eventKind === "navigation_decision") {
    return `Navigation decision recorded: ${threatLabel}`;
  }
  if (eventKind === "transaction_decision") {
    return `Transaction decision recorded: ${threatLabel}`;
  }
  if (sourceSurface === "manual_scan") {
    return `Manual scan result loaded: ${threatLabel}`;
  }
  if (sourceSurface === "desktop") {
    return `Desktop scan result loaded: ${threatLabel}`;
  }
  if (sourceSurface === "extension") {
    return `Extension scan result loaded: ${threatLabel}`;
  }
  if (sourceSurface === "mobile") {
    return `Mobile scan result loaded: ${threatLabel}`;
  }
  return `Observed scan activity: ${threatLabel}`;
}

function buildScanSummary(scan: ThreatDashboardScanSource): string {
  if (scan.ruleReason && scan.ruleReason.trim()) {
    return scan.ruleReason.trim();
  }

  if (scan.shortAdvice && scan.shortAdvice.trim()) {
    return scan.shortAdvice.trim();
  }

  return "Dashboard entry loaded from the current desktop scan history.";
}

function readLayer4Severity(classification: WalletReportClassification): ThreatSeverity {
  return classification;
}

function buildLayer4ReasonCodes(
  findings: ValidatedThreatLayer4Payload["result"]["findings"],
): readonly string[] {
  return findings.map((finding) => finding.reasonCode);
}

function buildLayer4EvidencePreview(
  report: ValidatedThreatLayer4Payload,
): readonly string[] {
  const evidence = [
    `Wallet chain: ${report.request.walletChain}.`,
    `Wallet address: ${report.request.walletAddress}.`,
    `Network: ${report.request.networkId}.`,
    `Scan mode: ${report.request.scanMode}.`,
    `Classification: ${report.result.classification}.`,
    `Findings: ${String(report.summary.findingCount)} total, ${String(report.summary.openFindingCount)} open, ${String(report.summary.actionableFindingCount)} actionable.`,
    `Cleanup actions: ${String(report.summary.cleanupActionCount)}.`,
    `Execution performed: ${report.result.executionPerformed ? "true" : "false"}.`,
  ];

  for (const finding of report.result.findings.slice(0, 3)) {
    evidence.push(`Finding: ${finding.title}. ${finding.summary}`);
  }

  return evidence;
}

function buildLayer4Title(report: ValidatedThreatLayer4Payload): string {
  return `Layer 4 wallet scan result: ${titleize(report.request.walletChain)} wallet`;
}

function buildScanTruthGaps(
  layer: ThreatLayer,
  decision: ThreatDecision,
  severity: ThreatSeverity,
  surface: ThreatSurface,
  sourceSurface: ThreatSourceSurface,
  occurredAt: string,
): readonly string[] {
  const truthGaps: string[] = [];

  if (parseThreatTimestamp(occurredAt) === 0) {
    truthGaps.push("Observed time is unavailable in the current dashboard source contract.");
  }
  if (layer === "unknown") {
    truthGaps.push("Layer identity is unavailable in the current dashboard source contract.");
  }
  if (decision === "unknown") {
    truthGaps.push("Decision state is unavailable in the current dashboard source contract.");
  }
  if (severity === "unknown") {
    truthGaps.push("Severity is unavailable in the current dashboard source contract.");
  }
  if (surface === "unknown") {
    truthGaps.push("Observed target surface is unavailable in the current dashboard source contract.");
  }
  if (sourceSurface === "unknown") {
    truthGaps.push("Source surface is unavailable in the current dashboard source contract.");
  }

  return truthGaps;
}

function buildScanReasonCodes(params: {
  readonly scan: ThreatDashboardScanSource;
  readonly eventKind: ThreatEventKind;
  readonly layer: ThreatLayer;
  readonly decision: ThreatDecision;
  readonly severity: ThreatSeverity;
  readonly surface: ThreatSurface;
  readonly sourceSurface: ThreatSourceSurface;
}): readonly string[] {
  const reasonCodes = new Set<string>();
  const threatCode = normalizeThreatToken(params.scan.threatType);
  if (threatCode) {
    reasonCodes.add(`threat:${threatCode}`);
  }

  const detectedBy = normalizeThreatToken(params.scan.detectedBy ?? "");
  if (detectedBy) {
    reasonCodes.add(`detected_by:${detectedBy}`);
  }

  const detectedByType = normalizeThreatToken(params.scan.detectedByType ?? "");
  if (detectedByType) {
    reasonCodes.add(`detector_type:${detectedByType}`);
  }

  const ruleName = normalizeThreatToken(params.scan.ruleName ?? "");
  if (ruleName) {
    reasonCodes.add(`rule:${ruleName}`);
  }

  reasonCodes.add(`event_kind:${params.eventKind}`);
  reasonCodes.add(`source_surface:${params.sourceSurface}`);
  reasonCodes.add(`target_surface:${params.surface}`);
  reasonCodes.add(`layer:${params.layer}`);
  reasonCodes.add(`decision:${params.decision}`);
  reasonCodes.add(`severity:${params.severity}`);

  return Array.from(reasonCodes);
}

function buildScanEvidencePreview(
  scan: ThreatDashboardScanSource,
  surface: ThreatSurface,
  sourceSurface: ThreatSourceSurface,
): readonly string[] {
  const evidence: string[] = [];

  evidence.push(`Source surface: ${sourceSurface}.`);
  evidence.push(`Target surface: ${surface}.`);
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

function buildEntryTruthState(truthGaps: readonly string[]): ThreatTruthState {
  return truthGaps.length === 0 ? "available" : "partial";
}

function buildDeterministicEventId(parts: ReadonlyArray<string | null | undefined>): string {
  return parts
    .map((part) => normalizeThreatToken(part ?? "") || "unknown")
    .join(":");
}

function buildScanEventId(params: {
  readonly scan: ThreatDashboardScanSource;
  readonly eventKind: ThreatEventKind;
  readonly layer: ThreatLayer;
  readonly decision: ThreatDecision;
  readonly severity: ThreatSeverity;
  readonly surface: ThreatSurface;
  readonly sourceSurface: ThreatSourceSurface;
}): string {
  return buildDeterministicEventId([
    "scan_event",
    params.eventKind,
    params.scan.id,
    params.scan.checkedAt,
    params.scan.url,
    params.scan.filename,
    params.scan.threatType,
    params.scan.source,
    params.layer,
    params.decision,
    params.severity,
    params.surface,
    params.sourceSurface,
    params.scan.ruleName,
    params.scan.detectedBy,
    params.scan.detectedByType,
    params.scan.ruleReason,
    params.scan.shortAdvice,
    params.scan.riskLevel,
    String(params.scan.riskScore),
    params.scan.engine,
    params.scan.userEmail,
    params.scan.deviceId,
    params.scan.mimeType,
  ]);
}

function pickLatestTimestamp(
  left: string | null | undefined,
  right: string | null | undefined,
): string | null {
  const leftTimestamp = parseThreatTimestamp(left);
  const rightTimestamp = parseThreatTimestamp(right);

  if (rightTimestamp > leftTimestamp) {
    return right ?? null;
  }
  if (leftTimestamp > 0) {
    return left ?? null;
  }
  return right ?? left ?? null;
}

function buildIntelSummary(
  manifest: NavigationManifestSnapshot | null,
  systemStatus: ThreatSystemStatus,
): string {
  if (!manifest) {
    return "Navigation manifest details are unavailable in the current desktop runtime snapshot.";
  }
  if (systemStatus.intelState === "stale") {
    return "Navigation intel is loaded but stale against the current desktop manifest policy.";
  }
  if (systemStatus.intelState === "partial") {
    return "Navigation intel is only partially represented by the current manifest payload.";
  }
  if (systemStatus.intelState === "unavailable") {
    return "Navigation intel is unavailable to the current desktop runtime.";
  }

  return "Navigation intel status is loaded from the current desktop manifest snapshot.";
}

function buildIntelTruthGaps(
  manifest: NavigationManifestSnapshot | null,
  systemStatus: ThreatSystemStatus,
): readonly string[] {
  const truthGaps: string[] = [];

  if (!manifest) {
    truthGaps.push("Navigation manifest payload is unavailable in the current dashboard source contract.");
    return truthGaps;
  }

  if (manifest.availableSectionCount < 2) {
    truthGaps.push("Navigation manifest is missing one or more expected feed sections.");
  }
  if (!manifest.bundleVersion) {
    truthGaps.push("Navigation bundle version is unavailable in the current manifest payload.");
  }
  if (!manifest.generatedAt) {
    truthGaps.push("Navigation manifest generated time is unavailable in the current manifest payload.");
  }
  if (systemStatus.intelState === "stale") {
    truthGaps.push("Navigation intel is stale against the current stale-after policy.");
  }
  if (systemStatus.intelState === "unavailable") {
    truthGaps.push("Navigation intel is unavailable to the current desktop runtime.");
  }

  return truthGaps;
}

function buildSystemSummary(systemStatus: ThreatSystemStatus): string {
  if (systemStatus.dashboardTruthState === "unavailable") {
    return "Desktop system status is unavailable to the current runtime.";
  }
  if (systemStatus.dashboardTruthState === "partial") {
    return "Desktop system status is only partially represented by current runtime contracts.";
  }
  if (systemStatus.dashboardTruthState === "degraded") {
    return "Desktop system status is degraded in the current runtime snapshot.";
  }

  return "Desktop system status is loaded from the current runtime snapshots.";
}

function buildSystemTruthGaps(systemStatus: ThreatSystemStatus): readonly string[] {
  const truthGaps = [...systemStatus.truthSignals];

  if (systemStatus.failSafeState === "unknown") {
    truthGaps.push("Fail-safe state is still unavailable in the current runtime contract.");
  }

  return truthGaps;
}

/**
 * Returns whether the provided event kind belongs in the threat activity feed.
 */
export function isThreatActivityEventKind(kind: ThreatEventKind): boolean {
  return ACTIVITY_EVENT_KINDS.includes(kind);
}

/**
 * Builds an empty immutable threat-log state.
 */
export function createEmptyThreatLogState(): ThreatLogState {
  return freezeThreatLogState({
    entries: [],
    lastUpdatedAt: null,
    sourceCoverage: {
      scanHistory: "unknown",
      intelStatus: "unknown",
      systemStatus: "unknown",
      layer1History: "unknown",
      layer3History: "unknown",
      sourceSurfaceBreakdown: { ...EMPTY_SOURCE_SURFACE_BREAKDOWN },
    },
    truthGaps: [],
  });
}

/**
 * Normalizes a single scan source into an immutable desktop threat-log entry.
 */
export function normalizeScanThreatLogEntry(
  scan: ThreatDashboardScanSource,
): ThreatLogEntry {
  const layer = readThreatLayer(scan.layer);
  const decision = readThreatDecision(scan.decision);
  const severity = readThreatSeverity(scan.severity);
  const surface = readThreatSurface(scan.surface);
  const sourceSurface = readThreatSourceSurface(scan.source);
  const eventKind = resolveScanEventKind(layer, decision);
  const targetLabel =
    scan.url && scan.url !== "(document)"
      ? scan.url
      : scan.filename && scan.filename.trim()
      ? scan.filename.trim()
      : null;
  const truthGaps = buildScanTruthGaps(
    layer,
    decision,
    severity,
    surface,
    sourceSurface,
    scan.checkedAt,
  );

  return freezeEntry({
    id: buildScanEventId({
      scan,
      eventKind,
      layer,
      decision,
      severity,
      surface,
      sourceSurface,
    }),
    occurredAt: scan.checkedAt,
    eventKind,
    layer,
    decision,
    severity,
    surface,
    sourceSurface,
    title: buildScanTitle(scan, eventKind, sourceSurface),
    summary: buildScanSummary(scan),
    reasonCodes: buildScanReasonCodes({
      scan,
      eventKind,
      layer,
      decision,
      severity,
      surface,
      sourceSurface,
    }),
    targetLabel,
    reportId: scan.id || null,
    evidencePreview: buildScanEvidencePreview(scan, surface, sourceSurface),
    statusTruth: buildEntryTruthState(truthGaps),
    sourceRef: scan.id ? `recent_scan:${scan.id}` : null,
    truthGaps,
    rawKind: normalizeThreatToken(scan.threatType) || null,
  });
}

/**
 * Normalizes immutable scan history into desktop threat-log entries.
 */
export function normalizeScanThreatLogEntries(
  scans: readonly ThreatDashboardScanSource[],
): readonly ThreatLogEntry[] {
  return freezeArray(scans.map((scan) => normalizeScanThreatLogEntry(scan)));
}

/**
 * Normalizes a Layer 4 wallet report into an immutable desktop threat-log entry.
 */
export function normalizeLayer4ThreatLogEntry(
  report: WalletLayer4Output,
): ThreatLogEntry | null {
  const validation = validateLayer4ThreatLogPayload(report);
  if (!validation.ok) {
    return null;
  }

  const validatedReport = validation.value;
  const severity = readLayer4Severity(validatedReport.result.classification);
  const truthGaps: readonly string[] = [];

  return freezeEntry({
    id: buildDeterministicEventId(["layer4_report", validatedReport.reportId]),
    occurredAt: validatedReport.generatedAt,
    eventKind: "scan_result",
    layer: "layer4",
    decision: "scan_result",
    severity,
    surface: "desktop",
    sourceSurface: "desktop",
    title: buildLayer4Title(validatedReport),
    summary: validatedReport.result.statusLabel,
    reasonCodes: buildLayer4ReasonCodes(validatedReport.result.findings),
    targetLabel: validatedReport.request.walletAddress,
    reportId: validatedReport.reportId,
    evidencePreview: buildLayer4EvidencePreview(validatedReport),
    statusTruth: buildEntryTruthState(truthGaps),
    sourceRef: `wallet_report:${validatedReport.reportId}`,
    truthGaps,
    rawKind: validatedReport.result.classification,
  });
}

/**
 * Normalizes immutable Layer 4 report history into desktop threat-log entries.
 */
export function normalizeLayer4ThreatLogEntries(
  reports: readonly WalletLayer4Output[],
): readonly ThreatLogEntry[] {
  return freezeArray(
    reports.flatMap((report) => {
      const entry = normalizeLayer4ThreatLogEntry(report);
      return entry ? [entry] : [];
    }),
  );
}

/**
 * Normalizes the current navigation intel snapshot into a desktop status event.
 */
export function normalizeIntelStatusThreatLogEntry(params: {
  readonly manifest: NavigationManifestSnapshot | null;
  readonly systemStatus: ThreatSystemStatus;
  readonly referenceTime: string | null;
}): ThreatLogEntry | null {
  const hasExplicitStatus =
    params.systemStatus.intelState !== "unknown" &&
    params.systemStatus.intelState !== "loading";
  if (!params.manifest && !hasExplicitStatus) {
    return null;
  }

  const occurredAt =
    params.manifest?.generatedAt ??
    params.referenceTime;
  if (!occurredAt) {
    return null;
  }

  const truthGaps = buildIntelTruthGaps(params.manifest, params.systemStatus);
  return freezeEntry({
    id: buildDeterministicEventId([
      "intel_status",
      params.manifest?.bundleVersion,
      params.manifest?.generatedAt,
      params.manifest?.maliciousFeedVersion,
      params.manifest?.allowlistFeedVersion,
      String(params.manifest?.availableSectionCount ?? 0),
      params.manifest?.maliciousStaleAfter,
      params.manifest?.maliciousExpiresAt,
      params.manifest?.allowlistStaleAfter,
      params.manifest?.allowlistExpiresAt,
      params.systemStatus.intelState,
    ]),
    occurredAt,
    eventKind: "intel_status",
    layer: "layer1",
    decision: "unknown",
    severity: "unknown",
    surface: "unknown",
    sourceSurface: "desktop",
    title: `Navigation intel status: ${titleize(params.systemStatus.intelState)}`,
    summary: buildIntelSummary(params.manifest, params.systemStatus),
    reasonCodes: freezeArray(
      [
        "event_kind:intel_status",
        "source_surface:desktop",
        `intel_state:${params.systemStatus.intelState}`,
        params.manifest?.bundleVersion
          ? `bundle:${normalizeThreatToken(params.manifest.bundleVersion)}`
          : "bundle:unknown",
      ],
    ),
    targetLabel: null,
    reportId: null,
    evidencePreview: freezeArray(
      [
        `Bundle version: ${params.manifest?.bundleVersion ?? "unavailable"}.`,
        `Generated at: ${params.manifest?.generatedAt ?? "unavailable"}.`,
        `Malicious feed version: ${params.manifest?.maliciousFeedVersion ?? "unavailable"}.`,
        `Allowlist feed version: ${params.manifest?.allowlistFeedVersion ?? "unavailable"}.`,
        `Available manifest sections: ${String(params.manifest?.availableSectionCount ?? 0)}.`,
      ],
    ),
    statusTruth: params.systemStatus.intelState,
    sourceRef:
      params.manifest?.bundleVersion != null
        ? `navigation_manifest:${params.manifest.bundleVersion}`
        : "navigation_manifest:current",
    truthGaps,
    rawKind: "navigation_manifest",
  });
}

/**
 * Normalizes the current desktop runtime status into a desktop system event.
 */
export function normalizeSystemStatusThreatLogEntry(params: {
  readonly systemStatus: ThreatSystemStatus;
  readonly engine: EngineStatusSnapshot | null;
  readonly healthSnapshot: BackendHealthSnapshot | null;
  readonly referenceTime: string | null;
}): ThreatLogEntry | null {
  const occurredAt =
    params.engine?.checkedAt ??
    params.healthSnapshot?.checkedAt ??
    params.referenceTime;
  if (!occurredAt) {
    return null;
  }

  const truthGaps = buildSystemTruthGaps(params.systemStatus);
  return freezeEntry({
    id: buildDeterministicEventId([
      "system_status",
      params.engine?.checkedAt,
      params.healthSnapshot?.checkedAt,
      params.systemStatus.dashboardTruthState,
      params.systemStatus.dataTruthState,
      params.systemStatus.intelState,
      params.systemStatus.providerState,
      params.systemStatus.failSafeState,
      params.systemStatus.engineState,
      params.systemStatus.shieldMode,
      params.systemStatus.databaseState,
    ]),
    occurredAt,
    eventKind: "system_status",
    layer: "unknown",
    decision: "unknown",
    severity: "unknown",
    surface: "desktop",
    sourceSurface: "desktop",
    title: `Desktop system status: ${titleize(params.systemStatus.dashboardTruthState)}`,
    summary: buildSystemSummary(params.systemStatus),
    reasonCodes: freezeArray(
      [
        "event_kind:system_status",
        "source_surface:desktop",
        `dashboard_truth:${params.systemStatus.dashboardTruthState}`,
        `provider_state:${params.systemStatus.providerState}`,
        `database_state:${params.systemStatus.databaseState}`,
      ],
    ),
    targetLabel: null,
    reportId: null,
    evidencePreview: freezeArray(
      [
        `Provider state: ${params.systemStatus.providerState}.`,
        `Engine state: ${params.systemStatus.engineState}.`,
        `Database state: ${params.systemStatus.databaseState}.`,
        `Fail-safe state: ${params.systemStatus.failSafeState}.`,
        `Shield mode: ${params.systemStatus.shieldMode}.`,
      ],
    ),
    statusTruth: params.systemStatus.dashboardTruthState,
    sourceRef: "desktop_runtime:status",
    truthGaps,
    rawKind: "desktop_runtime_status",
  });
}

/**
 * Deterministically merges threat-log entry sets without replacing prior history.
 */
export function mergeThreatLogEntries(
  existingEntries: readonly ThreatLogEntry[],
  incomingEntries: readonly ThreatLogEntry[],
): readonly ThreatLogEntry[] {
  const mergedEntries = new Map<string, ThreatLogEntry>();

  for (const entry of existingEntries) {
    if (!mergedEntries.has(entry.id)) {
      mergedEntries.set(entry.id, freezeEntry(entry));
    }
  }

  for (const entry of incomingEntries) {
    if (!mergedEntries.has(entry.id)) {
      mergedEntries.set(entry.id, freezeEntry(entry));
    }
  }

  return freezeArray(Array.from(mergedEntries.values()).sort(compareThreatLogEntries));
}

/**
 * Returns a deterministic newest-first slice from the desktop threat log.
 */
export function sliceThreatLogEntries(
  entries: readonly ThreatLogEntry[],
  limit: number,
): readonly ThreatLogEntry[] {
  return freezeArray([...entries].sort(compareThreatLogEntries).slice(0, limit));
}

/**
 * Filters the desktop threat log down to threat activity entries only.
 */
export function selectThreatActivityEntries(
  entries: readonly ThreatLogEntry[],
): readonly ThreatLogEntry[] {
  return freezeArray(entries.filter((entry) => isThreatActivityEventKind(entry.eventKind)));
}

function buildSourceCoverage(params: {
  readonly entries: readonly ThreatLogEntry[];
  readonly scanHistoryTruthState: ThreatTruthState;
  readonly systemStatus: ThreatSystemStatus;
}): ThreatSourceCoverageSummary {
  const sourceSurfaceBreakdown = { ...EMPTY_SOURCE_SURFACE_BREAKDOWN };
  let layer1History: ThreatTruthState =
    params.scanHistoryTruthState === "loading"
      ? "loading"
      : params.scanHistoryTruthState === "unavailable"
      ? "unavailable"
      : "unknown";
  let layer3History: ThreatTruthState = layer1History;

  for (const entry of params.entries) {
    sourceSurfaceBreakdown[entry.sourceSurface] += 1;

    if (entry.eventKind === "navigation_decision") {
      layer1History = "available";
    } else if (entry.layer === "layer1" && layer1History !== "available") {
      layer1History = "partial";
    }

    if (entry.eventKind === "transaction_decision") {
      layer3History = "available";
    } else if (entry.layer === "layer3" && layer3History !== "available") {
      layer3History = "partial";
    }
  }

  return {
    scanHistory: params.scanHistoryTruthState,
    intelStatus: params.systemStatus.intelState,
    systemStatus: params.systemStatus.dashboardTruthState,
    layer1History,
    layer3History,
    sourceSurfaceBreakdown,
  };
}

function buildThreatLogTruthGaps(params: {
  readonly entries: readonly ThreatLogEntry[];
  readonly sourceCoverage: ThreatSourceCoverageSummary;
}): readonly string[] {
  const truthGaps: string[] = [];

  if (params.sourceCoverage.scanHistory === "partial") {
    truthGaps.push("Recent scan history is only partially available in the current desktop session.");
  } else if (params.sourceCoverage.scanHistory === "unavailable") {
    truthGaps.push("Recent scan history is unavailable in the current desktop session.");
  }

  if (params.sourceCoverage.layer1History === "unknown") {
    truthGaps.push("Layer 1 decision history has not been explicitly exposed by current dashboard sources.");
  } else if (params.sourceCoverage.layer1History === "partial") {
    truthGaps.push("Layer 1 activity is present, but explicit decision truth remains partial.");
  }

  if (params.sourceCoverage.layer3History === "unknown") {
    truthGaps.push("Layer 3 decision history has not been explicitly exposed by current dashboard sources.");
  } else if (params.sourceCoverage.layer3History === "partial") {
    truthGaps.push("Layer 3 activity is present, but explicit decision truth remains partial.");
  }

  const entriesWithTruthGaps = params.entries.filter((entry) => entry.truthGaps.length > 0).length;
  if (entriesWithTruthGaps > 0) {
    truthGaps.push(
      `${String(entriesWithTruthGaps)} logged event${entriesWithTruthGaps === 1 ? "" : "s"} still carry partial or unknown truth.`,
    );
  }

  return truthGaps;
}

/**
 * Builds the desktop threat log from available desktop sources.
 */
export function buildThreatLogState(params: {
  readonly previousState: ThreatLogState | null;
  readonly scans: readonly ThreatDashboardScanSource[];
  readonly layer4Reports: readonly WalletLayer4Output[];
  readonly scanHistoryTruthState: ThreatTruthState;
  readonly systemStatus: ThreatSystemStatus;
  readonly manifest: NavigationManifestSnapshot | null;
  readonly engine: EngineStatusSnapshot | null;
  readonly healthSnapshot: BackendHealthSnapshot | null;
  readonly referenceTime: string | null;
}): ThreatLogState {
  const normalizedEntries: ThreatLogEntry[] = [
    ...normalizeScanThreatLogEntries(params.scans),
    ...normalizeLayer4ThreatLogEntries(params.layer4Reports),
  ];

  const intelEntry = normalizeIntelStatusThreatLogEntry({
    manifest: params.manifest,
    systemStatus: params.systemStatus,
    referenceTime: params.referenceTime,
  });
  if (intelEntry) {
    normalizedEntries.push(intelEntry);
  }

  const systemEntry = normalizeSystemStatusThreatLogEntry({
    systemStatus: params.systemStatus,
    engine: params.engine,
    healthSnapshot: params.healthSnapshot,
    referenceTime: params.referenceTime,
  });
  if (systemEntry) {
    normalizedEntries.push(systemEntry);
  }

  const mergedEntries = mergeThreatLogEntries(
    params.previousState?.entries ?? [],
    normalizedEntries,
  );
  const sourceCoverage = buildSourceCoverage({
    entries: mergedEntries,
    scanHistoryTruthState: params.scanHistoryTruthState,
    systemStatus: params.systemStatus,
  });

  let lastUpdatedAt = params.referenceTime;
  for (const entry of mergedEntries) {
    lastUpdatedAt = pickLatestTimestamp(lastUpdatedAt, entry.occurredAt);
  }

  return freezeThreatLogState({
    entries: mergedEntries,
    lastUpdatedAt,
    sourceCoverage,
    truthGaps: buildThreatLogTruthGaps({
      entries: mergedEntries,
      sourceCoverage,
    }),
  });
}
