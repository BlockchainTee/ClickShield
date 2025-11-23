// background.js
// Handles calls to your ClickShield backend.

const API_BASE = 'http://localhost:4000'; // change if you use a different IP

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'SCAN_URL') {
    const url = message.url;
    console.log('[ClickShield] Scanning URL:', url);

    fetch(`${API_BASE}/scan-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        userType: 'browser-extension',
        orgId: 'personal',
        orgName: 'Personal',
        userId: 'browser-extension-user',
        userEmail: 'browser-extension@clickshield.app',
        deviceId: `browser-${message.browser || 'chromium'}`
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
        sendResponse({ ok: true, data });
      })
      .catch((err) => {
        console.error('[ClickShield] Backend error:', err);
        sendResponse({ ok: false, error: err.message });
      });

    // Keep channel open for async sendResponse
    return true;
  }
});
