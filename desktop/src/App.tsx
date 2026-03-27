import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  buildThreatSystemStatus,
  parseBackendHealthSnapshot,
  parseEngineStatusSnapshot,
  parseNavigationManifestSnapshot,
} from "./dashboard/adapters";
import type {
  BackendHealthSnapshot,
  EngineStatusSnapshot,
  NavigationManifestSnapshot,
} from "./dashboard/adapters";
import { ThreatDashboard } from "./dashboard/components/ThreatDashboard";
import { buildThreatDashboardViewModel } from "./dashboard/selectors";
import {
  buildThreatLogState,
  createEmptyThreatLogState,
} from "./dashboard/threatLog";
import type {
  ThreatDashboardFilterState,
  ThreatLogState,
  ThreatTruthState,
} from "./dashboard/types";

// Prefer env override, fall back to localhost.
// Example: VITE_BACKEND_BASE=http://127.0.0.1:4000
const BACKEND_BASE =
  (import.meta as any)?.env?.VITE_BACKEND_BASE?.toString?.() || "http://127.0.0.1:4000";

/**
 * Desktop resilience goals covered in this file:
 * - Always show *something* even if backend /recent-scans fails (local cache fallback)
 * - Recover within 5 seconds from backend restore/offline/online transitions (fast polling + time-bounded retries)
 * - Restore the “rescan tray”, history, and risk metrics table from localStorage
 * - Be tolerant to backend schema drift (normalize scan entries)
 */

type HealthState = "unknown" | "ok" | "error";

type UrlScanResult = {
  url: string;
  riskLevel: string;
  riskScore: number;
  threatType: string;
  reason: string;
  shortAdvice: string;
  checkedAt: string;
  source: string;
  engine: string;
  id?: string;
  ai?: {
    aiNarrative: string;
    aiModel: string;
  };
};

type DocScanResult = {
  id: string;
  filename: string | null;
  mimeType: string | null;
  riskLevel: string;
  riskScore: number;
  threatType: string;
  reason: string;
  checkedAt: string;
  source: string;
  engine: string;
  ai?: {
    aiNarrative: string;
    aiModel: string;
  } | null;
  encryption?: any;
  context?: any;
};

type RecentScanEntry = {
  id: string;
  url: string; // "(document)" for docs
  riskLevel: string;
  riskScore: number;
  threatType: string;
  userEmail: string;
  userType: string;
  orgId: string | null;
  orgName: string | null;
  deviceId: string | null;
  checkedAt: string;
  source: string;
  engine: string;
  detectedBy?: string | null;
  detectedByType?: string | null;
  ruleName?: string | null;
  ruleReason?: string | null;
  shortAdvice?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  layer?: string | null;
  decision?: string | null;
  severity?: string | null;
  surface?: string | null;
};

type PersistedState = {
  v: 2;
  recentScans: RecentScanEntry[];
  hiddenIds: string[];
  // “rescan tray” = pinned/queued rescans (URLs only)
  rescanTray: {
    id: string;
    url: string;
    addedAt: string;
  }[];
  lastUpdatedAt: string;
};

const STORAGE_KEY = "clickshield.desktop.recentScans.v2";
const STORAGE_HIDDEN_KEY = "clickshield.desktop.hiddenIds.v2";
const STORAGE_RESCAN_TRAY_KEY = "clickshield.desktop.rescanTray.v2";

const STORAGE_SHIELD_MODE_KEY = "clickshield.desktop.shieldMode.v1";
const STORAGE_URL_CACHE_KEY = "clickshield.desktop.urlScanCache.v1";
const URL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const RETRY_BASE_MS = 600;
const RETRY_GROWTH_FACTOR = 1.6;
const RETRY_MAX_MS = 5000;
const RETRY_JITTER_RATIO = 0.15;
const FETCH_TIMEOUT_RECENT_MS = 3500;
const FETCH_TIMEOUT_HEALTH_MS = 2000;

const DEFAULT_THREAT_DASHBOARD_FILTERS: ThreatDashboardFilterState = {
  layer: "all",
  severity: "all",
  decision: "all",
  timeWindow: "24h",
  sourceSurface: "all",
};

type UrlScanCacheEntry = {
  url: string;
  value: UrlScanResult;
  cachedAt: string; // ISO
};

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function computeNextRetryDelayMs(attempt: number): number {
  const exponentialDelay = Math.min(
    RETRY_MAX_MS,
    Math.round(RETRY_BASE_MS * RETRY_GROWTH_FACTOR ** Math.max(0, attempt))
  );
  const jitterRange = exponentialDelay * RETRY_JITTER_RATIO;
  const jitteredDelay = exponentialDelay + (Math.random() * 2 - 1) * jitterRange;
  return Math.max(1, Math.min(RETRY_MAX_MS, Math.round(jitteredDelay)));
}

function clampRiskScore(n: any) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

function normalizeRiskLevel(input: any): string {
  const raw = typeof input === "string" ? input : "";
  const upper = raw.trim().toUpperCase();
  if (!upper) return "UNKNOWN";
  if (upper === "LOW") return "SAFE";
  if (upper === "MEDIUM") return "SUSPICIOUS";
  if (upper === "HIGH") return "DANGEROUS";
  return upper;
}

function normalizeThreatType(input: any): string {
  const raw = typeof input === "string" ? input : "";
  const t = raw.trim();
  return t || "unknown";
}

function normalizeCheckedAt(input: any): string {
  const raw = typeof input === "string" ? input : "";
  const d = new Date(raw);
  if (!raw) return nowIso();
  if (Number.isNaN(d.getTime())) return nowIso();
  return d.toISOString();
}

function readCachedUrlScan(url: string): UrlScanResult | null {
  try {
    const raw = localStorage.getItem(STORAGE_URL_CACHE_KEY);
    if (!raw) return null;
    const parsed = safeJsonParse<Record<string, UrlScanCacheEntry>>(raw);
    if (!parsed) return null;

    const key = (url || "").trim().toLowerCase();
    if (!key) return null;

    const hit = parsed[key];
    if (!hit || !hit.value) return null;

    const ts = new Date(hit.cachedAt).getTime();
    if (!Number.isFinite(ts)) return null;
    if (Date.now() - ts > URL_CACHE_TTL_MS) return null;

    return hit.value;
  } catch {
    return null;
  }
}

function writeCachedUrlScan(value: UrlScanResult) {
  try {
    if (!value?.url) return;

    const raw = localStorage.getItem(STORAGE_URL_CACHE_KEY);
    const parsed = safeJsonParse<Record<string, UrlScanCacheEntry>>(raw) || {};

    const key = value.url.trim().toLowerCase();
    parsed[key] = { url: value.url, value, cachedAt: nowIso() };

    // Keep cache bounded (most recent ~200)
    const entries = Object.entries(parsed)
      .map(([k, v]) => [k, v] as const)
      .sort((a, b) => {
        const ta = new Date(a[1].cachedAt).getTime();
        const tb = new Date(b[1].cachedAt).getTime();
        return tb - ta;
      })
      .slice(0, 200);

    const out: Record<string, UrlScanCacheEntry> = {};
    for (const [k, v] of entries) out[k] = v;

    localStorage.setItem(STORAGE_URL_CACHE_KEY, JSON.stringify(out));
  } catch {
    // fail calm
  }
}

function normalizeScanEntry(anyEntry: any): RecentScanEntry | null {
  if (!anyEntry || typeof anyEntry !== "object") return null;

  // unwrap common API envelope (matches mobile)
  const e =
    anyEntry && anyEntry.ok === true && anyEntry.scan && typeof anyEntry.scan === "object"
      ? anyEntry.scan
      : anyEntry;

  const id =
    (typeof e.id === "string" && e.id) ||
    (typeof e._id === "string" && e._id) ||
    `${normalizeCheckedAt(e.checkedAt)}:${String(e.url || e.target || "(unknown)")}`;

  const urlRaw =
    (typeof e.url === "string" && e.url) ||
    (typeof e.target === "string" && e.target) ||
    (typeof e.domain === "string" && e.domain) ||
    "(document)";

  const isDoc =
    urlRaw === "(document)" ||
    e.kind === "document" ||
    e.type === "document" ||
    e.mimeType ||
    e.filename;

  const url = isDoc ? "(document)" : urlRaw;

  return {
    id,
    url,
    riskLevel: normalizeRiskLevel(
      e.riskLevel ??
        e.risk ??
        e.verdict ??
        e.ruleRiskLevel ?? // ✅ mobile parity
        e.risk_level
    ),
    riskScore: clampRiskScore(
      e.riskScore ??
        e.score ??
        e.risk_score ??
        e.ruleScore ?? // ✅ mobile parity
        e.rule_score
    ),
    threatType: normalizeThreatType(
      e.threatType ??
        e.threat ??
        e.category ??
        e.ruleThreatCategory ?? // ✅ mobile parity
        e.threat_type
    ),
    userEmail: typeof e.userEmail === "string" ? e.userEmail : "unknown",
    userType: typeof e.userType === "string" ? e.userType : "consumer",
    orgId: typeof e.orgId === "string" ? e.orgId : null,
    orgName: typeof e.orgName === "string" ? e.orgName : null,
    deviceId: typeof e.deviceId === "string" ? e.deviceId : null,
    checkedAt: normalizeCheckedAt(e.checkedAt ?? e.createdAt ?? e.timestamp),
    source: typeof e.source === "string" ? e.source : "desktop",
    engine: typeof e.engine === "string" ? e.engine : "rules",
    detectedBy: typeof e.detectedBy === "string" ? e.detectedBy : null,
    detectedByType: typeof e.detectedByType === "string" ? e.detectedByType : null,
    ruleName: typeof e.ruleName === "string" ? e.ruleName : null,
    ruleReason: typeof e.ruleReason === "string" ? e.ruleReason : null,
    shortAdvice: typeof e.shortAdvice === "string" ? e.shortAdvice : null,
    filename: typeof e.filename === "string" ? e.filename : null,
    mimeType: typeof e.mimeType === "string" ? e.mimeType : null,
    layer: typeof e.layer === "string" ? e.layer : null,
    decision: typeof e.decision === "string" ? e.decision : null,
    severity: typeof e.severity === "string" ? e.severity : null,
    surface: typeof e.surface === "string" ? e.surface : null,
  };
}

function dedupeScansKeepNewest(entries: RecentScanEntry[]) {
  const byId = new Map<string, RecentScanEntry>();

  for (const e of entries) {
    if (!e || typeof e !== "object") continue;
    const id = typeof e.id === "string" ? e.id : "";
    if (!id) continue;

    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, e);
      continue;
    }

    const a = new Date(existing.checkedAt).getTime();
    const b = new Date(e.checkedAt).getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      byId.set(id, e);
      continue;
    }
    if (b >= a) byId.set(id, e);
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
  );
}

function normalizeUrlScanResult(raw: any): UrlScanResult {
  // unwrap: { ok: true, scan: {...} } or { result: {...} } or direct
  const base =
    raw && raw.ok === true && raw.scan && typeof raw.scan === "object"
      ? raw.scan
      : raw?.result ?? raw?.data ?? raw ?? {};

  const riskScore = clampRiskScore(
    base.riskScore ?? base.risk_score ?? base.score ?? base.ruleScore ?? base.rule_score
  );

  const riskLevel = normalizeRiskLevel(
    base.riskLevel ?? base.risk_level ?? base.risk ?? base.ruleRiskLevel ?? "UNKNOWN"
  );

  const threatType = String(
    base.threatType ?? base.threat_type ?? base.category ?? base.ruleThreatCategory ?? "UNKNOWN"
  );

  const reason = base.reason ?? base.details ?? base.ruleReason ?? "No reason provided.";

  const shortAdvice =
    base.shortAdvice ??
    base.short_advice ??
    base.advice ??
    (riskLevel === "SAFE"
      ? "Link appears low-risk, but always verify before connecting wallets or logging in."
      : "Treat this link as risky. Avoid connecting wallets or entering credentials.");

  return {
    url: String(base.url ?? ""),
    riskLevel,
    riskScore,
    threatType,
    reason: String(reason),
    shortAdvice: String(shortAdvice),
    checkedAt: String(base.checkedAt ?? base.checked_at ?? new Date().toISOString()),
    source: String(base.source ?? "desktop"),
    engine: String(base.engine ?? "rules"),
    id: typeof base.id === "string" ? base.id : typeof base._id === "string" ? base._id : undefined,
    ai: base.ai
      ? {
          aiNarrative: String(base.ai.aiNarrative ?? base.ai.ai_narrative ?? ""),
          aiModel: String(base.ai.aiModel ?? base.ai.ai_model ?? ""),
        }
      : undefined,
  };
}

function normalizeDocScanResult(raw: any): DocScanResult {
  const base =
    raw && raw.ok === true && raw.scan && typeof raw.scan === "object"
      ? raw.scan
      : raw?.result ?? raw?.data ?? raw ?? {};

  const riskScore = clampRiskScore(
    base.riskScore ?? base.risk_score ?? base.score ?? base.ruleScore ?? base.rule_score
  );

  const riskLevel = normalizeRiskLevel(
    base.riskLevel ?? base.risk_level ?? base.risk ?? base.ruleRiskLevel ?? "UNKNOWN"
  );

  const threatType = String(
    base.threatType ?? base.threat_type ?? base.category ?? base.ruleThreatCategory ?? "UNKNOWN"
  );

  const reason = base.reason ?? base.details ?? base.ruleReason ?? "No reason provided.";

  return {
    id: String(base.id ?? base._id ?? `${nowIso()}:doc`),
    filename: base.filename != null ? String(base.filename) : null,
    mimeType: base.mimeType != null ? String(base.mimeType) : null,
    riskLevel,
    riskScore,
    threatType,
    reason: String(reason),
    checkedAt: String(base.checkedAt ?? base.checked_at ?? new Date().toISOString()),
    source: String(base.source ?? "desktop"),
    engine: String(base.engine ?? "rules"),
    ai: base.ai
      ? {
          aiNarrative: String(base.ai.aiNarrative ?? base.ai.ai_narrative ?? ""),
          aiModel: String(base.ai.aiModel ?? base.ai.ai_model ?? ""),
        }
      : null,
    encryption: base.encryption,
    context: base.context,
  };
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function renderRiskPill(riskLevel?: string) {
  if (!riskLevel) return null;
  const upper = normalizeRiskLevel(riskLevel);

  let color = "bg-gray-700 text-gray-100";
  if (upper === "SAFE") color = "bg-emerald-600 text-emerald-50";
  else if (upper === "SUSPICIOUS") color = "bg-amber-600 text-amber-50";
  else if (upper === "DANGEROUS") color = "bg-red-700 text-red-50";
  else if (upper === "SENSITIVE") color = "bg-fuchsia-700 text-fuchsia-50";
  else if (upper === "UNKNOWN") color = "bg-slate-700 text-slate-200";

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
      {upper}
    </span>
  );
}

function renderAiNarrative(ai?: { aiNarrative?: string; aiModel?: string } | null) {
  if (!ai || !ai.aiNarrative) return null;
  const model = ai.aiModel || "gpt-4.1-mini";
  const narrative = ai.aiNarrative;

  return (
    <div className="mt-2 rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2 text-xs text-slate-100">
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-[11px] uppercase tracking-wide text-sky-400">AI Narrative</span>
        <span className="text-[10px] text-slate-400">{model}</span>
      </div>
      <p className="text-sm leading-snug">{narrative}</p>
    </div>
  );
}

function computeMetrics(scans: RecentScanEntry[]) {
  const total = scans.length;
  const by = {
    SAFE: 0,
    SUSPICIOUS: 0,
    DANGEROUS: 0,
    SENSITIVE: 0,
    UNKNOWN: 0,
  } as Record<string, number>;

  let sum = 0;
  let max = 0;

  for (const s of scans) {
    const rl = normalizeRiskLevel(s.riskLevel);
    by[rl] = (by[rl] || 0) + 1;
    const score = clampRiskScore(s.riskScore);
    sum += score;
    max = Math.max(max, score);
  }

  const avg = total > 0 ? Math.round((sum / total) * 10) / 10 : 0;

  const overall =
    by.DANGEROUS > 0
      ? "DANGEROUS"
      : by.SENSITIVE > 0
      ? "SENSITIVE"
      : by.SUSPICIOUS > 0
      ? "SUSPICIOUS"
      : by.SAFE > 0
      ? "SAFE"
      : "UNKNOWN";

  return { total, by, avg, max, overall };
}

const App: React.FC = () => {
  // ------------ Mount guard -------------
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ------------ Health -------------
  const [health, setHealth] = useState<HealthState>("unknown");
  const healthRef = useRef<HealthState>("unknown");
  useEffect(() => {
    healthRef.current = health;
  }, [health]);

  // =====================================================
  // Desktop restart (Tauri v2 preferred; calm fallback)
  // =====================================================
  async function restartDesktopAgent() {
    try {
      const pluginProcessModule = "@tauri-apps/plugin-process";
      const mod: any = await import(/* @vite-ignore */ pluginProcessModule);
      if (typeof mod?.relaunch === "function") {
        await mod.relaunch();
        return;
      }
    } catch {
      // ignore and fallback
    }

    try {
      window.location.reload();
    } catch {
      // fail calm
    }
  }

  // ------------ Quick URL scan -------------
  const [urlInput, setUrlInput] = useState("");
  const [urlScanLoading, setUrlScanLoading] = useState(false);
  const [urlScanResult, setUrlScanResult] = useState<UrlScanResult | null>(null);
  const [urlScanError, setUrlScanError] = useState<string | null>(null);

  // ------------ Doc scan (V2: PDF URL + true file upload) -------------
  const [docMode, setDocMode] = useState<"url" | "file">("url");

  const [docUrl, setDocUrl] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);

  const [docScanLoading, setDocScanLoading] = useState(false);
  const [docScanResult, setDocScanResult] = useState<DocScanResult | null>(null);
  const [docScanError, setDocScanError] = useState<string | null>(null);

  // ------------ Recent scans mini-dashboard -------------
  const [recentScans, setRecentScans] = useState<RecentScanEntry[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [dashboardFilters, setDashboardFilters] = useState<ThreatDashboardFilterState>(
    DEFAULT_THREAT_DASHBOARD_FILTERS
  );
  const [selectedThreatId, setSelectedThreatId] = useState<string | null>(null);
  const [backendHealthSnapshot, setBackendHealthSnapshot] = useState<BackendHealthSnapshot | null>(null);
  const [engineStatusSnapshot, setEngineStatusSnapshot] = useState<EngineStatusSnapshot | null>(null);
  const [navigationManifestSnapshot, setNavigationManifestSnapshot] =
    useState<NavigationManifestSnapshot | null>(null);
  const [dashboardStatusLoading, setDashboardStatusLoading] = useState(false);
  const [threatLogState, setThreatLogState] = useState<ThreatLogState>(() =>
    createEmptyThreatLogState()
  );

  // quick actions state
  const [rescanLoadingId, setRescanLoadingId] = useState<string | null>(null);

  // local “hide row” persistence
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const hiddenIdsRef = useRef<string[]>([]);
  useEffect(() => {
    hiddenIdsRef.current = hiddenIds;
  }, [hiddenIds]);

  // “rescan tray” persistence
  const [rescanTray, setRescanTray] = useState<{ id: string; url: string; addedAt: string }[]>([]);
  const rescanTrayRef = useRef<{ id: string; url: string; addedAt: string }[]>([]);
  useEffect(() => {
    rescanTrayRef.current = rescanTray;
  }, [rescanTray]);

  // Shield mode: 'normal' = extension badge hidden, 'paranoid' = badge visible
  const [shieldMode, setShieldMode] = useState<"normal" | "paranoid">(() => {
    try {
      const stored = localStorage.getItem(STORAGE_SHIELD_MODE_KEY);
      if (stored === "paranoid") return "paranoid";
      return "normal";
    } catch {
      return "normal";
    }
  });

  // 5-second recovery: bounded backoff+jitter scheduler while offline/unknown
  const retryTimerRef = useRef<number | null>(null);
  const retryAttemptRef = useRef(0);
  const [nextRetryDelayMs, setNextRetryDelayMs] = useState<number | null>(null);

  // ✅ prevent overlapping network calls (keeps UI responsive when backend is down)
  const healthInFlightRef = useRef(false);
  const recentInFlightRef = useRef(false);
  const dashboardStatusInFlightRef = useRef(false);

  const visibleScans = useMemo(() => {
    if (!hiddenIds.length) return recentScans;
    const hidden = new Set(hiddenIds);
    return recentScans.filter((s) => !hidden.has(s.id));
  }, [recentScans, hiddenIds]);

  const metrics = useMemo(() => computeMetrics(visibleScans), [visibleScans]);
  const dashboardReferenceTime =
    backendHealthSnapshot?.checkedAt ??
    lastSyncAt ??
    engineStatusSnapshot?.checkedAt ??
    navigationManifestSnapshot?.generatedAt ??
    null;
  const dashboardSystemStatus = useMemo(
    () =>
      buildThreatSystemStatus({
        health,
        healthSnapshot: backendHealthSnapshot,
        shieldMode,
        manifest: navigationManifestSnapshot,
        engine: engineStatusSnapshot,
        referenceTime: dashboardReferenceTime,
        isLoading: dashboardStatusLoading,
      }),
    [
      health,
      backendHealthSnapshot,
      shieldMode,
      navigationManifestSnapshot,
      engineStatusSnapshot,
      dashboardReferenceTime,
      dashboardStatusLoading,
    ]
  );
  const scanHistoryTruthState = useMemo<ThreatTruthState>(() => {
    if (recentLoading) {
      return "loading";
    }
    if (recentError) {
      return recentScans.length > 0 ? "partial" : "unavailable";
    }
    if (recentScans.length > 0) {
      return "available";
    }
    if (health === "ok") {
      return "available";
    }
    if (health === "error") {
      return "unavailable";
    }

    return "unknown";
  }, [health, recentError, recentLoading, recentScans]);

  useEffect(() => {
    setThreatLogState((previousState) =>
      buildThreatLogState({
        previousState,
        scans: recentScans,
        scanHistoryTruthState,
        systemStatus: dashboardSystemStatus,
        manifest: navigationManifestSnapshot,
        engine: engineStatusSnapshot,
        healthSnapshot: backendHealthSnapshot,
        referenceTime: dashboardReferenceTime,
      })
    );
  }, [
    recentScans,
    scanHistoryTruthState,
    dashboardSystemStatus,
    navigationManifestSnapshot,
    engineStatusSnapshot,
    backendHealthSnapshot,
    dashboardReferenceTime,
  ]);

  const dashboardView = useMemo(
    () =>
      buildThreatDashboardViewModel({
        threatLog: threatLogState,
        filters: dashboardFilters,
        hiddenEntryIds: hiddenIds,
        selectedEntryId: selectedThreatId,
        referenceTime: dashboardReferenceTime,
        isLoading: recentLoading || dashboardStatusLoading,
      }),
    [
      threatLogState,
      dashboardFilters,
      hiddenIds,
      selectedThreatId,
      dashboardReferenceTime,
      recentLoading,
      dashboardStatusLoading,
    ]
  );
  const selectedThreatScan = useMemo(
    () => {
      const reportId = dashboardView.selectedDetails?.reportId;
      if (!reportId) {
        return null;
      }

      return recentScans.find((scan) => scan.id === reportId) ?? null;
    },
    [recentScans, dashboardView.selectedDetails]
  );

  // =====================================================
  // Persistence
  // =====================================================
  function persistAll(nextScans: RecentScanEntry[], nextHidden: string[], nextTray: any[]) {
    const payload: PersistedState = {
      v: 2,
      recentScans: nextScans,
      hiddenIds: nextHidden,
      rescanTray: nextTray,
      lastUpdatedAt: nowIso(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      localStorage.setItem(STORAGE_HIDDEN_KEY, JSON.stringify(nextHidden));
      localStorage.setItem(STORAGE_RESCAN_TRAY_KEY, JSON.stringify(nextTray));
    } catch {
      // fail calm
    }
  }

  function loadPersisted() {
    const persisted = safeJsonParse<PersistedState>(localStorage.getItem(STORAGE_KEY));
    const hidden = safeJsonParse<string[]>(localStorage.getItem(STORAGE_HIDDEN_KEY)) || [];
    const tray =
      safeJsonParse<{ id: string; url: string; addedAt: string }[]>(
        localStorage.getItem(STORAGE_RESCAN_TRAY_KEY)
      ) || [];

    if (persisted?.recentScans?.length) {
      setRecentScans(dedupeScansKeepNewest(persisted.recentScans));
      setLastSyncAt(persisted.lastUpdatedAt || null);
    }

    setHiddenIds(Array.isArray(hidden) ? hidden : []);
    setRescanTray(Array.isArray(tray) ? tray : []);
  }

  // =====================================================
  // Networking helpers
  // =====================================================
  async function fetchJsonWithTimeout(url: string, init?: RequestInit, timeoutMs = 3500) {
    const controller = new AbortController();
    const t = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      return res;
    } finally {
      window.clearTimeout(t);
    }
  }

  async function pushShieldModeToBackend(mode: "normal" | "paranoid") {
    try {
      await fetchJsonWithTimeout(
        `${BACKEND_BASE}/shield-mode`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shieldMode: mode }),
        },
        FETCH_TIMEOUT_HEALTH_MS
      );
    } catch {
      // fail calm — backend might be offline; mode persisted locally
    }
  }

  async function fetchDashboardStatus() {
    if (dashboardStatusInFlightRef.current) return;
    dashboardStatusInFlightRef.current = true;

    if (mountedRef.current) {
      setDashboardStatusLoading(true);
    }

    try {
      const [engineResponse, manifestResponse] = await Promise.allSettled([
        fetchJsonWithTimeout(`${BACKEND_BASE}/engine/status`, undefined, FETCH_TIMEOUT_HEALTH_MS),
        fetchJsonWithTimeout(
          `${BACKEND_BASE}/intel/feeds/navigation/manifest.json`,
          undefined,
          FETCH_TIMEOUT_HEALTH_MS
        ),
      ]);

      let nextEngineStatus: EngineStatusSnapshot | null = null;
      if (engineResponse.status === "fulfilled" && engineResponse.value.ok) {
        const engineJson: unknown = await engineResponse.value.json().catch(() => null);
        nextEngineStatus = parseEngineStatusSnapshot(engineJson);
      }

      let nextManifest: NavigationManifestSnapshot | null = null;
      if (manifestResponse.status === "fulfilled" && manifestResponse.value.ok) {
        const manifestJson: unknown = await manifestResponse.value.json().catch(() => null);
        nextManifest = parseNavigationManifestSnapshot(manifestJson);
      }

      if (mountedRef.current) {
        setEngineStatusSnapshot(nextEngineStatus);
        setNavigationManifestSnapshot(nextManifest);
      }
    } catch {
      if (mountedRef.current) {
        setEngineStatusSnapshot(null);
        setNavigationManifestSnapshot(null);
      }
    } finally {
      if (mountedRef.current) {
        setDashboardStatusLoading(false);
      }
      dashboardStatusInFlightRef.current = false;
    }
  }

  function scheduleRetry(fn: () => void) {
    if (retryTimerRef.current != null) return;

    const delay = computeNextRetryDelayMs(retryAttemptRef.current);
    retryAttemptRef.current += 1;
    setNextRetryDelayMs(delay);

    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      fn();
    }, delay);
  }

  function clearRetry() {
    if (retryTimerRef.current != null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setNextRetryDelayMs(null);
  }

  function startPolling() {
    scheduleRetry(() => {
      if (healthRef.current !== "ok") {
        checkHealth();
        fetchRecentScans({ preferCache: true });
        fetchDashboardStatus();
      }

      if (healthRef.current !== "ok") {
        startPolling();
      }
    });
  }

  function stopPolling() {
    retryAttemptRef.current = 0;
    clearRetry();
  }

  async function checkHealth() {
    if (healthInFlightRef.current) return healthRef.current === "ok";
    healthInFlightRef.current = true;

    try {
      const res = await fetchJsonWithTimeout(`${BACKEND_BASE}/health`, undefined, FETCH_TIMEOUT_HEALTH_MS);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => null);
      const nextHealthSnapshot = parseBackendHealthSnapshot(data);

      const ok = !!(data && data.status === "ok");
      if (mountedRef.current) {
        setHealth(ok ? "ok" : "error");
        setBackendHealthSnapshot(nextHealthSnapshot);
      }

      if (ok) stopPolling();
      else startPolling();

      return ok;
    } catch {
      if (mountedRef.current) {
        setHealth("error");
        setBackendHealthSnapshot(null);
      }
      startPolling();
      return false;
    } finally {
      healthInFlightRef.current = false;
    }
  }

  async function fetchRecentScans(opts?: { preferCache?: boolean }) {
    if (recentInFlightRef.current) return;
    recentInFlightRef.current = true;

    if (!opts?.preferCache) setRecentLoading(true);
    setRecentError(null);

    try {
      const res = await fetchJsonWithTimeout(`${BACKEND_BASE}/recent-scans`, undefined, FETCH_TIMEOUT_RECENT_MS);

      // ✅ 304 = "Not Modified" (Express ETag). Treat as success and keep current UI state.
      if (res.status === 304) {
        if (mountedRef.current) {
          setLastSyncAt(nowIso());
          setHealth("ok"); // ✅ backend is responding
        }
        stopPolling();
        return;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Failed to load recent scans: ${res.status} ${text || ""}`.trim());
      }

      const json = await res.json().catch(() => ({}));

      const rawItems: any[] = Array.isArray(json)
        ? json
        : Array.isArray((json as any)?.items)
        ? (json as any).items
        : Array.isArray((json as any)?.scans)
        ? (json as any).scans
        : [];

      const normalized = rawItems.map(normalizeScanEntry).filter(Boolean) as RecentScanEntry[];

      if (mountedRef.current) {
        setRecentScans((prev) => {
          const merged = dedupeScansKeepNewest([...normalized, ...prev]);
          // ✅ persist with freshest refs (avoid stale closure)
          persistAll(merged, hiddenIdsRef.current, rescanTrayRef.current);
          return merged;
        });

        setLastSyncAt(nowIso());
        setHealth("ok"); // ✅ backend is responding
      }

      stopPolling();
    } catch (err: any) {
      const rawMsg = (err?.message || "").toString();
      const friendly =
        rawMsg.toLowerCase().includes("load failed") ||
        rawMsg.toLowerCase().includes("failed to fetch") ||
        rawMsg.toLowerCase().includes("networkerror") ||
        rawMsg.toLowerCase().includes("connection refused") ||
        rawMsg.toLowerCase().includes("aborted")
          ? "Backend offline — showing cached history."
          : rawMsg || "Failed to load recent scans.";

      if (mountedRef.current) {
        setRecentError(friendly);
        setHealth("error");
      }

      // Keep cached UI state; just persist what we already have.
      persistAll(recentScans, hiddenIdsRef.current, rescanTrayRef.current);
      startPolling();
    } finally {
      if (mountedRef.current) setRecentLoading(false);
      recentInFlightRef.current = false;
    }
  }

  // =====================================================
  // Boot
  // =====================================================
  useEffect(() => {
    loadPersisted();

    // kick once, then poll if needed
    checkHealth();
    fetchRecentScans({ preferCache: true });
    fetchDashboardStatus();
    pushShieldModeToBackend(shieldMode);

    const onOnline = () => {
      // ✅ instant recovery when network returns (still bounded by 5s rule)
      retryAttemptRef.current = 0;
      clearRetry();
      checkHealth();
      fetchRecentScans({ preferCache: true });
      fetchDashboardStatus();
    };
    const onOffline = () => {
      if (mountedRef.current) setHealth("error");
      startPolling();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      stopPolling();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    persistAll(recentScans, hiddenIds, rescanTray);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentScans, hiddenIds, rescanTray]);

  // Persist shield mode changes to localStorage + backend
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SHIELD_MODE_KEY, shieldMode);
    } catch {
      // fail calm
    }
    pushShieldModeToBackend(shieldMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shieldMode]);

  // =====================================================
  // Rescan tray helpers
  // =====================================================
  function pinUrlToTray(url: string) {
    const u = (url || "").trim();
    if (!u) return;

    const id = `url:${u}`;
    setRescanTray((prev) => {
      const without = prev.filter((x) => x.id !== id);
      return [{ id, url: u, addedAt: nowIso() }, ...without].slice(0, 20);
    });
  }

  // =====================================================
  // Quick URL scan handler
  // =====================================================
  async function handleUrlScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUrlScanError(null);
    setUrlScanResult(null);

    const trimmed = urlInput.trim();
    if (!trimmed) {
      setUrlScanError("Please enter a URL to scan.");
      return;
    }

    // ✅ normalize: allow "walmart.com" -> "https://walmart.com"
    const normalizedUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    // If backend is known-offline, try cache immediately (calm UX)
    if (healthRef.current !== "ok") {
      const cached = readCachedUrlScan(normalizedUrl);
      if (cached) {
        setUrlScanResult(cached);
        setUrlScanError("Backend offline — showing cached scan result.");
        return;
      }
    }

    setUrlScanLoading(true);
    try {
      const res = await fetchJsonWithTimeout(
        `${BACKEND_BASE}/scan-url`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-clickshield-org-id": "demo-acme",
            "x-org-id": "demo-acme",
          },
          body: JSON.stringify({
            url: normalizedUrl,
            userType: "business",
            userEmail: "desktop@clickshield.app",
            userId: "desktop-local-user",
            deviceId: "desktop-device",
            source: "desktop",
          }),
        },
        6000
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Backend returned ${res.status}: ${text || "Unknown error"}`);
      }

      const raw = await res.json().catch(() => ({}));
      const data = normalizeUrlScanResult(raw);
      setUrlScanResult(data);

      // ✅ write cache for offline use
      writeCachedUrlScan(data);

      const injected = normalizeScanEntry({
        id: data.id,
        url: data.url,
        riskLevel: data.riskLevel,
        riskScore: data.riskScore,
        threatType: data.threatType,
        userEmail: "desktop@clickshield.app",
        userType: "business",
        orgId: "demo-acme",
        orgName: "Demo Acme",
        deviceId: "desktop-device",
        checkedAt: data.checkedAt || nowIso(),
        source: data.source || "desktop",
        engine: data.engine || "rules",
      });

      if (injected) {
        setRecentScans((prev) => dedupeScansKeepNewest([injected, ...prev]));
      }

      // ✅ backend confirmed reachable
      setHealth("ok");
      stopPolling();

      // keep history warm when backend is up
      await fetchRecentScans({ preferCache: true });
    } catch (err: any) {
      // If network failed, try cache as a fallback before showing an error
      const cached = readCachedUrlScan(normalizedUrl);
      if (cached) {
        setUrlScanResult(cached);
        setUrlScanError("Backend offline — showing cached scan result.");
      } else {
        const rawMsg = (err?.message || "").toString();
        const friendly =
          rawMsg.toLowerCase().includes("load failed") ||
          rawMsg.toLowerCase().includes("failed to fetch") ||
          rawMsg.toLowerCase().includes("networkerror") ||
          rawMsg.toLowerCase().includes("connection refused") ||
          rawMsg.toLowerCase().includes("aborted")
            ? "Backend offline — unable to scan right now. Try again when backend is up."
            : rawMsg || "Failed to scan URL.";

        setUrlScanError(friendly);
      }
      setHealth("error");
      startPolling();
    } finally {
      setUrlScanLoading(false);
    }
  }

    // =====================================================
  // Document scan (V2)
  // 1) PDF URL -> /scan-document-url
  // 2) File upload -> /scan-document (multipart)
  // =====================================================

  async function handleDocUrlScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDocScanError(null);
    setDocScanResult(null);

    const trimmed = docUrl.trim();
    if (!trimmed) {
      setDocScanError("Paste a PDF/document URL to scan.");
      return;
    }

    setDocScanLoading(true);
    try {
      const res = await fetchJsonWithTimeout(
        `${BACKEND_BASE}/scan-document-url`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-clickshield-org-id": "demo-acme",
            "x-org-id": "demo-acme",
          },
          body: JSON.stringify({
            url: trimmed,
            userType: "business",
            userEmail: "desktop@clickshield.app",
            userId: "desktop-local-user",
            deviceId: "desktop-device",
            source: "desktop",
          }),
        },
        12000
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Backend returned ${res.status}: ${text || "Unknown error"}`);
      }

      const raw = await res.json().catch(() => ({}));
      const data = normalizeDocScanResult(raw);
      setDocScanResult(data);

      const injected = normalizeScanEntry({
        id: data.id,
        url: "(document)",
        riskLevel: data.riskLevel,
        riskScore: data.riskScore,
        threatType: data.threatType,
        userEmail: "desktop@clickshield.app",
        userType: "business",
        orgId: "demo-acme",
        orgName: "Demo Acme",
        deviceId: "desktop-device",
        checkedAt: data.checkedAt || nowIso(),
        source: data.source || "desktop",
        engine: data.engine || "rules",
        filename: data.filename,
        mimeType: data.mimeType,
      });

      if (injected) setRecentScans((prev) => dedupeScansKeepNewest([injected, ...prev]));

      setHealth("ok");
      stopPolling();
      await fetchRecentScans({ preferCache: true });
    } catch (err: any) {
      setDocScanError(err?.message || "Failed to scan document URL.");
      setHealth("error");
      startPolling();
    } finally {
      setDocScanLoading(false);
    }
  }

  async function handleDocFileScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDocScanError(null);
    setDocScanResult(null);

    if (!docFile) {
      setDocScanError("Choose a file to scan (PDF, etc).");
      return;
    }

    setDocScanLoading(true);
    try {
      const form = new FormData();
      form.append("file", docFile, docFile.name);
      form.append("filename", docFile.name);
      form.append("mimeType", docFile.type || "application/octet-stream");
      form.append("userType", "business");
      form.append("userEmail", "desktop@clickshield.app");
      form.append("userId", "desktop-local-user");
      form.append("deviceId", "desktop-device");
      form.append("source", "desktop");

      const res = await fetchJsonWithTimeout(
        `${BACKEND_BASE}/scan-document`,
        {
          method: "POST",
          headers: {
            // NOTE: do NOT set Content-Type manually for FormData
            "x-clickshield-org-id": "demo-acme",
            "x-org-id": "demo-acme",
          },
          body: form as any,
        },
        15000
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Backend returned ${res.status}: ${text || "Unknown error"}`);
      }

      const raw = await res.json().catch(() => ({}));
      const data = normalizeDocScanResult(raw);
      setDocScanResult(data);

      const injected = normalizeScanEntry({
        id: data.id,
        url: "(document)",
        riskLevel: data.riskLevel,
        riskScore: data.riskScore,
        threatType: data.threatType,
        userEmail: "desktop@clickshield.app",
        userType: "business",
        orgId: "demo-acme",
        orgName: "Demo Acme",
        deviceId: "desktop-device",
        checkedAt: data.checkedAt || nowIso(),
        source: data.source || "desktop",
        engine: data.engine || "rules",
        filename: data.filename ?? docFile.name,
        mimeType: data.mimeType ?? docFile.type,
      });

      if (injected) setRecentScans((prev) => dedupeScansKeepNewest([injected, ...prev]));

      setHealth("ok");
      stopPolling();
      await fetchRecentScans({ preferCache: true });
    } catch (err: any) {
      setDocScanError(err?.message || "Failed to scan file.");
      setHealth("error");
      startPolling();
    } finally {
      setDocScanLoading(false);
    }
  }


  // =====================================================
  // Recent scan actions
  // =====================================================
  function handleHideLocal(entry: RecentScanEntry) {
    setHiddenIds((prev) => Array.from(new Set([...prev, entry.id])));
  }

  function handleUnhideAll() {
    setHiddenIds([]);
  }

  function addToRescanTray(entry: RecentScanEntry) {
    if (!entry.url || entry.url === "(document)") return;
    setRescanTray((prev) => {
      if (prev.some((p) => p.id === entry.id)) return prev;
      return [{ id: entry.id, url: entry.url, addedAt: nowIso() }, ...prev].slice(0, 20);
    });
  }

  function removeFromRescanTray(id: string) {
    setRescanTray((prev) => prev.filter((x) => x.id !== id));
  }

  async function handleRescanUrl(url: string, loadingId: string) {
    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;

    // If backend is known-offline, try cache immediately (calm UX)
    if (healthRef.current !== "ok") {
      const cached = readCachedUrlScan(normalizedUrl);
      if (cached) {
        setUrlScanResult(cached);
        setUrlScanError("Backend offline — showing cached scan result.");
        return;
      }
    }

    setRescanLoadingId(loadingId);
    try {
      const res = await fetchJsonWithTimeout(
        `${BACKEND_BASE}/scan-url`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-clickshield-org-id": "demo-acme",
            "x-org-id": "demo-acme",
          },
          body: JSON.stringify({
            url: normalizedUrl,
            userType: "business",
            userEmail: "desktop@clickshield.app",
            userId: "desktop-local-user",
            deviceId: "desktop-device",
            source: "desktop",
          }),
        },
        6000
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Re-scan failed: ${res.status} ${text || ""}`.trim());
      }

      const raw = await res.json().catch(() => ({}));
      const payload = normalizeUrlScanResult(raw);

      // ✅ write cache for offline use
      writeCachedUrlScan(payload);

      const injected = normalizeScanEntry({
        id: payload.id,
        url: payload.url,
        riskLevel: payload.riskLevel,
        riskScore: payload.riskScore,
        threatType: payload.threatType,
        userEmail: "desktop@clickshield.app",
        userType: "business",
        orgId: "demo-acme",
        orgName: "Demo Acme",
        deviceId: "desktop-device",
        checkedAt: payload.checkedAt || nowIso(),
        source: payload.source || "desktop",
        engine: payload.engine || "rules",
      });

      if (injected) {
        setRecentScans((prev) => dedupeScansKeepNewest([injected, ...prev]));
      }

      setHealth("ok");
      stopPolling();

      await fetchRecentScans({ preferCache: true });
    } catch (err: any) {
      const cached = readCachedUrlScan(normalizedUrl);
      if (cached) {
        setUrlScanResult(cached);
        setUrlScanError("Backend offline — showing cached scan result.");
      } else {
        console.error("[Desktop] Re-scan failed:", err);
      }
      setHealth("error");
      startPolling();
    } finally {
      setRescanLoadingId(null);
    }
  }

  async function handleRescan(entry: RecentScanEntry) {
    if (!entry.url || entry.url === "(document)") return;
    await handleRescanUrl(entry.url, entry.id);
  }

  async function handleRescanSelectedThreat() {
    if (!selectedThreatScan) return;
    await handleRescan(selectedThreatScan);
  }

  function handlePinSelectedThreat() {
    if (!selectedThreatScan) return;
    addToRescanTray(selectedThreatScan);
  }

  function handleHideSelectedThreat() {
    if (!selectedThreatScan) return;
    handleHideLocal(selectedThreatScan);
  }

  async function handleRescanTrayAll() {
    for (const item of rescanTray) {
      // eslint-disable-next-line no-await-in-loop
      await handleRescanUrl(item.url, item.id);
    }
  }

  // =====================================================
  // UI computed values
  // =====================================================
  const retryWindowSeconds = Math.max(1, Math.round((nextRetryDelayMs ?? RETRY_BASE_MS) / 1000));

  const backendBadge =
    health === "ok"
      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
      : health === "error"
      ? "border-red-500/60 bg-red-500/10 text-red-200"
      : "border-slate-600 bg-slate-800 text-slate-300";

  const backendDot =
    health === "ok" ? "bg-emerald-400" : health === "error" ? "bg-red-500" : "bg-slate-500";

  const urlScoreDisplay = urlScanResult != null ? clampRiskScore(urlScanResult.riskScore) : null;
  const docScoreDisplay = docScanResult != null ? clampRiskScore(docScanResult.riskScore) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex justify-center px-4 py-6">
      <div className="w-full max-w-5xl space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">ClickShield Desktop Agent</h1>
            <p className="text-sm text-slate-400">
              Local Web3 & phishing guard – powered by your{" "}
              <span className="font-mono text-sky-400">{BACKEND_BASE.replace(/^https?:\/\//, "")}</span>
            </p>
            {lastSyncAt && (
              <p className="text-[11px] text-slate-500 mt-1">
                History restored • last sync {formatDate(lastSyncAt)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Shield Mode Toggle */}
            <button
              onClick={() => setShieldMode((prev) => (prev === "normal" ? "paranoid" : "normal"))}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                shieldMode === "paranoid"
                  ? "border-sky-500/60 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25"
                  : "border-slate-700 bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200"
              }`}
              title={
                shieldMode === "paranoid"
                  ? "Paranoid: browser badge visible on every page"
                  : "Normal: browser badge hidden (shield still active)"
              }
            >
              <span
                className={`inline-block h-2 w-2 rounded-full transition-colors duration-200 ${
                  shieldMode === "paranoid" ? "bg-sky-400" : "bg-slate-500"
                }`}
              />
              <span className="uppercase tracking-wide">
                {shieldMode === "paranoid" ? "Paranoid" : "Normal"}
              </span>
            </button>

            <div className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${backendBadge}`}>
              <span className={`h-2 w-2 rounded-full ${backendDot}`} />
              <span className="uppercase tracking-wide font-semibold">
                {health === "ok" ? "Backend: OK" : health === "error" ? "Backend: OFFLINE" : "Backend: CHECKING"}
              </span>
            </div>

            <button
              onClick={() => {
                checkHealth();
                fetchRecentScans({ preferCache: true });
                fetchDashboardStatus();
              }}
              className="text-[11px] px-2 py-1 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800"
              title="Force refresh"
            >
              Sync
            </button>

            <button
              onClick={() => restartDesktopAgent()}
              className="text-[11px] px-2 py-1 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800"
              title="Restart the Desktop Agent"
            >
              Restart
            </button>
          </div>
        </header>

        {/* Metrics + Rescan tray */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold tracking-tight">Risk metrics</h2>
              <p className="text-xs text-slate-400">
                Metrics are computed locally from your restored history (cached when backend is down).
              </p>
            </div>

            <div className="flex items-center gap-2">
              {hiddenIds.length > 0 && (
                <button
                  onClick={handleUnhideAll}
                  className="text-[11px] px-2 py-1 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800"
                >
                  Unhide all ({hiddenIds.length})
                </button>
              )}
              <button
                onClick={() => {
                  fetchRecentScans({ preferCache: true });
                  fetchDashboardStatus();
                }}
                disabled={recentLoading}
                className="text-[11px] px-2 py-1 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-60"
              >
                {recentLoading ? "Refreshing…" : "Refresh history"}
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="text-[11px] text-slate-400">Overall</div>
              <div className="mt-1 flex items-center justify-between">
                {renderRiskPill(metrics.overall)}
                <div className="text-[11px] text-slate-400">max {metrics.max}</div>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">avg score {metrics.avg}</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="text-[11px] text-slate-400">Total scans</div>
              <div className="text-xl font-semibold mt-1">{metrics.total}</div>
              <div className="text-[11px] text-slate-500">visible (after hides)</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="text-[11px] text-slate-400">Breakdown</div>
              <div className="mt-2 space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">SAFE</span>
                  <span className="text-slate-200">{metrics.by.SAFE}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">SUSPICIOUS</span>
                  <span className="text-slate-200">{metrics.by.SUSPICIOUS}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">DANGEROUS</span>
                  <span className="text-slate-200">{metrics.by.DANGEROUS}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">SENSITIVE</span>
                  <span className="text-slate-200">{metrics.by.SENSITIVE}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-slate-400">Rescan tray</div>
                <div className="text-[11px] text-slate-500">{rescanTray.length}/20</div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={handleRescanTrayAll}
                  disabled={rescanTray.length === 0 || rescanLoadingId != null}
                  className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  title="Rescan all URLs in tray (sequential, calm)"
                >
                  {rescanLoadingId ? "Rescanning…" : "Rescan all"}
                </button>
                <button
                  onClick={() => setRescanTray([])}
                  disabled={rescanTray.length === 0 || rescanLoadingId != null}
                  className="text-[11px] px-2 py-2 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                  title="Clear tray"
                >
                  Clear
                </button>
              </div>

              {rescanTray.length > 0 && (
                <div className="mt-2 max-h-24 overflow-auto rounded-lg border border-slate-800 bg-slate-950/40">
                  {rescanTray.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2 px-2 py-1 border-b border-slate-800/70 last:border-b-0"
                    >
                      <div className="text-[10px] text-slate-200 font-mono truncate">{t.url}</div>
                      <button
                        onClick={() => removeFromRescanTray(t.id)}
                        className="text-[10px] px-2 py-1 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800"
                        title="Remove"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {recentError && (
            <div className="mt-3 rounded-xl border border-red-700/50 bg-red-950/30 px-3 py-2 text-xs text-red-200">
              <span>
                {/showing cached history/i.test(recentError)
                  ? `Backend offline — showing cached history. Auto-retry in ~${retryWindowSeconds}s.`
                  : recentError}
              </span>
              {!/showing cached history/i.test(recentError) && (
                <span className="text-red-300/80">
                  {" "}
                  {`Showing cached history. Auto-recovery will retry in ~${retryWindowSeconds}s while offline.`}
                </span>
              )}
            </div>
          )}
        </section>

        {/* Top row: Quick URL + Document scan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Quick URL Scan card */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40">
            <h2 className="text-sm font-semibold tracking-tight mb-2">Quick URL Scan</h2>
            <p className="text-xs text-slate-400 mb-3">
              Paste a link before you click. ClickShield runs deterministic rules first, then AI if available.
            </p>

            <form onSubmit={handleUrlScanSubmit} className="space-y-3">
              <input
                type="text"
                className="w-full rounded-xl bg-slate-950/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/80 focus:border-sky-400 font-mono"
                placeholder="https://example.com"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
              {urlScanError && <p className="text-xs text-red-400">{urlScanError}</p>}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={urlScanLoading}
                  className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {urlScanLoading ? "Scanning…" : "Scan URL"}
                </button>

                <button
                  type="button"
                  disabled={!urlScanResult?.url && !urlInput.trim()}
                  onClick={() => pinUrlToTray((urlScanResult?.url || urlInput).trim())}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Pin to tray
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-950/40 border border-slate-800 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Score:</span>
                  <span className="text-xs text-slate-100 font-mono">{urlScoreDisplay != null ? urlScoreDisplay : "—"}</span>
                  <span className="text-[11px] text-slate-500">{urlScanResult?.threatType ? `• ${urlScanResult.threatType}` : ""}</span>
                </div>
                <div className="flex items-center gap-2">{urlScanResult?.riskLevel ? renderRiskPill(urlScanResult.riskLevel) : null}</div>
              </div>
            </form>

            {urlScanResult && (
              <div className="mt-4 rounded-xl bg-slate-950/60 border border-slate-800 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {renderRiskPill(urlScanResult.riskLevel)}
                    <span className="text-[11px] text-slate-400">
                      Score: {clampRiskScore(urlScanResult.riskScore)} • {urlScanResult.threatType}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const injected = normalizeScanEntry({
                        id: urlScanResult.id,
                        url: urlScanResult.url,
                        checkedAt: urlScanResult.checkedAt || nowIso(),
                        riskLevel: urlScanResult.riskLevel,
                        riskScore: clampRiskScore(urlScanResult.riskScore),
                        threatType: urlScanResult.threatType,
                        userEmail: "desktop@clickshield.app",
                        userType: "business",
                        orgId: "demo-acme",
                        orgName: "Demo Acme",
                        deviceId: "desktop-device",
                        source: urlScanResult.source || "desktop",
                        engine: urlScanResult.engine || "rules",
                      });
                      if (injected) addToRescanTray(injected);
                      else pinUrlToTray(urlScanResult.url);
                    }}
                    className="text-[11px] px-2 py-1 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800"
                    title="Pin this URL into rescan tray"
                  >
                    Pin to tray
                  </button>
                </div>

                <p className="text-xs text-slate-200">{urlScanResult.reason}</p>
                {renderAiNarrative(urlScanResult.ai)}
                <p className="text-[11px] text-slate-400 mt-1">{urlScanResult.shortAdvice}</p>
              </div>
            )}
          </section>
          {/* Document scan (V2: PDF URL + file upload) */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40">
            <h2 className="text-sm font-semibold tracking-tight mb-2">Document Scan</h2>
            <p className="text-xs text-slate-400 mb-3">
              Scan document links (PDFs/whitepapers) or upload a local file. Rules first, AI second.
            </p>

            {/* Mode toggle */}
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => setDocMode("url")}
                className={`text-[11px] px-3 py-2 rounded-xl border transition-colors ${
                  docMode === "url"
                    ? "border-sky-500/60 bg-sky-500/10 text-sky-200"
                    : "border-slate-700 bg-slate-950/30 text-slate-200 hover:bg-slate-800"
                }`}
              >
                PDF URL
              </button>
              <button
                type="button"
                onClick={() => setDocMode("file")}
                className={`text-[11px] px-3 py-2 rounded-xl border transition-colors ${
                  docMode === "file"
                    ? "border-sky-500/60 bg-sky-500/10 text-sky-200"
                    : "border-slate-700 bg-slate-950/30 text-slate-200 hover:bg-slate-800"
                }`}
              >
                Upload File
              </button>
            </div>

            {docMode === "url" ? (
              <form onSubmit={handleDocUrlScanSubmit} className="space-y-3">
                <input
                  type="text"
                  className="w-full rounded-xl bg-slate-950/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/80 focus:border-sky-400 font-mono"
                  placeholder="https://site.com/whitepaper.pdf"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                />

                {docScanError && <p className="text-xs text-red-400">{docScanError}</p>}

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={docScanLoading}
                    className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {docScanLoading ? "Scanning…" : "Scan PDF URL"}
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-950/40 border border-slate-800 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Score:</span>
                    <span className="text-xs text-slate-100 font-mono">
                      {docScoreDisplay != null ? docScoreDisplay : "—"}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {docScanResult?.threatType ? `• ${docScanResult.threatType}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {docScanResult?.riskLevel ? renderRiskPill(docScanResult.riskLevel) : null}
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleDocFileScanSubmit} className="space-y-3">
                <input
                  type="file"
                  accept="application/pdf,text/plain,.pdf,.txt,.doc,.docx"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setDocFile(f);
                    setDocScanError(null);
                  }}
                  className="w-full text-xs text-slate-200 file:mr-3 file:rounded-xl file:border file:border-slate-700 file:bg-slate-950/40 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-100 hover:file:bg-slate-800"
                />

                {docFile && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-200">
                    <div className="font-mono text-[11px] truncate">{docFile.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {docFile.type || "unknown type"} • {Math.round(docFile.size / 1024)} KB
                    </div>
                  </div>
                )}

                {docScanError && <p className="text-xs text-red-400">{docScanError}</p>}

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={docScanLoading || !docFile}
                    className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {docScanLoading ? "Scanning…" : "Scan File"}
                  </button>

                  <button
                    type="button"
                    disabled={docScanLoading || !docFile}
                    onClick={() => setDocFile(null)}
                    className="text-[11px] px-3 py-2 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                  >
                    Clear
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-950/40 border border-slate-800 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Score:</span>
                    <span className="text-xs text-slate-100 font-mono">
                      {docScoreDisplay != null ? docScoreDisplay : "—"}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {docScanResult?.threatType ? `• ${docScanResult.threatType}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {docScanResult?.riskLevel ? renderRiskPill(docScanResult.riskLevel) : null}
                  </div>
                </div>
              </form>
            )}

            {docScanResult && (
              <div className="mt-4 rounded-xl bg-slate-950/60 border border-slate-800 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {renderRiskPill(docScanResult.riskLevel)}
                    <span className="text-[11px] text-slate-400">
                      Score: {clampRiskScore(docScanResult.riskScore)} • {docScanResult.threatType}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-200">{docScanResult.reason}</p>
                {renderAiNarrative(docScanResult.ai || undefined)}
              </div>
            )}
          </section>



        </div>

        <ThreatDashboard
          entries={dashboardView.entries}
          filteredEntries={dashboardView.filteredEntries}
          filters={dashboardFilters}
          summary={dashboardView.summary}
          systemStatus={dashboardSystemStatus}
          selectedEntryId={dashboardView.selectedEntryId}
          selectedDetails={dashboardView.selectedDetails}
          isLoading={recentLoading || dashboardStatusLoading}
          feedEmptyState={dashboardView.feedEmptyState}
          detailsEmptyState={dashboardView.detailsEmptyState}
          onFiltersChange={setDashboardFilters}
          onSelectEntry={setSelectedThreatId}
          onClearFilters={() => setDashboardFilters(DEFAULT_THREAT_DASHBOARD_FILTERS)}
          onPinSelected={selectedThreatScan && selectedThreatScan.url !== "(document)" ? handlePinSelectedThreat : undefined}
          onHideSelected={selectedThreatScan ? handleHideSelectedThreat : undefined}
          onRescanSelected={
            selectedThreatScan && selectedThreatScan.url !== "(document)" ? handleRescanSelectedThreat : undefined
          }
        />
      </div>
    </div>
  );
};

export default App;
