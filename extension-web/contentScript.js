// contentScript.js
// Injected into pages. Shows a small risk badge on every page,
// and a full-screen warning overlay for dangerous/suspicious sites.

(function () {
    const currentUrl = window.location.href;
  
    // Skip internal browser pages
    if (
      currentUrl.startsWith('chrome://') ||
      currentUrl.startsWith('edge://') ||
      currentUrl.startsWith('about:') ||
      currentUrl.startsWith('chrome-extension://')
    ) {
      return;
    }
  
    // Ask background.js to scan this URL
    chrome.runtime.sendMessage(
      { type: 'SCAN_URL', url: currentUrl },
      (response) => {
        if (!response || !response.ok) {
          console.warn('[ClickShield] Scan failed or no response');
          return;
        }
  
        const data = response.data || {};
        const riskLevel = (data.riskLevel || 'UNKNOWN').toUpperCase();
  
        // Always show a small badge so we know it's working
        showRiskBadge(riskLevel, data, currentUrl);
  
        // Only block if dangerous or suspicious
        if (riskLevel === 'DANGEROUS' || riskLevel === 'SUSPICIOUS') {
          showWarningOverlay(data, currentUrl);
        } else {
          console.log('[ClickShield] URL considered safe/low risk:', riskLevel);
        }
      }
    );
  
    function showRiskBadge(riskLevel, data, url) {
      if (document.getElementById('clickshield-risk-badge')) {
        return;
      }
  
      const badge = document.createElement('div');
      badge.id = 'clickshield-risk-badge';
  
      const bg =
        riskLevel === 'DANGEROUS'
          ? '#DC2626'
          : riskLevel === 'SUSPICIOUS'
          ? '#F97316'
          : riskLevel === 'SAFE'
          ? '#16A34A'
          : '#4B5563';
  
      const label =
        riskLevel === 'UNKNOWN' ? 'UNKNOWN' : riskLevel.toUpperCase();
  
      Object.assign(badge.style, {
        position: 'fixed',
        bottom: '12px',
        right: '12px',
        zIndex: '2147483647',
        backgroundColor: bg,
        color: '#F9FAFB',
        padding: '4px 10px',
        borderRadius: '999px',
        fontSize: '11px',
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
        boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        cursor: 'default',
      });
  
      const dot = document.createElement('span');
      Object.assign(dot.style, {
        width: '8px',
        height: '8px',
        borderRadius: '999px',
        backgroundColor: '#F9FAFB',
        opacity: '0.9',
      });
  
      const text = document.createElement('span');
      text.textContent = `ClickShield: ${label}`;
  
      badge.appendChild(dot);
      badge.appendChild(text);
  
      document.addEventListener('DOMContentLoaded', () => {
        if (!document.body.contains(badge)) {
          document.body.appendChild(badge);
        }
      });
  
      if (document.body) {
        document.body.appendChild(badge);
      }
    }
  
    function showWarningOverlay(data, url) {
      // Don't duplicate overlay
      if (document.getElementById('clickshield-warning-overlay')) {
        return;
      }
  
      const overlay = document.createElement('div');
      overlay.id = 'clickshield-warning-overlay';
      Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.88)',
        color: '#fff',
        zIndex: '2147483647',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        padding: '20px',
        boxSizing: 'border-box',
      });
  
      overlay.innerHTML = `
        <div style="
          max-width: 520px;
          width: 100%;
          background: #020617;
          border-radius: 18px;
          border: 1px solid #1F2937;
          box-shadow: 0 24px 60px rgba(0,0,0,0.7);
          padding: 20px 20px 16px;
          text-align: left;
        ">
          <div style="
            display:inline-flex;
            padding:2px 8px;
            border-radius:999px;
            border:1px solid ${data.riskLevel === 'DANGEROUS' ? '#DC2626' : '#F97316'};
            background-color:${data.riskLevel === 'DANGEROUS' ? '#DC262633' : '#F9731633'};
            color:${data.riskLevel === 'DANGEROUS' ? '#FECACA' : '#FED7AA'};
            font-size:11px;
            font-weight:700;
            margin-bottom:8px;
          ">
            ${data.riskLevel === 'DANGEROUS' ? 'DANGEROUS' : 'SUSPICIOUS'}
          </div>
  
          <h1 style="color:#F9FAFB; font-size:20px; font-weight:800; margin:0 0 4px;">
            ClickShield blocked this page
          </h1>
  
          <p style="font-size:13px; color:#9CA3AF; margin:0 0 12px;">
            This site looks like a crypto or phishing threat. Proceed only if you fully trust it.
          </p>
  
          <p style="
            font-size:12px;
            color:#E5E7EB;
            margin:0 0 8px;
            word-break:break-all;
          ">
            ${url}
          </p>
  
          <p style="font-size:12px; color:#D1D5DB; margin:0 0 4px;">
            ${data.reason || 'This page matches high-risk patterns in your ClickShield engine.'}
          </p>
  
          <p style="font-size:12px; color:#BFDBFE; margin:0 0 12px;">
            Advice: ${
              data.shortAdvice ||
              'Do not connect wallets, sign transactions, or enter seed phrases on this page.'
            }
          </p>
  
          <div style="
            display:flex;
            justify-content:space-between;
            font-size:11px;
            color:#6B7280;
            margin-bottom:12px;
            flex-wrap:wrap;
            gap:6px;
          ">
            <span>Threat: ${data.threatType || data.rule?.ruleThreatCategory || 'UNKNOWN'}</span>
            <span>Risk score: ${
              typeof data.riskScore === 'number' ? data.riskScore : 'n/a'
            }</span>
          </div>
  
          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button id="clickshield-leave" style="
              padding:6px 12px;
              border-radius:999px;
              border:none;
              background:#DC2626;
              color:#F9FAFB;
              font-size:13px;
              font-weight:600;
              cursor:pointer;
            ">
              Leave site
            </button>
            <button id="clickshield-proceed" style="
              padding:6px 12px;
              border-radius:999px;
              border:1px solid #4B5563;
              background:#020617;
              color:#E5E7EB;
              font-size:13px;
              font-weight:500;
              cursor:pointer;
            ">
              Proceed anyway
            </button>
          </div>
        </div>
      `;
  
      document.body.appendChild(overlay);
  
      document.getElementById('clickshield-leave').onclick = () => {
        try {
          window.location.href = 'about:blank';
        } catch (e) {
          window.history.back();
        }
      };
  
      document.getElementById('clickshield-proceed').onclick = () => {
        overlay.remove();
      };
    }
  })();
  