// background.js - ClickShield backend proxy

const API_BASE = 'http://localhost:4000';

// Backend connectivity state (shared with popup via chrome.runtime messages)
let backendOnline = false;
let lastHealthCheck = null;

// Shield mode state (synced from backend on startup + every scan response)
let currentShieldMode = 'normal';

// Detect browser from service worker context
function detectBrowser() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (ua.includes('Brave')) return 'brave';
  if (ua.includes('Edg')) return 'edge';
  return 'chrome';
}

const detectedBrowser = detectBrowser();

// Fetch shield mode from backend
async function fetchShieldMode() {
  try {
    const res = await fetch(`${API_BASE}/shield-mode`);
    if (res.ok) {
      const data = await res.json();
      if (data.shieldMode === 'normal' || data.shieldMode === 'paranoid') {
        currentShieldMode = data.shieldMode;
        console.log('[ClickShield][BG] Shield mode updated:', currentShieldMode);
      }
    }
  } catch (err) {
    console.warn('[ClickShield][BG] Could not fetch shield-mode:', err?.message || err);
  }
}

// Health check: ping backend and update status
async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      backendOnline = data.status === 'ok';
    } else {
      backendOnline = false;
    }
  } catch {
    backendOnline = false;
  }
  lastHealthCheck = new Date().toISOString();
  console.log(`[ClickShield][BG] Health check: backend ${backendOnline ? 'ONLINE' : 'OFFLINE'}`);
}

// Run health check + fetch shield mode on install and startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('ClickShield Web3 Protection installed.');
  checkBackendHealth();
  fetchShieldMode();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('ClickShield Web3 Protection started.');
  checkBackendHealth();
  fetchShieldMode();
});

// Re-check health every 60 seconds via alarm
chrome.alarms.create('healthCheck', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'healthCheck') {
    checkBackendHealth();
  }
});

// Scan with one retry
async function scanUrl(url, browserName) {
  const doFetch = () =>
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
    });

  let res;
  try {
    res = await doFetch();
  } catch (err) {
    // First attempt failed — wait 2s and retry once
    console.warn('[ClickShield][BG] Scan fetch failed, retrying in 2s:', err?.message);
    await new Promise((r) => setTimeout(r, 2000));
    res = await doFetch();
  }

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Backend error ${res.status}: ${txt}`);
  }
  return res.json();
}

// Listen for scan requests from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'SCAN_URL') {
    const url = message.url;
    const browserName = message.browser || detectedBrowser;

    console.log('[ClickShield][BG] Scanning URL from content script:', url);

    scanUrl(url, browserName)
      .then((data) => {
        backendOnline = true;
        console.log('[ClickShield][BG] Scan success:', data);

        // Update local shield mode from scan response
        if (data.shieldMode === 'normal' || data.shieldMode === 'paranoid') {
          currentShieldMode = data.shieldMode;
        }

        sendResponse({ ok: true, data, shieldMode: currentShieldMode });
      })
      .catch((err) => {
        backendOnline = false;
        console.error('[ClickShield][BG] Scan failed:', err?.message || err);
        sendResponse({
          ok: false,
          error: err?.message || 'Unknown error',
          backendOffline: true,
          shieldMode: currentShieldMode,
        });
      });

    // Tell Chrome we will reply asynchronously
    return true;
  }

  // Handle status queries from popup
  if (message && message.type === 'GET_STATUS') {
    sendResponse({
      backendOnline,
      lastHealthCheck,
      browser: detectedBrowser,
      apiBase: API_BASE,
      shieldMode: currentShieldMode,
    });
    return false;
  }
});
