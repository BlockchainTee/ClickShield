// src/App.tsx
// ClickShield Desktop Agent - Health + Quick URL Scan + Clipboard Auto-Scan + Document Scan

import { useEffect, useState } from "react";
import "./App.css";
import { readText } from "@tauri-apps/plugin-clipboard-manager";

type ScanResult = {
  url: string;
  riskLevel: string;
  riskScore: number;
  threatType: string;
  reason: string;
  shortAdvice: string;
  checkedAt: string;
  source?: string;
  engine?: string;
  ai?: {
    aiNarrative: string;
    aiModel: string;
  };
};

type DocumentScanResult = {
  id: string;
  filename: string | null;
  mimeType: string | null;
  riskLevel: string;
  riskScore: number;
  threatType: string;
  reason: string;
  checkedAt: string;
  engine?: string;
  ai?: {
    aiNarrative: string;
    aiModel: string;
  };
};

type Health = {
  status: string;
  service: string;
};

function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [urlInput, setUrlInput] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [autoScanResult, setAutoScanResult] = useState<ScanResult | null>(null);

  // Document scan state
  const [docFilename, setDocFilename] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docResult, setDocResult] = useState<DocumentScanResult | null>(null);
  const [docScanning, setDocScanning] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  // ---------------- HEALTH CHECK ----------------
  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch("http://localhost:4000/health");
        const data = await res.json();
        setHealth(data);
        setHealthError(null);
      } catch (err: any) {
        console.error("[ClickShield][Desktop] Health check failed:", err);
        setHealth(null);
        setHealthError("Backend unreachable on http://localhost:4000");
      }
    }

    fetchHealth();
  }, []);

  // ---------------- MANUAL URL SCAN ----------------
  async function handleManualScan() {
    if (!urlInput.trim()) return;

    setIsScanning(true);
    setScanError(null);
    setScanResult(null);

    try {
      const res = await fetch("http://localhost:4000/scan-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: urlInput.trim(),
          userType: "business",
          userEmail: "desktop-admin@clickshield.local",
          source: "desktop-agent",
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = (await res.json()) as ScanResult;
      setScanResult(data);
    } catch (err: any) {
      console.error("[ClickShield][Desktop] Manual scan failed:", err);
      setScanError(err?.message || "Scan failed");
    } finally {
      setIsScanning(false);
    }
  }

  // ---------------- DOCUMENT SCAN (pasted text) ----------------
  async function handleDocumentScan() {
    if (!docContent.trim()) return;

    setDocScanning(true);
    setDocError(null);
    setDocResult(null);

    try {
      const res = await fetch("http://localhost:4000/scan-document-encrypted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: docContent,
          filename: docFilename || "(pasted document)",
          mimeType: "text/plain",
          userType: "business",
          userEmail: "desktop-admin@clickshield.local",
          orgId: "desktop-org",
          orgName: "Desktop Agent",
          source: "desktop-agent",
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = (await res.json()) as DocumentScanResult;
      setDocResult(data);
    } catch (err: any) {
      console.error("[ClickShield][Desktop] Document scan failed:", err);
      setDocError(err?.message || "Document scan failed");
    } finally {
      setDocScanning(false);
    }
  }

  // ---------------- CLIPBOARD AUTO-SCAN ----------------
  useEffect(() => {
    let lastClipboard = "";

    const interval = setInterval(async () => {
      try {
        const text = await readText();

        if (!text) return;

        // Avoid hammering backend if clipboard hasn't changed
        if (text === lastClipboard) return;

        // Basic URL detection
        const urlRegex = /(https?:\/\/[^\s]+)/i;
        if (!urlRegex.test(text)) {
          lastClipboard = text;
          return;
        }

        lastClipboard = text;
        console.log("[ClickShield][Clipboard] URL detected:", text);

        const res = await fetch("http://localhost:4000/scan-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: text,
            userType: "consumer",
            userEmail: "local-agent@desktop",
            source: "desktop-agent",
          }),
        });

        if (!res.ok) {
          const t = await res.text();
          console.error(
            "[ClickShield][Clipboard] Scan failed:",
            res.status,
            t
          );
          return;
        }

        const data = (await res.json()) as ScanResult;
        console.log("[ClickShield][Clipboard][AutoScan]", data);
        setAutoScanResult(data);
      } catch (err) {
        console.error("[ClickShield][Clipboard] Monitor error:", err);
      }
    }, 400); // 400ms: fast but not insane

    return () => clearInterval(interval);
  }, []);

  // ---------------- RENDER ----------------
  return (
    <div
      className="app-root"
      style={{
        minHeight: "100vh",
        padding: "24px",
        background: "#020617",
        color: "#e5e7eb",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
            ClickShield Desktop Agent
          </h1>
          <p style={{ fontSize: 14, color: "#9ca3af" }}>
            Local security agent for URLs, clipboard, and document scanning.
          </p>
        </header>

        {/* Health Card */}
        <section
          style={{
            marginBottom: 24,
            padding: 16,
            borderRadius: 12,
            background:
              health && !healthError
                ? "rgba(22, 163, 74, 0.12)"
                : "rgba(220, 38, 38, 0.1)",
            border: `1px solid ${
              health && !healthError
                ? "rgba(22, 163, 74, 0.6)"
                : "rgba(220, 38, 38, 0.6)"
            }`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: 1.2,
              }}
            >
              Backend Health
            </div>
            {health && !healthError ? (
              <div style={{ fontSize: 14 }}>
                <strong>{health.status.toUpperCase()}</strong> •{" "}
                <span style={{ color: "#9ca3af" }}>{health.service}</span>
              </div>
            ) : (
              <div style={{ fontSize: 14 }}>
                <strong>UNAVAILABLE</strong> •{" "}
                <span style={{ color: "#f97373" }}>{healthError}</span>
              </div>
            )}
          </div>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              backgroundColor:
                health && !healthError ? "#22c55e" : "#ef4444",
              boxShadow: `0 0 12px ${
                health && !healthError
                  ? "rgba(34, 197, 94, 0.7)"
                  : "rgba(239, 68, 68, 0.7)"
              }`,
            }}
          ></div>
        </section>

        {/* Manual Quick URL Scan */}
        <section
          style={{
            marginBottom: 24,
            padding: 16,
            borderRadius: 12,
            background: "rgba(15, 23, 42, 0.9)",
            border: "1px solid rgba(148, 163, 184, 0.4)",
          }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Quick URL Scan</h2>
          <p
            style={{
              fontSize: 13,
              color: "#9ca3af",
              marginBottom: 12,
            }}
          >
            Paste or type a URL to scan it using ClickShield&apos;s rule
            engine + AI narrative.
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/suspicious-link"
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid rgba(75, 85, 99, 0.8)",
                background: "rgba(15, 23, 42, 0.9)",
                color: "#e5e7eb",
                fontSize: 13,
              }}
            />
            <button
              onClick={handleManualScan}
              disabled={isScanning || !urlInput.trim()}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 500,
                cursor:
                  isScanning || !urlInput.trim()
                    ? "not-allowed"
                    : "pointer",
                opacity: isScanning || !urlInput.trim() ? 0.6 : 1,
                background:
                  "linear-gradient(135deg, rgba(56, 189, 248, 0.9), rgba(59, 130, 246, 0.9))",
                color: "#020617",
              }}
            >
              {isScanning ? "Scanning..." : "Scan URL"}
            </button>
          </div>

          {scanError && (
            <div
              style={{
                fontSize: 12,
                color: "#f97373",
                marginBottom: 8,
              }}
            >
              {scanError}
            </div>
          )}

          {scanResult && (
            <div
              style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 10,
                background: "rgba(15, 23, 42, 0.9)",
                border: "1px solid rgba(148, 163, 184, 0.5)",
                fontSize: 13,
              }}
            >
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: "#9ca3af" }}>URL: </span>
                <span>{scanResult.url}</span>
              </div>
              <div style={{ marginBottom: 4 }}>
                <strong>{scanResult.riskLevel}</strong> • Score:{" "}
                {scanResult.riskScore} • {scanResult.threatType}
              </div>
              <div style={{ marginBottom: 4 }}>{scanResult.reason}</div>
              <div
                style={{
                  marginBottom: 4,
                  color: "#fbbf24",
                }}
              >
                {scanResult.shortAdvice}
              </div>
              {scanResult.ai && (
                <div
                  style={{
                    marginTop: 6,
                    paddingTop: 6,
                    borderTop: "1px solid #1f2937",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#9ca3af",
                      marginBottom: 2,
                    }}
                  >
                    AI Narrative · {scanResult.ai.aiModel}
                  </div>
                  <div>{scanResult.ai.aiNarrative}</div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Document Scan (pasted) */}
        <section
          style={{
            marginBottom: 24,
            padding: 16,
            borderRadius: 12,
            background: "rgba(15, 23, 42, 0.9)",
            border: "1px solid rgba(248, 250, 252, 0.06)",
          }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>
            Document Scan (Pasted Text)
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "#9ca3af",
              marginBottom: 12,
            }}
          >
            Paste any document snippet here (logs, config, seed phrase
            export, API keys) and ClickShield will classify sensitivity
            using deterministic rules + AI.
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              value={docFilename}
              onChange={(e) => setDocFilename(e.target.value)}
              placeholder="Filename (optional, e.g. wallet-notes.txt)"
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid rgba(75, 85, 99, 0.8)",
                background: "rgba(15, 23, 42, 0.9)",
                color: "#e5e7eb",
                fontSize: 13,
              }}
            />
          </div>

          <textarea
            value={docContent}
            onChange={(e) => setDocContent(e.target.value)}
            placeholder="Paste document content here (we never store plaintext; backend encrypts in-memory only flow)..."
            rows={6}
            style={{
              width: "100%",
              resize: "vertical",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(75, 85, 99, 0.8)",
              background: "rgba(15, 23, 42, 0.9)",
              color: "#e5e7eb",
              fontSize: 13,
              marginBottom: 8,
              fontFamily: "SF Mono, Menlo, Monaco, Consolas, monospace",
            }}
          />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <button
              onClick={handleDocumentScan}
              disabled={docScanning || !docContent.trim()}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 500,
                cursor:
                  docScanning || !docContent.trim()
                    ? "not-allowed"
                    : "pointer",
                opacity: docScanning || !docContent.trim() ? 0.6 : 1,
                background:
                  "linear-gradient(135deg, rgba(244, 114, 182, 0.9), rgba(168, 85, 247, 0.9))",
                color: "#020617",
              }}
            >
              {docScanning ? "Scanning..." : "Scan Document"}
            </button>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              Local agent → backend `/scan-document-encrypted` (RULES + AI)
            </div>
          </div>

          {docError && (
            <div
              style={{
                fontSize: 12,
                color: "#f97373",
                marginTop: 8,
              }}
            >
              {docError}
            </div>
          )}

          {docResult && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                background: "rgba(15, 23, 42, 0.9)",
                border: "1px solid rgba(148, 163, 184, 0.5)",
                fontSize: 13,
              }}
            >
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: "#9ca3af" }}>Document: </span>
                <span>{docResult.filename || "(document)"}</span>
              </div>
              <div style={{ marginBottom: 4 }}>
                <strong>{docResult.riskLevel}</strong> • Score:{" "}
                {docResult.riskScore} • {docResult.threatType}
              </div>
              <div style={{ marginBottom: 4 }}>{docResult.reason}</div>
              {docResult.ai && (
                <div
                  style={{
                    marginTop: 6,
                    paddingTop: 6,
                    borderTop: "1px solid #1f2937",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#9ca3af",
                      marginBottom: 2,
                    }}
                  >
                    AI Narrative · {docResult.ai.aiModel}
                  </div>
                  <div>{docResult.ai.aiNarrative}</div>
                </div>
              )}
              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: "#64748b",
                }}
              >
                Classified via RULE_ONLY or RULE_PLUS_AI. Plaintext is
                not stored; backend uses encryption path for at-rest
                handling.
              </div>
            </div>
          )}
        </section>

        {/* Clipboard Auto-Scan Banner */}
        {autoScanResult && (
          <section
            style={{
              position: "fixed",
              right: 16,
              bottom: 16,
              maxWidth: 360,
              padding: 12,
              borderRadius: 12,
              background: "rgba(15, 23, 42, 0.98)",
              border: "1px solid rgba(59, 130, 246, 0.8)",
              boxShadow: "0 15px 40px rgba(15, 23, 42, 0.8)",
              fontSize: 12,
              zIndex: 50,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#93c5fd",
                marginBottom: 4,
              }}
            >
              Clipboard Auto-Scan · desktop-agent
            </div>
            <div
              style={{
                fontSize: 12,
                marginBottom: 4,
                wordBreak: "break-all",
              }}
            >
              {autoScanResult.url}
            </div>
            <div style={{ marginBottom: 4 }}>
              <strong>{autoScanResult.riskLevel}</strong> • Score:{" "}
              {autoScanResult.riskScore} • {autoScanResult.threatType}
            </div>
            <div style={{ marginBottom: 4 }}>
              {autoScanResult.reason}
            </div>
            {autoScanResult.ai && (
              <div style={{ marginTop: 4 }}>
                <span
                  style={{
                    fontSize: 11,
                    color: "#9ca3af",
                  }}
                >
                  AI · {autoScanResult.ai.aiModel}
                </span>
                <div>{autoScanResult.ai.aiNarrative}</div>
              </div>
            )}
            <div
              style={{
                marginTop: 6,
                color: "#fbbf24",
              }}
            >
              {autoScanResult.shortAdvice}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
