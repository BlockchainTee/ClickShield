// server.js - clean, stable ClickShield backend

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

// Basic middleware
app.use(cors());
app.use(express.json());

// =====================================================
// ================ HEALTH CHECK =======================
// =====================================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'clickshield-backend' });
});

// =====================================================
// ================== CURRENT USER =====================
// =====================================================
// Simple static /me so the dashboard can load a demo user/org
app.get('/me', (req, res) => {
  res.json({
    user: {
      id: 'demo-user-1',
      email: 'security@acmecorp.com',
      name: 'Acme Security Admin',
    },
    org: {
      id: 'demo-acme',
      name: 'Acme Corp',
    },
    role: 'admin',
  });
});

// =====================================================
// ============ IN-MEMORY RECENT SCANS BUFFER =========
// =====================================================
const RECENT_SCANS_MAX = 200;
const recentScans = [];

// =====================================================
// ============== SIMPLE RULE ENGINE ===================
// =====================================================

function runRuleEngine(rawUrl) {
  const url = (rawUrl || '').toString();
  const lower = url.toLowerCase();

  let riskLevel = 'SAFE';
  let threatType = 'GENERIC';
  let score = 10;
  let reason = 'No obvious threat patterns detected.';

  const dangerousKeywords = [
    'seed-phrase',
    'seedphrase',
    'private-key',
    'privatekey',
    'drainer',
    'walletdrainer',
    'verify-seed',
    'recovery-phrase',
  ];

  const suspiciousKeywords = [
    'airdrop',
    'claim',
    'mint',
    'bonus',
    'giveaway',
    'login',
    'signin',
    'sign-in',
    'metamask',
    'phantom',
    'keplr',
    'ledger',
    'trezor',
  ];

  let matchedDangerous = [];
  let matchedSuspicious = [];

  for (const k of dangerousKeywords) {
    if (lower.includes(k)) matchedDangerous.push(k);
  }
  for (const k of suspiciousKeywords) {
    if (lower.includes(k)) matchedSuspicious.push(k);
  }

  // Rough heuristic for wallet-drainer URLs
  const looksLikeWalletConnect =
    lower.includes('walletconnect') ||
    lower.includes('wc?uri=') ||
    lower.includes('wc=');

  const looksLikeLoginPhish =
    lower.includes('login') &&
    (lower.includes('metamask') ||
      lower.includes('phantom') ||
      lower.includes('binance') ||
      lower.includes('coinbase'));

  if (matchedDangerous.length > 0 || looksLikeWalletConnect) {
    riskLevel = 'DANGEROUS';
    threatType = 'PHISHING_DRAINER';
    score = 90;
    reason =
      'URL matches high-risk crypto scam patterns (wallet drainer / seed phrase).';
  } else if (matchedSuspicious.length > 0 || looksLikeLoginPhish) {
    riskLevel = 'SUSPICIOUS';
    threatType = 'PHISHING_LURE';
    score = 65;
    reason =
      'URL contains common crypto airdrop / login lure patterns. Treat with caution.';
  }

  // Very short / weird URLs also suspicious
  if (url.length < 15 && riskLevel === 'SAFE') {
    riskLevel = 'SUSPICIOUS';
    threatType = 'GENERIC_SHORT_URL';
    score = 40;
    reason =
      'Very short URL. Could be a redirect or obfuscated link. Verify source before using.';
  }

  return {
    ruleRiskLevel: riskLevel,
    ruleThreatCategory: threatType,
    ruleScore: score,
    ruleReason: reason,
  };
}

// =====================================================
// =============== SOURCE DERIVATION ===================
// =====================================================

function deriveSourceFromBody(body = {}) {
  try {
    const rawSource =
      (body.source ||
        body.userType ||
        body.user_type ||
        '').toString().toLowerCase();

    if (rawSource === 'browser-extension' || rawSource === 'extension') {
      return 'extension';
    }
    if (rawSource === 'consumer' || rawSource === 'mobile') {
      return 'mobile';
    }
    if (
      rawSource === 'business' ||
      rawSource === 'dashboard' ||
      rawSource === 'admin'
    ) {
      return 'dashboard';
    }

    return 'api';
  } catch {
    return 'api';
  }
}

// =====================================================
// =============== URL SCAN ENDPOINT ===================
// =====================================================

app.post('/scan-url', async (req, res) => {
  try {
    const { url, userType, orgId, orgName, userId, userEmail, deviceId } =
      req.body || {};

    if (!url || typeof url !== 'string') {
      return res
        .status(400)
        .json({ error: 'url is required as a string' });
    }

    const source = deriveSourceFromBody(req.body);
    const effectiveUserType =
      userType === 'business' ? 'business' : 'consumer';

    // 1. Run rule engine
    const ruleResult = runRuleEngine(url);

    // For now we skip AI; this is a stable rule-only engine.
    const finalRiskLevel = ruleResult.ruleRiskLevel;
    const finalThreatType = ruleResult.ruleThreatCategory;
    const finalRiskScore = ruleResult.ruleScore;

    const now = new Date().toISOString();
    const id =
      Date.now().toString() + Math.random().toString(36).slice(2);

    const responseBody = {
      url,
      riskLevel: finalRiskLevel,
      riskScore: finalRiskScore,
      threatType: finalThreatType,
      reason: ruleResult.ruleReason,
      shortAdvice:
        finalRiskLevel === 'SAFE'
          ? 'Link appears low-risk, but always verify before connecting wallets or logging in.'
          : 'Treat this link as risky. Avoid connecting wallets or entering credentials unless you fully trust the source.',
      checkedAt: now,
      source, // "mobile" | "extension" | "dashboard" | "api"
      engine: 'RULE_ONLY',
      context: {
        userType: effectiveUserType,
        orgId: orgId || null,
        orgName: orgName || null,
        userId: userId || null,
        userEmail: userEmail || null,
        deviceId: deviceId || null,
      },
    };

    // Update in-memory recentScans buffer
    try {
      recentScans.unshift({
        id,
        url: responseBody.url,
        riskLevel: responseBody.riskLevel,
        riskScore: finalRiskScore,
        threatType: responseBody.threatType,
        userEmail: responseBody.context.userEmail || 'unknown',
        userType: responseBody.context.userType || effectiveUserType,
        orgId: responseBody.context.orgId || null,
        orgName: responseBody.context.orgName || null,
        deviceId: responseBody.context.deviceId || null,
        checkedAt: responseBody.checkedAt,
        source: responseBody.source || source,
      });
      if (recentScans.length > RECENT_SCANS_MAX) {
        recentScans.length = RECENT_SCANS_MAX;
      }
    } catch (err) {
      console.error(
        'Failed to update in-memory recentScans:',
        err.message || err
      );
    }

    res.json(responseBody);
  } catch (err) {
    console.error('Error in /scan-url:', err.message || err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// ============ DASHBOARD DATA ENDPOINTS ===============
// =====================================================

// Metrics computed from in-memory recentScans
app.get('/metrics', (req, res) => {
  const totalScans = recentScans.length;
  let dangerousCount = 0;
  let suspiciousCount = 0;
  let safeCount = 0;
  let lastScanAt = null;

  for (const s of recentScans) {
    const risk = (s.riskLevel || '').toString().toUpperCase();
    if (risk === 'DANGEROUS') dangerousCount++;
    else if (risk === 'SUSPICIOUS') suspiciousCount++;
    else if (risk === 'SAFE') safeCount++;

    if (!lastScanAt || (s.checkedAt || '') > lastScanAt) {
      lastScanAt = s.checkedAt || null;
    }
  }

  res.json({
    totalScans,
    dangerousCount,
    suspiciousCount,
    safeCount,
    lastScanAt,
  });
});

// Weekly report for the last 7 days from in-memory recentScans
app.get('/weekly-report', (req, res) => {
  const now = new Date();
  const weekEnd = now.toISOString();
  const weekStartDate = new Date(now);
  weekStartDate.setDate(now.getDate() - 7);
  const weekStart = weekStartDate.toISOString();

  const inRange = recentScans.filter((s) => {
    if (!s.checkedAt) return false;
    return s.checkedAt >= weekStart && s.checkedAt <= weekEnd;
  });

  let totalScans = inRange.length;
  let dangerousCount = 0;
  let suspiciousCount = 0;
  let safeCount = 0;
  const typeCounts = {};

  for (const s of inRange) {
    const risk = (s.riskLevel || '').toString().toUpperCase();
    if (risk === 'DANGEROUS') dangerousCount++;
    else if (risk === 'SUSPICIOUS') suspiciousCount++;
    else if (risk === 'SAFE') safeCount++;

    const t = (s.threatType || 'UNKNOWN').toString();
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }

  const topThreatTypes = Object.entries(typeCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  res.json({
    weekStart,
    weekEnd,
    totalScans,
    dangerousCount,
    suspiciousCount,
    safeCount,
    topThreatTypes,
  });
});

// Recent scans list for dashboard table
app.get('/recent-scans', (req, res) => {
  res.json(recentScans);
});

// =====================================================
// ================== START SERVER =====================
// =====================================================

app.listen(PORT, () => {
  console.log(`ClickShield backend running on port ${PORT}`);
});
