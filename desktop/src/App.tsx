import React, { useEffect, useState } from "react";

const BACKEND_BASE = "http://localhost:4000";

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
  url: string;
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
};

const App: React.FC = () => {
  // ------------ Health -------------
  const [health, setHealth] = useState<HealthState>("unknown");

  // ------------ Quick URL scan -------------
  const [urlInput, setUrlInput] = useState("");
  const [urlScanLoading, setUrlScanLoading] = useState(false);
  const [urlScanResult, setUrlScanResult] = useState<UrlScanResult | null>(
    null
  );
  const [urlScanError, setUrlScanError] = useState<string | null>(null);

  // ------------ Doc scan -------------
  const [docText, setDocText] = useState("");
  const [docFilename, setDocFilename] = useState("pasted-document.txt");
  const [docScanLoading, setDocScanLoading] = useState(false);
  const [docScanResult, setDocScanResult] = useState<DocScanResult | null>(
    null
  );
  const [docScanError, setDocScanError] = useState<string | null>(null);

  // ------------ Recent scans mini-dashboard -------------
  const [recentScans, setRecentScans] = useState<RecentScanEntry[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);

  // quick actions state
  const [rescanLoadingId, setRescanLoadingId] = useState<string | null>(null);
  const [selectedScan, setSelectedScan] = useState<RecentScanEntry | null>(
    null
  );

  // =====================================================
  // Helpers
  // =====================================================

  function formatDate(value?: string | null) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  }

  function renderRiskPill(riskLevel?: string) {
    if (!riskLevel) return null;
    const upper = riskLevel.toUpperCase();

    let color = "bg-gray-700 text-gray-100";
    if (upper === "SAFE") color = "bg-emerald-600 text-emerald-50";
    else if (upper === "SUSPICIOUS") color = "bg-amber-600 text-amber-50";
    else if (upper === "DANGEROUS") color = "bg-red-700 text-red-50";
    else if (upper === "SENSITIVE") color = "bg-fuchsia-700 text-fuchsia-50";

    return (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${color}`}
      >
        {upper}
      </span>
    );
  }

  function renderAiNarrative(ai?: UrlScanResult["ai"] | DocScanResult["ai"]) {
    if (!ai || !ai.aiNarrative) return null;
    return (
      <div className="mt-2 rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2 text-xs text-slate-100">
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-[11px] uppercase tracking-wide text-sky-400">
            AI Narrative
          </span>
          <span className="text-[10px] text-slate-400">
            {ai.aiModel || "gpt-4.1-mini"}
          </span>
        </div>
        <p className="text-sm leading-snug">{ai.aiNarrative}</p>
      </div>
    );
  }

  async function fetchRecentScans() {
    setRecentLoading(true);
    setRecentError(null);
    try {
      const res = await fetch(`${BACKEND_BASE}/recent-scans`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Failed to load recent scans: ${res.status} ${text || ""}`.trim()
        );
      }
      const data = (await res.json()) as RecentScanEntry[];
      setRecentScans(data || []);
    } catch (err: any) {
      setRecentError(err?.message || "Failed to load recent scans.");
    } finally {
      setRecentLoading(false);
    }
  }

  // =====================================================
  // Health check + initial recent scans
  // =====================================================
  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const res = await fetch(`${BACKEND_BASE}/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (data && data.status === "ok") {
          setHealth("ok");
        } else {
          setHealth("error");
        }
      } catch {
        if (!cancelled) setHealth("error");
      }
    }

    checkHealth();
    fetchRecentScans();

    return () => {
      cancelled = true;
    };
  }, []);

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

    setUrlScanLoading(true);
    try {
      const res = await fetch(`${BACKEND_BASE}/scan-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: trimmed,
          userType: "business",
          userEmail: "desktop@clickshield.app",
          source: "desktop",
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Backend returned ${res.status}: ${text || "Unknown error"}`
        );
      }

      const data = (await res.json()) as UrlScanResult;
      setUrlScanResult(data);
      await fetchRecentScans();
    } catch (err: any) {
      setUrlScanError(err?.message || "Failed to scan URL.");
    } finally {
      setUrlScanLoading(false);
    }
  }

  // =====================================================
  // Document scan handler (pasted text -> /scan-document-encrypted)
  // =====================================================
  async function handleDocScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDocScanError(null);
    setDocScanResult(null);

    const trimmed = docText.trim();
    if (!trimmed) {
      setDocScanError("Paste some text or secrets to scan.");
      return;
    }

    setDocScanLoading(true);
    try {
      const res = await fetch(`${BACKEND_BASE}/scan-document-encrypted`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: trimmed,
          filename: docFilename || "pasted-document.txt",
          mimeType: "text/plain",
          userType: "business",
          userEmail: "desktop@clickshield.app",
          source: "desktop",
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Backend returned ${res.status}: ${text || "Unknown error"}`
        );
      }

      const data = (await res.json()) as DocScanResult;
      setDocScanResult(data);
      await fetchRecentScans();
    } catch (err: any) {
      setDocScanError(err?.message || "Failed to scan document.");
    } finally {
      setDocScanLoading(false);
    }
  }

  // =====================================================
  // Quick actions on recent scans
  // =====================================================

  async function handleRescan(entry: RecentScanEntry) {
    if (!entry.url || entry.url === "(document)") {
      // For now we only support re-scan for URL entries
      return;
    }

    setRescanLoadingId(entry.id);
    try {
      const res = await fetch(`${BACKEND_BASE}/scan-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: entry.url,
          userType: entry.userType || "consumer",
          userEmail: entry.userEmail || "desktop@clickshield.app",
          source: "desktop",
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Re-scan failed: ${res.status} ${text || ""}`.trim()
        );
      }

      await res.json(); // ignore payload, we’ll refresh the list
      await fetchRecentScans();
    } catch (err) {
      // We’ll just log in console for now, to avoid noisy UI.
      console.error("[Desktop] Re-scan failed:", err);
    } finally {
      setRescanLoadingId(null);
    }
  }

  function handleDeleteLocal(entry: RecentScanEntry) {
    // Local-only hide. Does NOT delete from backend.
    setRecentScans((prev) => prev.filter((s) => s.id !== entry.id));
  }

  function handleExpand(entry: RecentScanEntry) {
    setSelectedScan(entry);
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex justify-center px-4 py-6">
      <div className="w-full max-w-5xl space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              ClickShield Desktop Agent
            </h1>
            <p className="text-sm text-slate-400">
              Local Web3 & phishing guard – powered by your{" "}
              <span className="font-mono text-sky-400">backend:4000</span>
            </p>
          </div>
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
              health === "ok"
                ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                : health === "error"
                ? "border-red-500/60 bg-red-500/10 text-red-200"
                : "border-slate-600 bg-slate-800 text-slate-300"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                health === "ok"
                  ? "bg-emerald-400"
                  : health === "error"
                  ? "bg-red-500"
                  : "bg-slate-500"
              }`}
            />
            <span className="uppercase tracking-wide font-semibold">
              {health === "ok"
                ? "Backend: OK"
                : health === "error"
                ? "Backend: OFFLINE"
                : "Backend: CHECKING"}
            </span>
          </div>
        </header>

        {/* Top row: Quick URL + Document scan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Quick URL Scan card */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40">
            <h2 className="text-sm font-semibold tracking-tight mb-2">
              Quick URL Scan
            </h2>
            <p className="text-xs text-slate-400 mb-3">
              Paste a link before you click. ClickShield runs deterministic
              rules first, then AI if available.
            </p>

            <form onSubmit={handleUrlScanSubmit} className="space-y-3">
              <input
                type="text"
                className="w-full rounded-xl bg-slate-950/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/80 focus:border-sky-400 font-mono"
                placeholder="https://example.com"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
              {urlScanError && (
                <p className="text-xs text-red-400">{urlScanError}</p>
              )}
              <button
                type="submit"
                disabled={urlScanLoading}
                className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {urlScanLoading ? "Scanning…" : "Scan URL"}
              </button>
            </form>

            {urlScanResult && (
              <div className="mt-4 rounded-xl bg-slate-950/60 border border-slate-800 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {renderRiskPill(urlScanResult.riskLevel)}
                    <span className="text-[11px] text-slate-400">
                      Score: {urlScanResult.riskScore} •{" "}
                      {urlScanResult.threatType}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-200">
                  {urlScanResult.reason}
                </p>
                {renderAiNarrative(urlScanResult.ai)}
                <p className="text-[11px] text-slate-400 mt-1">
                  {urlScanResult.shortAdvice}
                </p>
              </div>
            )}
          </section>

          {/* Pasted Document scan */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40">
            <h2 className="text-sm font-semibold tracking-tight mb-2">
              Pasted Document Scan
            </h2>
            <p className="text-xs text-slate-400 mb-3">
              Paste config files, environment variables, or wallet backup
              phrases. ClickShield will detect API keys, wallet recovery data,
              and other sensitive material. Raw text is only processed locally
              and encrypted before any at-rest storage.
            </p>

            <form onSubmit={handleDocScanSubmit} className="space-y-3">
              <div className="flex flex-col md:flex-row gap-2 items-center">
                <label className="text-xs text-slate-300 w-full md:w-auto">
                  Filename hint
                </label>
                <input
                  type="text"
                  className="w-full md:flex-1 rounded-xl bg-slate-950/70 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/80 focus:border-sky-400 font-mono"
                  value={docFilename}
                  onChange={(e) => setDocFilename(e.target.value)}
                />
              </div>

              <textarea
                className="w-full h-40 rounded-xl bg-slate-950/70 border border-slate-700 px-3 py-2 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/80 focus:border-sky-400 font-mono resize-vertical"
                placeholder="Paste your document or secrets here…"
                value={docText}
                onChange={(e) => setDocText(e.target.value)}
              />

              {docScanError && (
                <p className="text-xs text-red-400">{docScanError}</p>
              )}

              <button
                type="submit"
                disabled={docScanLoading}
                className="inline-flex items-center justify-center rounded-xl bg-fuchsia-600 px-4 py-2 text-xs font-semibold text-white hover:bg-fuchsia-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {docScanLoading ? "Scanning…" : "Scan document for secrets"}
              </button>
            </form>

            {docScanResult && (
              <div className="mt-4 rounded-xl bg-slate-950/60 border border-slate-800 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {renderRiskPill(docScanResult.riskLevel)}
                    <span className="text-[11px] text-slate-400">
                      Score: {docScanResult.riskScore} •{" "}
                      {docScanResult.threatType}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-200">
                  {docScanResult.reason}
                </p>
                {renderAiNarrative(docScanResult.ai || undefined)}
              </div>
            )}
          </section>
        </div>

        {/* Recent Scans mini-dashboard with quick actions */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold tracking-tight">
              Recent Scans (local session)
            </h2>
            <button
              onClick={fetchRecentScans}
              disabled={recentLoading}
              className="text-[11px] px-2 py-1 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-60"
            >
              {recentLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Quick view of what ClickShield has seen. Actions are local-only:
            <span className="ml-1">🔄 re-scan URL</span>
            <span className="ml-1">📄 view details</span>
            <span className="ml-1">🗑 hide row</span>
          </p>

          {recentError && (
            <p className="text-xs text-red-400 mb-2">{recentError}</p>
          )}

          {recentScans.length === 0 && !recentLoading && !recentError && (
            <p className="text-xs text-slate-500">
              No recent scans yet. Run a URL or document scan to populate this
              list.
            </p>
          )}

          {recentScans.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
              <table className="w-full text-xs">
                <thead className="bg-slate-900/80 text-slate-300">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">When</th>
                    <th className="px-3 py-2 text-left font-medium">Source</th>
                    <th className="px-3 py-2 text-left font-medium">Risk</th>
                    <th className="px-3 py-2 text-left font-medium">
                      URL / Document
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentScans.map((scan) => {
                    const isDocument =
                      !scan.url || scan.url === "(document)";
                    return (
                      <tr
                        key={scan.id}
                        className="border-t border-slate-800/80 hover:bg-slate-900/60"
                      >
                        <td className="px-3 py-2 align-top text-slate-300">
                          {formatDate(scan.checkedAt)}
                        </td>
                        <td className="px-3 py-2 align-top text-slate-400">
                          <span className="font-mono text-[11px]">
                            {scan.source || "api"}
                          </span>
                          <div className="text-[10px] text-slate-500">
                            {scan.userEmail || "unknown"}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-col gap-1">
                            {renderRiskPill(scan.riskLevel)}
                            <span className="text-[10px] text-slate-400">
                              {scan.threatType} • {scan.riskScore}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top max-w-xs">
                          <div className="text-[11px] text-slate-200 truncate font-mono">
                            {isDocument
                              ? "(document)"
                              : scan.url || "(unknown)"}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              title={
                                isDocument
                                  ? "Re-scan only supported for URL entries"
                                  : "Re-scan this URL"
                              }
                              disabled={isDocument || rescanLoadingId === scan.id}
                              onClick={() => handleRescan(scan)}
                              className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 disabled:opacity-40 text-sm"
                            >
                              {rescanLoadingId === scan.id ? "…" : "🔄"}
                            </button>
                            <button
                              title="View details"
                              onClick={() => handleExpand(scan)}
                              className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-sm"
                            >
                              📄
                            </button>
                            <button
                              title="Hide from this list (local only)"
                              onClick={() => handleDeleteLocal(scan)}
                              className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-red-700/70 bg-red-950/60 hover:bg-red-900/70 text-sm"
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Details modal */}
        {selectedScan && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="w-full max-w-lg rounded-2xl bg-slate-950 border border-slate-700 shadow-2xl shadow-black/60 p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold tracking-tight">
                    Scan details
                  </h3>
                  <div className="text-[11px] text-slate-400">
                    {formatDate(selectedScan.checkedAt)}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedScan(null)}
                  className="text-xs px-2 py-1 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
                >
                  Close
                </button>
              </div>

              <div className="flex items-center justify-between">
                {renderRiskPill(selectedScan.riskLevel)}
                <span className="text-[11px] text-slate-400">
                  Score: {selectedScan.riskScore} •{" "}
                  {selectedScan.threatType}
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <div className="text-slate-400">URL / Document</div>
                <div className="font-mono text-[11px] text-slate-100 break-all">
                  {selectedScan.url || "(document)"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="space-y-1">
                  <div className="text-slate-400">User</div>
                  <div className="text-slate-100">
                    {selectedScan.userEmail || "unknown"}
                  </div>
                  <div className="text-slate-500">
                    {selectedScan.userType || "consumer"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-slate-400">Context</div>
                  <div className="text-slate-100">
                    {selectedScan.orgName || "Personal / N/A"}
                  </div>
                  <div className="text-slate-500">
                    Device: {selectedScan.deviceId || "unknown"}
                  </div>
                </div>
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="text-slate-400">Engine</div>
                <div className="text-slate-100">{selectedScan.engine}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
