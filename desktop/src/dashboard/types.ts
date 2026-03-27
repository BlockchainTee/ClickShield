import type { WalletReportClassification } from "../lib/shared-rules";

/**
 * Identifies the ClickShield protection layer represented by a dashboard event.
 */
export type ThreatLayer = "layer1" | "layer3" | "layer4" | "unknown";

/**
 * Describes the calm, user-visible outcome associated with a dashboard event.
 */
export type ThreatDecision =
  | "allowed"
  | "warned"
  | "blocked"
  | "scan_result"
  | "observed"
  | "reviewed"
  | "reported"
  | "degraded"
  | "unknown";

/**
 * Severity level used by the dashboard feed and summary cards.
 */
export type ThreatSeverity =
  | "low"
  | "medium"
  | "high"
  | "critical"
  | WalletReportClassification
  | "unknown";

/**
 * Explicit target surface where the event was observed or scanned.
 */
export type ThreatSurface = "browser" | "wallet" | "desktop" | "document" | "api" | "unknown";

/**
 * Source surface for cross-surface threat-log ingestion.
 */
export type ThreatSourceSurface =
  | "desktop"
  | "extension"
  | "mobile"
  | "manual_scan"
  | "unknown";

/**
 * Threat event kinds supported by the desktop threat log.
 */
export type ThreatEventKind =
  | "navigation_decision"
  | "transaction_decision"
  | "scan_result"
  | "intel_status"
  | "system_status";

/**
 * Truth state for dashboard runtime and data availability.
 */
export type ThreatTruthState =
  | "unknown"
  | "loading"
  | "loaded"
  | "available"
  | "partial"
  | "degraded"
  | "stale"
  | "unavailable";

/**
 * Provider state exposed by the current runtime contract.
 */
export type ThreatProviderState =
  | "unknown"
  | "loading"
  | "rule-only"
  | "rule-plus-ai"
  | "partial"
  | "degraded"
  | "unavailable";

/**
 * Fail-safe truth state; unknown remains explicit unless upstream exposes more.
 */
export type ThreatFailSafeState =
  | "active"
  | "inactive"
  | "unknown"
  | "partial"
  | "degraded"
  | "unavailable";

/**
 * Supported dashboard time windows.
 */
export type ThreatTimeWindow = "24h" | "7d" | "30d" | "all";

/**
 * Single immutable dashboard event rendered in the threat feed.
 */
export interface ThreatLogEntry {
  readonly id: string;
  readonly occurredAt: string;
  readonly eventKind: ThreatEventKind;
  readonly layer: ThreatLayer;
  readonly decision: ThreatDecision;
  readonly severity: ThreatSeverity;
  readonly surface: ThreatSurface;
  readonly sourceSurface: ThreatSourceSurface;
  readonly title: string;
  readonly summary: string;
  readonly reasonCodes: readonly string[];
  readonly targetLabel: string | null;
  readonly reportId: string | null;
  readonly evidencePreview: readonly string[];
  readonly statusTruth: ThreatTruthState;
  readonly sourceRef: string | null;
  readonly truthGaps: readonly string[];
  readonly rawKind?: string | null;
}

/**
 * Cross-source coverage summary exposed by the desktop threat log.
 */
export interface ThreatSourceCoverageSummary {
  readonly scanHistory: ThreatTruthState;
  readonly intelStatus: ThreatTruthState;
  readonly systemStatus: ThreatTruthState;
  readonly layer1History: ThreatTruthState;
  readonly layer3History: ThreatTruthState;
  readonly sourceSurfaceBreakdown: Record<ThreatSourceSurface, number>;
}

/**
 * Immutable append-only threat log state consumed by dashboard selectors.
 */
export interface ThreatLogState {
  readonly entries: readonly ThreatLogEntry[];
  readonly lastUpdatedAt: string | null;
  readonly sourceCoverage: ThreatSourceCoverageSummary;
  readonly truthGaps: readonly string[];
}

/**
 * Summary of allow / warn / block outcomes explicitly present in the log.
 */
export interface ThreatActionBreakdown {
  readonly allowed: number;
  readonly warned: number;
  readonly blocked: number;
}

/**
 * Current dashboard filter choices.
 */
export interface ThreatDashboardFilterState {
  readonly layer: ThreatLayer | "all";
  readonly severity: ThreatSeverity | "all";
  readonly decision: ThreatDecision | "all";
  readonly timeWindow: ThreatTimeWindow;
  readonly sourceSurface: ThreatSourceSurface | "all";
}

/**
 * Aggregated summary metrics rendered in the top strip and supporting cards.
 */
export interface ThreatDashboardSummary {
  readonly totalEntries: number;
  readonly activityEntries: number;
  readonly statusEntries: number;
  readonly threatsLast24Hours: number;
  readonly scansRun: number;
  readonly lastRefresh: string | null;
  readonly layerBreakdown: Record<ThreatLayer, number>;
  readonly severityBreakdown: Record<ThreatSeverity, number>;
  readonly decisionBreakdown: Record<ThreatDecision, number>;
  readonly sourceSurfaceBreakdown: Record<ThreatSourceSurface, number>;
  readonly eventKindBreakdown: Record<ThreatEventKind, number>;
  readonly actionBreakdown: ThreatActionBreakdown;
  readonly entriesWithUnknownTruth: number;
}

/**
 * Current system and provider snapshot shown in the side status panel.
 */
export interface ThreatSystemStatus {
  readonly dashboardTruthState: ThreatTruthState;
  readonly dataTruthState: ThreatTruthState;
  readonly intelState: ThreatTruthState;
  readonly snapshotVersion: string | null;
  readonly lastRefresh: string | null;
  readonly providerState: ThreatProviderState;
  readonly failSafeState: ThreatFailSafeState;
  readonly engineState: "active" | "degraded" | "unknown" | "unavailable";
  readonly shieldMode: "normal" | "paranoid" | "unknown";
  readonly databaseState: "available" | "unavailable" | "unknown" | "partial";
  readonly truthSummary: string;
  readonly truthSignals: readonly string[];
}

/**
 * Readable details model for the right-side details panel.
 */
export interface ThreatDetailsViewModel {
  readonly id: string;
  readonly occurredAt: string;
  readonly occurredAtLabel: string;
  readonly eventKind: ThreatEventKind;
  readonly eventKindLabel: string;
  readonly layer: ThreatLayer;
  readonly layerLabel: string;
  readonly decision: ThreatDecision;
  readonly decisionLabel: string;
  readonly severity: ThreatSeverity;
  readonly severityLabel: string;
  readonly surface: ThreatSurface;
  readonly surfaceLabel: string;
  readonly sourceSurface: ThreatSourceSurface;
  readonly sourceSurfaceLabel: string;
  readonly title: string;
  readonly summary: string;
  readonly reasonCodes: readonly string[];
  readonly evidencePreview: readonly string[];
  readonly targetLabel: string | null;
  readonly reportId: string | null;
  readonly statusTruth: ThreatTruthState;
  readonly statusTruthLabel: string;
  readonly sourceRef: string | null;
  readonly truthGaps: readonly string[];
}

/**
 * Empty-state copy for feed and details shells.
 */
export interface ThreatDashboardEmptyStateLabels {
  readonly title: string;
  readonly description: string;
}

/**
 * Derived dashboard state used by the desktop shell.
 */
export interface ThreatDashboardViewModel {
  readonly threatLog: ThreatLogState;
  readonly entries: readonly ThreatLogEntry[];
  readonly filteredEntries: readonly ThreatLogEntry[];
  readonly summary: ThreatDashboardSummary;
  readonly selectedEntryId: string | null;
  readonly selectedDetails: ThreatDetailsViewModel | null;
  readonly feedEmptyState: ThreatDashboardEmptyStateLabels;
  readonly detailsEmptyState: ThreatDashboardEmptyStateLabels;
}
