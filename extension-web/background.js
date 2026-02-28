// background.js - ClickShield backend proxy

const API_BASE = 'http://localhost:4000';

// Log basic lifecycle
chrome.runtime.onInstalled.addListener(() => {
  console.log('ClickShield Web3 Protection installed.');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('ClickShield Web3 Protection started.');
});

// Listen for scan requests from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'SCAN_URL') {
    const url = message.url;
    const browserName = message.browser || 'chromium';

    console.log('[ClickShield][BG] Scanning URL from content script:', url);

    fetch(`${API_BASE}/scan-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-clickshield-org-id': 'demo-acme',
          'x-org-id': 'demo-acme',
        },
        body: JSON.stringify({
          url,
          userType: 'consumer',
          userId: 'browser-extension-user',
          userEmail: 'browser-extension@clickshield.app',
          deviceId: `browser-${browserName}`,
          source: 'browser-extension',
        }),
      })
      
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Backend error ${res.status}: ${txt}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log('[ClickShield][BG] Scan success:', data);
        sendResponse({ ok: true, data });
      })
      .catch((err) => {
        console.error('[ClickShield][BG] Scan failed:', err?.message || err);
        sendResponse({ ok: false, error: err?.message || 'Unknown error' });
      });

    // Tell Chrome we will reply asynchronously
    return true;
  }
});
