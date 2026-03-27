import type { ThreatLogEntry } from "../types";
import { formatThreatTimestamp } from "../selectors";

interface ThreatFeedItemProps {
  readonly entry: ThreatLogEntry;
  readonly isSelected: boolean;
  readonly onSelect: (entryId: string) => void;
}

function layerBadgeClass(layer: ThreatLogEntry["layer"]): string {
  if (layer === "layer1") {
    return "border-sky-500/40 bg-sky-500/10 text-sky-200";
  }
  if (layer === "layer3") {
    return "border-violet-500/40 bg-violet-500/10 text-violet-200";
  }
  if (layer === "layer4") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  }
  return "border-slate-600 bg-slate-900/80 text-slate-200";
}

function decisionBadgeClass(decision: ThreatLogEntry["decision"]): string {
  if (decision === "blocked") {
    return "border-red-500/40 bg-red-500/10 text-red-200";
  }
  if (decision === "warned") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  }
  if (decision === "allowed") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  }
  if (decision === "reported") {
    return "border-red-500/40 bg-red-500/10 text-red-200";
  }
  if (decision === "reviewed") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  }
  if (decision === "degraded") {
    return "border-slate-500/40 bg-slate-500/10 text-slate-200";
  }
  if (decision === "unknown") {
    return "border-slate-600 bg-slate-900/80 text-slate-200";
  }
  return "border-slate-600 bg-slate-800/70 text-slate-200";
}

function severityAccentClass(severity: ThreatLogEntry["severity"]): string {
  if (severity === "critical") {
    return "bg-red-400";
  }
  if (severity === "high") {
    return "bg-orange-400";
  }
  if (severity === "medium") {
    return "bg-amber-300";
  }
  if (severity === "low") {
    return "bg-emerald-400";
  }
  return "bg-slate-500";
}

function sourceSurfaceBadgeClass(sourceSurface: ThreatLogEntry["sourceSurface"]): string {
  if (sourceSurface === "desktop") {
    return "border-sky-500/40 bg-sky-500/10 text-sky-200";
  }
  if (sourceSurface === "extension") {
    return "border-violet-500/40 bg-violet-500/10 text-violet-200";
  }
  if (sourceSurface === "mobile") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  }
  if (sourceSurface === "manual_scan") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  }
  return "border-slate-600 bg-slate-900/80 text-slate-200";
}

function titleLabel(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function ThreatFeedItem({ entry, isSelected, onSelect }: ThreatFeedItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.id)}
      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
        isSelected
          ? "border-sky-500/40 bg-slate-900/90"
          : "border-slate-800 bg-slate-950/40 hover:bg-slate-900/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
            <span
              className={`inline-flex rounded-full border px-2 py-1 ${layerBadgeClass(entry.layer)}`}
            >
              {entry.layer === "unknown" ? "Unknown layer" : titleLabel(entry.layer)}
            </span>
            <span
              className={`inline-flex rounded-full border px-2 py-1 ${decisionBadgeClass(entry.decision)}`}
            >
              {entry.decision === "unknown" ? "Unknown decision" : titleLabel(entry.decision)}
            </span>
            <span
              className={`inline-flex rounded-full border px-2 py-1 ${sourceSurfaceBadgeClass(entry.sourceSurface)}`}
            >
              {entry.sourceSurface === "unknown"
                ? "Unknown source"
                : titleLabel(entry.sourceSurface)}
            </span>
            <span className="inline-flex items-center gap-2 text-slate-400">
              <span className={`h-2 w-2 rounded-full ${severityAccentClass(entry.severity)}`} />
              {entry.severity === "unknown" ? "Unknown severity" : titleLabel(entry.severity)}
            </span>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-100">{entry.title}</div>
            <div className="mt-1 text-xs leading-5 text-slate-400">{entry.summary}</div>
          </div>
          {entry.targetLabel ? (
            <div className="text-[11px] font-mono text-slate-500 truncate">{entry.targetLabel}</div>
          ) : null}
        </div>
        <div className="shrink-0 text-[11px] text-slate-500">
          {formatThreatTimestamp(entry.occurredAt)}
        </div>
      </div>
    </button>
  );
}
