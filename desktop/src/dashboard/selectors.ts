import {
  selectThreatActivityEntries,
  sliceThreatLogEntries,
} from "./threatLog";
import {
  formatThreatTimestamp,
  parseThreatTimestamp,
} from "./time";
import type {
  ThreatDashboardEmptyStateLabels,
  ThreatDashboardFilterState,
  ThreatDashboardSummary,
  ThreatDashboardViewModel,
  ThreatDecision,
  ThreatDetailsViewModel,
  ThreatEventKind,
  ThreatLayer,
  ThreatLogEntry,
  ThreatLogState,
  ThreatSeverity,
  ThreatSourceSurface,
  ThreatTimeWindow,
} from "./types";

const EMPTY_LAYER_BREAKDOWN: Record<ThreatLayer, number> = {
  layer1: 0,
  layer3: 0,
  layer4: 0,
  unknown: 0,
};

const EMPTY_SEVERITY_BREAKDOWN: Record<ThreatSeverity, number> = {
  low: 0,
  medium: 0,
  high: 0,
  critical: 0,
  no_issues_detected: 0,
  issues_detected: 0,
  manual_action_required: 0,
  execution_reported: 0,
  unknown: 0,
};

const EMPTY_DECISION_BREAKDOWN: Record<ThreatDecision, number> = {
  allowed: 0,
  warned: 0,
  blocked: 0,
  scan_result: 0,
  observed: 0,
  reviewed: 0,
  reported: 0,
  degraded: 0,
  unknown: 0,
};

const EMPTY_SOURCE_SURFACE_BREAKDOWN: Record<ThreatSourceSurface, number> = {
  desktop: 0,
  extension: 0,
  mobile: 0,
  manual_scan: 0,
  unknown: 0,
};

const EMPTY_EVENT_KIND_BREAKDOWN: Record<ThreatEventKind, number> = {
  navigation_decision: 0,
  transaction_decision: 0,
  scan_result: 0,
  intel_status: 0,
  system_status: 0,
};

export { formatThreatTimestamp, parseThreatTimestamp };

/**
 * Returns entries ordered newest-first, then by id for stable tie-breaking.
 */
export function sortThreatLogEntries(entries: readonly ThreatLogEntry[]): ThreatLogEntry[] {
  return [...entries].sort((left, right) => {
    const timestampDelta =
      parseThreatTimestamp(right.occurredAt) - parseThreatTimestamp(left.occurredAt);
    if (timestampDelta !== 0) {
      return timestampDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

/**
 * Returns whether any dashboard filter differs from the default state.
 */
export function hasActiveThreatDashboardFilters(
  filters: ThreatDashboardFilterState,
): boolean {
  return (
    filters.layer !== "all" ||
    filters.severity !== "all" ||
    filters.decision !== "all" ||
    filters.timeWindow !== "all" ||
    filters.sourceSurface !== "all"
  );
}

/**
 * Resolves the window start time for the provided time window.
 */
export function resolveThreatWindowStart(
  timeWindow: ThreatTimeWindow,
  referenceTime: string | null,
): number | null {
  const referenceTimestamp = parseThreatTimestamp(referenceTime);
  if (referenceTimestamp === 0) {
    return null;
  }

  if (timeWindow === "all") {
    return null;
  }

  const hours = timeWindow === "24h" ? 24 : timeWindow === "7d" ? 24 * 7 : 24 * 30;
  return referenceTimestamp - hours * 60 * 60 * 1000;
}

/**
 * Filters threat entries using immutable dashboard filters and a fixed reference time.
 */
export function filterThreatLogEntries(
  entries: readonly ThreatLogEntry[],
  filters: ThreatDashboardFilterState,
  referenceTime: string | null,
): ThreatLogEntry[] {
  const windowStart = resolveThreatWindowStart(filters.timeWindow, referenceTime);

  return entries.filter((entry) => {
    if (filters.layer !== "all" && entry.layer !== filters.layer) {
      return false;
    }

    if (filters.severity !== "all" && entry.severity !== filters.severity) {
      return false;
    }

    if (filters.decision !== "all" && entry.decision !== filters.decision) {
      return false;
    }

    if (filters.sourceSurface !== "all" && entry.sourceSurface !== filters.sourceSurface) {
      return false;
    }

    if (windowStart != null && parseThreatTimestamp(entry.occurredAt) < windowStart) {
      return false;
    }

    return true;
  });
}

/**
 * Counts how many entries fall inside the last 24 hours using a fixed reference time.
 */
export function computeThreatsLast24Hours(
  entries: readonly ThreatLogEntry[],
  referenceTime: string | null,
): number {
  const windowStart = resolveThreatWindowStart("24h", referenceTime);
  if (windowStart == null) {
    return 0;
  }

  let count = 0;
  for (const entry of entries) {
    if (parseThreatTimestamp(entry.occurredAt) >= windowStart) {
      count += 1;
    }
  }

  return count;
}

/**
 * Aggregates entries by ClickShield protection layer.
 */
export function computeLayerBreakdown(
  entries: readonly ThreatLogEntry[],
): Record<ThreatLayer, number> {
  const breakdown: Record<ThreatLayer, number> = { ...EMPTY_LAYER_BREAKDOWN };
  for (const entry of entries) {
    breakdown[entry.layer] += 1;
  }

  return breakdown;
}

/**
 * Aggregates entries by severity.
 */
export function computeSeverityBreakdown(
  entries: readonly ThreatLogEntry[],
): Record<ThreatSeverity, number> {
  const breakdown: Record<ThreatSeverity, number> = { ...EMPTY_SEVERITY_BREAKDOWN };
  for (const entry of entries) {
    breakdown[entry.severity] += 1;
  }

  return breakdown;
}

/**
 * Aggregates entries by decision.
 */
export function computeDecisionBreakdown(
  entries: readonly ThreatLogEntry[],
): Record<ThreatDecision, number> {
  const breakdown: Record<ThreatDecision, number> = { ...EMPTY_DECISION_BREAKDOWN };
  for (const entry of entries) {
    breakdown[entry.decision] += 1;
  }

  return breakdown;
}

/**
 * Aggregates entries by source surface.
 */
export function computeSourceSurfaceBreakdown(
  entries: readonly ThreatLogEntry[],
): Record<ThreatSourceSurface, number> {
  const breakdown: Record<ThreatSourceSurface, number> = {
    ...EMPTY_SOURCE_SURFACE_BREAKDOWN,
  };
  for (const entry of entries) {
    breakdown[entry.sourceSurface] += 1;
  }

  return breakdown;
}

/**
 * Aggregates entries by event kind.
 */
export function computeEventKindBreakdown(
  entries: readonly ThreatLogEntry[],
): Record<ThreatEventKind, number> {
  const breakdown: Record<ThreatEventKind, number> = {
    ...EMPTY_EVENT_KIND_BREAKDOWN,
  };
  for (const entry of entries) {
    breakdown[entry.eventKind] += 1;
  }

  return breakdown;
}

function toTitleLabel(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function filterHiddenThreatEntries(
  entries: readonly ThreatLogEntry[],
  hiddenEntryIds: readonly string[],
): readonly ThreatLogEntry[] {
  if (hiddenEntryIds.length === 0) {
    return entries;
  }

  const hidden = new Set(hiddenEntryIds);
  return entries.filter(
    (entry) =>
      !hidden.has(entry.id) &&
      !(entry.reportId && hidden.has(entry.reportId)) &&
      !(entry.sourceRef && hidden.has(entry.sourceRef)),
  );
}

/**
 * Builds the normalized dashboard summary strip and support-card metrics.
 */
export function buildThreatDashboardSummary(params: {
  readonly activityEntries: readonly ThreatLogEntry[];
  readonly threatLog: ThreatLogState;
  readonly referenceTime: string | null;
}): ThreatDashboardSummary {
  let entriesWithUnknownTruth = 0;
  let scansRun = 0;

  for (const entry of params.activityEntries) {
    if (entry.statusTruth !== "available" && entry.statusTruth !== "loaded") {
      entriesWithUnknownTruth += 1;
    }
    if (entry.eventKind === "scan_result") {
      scansRun += 1;
    }
  }

  const decisionBreakdown = computeDecisionBreakdown(params.activityEntries);

  return {
    totalEntries: params.threatLog.entries.length,
    activityEntries: params.activityEntries.length,
    statusEntries: params.threatLog.entries.length - params.activityEntries.length,
    threatsLast24Hours: computeThreatsLast24Hours(
      params.activityEntries,
      params.referenceTime,
    ),
    scansRun,
    lastRefresh: params.threatLog.lastUpdatedAt,
    layerBreakdown: computeLayerBreakdown(params.activityEntries),
    severityBreakdown: computeSeverityBreakdown(params.activityEntries),
    decisionBreakdown,
    sourceSurfaceBreakdown: computeSourceSurfaceBreakdown(params.activityEntries),
    eventKindBreakdown: computeEventKindBreakdown(params.threatLog.entries),
    actionBreakdown: {
      allowed: decisionBreakdown.allowed,
      warned: decisionBreakdown.warned,
      blocked: decisionBreakdown.blocked,
    },
    entriesWithUnknownTruth,
  };
}

/**
 * Returns the selected details view model for the current threat entry id.
 */
export function selectThreatDetailsViewModel(
  entries: readonly ThreatLogEntry[],
  selectedEntryId: string | null,
): ThreatDetailsViewModel | null {
  if (!selectedEntryId) {
    return null;
  }

  const entry = entries.find((candidate) => candidate.id === selectedEntryId);
  if (!entry) {
    return null;
  }

  return {
    id: entry.id,
    occurredAt: entry.occurredAt,
    occurredAtLabel: formatThreatTimestamp(entry.occurredAt),
    eventKind: entry.eventKind,
    eventKindLabel: toTitleLabel(entry.eventKind),
    layer: entry.layer,
    layerLabel:
      entry.layer === "layer1"
        ? "Layer 1"
        : entry.layer === "layer3"
        ? "Layer 3"
        : entry.layer === "layer4"
        ? "Layer 4"
        : "Unknown layer",
    decision: entry.decision,
    decisionLabel: toTitleLabel(entry.decision),
    severity: entry.severity,
    severityLabel: toTitleLabel(entry.severity),
    surface: entry.surface,
    surfaceLabel: toTitleLabel(entry.surface),
    sourceSurface: entry.sourceSurface,
    sourceSurfaceLabel: toTitleLabel(entry.sourceSurface),
    title: entry.title,
    summary: entry.summary,
    reasonCodes: entry.reasonCodes,
    evidencePreview: entry.evidencePreview,
    targetLabel: entry.targetLabel,
    reportId: entry.reportId,
    statusTruth: entry.statusTruth,
    statusTruthLabel: toTitleLabel(entry.statusTruth),
    sourceRef: entry.sourceRef,
    truthGaps: entry.truthGaps,
  };
}

/**
 * Resolves the effective selected entry id without mutating caller state.
 */
export function resolveSelectedThreatEntryId(
  entries: readonly ThreatLogEntry[],
  selectedEntryId: string | null,
): string | null {
  if (entries.length === 0) {
    return null;
  }

  if (selectedEntryId && entries.some((entry) => entry.id === selectedEntryId)) {
    return selectedEntryId;
  }

  return entries[0].id;
}

/**
 * Builds premium empty-state labels for feed and details shells.
 */
export function buildThreatDashboardEmptyState(params: {
  readonly isLoading: boolean;
  readonly hasEntries: boolean;
  readonly hasFilteredEntries: boolean;
}): ThreatDashboardEmptyStateLabels {
  if (params.isLoading) {
    return {
      title: "Loading dashboard activity",
      description: "ClickShield is loading the latest observed scan and threat activity.",
    };
  }

  if (!params.hasEntries) {
    return {
      title: "No threat activity yet",
      description: "Observed scans and reports will appear here once desktop activity is loaded.",
    };
  }

  if (!params.hasFilteredEntries) {
    return {
      title: "No results for these filters",
      description: "Try widening the window or clearing a filter to review more observed activity.",
    };
  }

  return {
    title: "No detail selected",
    description: "Choose an entry from the feed to review its reason codes and evidence summary.",
  };
}

/**
 * Builds the derived dashboard state used by App.tsx.
 */
export function buildThreatDashboardViewModel(params: {
  readonly threatLog: ThreatLogState;
  readonly filters: ThreatDashboardFilterState;
  readonly hiddenEntryIds: readonly string[];
  readonly selectedEntryId: string | null;
  readonly referenceTime: string | null;
  readonly isLoading: boolean;
}): ThreatDashboardViewModel {
  const activityEntries = selectThreatActivityEntries(params.threatLog.entries);
  const visibleEntries = sortThreatLogEntries(
    filterHiddenThreatEntries(activityEntries, params.hiddenEntryIds),
  );
  const recentEntries = sliceThreatLogEntries(visibleEntries, visibleEntries.length);
  const effectiveReferenceTime =
    params.referenceTime ?? params.threatLog.lastUpdatedAt ?? recentEntries[0]?.occurredAt ?? null;
  const filteredEntries = filterThreatLogEntries(
    recentEntries,
    params.filters,
    effectiveReferenceTime,
  );
  const summary = buildThreatDashboardSummary({
    activityEntries: recentEntries,
    threatLog: params.threatLog,
    referenceTime: effectiveReferenceTime,
  });
  const selectedEntryId = resolveSelectedThreatEntryId(
    filteredEntries,
    params.selectedEntryId,
  );
  const feedEmptyState = buildThreatDashboardEmptyState({
    isLoading: params.isLoading,
    hasEntries: recentEntries.length > 0,
    hasFilteredEntries: filteredEntries.length > 0,
  });
  const detailsEmptyState =
    filteredEntries.length === 0
      ? feedEmptyState
      : buildThreatDashboardEmptyState({
          isLoading: false,
          hasEntries: true,
          hasFilteredEntries: true,
        });

  return {
    threatLog: params.threatLog,
    entries: recentEntries,
    filteredEntries,
    summary,
    selectedEntryId,
    selectedDetails: selectThreatDetailsViewModel(filteredEntries, selectedEntryId),
    feedEmptyState,
    detailsEmptyState,
  };
}
