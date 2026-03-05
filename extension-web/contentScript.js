// contentScript.js - ClickShield neon shield overlay + premium corner badge

const href = window.location.href || '';

// Auto-detect browser
function detectBrowser() {
  const ua = navigator.userAgent || '';
  if (ua.includes('Brave')) return 'brave';
  if (ua.includes('Edg')) return 'edge';
  return 'chrome';
}

// Only run on http/https pages
if (href.startsWith('http://') || href.startsWith('https://')) {
  console.log('[ClickShield][CS] Content script loaded on:', href);
  scanWithBackground(href);
}

function scanWithBackground(url) {
  // Avoid scanning inside iframes
  if (window.top !== window.self) return;

  console.log('[ClickShield][CS] Requesting scan for:', url);

  chrome.runtime.sendMessage(
    {
      type: 'SCAN_URL',
      url,
      browser: detectBrowser(),
    },
    (response) => {
      const shieldMode = (response && response.shieldMode) || 'normal';

      if (chrome.runtime.lastError) {
        console.warn(
          '[ClickShield][CS] Message error:',
          chrome.runtime.lastError.message
        );
        // Only show neutral badge in paranoid mode
        if (shieldMode === 'paranoid') {
          showCornerBadge({
            riskLevel: 'OFFLINE',
            threatType: 'ENGINE_ERROR',
          });
        }
        return;
      }
      if (!response || !response.ok) {
        console.warn(
          '[ClickShield][CS] Scan failed or no response:',
          response && response.error
        );
        if (shieldMode === 'paranoid') {
          const isOffline = response && response.backendOffline;
          showCornerBadge({
            riskLevel: isOffline ? 'OFFLINE' : 'UNKNOWN',
            threatType: 'ENGINE_ERROR',
          });
        }
        return;
      }

      console.log('[ClickShield][CS] Raw scan result:', response.data, 'shieldMode:', shieldMode);
      handleScanResult(
        response.data && response.data.scan ? response.data.scan : response.data,
        shieldMode
      );
    }
  );
}
function normalizeScanResult(result = {}) {
    // Unwrap common backend shapes:
    // - { ok: true, scan: {...} }
    // - { data: { ok: true, scan: {...} } }
    try {
      if (result && typeof result === 'object') {
        if (result.ok === true && result.scan && typeof result.scan === 'object') {
          result = result.scan;
        } else if (
          result.data &&
          typeof result.data === 'object' &&
          result.data.ok === true &&
          result.data.scan &&
          typeof result.data.scan === 'object'
        ) {
          result = result.data.scan;
        }
      }
    } catch {
      // keep original
    }

    // Support both camelCase and snake_case
    const rawRiskLevel =
      result.riskLevel ||
      result.risk_level ||
      result.ruleRiskLevel ||
      result.rule_risk_level ||
      'UNKNOWN';

    const rawRiskScore =
      typeof result.riskScore === 'number'
        ? result.riskScore
        : typeof result.risk_score === 'number'
        ? result.risk_score
        : typeof result.ruleScore === 'number'
        ? result.ruleScore
        : typeof result.rule_score === 'number'
        ? result.rule_score
        : null;

    const rawThreatType =
      result.threatType ||
      result.threat_type ||
      result.ruleThreatCategory ||
      result.rule_threat_category ||
      'UNKNOWN';

    const riskLevel = String(rawRiskLevel).toUpperCase();
    const riskScore = rawRiskScore;
    const threatType = String(rawThreatType);

    const reason =
      result.reason ||
      result.explanation ||
      result.ruleReason ||
      result.rule_reason ||
      'No additional explanation available.';

    const baseShortAdvice =
      result.shortAdvice ||
      result.advice ||
      (riskLevel === 'SAFE'
        ? 'Link appears low-risk, but always verify before connecting wallets or logging in.'
        : 'Treat this link as risky. Avoid connecting wallets or entering credentials unless you fully trust the source.');

    const url = result.url || result.scannedUrl || window.location.href;

    return {
      riskLevel,
      riskScore,
      threatType,
      reason,
      shortAdvice: baseShortAdvice,
      url,
    };
  }


function handleScanResult(rawResult, shieldMode) {
  const normalized = normalizeScanResult(rawResult);
  const { riskLevel, riskScore, threatType, reason, shortAdvice, url } =
    normalized;

  console.log('[ClickShield][CS] Normalized scan result:', normalized);

  if (riskLevel === 'DANGEROUS') {
    // Full-screen shield ALWAYS shows regardless of mode — security-critical
    showFullScreenShield({
      riskLevel,
      riskScore,
      threatType,
      reason,
      shortAdvice,
      url,
    });
    return;
  }

  // Corner badge only in paranoid mode
  if (shieldMode === 'paranoid') {
    showCornerBadge({
      riskLevel,
      riskScore,
      threatType,
    });
  } else {
    // Normal mode: remove any existing badge
    const existing = document.getElementById('clickshield-corner-badge');
    if (existing) existing.remove();
  }
}

function showFullScreenShield(info) {
  if (document.getElementById('clickshield-overlay-root')) {
    return;
  }

  const root = document.createElement('div');
  root.id = 'clickshield-overlay-root';
  root.innerHTML = getOverlayHtml(info);
  document.documentElement.appendChild(root);

  const leaveBtn = document.getElementById('clickshield-leave-btn');
  const proceedBtn = document.getElementById('clickshield-proceed-btn');

  if (leaveBtn) {
    leaveBtn.addEventListener('click', () => {
      try {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = 'about:blank';
        }
      } catch (e) {
        window.location.href = 'about:blank';
      }
    });
  }

  if (proceedBtn) {
    proceedBtn.addEventListener('click', () => {
      root.remove();
    });
  }
}

function getOverlayHtml(info) {
  const riskLabel = info.riskLevel || 'DANGEROUS';
  const score = info.riskScore != null ? info.riskScore : '\u2013';
  const threatType = info.threatType || 'Unknown';
  const reason = info.reason || '';
  const shortAdvice = info.shortAdvice || '';
  const url = info.url || window.location.href;

  return `
    <style>
      #clickshield-overlay-root {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
      }

      .cs-backdrop {
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at top, #0f172a 0, #020617 45%, #000 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        box-sizing: border-box;
      }

      .cs-grid {
        position: absolute;
        inset: 0;
        background-image: linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px);
        background-size: 24px 24px;
        pointer-events: none;
        opacity: 0.5;
      }

      .cs-panel {
        position: relative;
        max-width: 640px;
        width: 100%;
        background: rgba(15, 23, 42, 0.96);
        border-radius: 24px;
        border: 1px solid rgba(56, 189, 248, 0.5);
        box-shadow:
          0 0 0 1px rgba(15, 23, 42, 1),
          0 0 80px rgba(8, 47, 73, 0.9);
        padding: 24px;
        color: #e5e7eb;
        overflow: hidden;
      }

      .cs-panel::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at top, rgba(56, 189, 248, 0.25), transparent 55%);
        opacity: 0.4;
        pointer-events: none;
      }

      .cs-header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        position: relative;
        z-index: 1;
      }

      .cs-product-tag {
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #38bdf8;
        margin-bottom: 4px;
      }

      .cs-title {
        font-size: 20px;
        font-weight: 800;
        color: #f9fafb;
        margin: 0;
      }

      .cs-subtitle {
        font-size: 12px;
        color: #9ca3af;
        margin-top: 4px;
      }

      .cs-shield {
        width: 72px;
        height: 72px;
        border-radius: 999px;
        border: 2px solid rgba(248, 113, 113, 0.7);
        background: radial-gradient(circle at top, #ef4444, #7f1d1d);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow:
          0 0 40px rgba(248, 113, 113, 0.75),
          0 0 0 1px rgba(15, 23, 42, 1);
      }

      .cs-shield-icon {
        font-size: 32px;
        color: #fee2e2;
      }

      .cs-body {
        margin-top: 16px;
        position: relative;
        z-index: 1;
      }

      .cs-url {
        font-size: 11px;
        color: #9ca3af;
        margin-bottom: 8px;
        word-break: break-all;
      }

      .cs-risk-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .cs-risk-badge {
        font-size: 11px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid #ef4444;
        background: rgba(127, 29, 29, 0.85);
        color: #fee2e2;
      }

      .cs-score-pill {
        font-size: 11px;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(56, 189, 248, 0.6);
        color: #e0f2fe;
        background: rgba(15, 23, 42, 0.9);
      }

      .cs-threat-pill {
        font-size: 11px;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(251, 191, 36, 0.7);
        color: #facc15;
        background: rgba(23, 23, 23, 0.9);
      }

      .cs-reason {
        font-size: 12px;
        color: #e5e7eb;
        margin-bottom: 8px;
      }

      .cs-advice {
        font-size: 12px;
        color: #bfdbfe;
        margin-bottom: 16px;
      }

      .cs-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .cs-btn-primary {
        flex: 1;
        min-width: 120px;
        border-radius: 999px;
        border: none;
        padding: 9px 14px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        background: linear-gradient(90deg, #0ea5e9, #22d3ee);
        color: #0b1120;
        box-shadow: 0 0 24px rgba(56, 189, 248, 0.8);
      }

      .cs-btn-secondary {
        flex: 1;
        min-width: 120px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.7);
        padding: 9px 14px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        background: rgba(15, 23, 42, 0.9);
        color: #e5e7eb;
      }

      .cs-footer {
        margin-top: 12px;
        font-size: 10px;
        color: #6b7280;
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: center;
      }

      .cs-footer span {
        white-space: nowrap;
      }

      .cs-footer-right {
        text-align: right;
      }

      @media (max-width: 640px) {
        .cs-panel {
          padding: 16px;
          border-radius: 18px;
        }
        .cs-header-row {
          align-items: flex-start;
        }
        .cs-shield {
          width: 60px;
          height: 60px;
        }
      }
    </style>

    <div class="cs-backdrop">
      <div class="cs-grid"></div>
      <div class="cs-panel">
        <div class="cs-header-row">
          <div>
            <div class="cs-product-tag">ClickShield \u00b7 Web3 Protection</div>
            <h1 class="cs-title">Dangerous link blocked</h1>
            <p class="cs-subtitle">
              We detected high-risk crypto scam patterns on this page. Your wallet and assets may be at risk.
            </p>
          </div>
          <div class="cs-shield">
            <div class="cs-shield-icon">\u26a0\ufe0f</div>
          </div>
        </div>

        <div class="cs-body">
          <div class="cs-url">\${escapeHtml(url)}</div>

          <div class="cs-risk-row">
            <div class="cs-risk-badge">\${escapeHtml(riskLabel)}</div>
            <div class="cs-threat-pill">\${escapeHtml(threatType)}</div>
            <div class="cs-score-pill">Risk score: \${escapeHtml(String(score))}</div>
          </div>

          <div class="cs-reason">\${escapeHtml(reason)}</div>
          <div class="cs-advice">\${escapeHtml(shortAdvice)}</div>

          <div class="cs-buttons">
            <button id="clickshield-leave-btn" class="cs-btn-primary">
              Leave this site
            </button>
            <button id="clickshield-proceed-btn" class="cs-btn-secondary">
              Ignore and continue
            </button>
          </div>

          <div class="cs-footer">
            <div>
              <span>Engine: ClickShield rule engine</span>
            </div>
              <span>Protected by ClickShield</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function showCornerBadge(info) {
  // Always remove previous badge so the text updates with each scan
  const existing = document.getElementById('clickshield-corner-badge');
  if (existing) existing.remove();

  const riskLevel = (info.riskLevel || 'UNKNOWN').toUpperCase();

  let text = 'ClickShield: MONITORING';
  let subtext = '';
  let bg =
    'linear-gradient(90deg, rgba(37,99,235,0.95), rgba(8,47,73,0.95))';
  let border = '1px solid rgba(129,140,248,0.8)';

  if (riskLevel === 'SAFE') {
    text = 'ClickShield: SAFE';
    subtext = 'Low-risk page';
    bg =
      'linear-gradient(135deg, rgba(34,197,94,0.95), rgba(21,128,61,0.95))';
    border = '1px solid rgba(190,242,100,0.9)';
  } else if (riskLevel === 'SUSPICIOUS') {
    text = 'ClickShield: CHECK LINK';
    subtext = 'Suspicious patterns detected';
    bg =
      'linear-gradient(135deg, rgba(234,179,8,0.98), rgba(133,77,14,0.98))';
    border = '1px solid rgba(254,240,138,0.95)';
  } else if (riskLevel === 'DANGEROUS') {
    text = 'ClickShield: BLOCKED';
    subtext = 'Dangerous link';
    bg =
      'linear-gradient(135deg, rgba(248,113,113,0.98), rgba(127,29,29,0.98))';
    border = '1px solid rgba(254,202,202,0.95)';
  } else if (riskLevel === 'OFFLINE') {
    text = 'ClickShield: OFFLINE';
    subtext = 'Backend not running \u2014 start server';
    bg =
      'linear-gradient(135deg, rgba(239,68,68,0.9), rgba(127,29,29,0.9))';
    border = '1px solid rgba(252,165,165,0.9)';
  } else {
    text = 'ClickShield: MONITORING';
    subtext = 'Scan pending / limited';

    bg =
      'linear-gradient(135deg, rgba(148,163,184,0.95), rgba(30,64,175,0.95))';
    border = '1px solid rgba(209,213,219,0.9)';
  }

  console.log('[ClickShield][CS] Rendering corner badge with:', {
    riskLevel,
    text,
    subtext,
  });

  const badge = document.createElement('div');
  badge.id = 'clickshield-corner-badge';
  badge.style.position = 'fixed';
  badge.style.bottom = '12px';
  badge.style.right = '12px';
  badge.style.zIndex = '2147483646';
  badge.style.fontFamily =
    "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif";
  badge.style.fontSize = '11px';
  badge.style.color = '#f9fafb';
  badge.style.background = bg;
  badge.style.borderRadius = '999px';
  badge.style.padding = '6px 12px';
  badge.style.boxShadow = '0 16px 40px rgba(15,23,42,0.85)';
  badge.style.border = border;
  badge.style.display = 'flex';
  badge.style.alignItems = 'center';
  badge.style.gap = '8px';
  badge.style.backdropFilter = 'blur(12px)';
  badge.style.WebkitBackdropFilter = 'blur(12px)';
  badge.style.maxWidth = '260px';

  const textHtml = subtext
    ? `<div style="display:flex;flex-direction:column;line-height:1.2;">
         <span style="font-weight:600;">${escapeHtml(text)}</span>
         <span style="opacity:0.85;font-size:10px;">${escapeHtml(
           subtext
         )}</span>
       </div>`
    : `<div style="line-height:1.2;font-weight:600;">
         ${escapeHtml(text)}
       </div>`;

  badge.innerHTML = textHtml;

  document.documentElement.appendChild(badge);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
