// popup.js - ClickShield extension popup

const statusDot = document.getElementById('status-dot');
const statusLabel = document.getElementById('status-label');
const statusDetail = document.getElementById('status-detail');
const browserName = document.getElementById('browser-name');
const apiBase = document.getElementById('api-base');
const lastCheck = document.getElementById('last-check');
const helpSection = document.getElementById('help-section');
const versionEl = document.getElementById('version');

// Get version from manifest
const manifest = chrome.runtime.getManifest();
versionEl.textContent = `v${manifest.version}`;

// Query background for status
chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
  if (chrome.runtime.lastError || !response) {
    statusDot.className = 'status-dot offline';
    statusLabel.textContent = 'Service worker error';
    statusDetail.textContent = '';
    helpSection.style.display = 'block';
    return;
  }

  const { backendOnline, lastHealthCheck, browser, apiBase: base } = response;

  if (backendOnline) {
    statusDot.className = 'status-dot online';
    statusLabel.textContent = 'Backend Online';
    statusDetail.textContent = 'Scanning active';
    helpSection.style.display = 'none';
  } else {
    statusDot.className = 'status-dot offline';
    statusLabel.textContent = 'Backend Offline';
    statusDetail.textContent = 'Scans unavailable';
    helpSection.style.display = 'block';
  }

  browserName.textContent = (browser || 'unknown').charAt(0).toUpperCase() + (browser || 'unknown').slice(1);
  apiBase.textContent = base || 'http://localhost:4000';

  if (lastHealthCheck) {
    const d = new Date(lastHealthCheck);
    lastCheck.textContent = d.toLocaleTimeString();
  } else {
    lastCheck.textContent = 'Never';
  }
});
