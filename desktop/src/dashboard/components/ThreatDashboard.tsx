import type {
  ThreatDashboardEmptyStateLabels,
  ThreatDashboardFilterState,
  ThreatDashboardSummary,
  ThreatDetailsViewModel,
  ThreatFailSafeState,
  ThreatLogEntry,
  ThreatProviderState,
  ThreatSystemStatus,
  ThreatTruthState,
} from "../types";
import { formatThreatTimestamp, hasActiveThreatDashboardFilters } from "../selectors";
import { ThreatDashboardCard } from "./ThreatDashboardCard";
import { ThreatFeedItem } from "./ThreatFeedItem";

interface ThreatDashboardProps {
  readonly entries: readonly ThreatLogEntry[];
  readonly filteredEntries: readonly ThreatLogEntry[];
  readonly filters: ThreatDashboardFilterState;
  readonly summary: ThreatDashboardSummary;
  readonly systemStatus: ThreatSystemStatus;
  readonly selectedEntryId: string | null;
  readonly selectedDetails: ThreatDetailsViewModel | null;
  readonly isLoading: boolean;
  readonly feedEmptyState: ThreatDashboardEmptyStateLabels;
  readonly detailsEmptyState: ThreatDashboardEmptyStateLabels;
  readonly onFiltersChange: (nextState: ThreatDashboardFilterState) => void;
  readonly onSelectEntry: (entryId: string) => void;
  readonly onClearFilters: () => void;
  readonly onPinSelected?: () => void;
  readonly onHideSelected?: () => void;
  readonly onRescanSelected?: () => void;
}

function statusToneClass(
  tone: "neutral" | "info" | "success" | "warning" | "danger",
): string {
  if (tone === "success") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  }
  if (tone === "warning") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  }
  if (tone === "danger") {
    return "border-red-500/40 bg-red-500/10 text-red-200";
  }
  if (tone === "info") {
    return "border-sky-500/40 bg-sky-500/10 text-sky-200";
  }
  return "border-slate-700 bg-slate-900/70 text-slate-200";
}

function truthToneClass(state: ThreatTruthState): "neutral" | "info" | "success" | "warning" | "danger" {
  if (state === "loaded" || state === "available") {
    return "success";
  }
  if (state === "loading") {
    return "info";
  }
  if (state === "partial" || state === "stale" || state === "degraded") {
    return "warning";
  }
  if (state === "unavailable") {
    return "danger";
  }
  return "neutral";
}

function providerToneClass(state: ThreatProviderState): "neutral" | "info" | "success" | "warning" | "danger" {
  if (state === "rule-plus-ai") {
    return "info";
  }
  if (state === "rule-only") {
    return "neutral";
  }
  if (state === "partial" || state === "degraded") {
    return "warning";
  }
  if (state === "unavailable") {
    return "danger";
  }
  if (state === "loading") {
    return "info";
  }
  return "neutral";
}

function failSafeToneClass(state: ThreatFailSafeState): "neutral" | "info" | "success" | "warning" | "danger" {
  if (state === "active") {
    return "success";
  }
  if (state === "inactive") {
    return "neutral";
  }
  if (state === "partial" || state === "degraded") {
    return "warning";
  }
  if (state === "unavailable") {
    return "danger";
  }
  return "neutral";
}

function labelize(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function renderMetricValue(value: string | number | null): string {
  if (value == null || value === "") {
    return "Unavailable";
  }
  return String(value);
}

function DashboardEmptyState({
  title,
  description,
}: ThreatDashboardEmptyStateLabels) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/30 px-4 py-5">
      <div className="text-sm font-medium text-slate-100">{title}</div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{description}</p>
    </div>
  );
}

function DashboardLoadingState() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="rounded-xl border border-slate-800 bg-slate-950/30 px-4 py-4"
        >
          <div className="h-3 w-28 rounded bg-slate-800" />
          <div className="mt-3 h-4 w-3/4 rounded bg-slate-800" />
          <div className="mt-2 h-3 w-full rounded bg-slate-900" />
        </div>
      ))}
    </div>
  );
}

function DashboardTruthBanner({ systemStatus }: { readonly systemStatus: ThreatSystemStatus }) {
  if (
    systemStatus.dashboardTruthState === "available" ||
    systemStatus.dashboardTruthState === "loaded"
  ) {
    return null;
  }

  return (
    <div className={`rounded-xl border px-4 py-3 ${statusToneClass(truthToneClass(systemStatus.dashboardTruthState))}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wide">
            Dashboard truth {labelize(systemStatus.dashboardTruthState)}
          </div>
          <p className="text-xs leading-5">{systemStatus.truthSummary}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {systemStatus.truthSignals.map((signal) => (
            <span key={signal} className="rounded-full border border-current/20 px-2 py-1">
              {signal}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterSelect(props: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
}) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{props.label}</span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusStrip({
  summary,
  systemStatus,
}: {
  readonly summary: ThreatDashboardSummary;
  readonly systemStatus: ThreatSystemStatus;
}) {
  const intelTone =
    truthToneClass(systemStatus.intelState);
  const dashboardTone = truthToneClass(systemStatus.dashboardTruthState);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
      <div className="rounded-xl border border-slate-800 bg-slate-950/45 px-4 py-3">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">Navigation Intel</div>
        <div className={`mt-2 inline-flex rounded-full border px-2 py-1 text-xs ${statusToneClass(intelTone)}`}>
          {labelize(systemStatus.intelState)}
        </div>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/45 px-4 py-3">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">Snapshot Version</div>
        <div className="mt-2 text-sm font-medium text-slate-100">
          {renderMetricValue(systemStatus.snapshotVersion)}
        </div>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/45 px-4 py-3">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">Last Refresh</div>
        <div className="mt-2 text-sm font-medium text-slate-100">
          {systemStatus.lastRefresh ? formatThreatTimestamp(systemStatus.lastRefresh) : "Unavailable"}
        </div>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/45 px-4 py-3">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">Threats Last 24h</div>
        <div className="mt-2 text-sm font-medium text-slate-100">{summary.threatsLast24Hours}</div>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/45 px-4 py-3">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">Dashboard Truth</div>
        <div className="mt-2 flex items-center justify-between">
          <div className="text-sm font-medium text-slate-100">{summary.scansRun} scans</div>
          <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] ${statusToneClass(dashboardTone)}`}>
            {labelize(systemStatus.dashboardTruthState)}
          </span>
        </div>
      </div>
    </div>
  );
}

function FeedPanel(props: {
  readonly entries: readonly ThreatLogEntry[];
  readonly selectedEntryId: string | null;
  readonly isLoading: boolean;
  readonly emptyState: ThreatDashboardEmptyStateLabels;
  readonly onSelectEntry: (entryId: string) => void;
}) {
  return (
    <ThreatDashboardCard
      title="Recent Threat Activity"
      subtitle="Deterministic activity feed derived from the normalized desktop threat log."
    >
      {props.isLoading && props.entries.length === 0 ? (
        <DashboardLoadingState />
      ) : props.entries.length === 0 ? (
        <DashboardEmptyState {...props.emptyState} />
      ) : (
        <div className="space-y-3">
          {props.entries.map((entry) => (
            <ThreatFeedItem
              key={entry.id}
              entry={entry}
              isSelected={entry.id === props.selectedEntryId}
              onSelect={props.onSelectEntry}
            />
          ))}
        </div>
      )}
    </ThreatDashboardCard>
  );
}

function DetailsPanel(props: {
  readonly details: ThreatDetailsViewModel | null;
  readonly emptyState: ThreatDashboardEmptyStateLabels;
  readonly onPinSelected?: () => void;
  readonly onHideSelected?: () => void;
  readonly onRescanSelected?: () => void;
}) {
  return (
    <ThreatDashboardCard
      title="Threat Details"
      subtitle="Readable evidence and reason codes for the currently selected activity."
      actions={
        props.details ? (
          <>
            {props.onRescanSelected ? (
              <button
                type="button"
                onClick={props.onRescanSelected}
                className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
              >
                Rescan
              </button>
            ) : null}
            {props.onPinSelected ? (
              <button
                type="button"
                onClick={props.onPinSelected}
                className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
              >
                Pin
              </button>
            ) : null}
            {props.onHideSelected ? (
              <button
                type="button"
                onClick={props.onHideSelected}
                className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
              >
                Hide
              </button>
            ) : null}
          </>
        ) : null
      }
    >
      {!props.details ? (
        <DashboardEmptyState {...props.emptyState} />
      ) : (
        <div className="space-y-4 text-xs">
          {props.details.truthGaps.length > 0 ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-amber-100">
              <div className="text-[11px] uppercase tracking-wide">Truth gaps</div>
              <div className="mt-2 space-y-1 text-xs">
                {props.details.truthGaps.map((truthGap) => (
                  <div key={truthGap}>{truthGap}</div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200">
                {props.details.eventKindLabel}
              </span>
              <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-[11px] text-sky-200">
                {props.details.layerLabel}
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200">
                {props.details.decisionLabel}
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200">
                {props.details.severityLabel}
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200">
                {props.details.sourceSurfaceLabel}
              </span>
            </div>
            <div className="text-sm font-medium text-slate-100">{props.details.title}</div>
            <div className="leading-5 text-slate-400">{props.details.summary}</div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Observed</div>
              <div className="mt-2 text-slate-100">{props.details.occurredAtLabel}</div>
              <div className="mt-1 text-slate-400">
                Source: {props.details.sourceSurfaceLabel}
              </div>
              <div className="mt-1 text-slate-500">
                Target: {props.details.surfaceLabel}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Related Report</div>
              <div className="mt-2 font-mono text-[11px] text-slate-100 break-all">
                {props.details.reportId ?? "Unavailable"}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Target</div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3 font-mono text-[11px] text-slate-100 break-all">
              {props.details.targetLabel ?? "No target label recorded"}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Status Truth</div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-100">{props.details.statusTruthLabel}</div>
                <div className="font-mono text-[11px] text-slate-500 break-all">
                  {props.details.sourceRef ?? "Unavailable"}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Reason Codes</div>
            {props.details.reasonCodes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {props.details.reasonCodes.map((code) => (
                  <span
                    key={code}
                    className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-200"
                  >
                    {code}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-slate-500">No reason codes were recorded for this item.</div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Evidence Preview</div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3">
              {props.details.evidencePreview.length > 0 ? (
                <ul className="space-y-2 text-slate-300">
                  {props.details.evidencePreview.map((evidence) => (
                    <li key={evidence}>{evidence}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-slate-500">No evidence preview is available for this item.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </ThreatDashboardCard>
  );
}

function SystemStatusPanel({ systemStatus }: { readonly systemStatus: ThreatSystemStatus }) {
  const intelTone = truthToneClass(systemStatus.intelState);
  const providerTone = providerToneClass(systemStatus.providerState);
  const failSafeTone = failSafeToneClass(systemStatus.failSafeState);
  const dataTone = truthToneClass(systemStatus.dataTruthState);
  const dashboardTone = truthToneClass(systemStatus.dashboardTruthState);

  return (
    <ThreatDashboardCard
      title="System Status"
      subtitle="Current intel, provider, and fallback posture for the desktop visibility layer."
      actions={
        <span className={`rounded-full border px-2 py-1 text-[11px] ${statusToneClass(dashboardTone)}`}>
          {labelize(systemStatus.dashboardTruthState)}
        </span>
      }
    >
      <div className="space-y-3 text-xs">
        <div className="rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Truth summary</div>
          <div className="mt-2 text-slate-100">{systemStatus.truthSummary}</div>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3">
          <span className="text-slate-400">Data state</span>
          <span className={`rounded-full border px-2 py-1 ${statusToneClass(dataTone)}`}>
            {labelize(systemStatus.dataTruthState)}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3">
          <span className="text-slate-400">Intel</span>
          <span className={`rounded-full border px-2 py-1 ${statusToneClass(intelTone)}`}>
            {labelize(systemStatus.intelState)}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3">
          <span className="text-slate-400">Snapshot version</span>
          <span className="font-mono text-[11px] text-slate-100">
            {renderMetricValue(systemStatus.snapshotVersion)}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3">
          <span className="text-slate-400">Last refresh</span>
          <span className="text-slate-100">
            {systemStatus.lastRefresh ? formatThreatTimestamp(systemStatus.lastRefresh) : "Unavailable"}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3">
          <span className="text-slate-400">Provider state</span>
          <span className={`rounded-full border px-2 py-1 ${statusToneClass(providerTone)}`}>
            {labelize(systemStatus.providerState)}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3">
          <span className="text-slate-400">Fail-safe mode</span>
          <span className={`rounded-full border px-2 py-1 ${statusToneClass(failSafeTone)}`}>
            {labelize(systemStatus.failSafeState)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Shield mode</div>
            <div className="mt-2 text-slate-100">{labelize(systemStatus.shieldMode)}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Database</div>
            <div className="mt-2 text-slate-100">{labelize(systemStatus.databaseState)}</div>
          </div>
        </div>
        {systemStatus.truthSignals.length > 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Observed constraints</div>
            <div className="mt-2 space-y-2 text-slate-300">
              {systemStatus.truthSignals.map((signal) => (
                <div key={signal}>{signal}</div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </ThreatDashboardCard>
  );
}

function LayerBreakdownPanel({ summary }: { readonly summary: ThreatDashboardSummary }) {
  const rows: Array<{ readonly label: string; readonly value: number }> = [
    { label: "Layer 1", value: summary.layerBreakdown.layer1 },
    { label: "Layer 3", value: summary.layerBreakdown.layer3 },
    { label: "Layer 4", value: summary.layerBreakdown.layer4 },
    { label: "Unknown", value: summary.layerBreakdown.unknown },
  ];

  return (
    <ThreatDashboardCard
      title="Layer Breakdown"
      subtitle="Activity remains separated by navigation, transaction, and scan/report layers."
    >
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3 text-xs"
          >
            <span className="text-slate-400">{row.label}</span>
            <span className="text-slate-100">{row.value}</span>
          </div>
        ))}
      </div>
    </ThreatDashboardCard>
  );
}

function RecentScanSummaryPanel({ summary }: { readonly summary: ThreatDashboardSummary }) {
  return (
    <ThreatDashboardCard
      title="Threat Log Summary"
      subtitle="Counts are computed from the normalized desktop threat log."
    >
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Blocked</div>
          <div className="mt-2 text-lg font-medium text-slate-100">
            {summary.actionBreakdown.blocked}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Warned</div>
          <div className="mt-2 text-lg font-medium text-slate-100">
            {summary.actionBreakdown.warned}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Allowed</div>
          <div className="mt-2 text-lg font-medium text-slate-100">
            {summary.actionBreakdown.allowed}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Unknown truth</div>
          <div className="mt-2 text-lg font-medium text-slate-100">
            {summary.entriesWithUnknownTruth}
          </div>
        </div>
      </div>
    </ThreatDashboardCard>
  );
}

export function ThreatDashboard({
  entries,
  filteredEntries,
  filters,
  summary,
  systemStatus,
  selectedEntryId,
  selectedDetails,
  isLoading,
  feedEmptyState,
  detailsEmptyState,
  onFiltersChange,
  onSelectEntry,
  onClearFilters,
  onPinSelected,
  onHideSelected,
  onRescanSelected,
}: ThreatDashboardProps) {
  const filtersActive = hasActiveThreatDashboardFilters(filters);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold tracking-tight text-slate-100">Threat Dashboard</h2>
        <p className="text-xs text-slate-400">
          Premium visibility shell for observed navigation, transaction, and scan activity.
        </p>
      </div>

      <div className="mt-4">
        <DashboardTruthBanner systemStatus={systemStatus} />
      </div>

      <div className="mt-4">
        <StatusStrip summary={summary} systemStatus={systemStatus} />
      </div>

      <div className="mt-4">
        <ThreatDashboardCard
          title="Filter Activity"
          subtitle="Refine the feed by layer, severity, decision, window, and source surface."
          actions={
            filtersActive ? (
              <button
                type="button"
                onClick={onClearFilters}
                className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
              >
                Clear filters
              </button>
            ) : null
          }
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <FilterSelect
              label="Layer"
              value={filters.layer}
              onChange={(layer) =>
                onFiltersChange({ ...filters, layer: layer as ThreatDashboardFilterState["layer"] })
              }
              options={[
                { value: "all", label: "All layers" },
                { value: "layer1", label: "Layer 1" },
                { value: "layer3", label: "Layer 3" },
                { value: "layer4", label: "Layer 4" },
                { value: "unknown", label: "Unknown" },
              ]}
            />
            <FilterSelect
              label="Severity"
              value={filters.severity}
              onChange={(severity) =>
                onFiltersChange({
                  ...filters,
                  severity: severity as ThreatDashboardFilterState["severity"],
                })
              }
              options={[
                { value: "all", label: "All severities" },
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
                { value: "critical", label: "Critical" },
                { value: "unknown", label: "Unknown" },
              ]}
            />
            <FilterSelect
              label="Decision"
              value={filters.decision}
              onChange={(decision) =>
                onFiltersChange({
                  ...filters,
                  decision: decision as ThreatDashboardFilterState["decision"],
                })
              }
              options={[
                { value: "all", label: "All decisions" },
                { value: "blocked", label: "Blocked" },
                { value: "warned", label: "Warned" },
                { value: "allowed", label: "Allowed" },
                { value: "observed", label: "Observed" },
                { value: "reviewed", label: "Reviewed" },
                { value: "reported", label: "Reported" },
                { value: "degraded", label: "Degraded" },
                { value: "unknown", label: "Unknown" },
              ]}
            />
            <FilterSelect
              label="Window"
              value={filters.timeWindow}
              onChange={(timeWindow) =>
                onFiltersChange({
                  ...filters,
                  timeWindow: timeWindow as ThreatDashboardFilterState["timeWindow"],
                })
              }
              options={[
                { value: "24h", label: "Last 24h" },
                { value: "7d", label: "Last 7d" },
                { value: "30d", label: "Last 30d" },
                { value: "all", label: "All loaded" },
              ]}
            />
            <FilterSelect
              label="Source"
              value={filters.sourceSurface}
              onChange={(sourceSurface) =>
                onFiltersChange({
                  ...filters,
                  sourceSurface:
                    sourceSurface as ThreatDashboardFilterState["sourceSurface"],
                })
              }
              options={[
                { value: "all", label: "All sources" },
                { value: "desktop", label: "Desktop" },
                { value: "extension", label: "Extension" },
                { value: "mobile", label: "Mobile" },
                { value: "manual_scan", label: "Manual Scan" },
                { value: "unknown", label: "Unknown" },
              ]}
            />
          </div>
        </ThreatDashboardCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <FeedPanel
          entries={filteredEntries}
          selectedEntryId={selectedEntryId}
          isLoading={isLoading}
          emptyState={feedEmptyState}
          onSelectEntry={onSelectEntry}
        />
        <div className="space-y-4">
          <DetailsPanel
            details={selectedDetails}
            emptyState={detailsEmptyState}
            onPinSelected={onPinSelected}
            onHideSelected={onHideSelected}
            onRescanSelected={onRescanSelected}
          />
          <SystemStatusPanel systemStatus={systemStatus} />
          <LayerBreakdownPanel summary={summary} />
          <RecentScanSummaryPanel summary={summary} />
        </div>
      </div>

      {entries.length > 0 ? (
        <p className="mt-4 text-[11px] text-slate-500">
          Entries in the desktop threat log are ordered by observed timestamp, then id, for stable rendering.
        </p>
      ) : null}
    </section>
  );
}
