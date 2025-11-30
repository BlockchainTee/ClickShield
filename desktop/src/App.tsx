// src/App.tsx - ClickShield Desktop Agent v1
// Simple, stable: health card + Quick URL Scan + Pasted Document Scan
// (Clipboard Guard reserved for v2)

import React, { useEffect, useState } from "react";

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

type HealthState = "unknown" | "ok" | "error";

const BACKEND_BASE = "http://localhost:4000";

// -------- Helper: basic URL heuristic --------
function looksLikeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.length < 8) return false;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return true;
  }

  return /\.[a-z]{2,}($|[\/\?#])/.test(trimmed);
}

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

  // =====================================================
  // Health check on load
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
    } catch (err: any) {
      setDocScanError(err?.message || "Failed to scan document.");
    } finally {
      setDocScanLoading(false);
    }
  }

  // =====================================================
  // Render helpers
  // =====================================================

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

        {/* Top row: Quick URL Scan */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40">
          <h2 className="text-sm font-semibold tracking-tight mb-2">
            Quick URL Scan
          </h2>
          <p className="text-xs text-slate-400 mb-3">
            Paste a link before you click. ClickShield runs deterministic rules
            first, then AI if available.
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

        {/* Bottom row: Pasted Document scan */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40">
          <h2 className="text-sm font-semibold tracking-tight mb-2">
            Pasted Document Scan
          </h2>
          <p className="text-xs text-slate-400 mb-3">
            Paste config files, environment variables, or wallet backup phrases.
            ClickShield will detect API keys, wallet recovery data, and other
            sensitive material. Raw text is only processed locally and encrypted
            before any at-rest storage.
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
    </div>
  );
};

export default App;
