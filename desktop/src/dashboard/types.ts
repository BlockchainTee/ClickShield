/**
 * Identifies the ClickShield protection layer represented by a dashboard event.
 */
export type ThreatLayer = "layer1" | "layer3" | "layer4" | "unknown";

/**
 * Describes the calm, user-visible outcome associated with a dashboard event.
 */
export type ThreatDecision = "observed" | "reviewed" | "reported" | "degraded" | "unknown";

/**
 * Severity level used by the dashboard feed and summary cards.
 */
export type ThreatSeverity = "low" | "medium" | "high" | "critical" | "unknown";

/**
 * Surface where the event was observed or scanned.
 */
export type ThreatSurface = "browser" | "wallet" | "desktop" | "document" | "api" | "unknown";

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
  readonly layer: ThreatLayer;
  readonly decision: ThreatDecision;
  readonly severity: ThreatSeverity;
  readonly surface: ThreatSurface;
  readonly title: string;
  readonly summary: string;
  readonly reasonCodes: readonly string[];
  readonly targetLabel: string | null;
  readonly reportId: string | null;
  readonly evidencePreview: readonly string[];
}

/**
 * Current dashboard filter choices.
 */
export interface ThreatDashboardFilterState {
  readonly layer: ThreatLayer | "all";
  readonly severity: ThreatSeverity | "all";
  readonly decision: ThreatDecision | "all";
  readonly timeWindow: ThreatTimeWindow;
  readonly surface: ThreatSurface | "all";
}

/**
 * Aggregated summary metrics rendered in the top strip and supporting cards.
 */
export interface ThreatDashboardSummary {
  readonly totalEntries: number;
  readonly threatsLast24Hours: number;
  readonly scansRun: number;
  readonly lastRefresh: string | null;
  readonly layerBreakdown: Record<ThreatLayer, number>;
  readonly severityBreakdown: Record<ThreatSeverity, number>;
  readonly decisionBreakdown: Record<ThreatDecision, number>;
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
  readonly layer: ThreatLayer;
  readonly layerLabel: string;
  readonly decision: ThreatDecision;
  readonly decisionLabel: string;
  readonly severity: ThreatSeverity;
  readonly severityLabel: string;
  readonly surface: ThreatSurface;
  readonly surfaceLabel: string;
  readonly title: string;
  readonly summary: string;
  readonly reasonCodes: readonly string[];
  readonly evidencePreview: readonly string[];
  readonly targetLabel: string | null;
  readonly reportId: string | null;
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
  readonly entries: readonly ThreatLogEntry[];
  readonly filteredEntries: readonly ThreatLogEntry[];
  readonly summary: ThreatDashboardSummary;
  readonly selectedEntryId: string | null;
  readonly selectedDetails: ThreatDetailsViewModel | null;
  readonly feedEmptyState: ThreatDashboardEmptyStateLabels;
  readonly detailsEmptyState: ThreatDashboardEmptyStateLabels;
}
