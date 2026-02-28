# ClickShield Desktop Agent Security Audit

## Executive Summary
The current desktop agent is **not ready for public production launch**. Core release-security controls (code signing/notarization pipeline, signed updater, CSP hardening, TLS enforcement) are missing or disabled. The app has some resilience controls (timeouts, retry polling, offline cache) but fails key launch requirements for secure distribution and recovery guarantees.

## Launch Blockers

### LB-01: CSP disabled in Tauri and remote script execution enabled
- Location: `src-tauri/tauri.conf.json:20-22`, `index.html:8-14`
- Evidence:
  - `"csp": null`
  - `<script src="https://cdn.tailwindcss.com"></script>` and inline script block
- Impact: Any frontend injection or supply-chain compromise of remote script source can execute privileged desktop-context JS.
- Required fix:
  - Set explicit Tauri CSP in config.
  - Remove runtime CDN script dependency; bundle styles at build time.
  - Eliminate inline scripts or move to nonce/hash policy.

### LB-02: No signed auto-update mechanism
- Location: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`
- Evidence:
  - No updater plugin dependency/config.
  - No update endpoint/signature settings in Tauri config.
- Impact: No trusted patch channel for urgent security fixes; cannot verify update authenticity.
- Required fix:
  - Implement signed updater (Tauri updater plugin + signature verification).
  - Define secure update endpoint, key rotation, staged rollout, and rollback behavior.

### LB-03: Code-signing/notarization pipeline not configured
- Location: `src-tauri/tauri.conf.json`, repository root (no CI/release workflow files), no entitlement files in repo
- Evidence:
  - No macOS notarization/hardened-runtime automation.
  - No Windows signing pipeline artifacts/config.
  - No CI release validation/signature gates.
- Impact: High risk of failed distribution trust checks (Gatekeeper/SmartScreen) and store rejection.
- Required fix:
  - Add CI release pipeline with mandatory signing + verification.
  - Add macOS hardened runtime + notarization workflow.
  - Add Windows Authenticode signing and timestamping workflow.

### LB-04: TLS not enforced for backend traffic carrying sensitive payloads
- Location: `src/App.tsx:5-6`, `src/App.tsx:799-817`, `src/App.tsx:903-921`, `src/App.tsx:987-999`
- Evidence:
  - Default backend is `http://127.0.0.1:4000`.
  - URL scans and file uploads are sent to backend without HTTPS enforcement.
- Impact: If backend base is set to non-local HTTP, URL/file/identity metadata can be intercepted or modified.
- Required fix:
  - Enforce `https://` for non-loopback endpoints.
  - Explicitly pin allowed backend origins in production builds.

## High Priority

### H-01: IPC capability grants `opener:default` broad URL/path opening
- Location: `src-tauri/capabilities/default.json:8-11`
- Evidence:
  - Permission set includes `opener:default`.
- Impact: Increases blast radius of any renderer compromise/XSS by allowing external URL/path opening behavior.
- Required fix:
  - Remove unused opener capability, or scope allow-list to strict URLs/paths.

### H-02: Process plugin enabled in Rust runtime without aligned capability model
- Location: `src-tauri/src/main.rs:2-6`, `src-tauri/capabilities/default.json:8-12`, `src/App.tsx:477-483`
- Evidence:
  - Process plugin initialized in Rust.
  - No `process:*` permission in capability file.
  - UI attempts relaunch via plugin.
- Impact: Ambiguous runtime behavior for restart/recovery; hardening policy drift.
- Required fix:
  - Either remove process plugin or explicitly grant minimal needed process permissions and test restart path.

### H-03: Sensitive operational data persisted in localStorage without protection
- Location: `src/App.tsx:70-81`, `src/App.tsx:83-88`, `src/App.tsx:553-586`
- Evidence:
  - Stores scan history, URLs/doc markers, userEmail/org/device identifiers in localStorage.
- Impact: Local compromise/malware or renderer compromise can exfiltrate retained scan history and metadata.
- Required fix:
  - Minimize retained fields, add retention expiry, and consider encrypted local storage for sensitive metadata.

### H-04: No release pipeline controls for artifact integrity
- Location: repository root (`.github` missing), `package.json:6-14`
- Evidence:
  - No CI workflow for build reproducibility, hash/signature verification, or release policy checks.
- Impact: Manual releases are vulnerable to tampering and inconsistent signing.
- Required fix:
  - Add CI checks for lockfile integrity, reproducible build, artifact hashing, signature verification, and policy gating.

## Medium

### M-01: No custom Tauri commands (good), but default core IPC still exposed
- Location: `src-tauri/src/main.rs`, `src-tauri/capabilities/default.json`
- Evidence:
  - No `#[tauri::command]` found.
  - `core:default` present.
- Impact: IPC surface is lower than typical, but not zero.
- Required fix:
  - Keep command surface minimal; explicitly deny unused permissions as app grows.

### M-02: Retry logic is fixed-interval (no backoff/jitter)
- Location: `src/App.tsx:90`, `src/App.tsx:602-610`, `src/App.tsx:703`, `src/App.tsx:1350`
- Evidence:
  - Poll every 2.5s while offline.
- Impact: Can create thundering retries under partial outage.
- Required fix:
  - Use bounded exponential backoff with jitter, keep 5s recovery target by capping interval.

### M-03: Recent scan memory/state growth can become unbounded
- Location: `src/App.tsx:683-688`, `src/App.tsx:849`, `src/App.tsx:951`, `src/App.tsx:1028`, `src/App.tsx:1134`
- Evidence:
  - `recentScans` merge/dedupe has no hard cap.
- Impact: Long-running sessions may increase memory and local storage footprint.
- Required fix:
  - Cap in-memory/history records (for example latest N).

### M-04: Crash recovery is partial (backend retry only)
- Location: `src/App.tsx:535-639`, `src/App.tsx:723-747`, `src/App.tsx:1210-1227`
- Evidence:
  - Handles backend offline with retries and cache.
  - No watchdog/supervisor for full app process crash.
- Impact: Does not satisfy strict “recover within 5 seconds from failure” for app-level crashes.
- Required fix:
  - Add OS-level/service watchdog or launcher supervisor strategy.

## Low

### L-01: No unsafe eval usage observed
- Location: frontend and Rust sources scanned
- Evidence:
  - No `eval`, `new Function`, `dangerouslySetInnerHTML`, or `innerHTML` sinks found in app code.
- Residual risk:
  - CSP still required because future changes and third-party scripts can reintroduce injection risk.

### L-02: Shell/command execution plugin not enabled (positive)
- Location: `src-tauri/Cargo.toml`
- Evidence:
  - No shell plugin dependency.
- Residual risk:
  - Reassess if shell/file-system plugins are added later.

## Requested Coverage Summary
- Tauri configuration: present, but security posture is permissive (`csp: null`).
- Auto-update setup: missing.
- Code signing + notarization readiness: missing build pipeline evidence.
- IPC exposure: limited custom IPC, but default core + opener capability exposed.
- Shell/command restrictions: shell plugin absent (good); process plugin enabled.
- Unsafe eval: not found.
- File system scope: no filesystem plugin/capabilities found.
- Credential handling: no auth tokens found; sends static identity metadata to backend.
- TLS enforcement: missing for non-local backend targets.
- Seed/private key handling: no seed/private-key code found.
- Signed update verification/rollback/update endpoint security: missing (no updater implementation).
- Crash/recovery: backend retry exists; process crash watchdog absent.
- Offline fallback: URL scan cache + recent history cache present; document scan has no offline fallback.
- Performance/resilience: request timeouts present; retry/backoff strategy weak; state growth uncapped.
- Privacy surface: URLs, documents, user/org/device metadata leave device via backend requests.
- Telemetry defaults: no explicit telemetry SDK observed.
- Build pipeline: no CI release/signature/integrity workflow found.
- Dev/prod separation: weak; production safety gates absent.
