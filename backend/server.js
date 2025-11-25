// server.js - clean, stable ClickShield backend with optional AI layer

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 4000;

// ===================== OpenAI / AI Setup =======================

let openai = null;

if (process.env.OPENAI_API_KEY) {
  try {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log(
      '[ClickShield][AI] OpenAI client initialized. Engine: RULE_PLUS_AI when available.'
    );
  } catch (err) {
    console.error(
      '[ClickShield][AI] Failed to initialize OpenAI client:',
      err.message || err
    );
    openai = null;
  }
} else {
  console.log(
    '[ClickShield][AI] OPENAI_API_KEY not set. Running in RULE_ONLY mode.'
  );
}

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
// ============== TRUSTED DOMAIN HELPERS ===============
// =====================================================

const TRUSTED_DOMAINS = [
  'lowes.com',
  'www.lowes.com',
  'openai.com',
  'platform.openai.com',
  'www.openai.com',
];

function isTrustedDomain(rawUrl) {
  if (!rawUrl) return false;
  try {
    const normalized =
      rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
        ? rawUrl
        : `https://${rawUrl}`;
    const u = new URL(normalized);
    const host = (u.hostname || '').toLowerCase();
    return TRUSTED_DOMAINS.includes(host);
  } catch {
    return false;
  }
}

// =====================================================
// ============== SIMPLE RULE ENGINE ===================
// =====================================================

function runRuleEngine(rawUrl) {
  const url = (rawUrl || '').toString();
  const lower = url.toLowerCase();

  // 0. Trusted allowlist: always SAFE, very low score
  if (isTrustedDomain(url)) {
    return {
      ruleRiskLevel: 'SAFE',
      ruleThreatCategory: 'TRUSTED_SITE',
      ruleScore: 5,
      ruleReason: 'Domain is on ClickShield trusted allowlist.',
    };
  }

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

  // Very short / weird URLs: note in the reason, but DO NOT flip to SUSPICIOUS
  if (url.length < 15 && riskLevel === 'SAFE') {
    // keep SAFE, just slightly adjust score + explanation
    score = 15;
    reason =
      'Short URL with no known scam patterns detected. Appears low-risk but always verify the source.';
  }

  return {
    ruleRiskLevel: riskLevel,
    ruleThreatCategory: threatType,
    ruleScore: score,
    ruleReason: reason,
  };
}

// =====================================================
// =================== AI ANALYSIS =====================
// =====================================================

async function runAiAnalysis({
  url,
  ruleResult,
  effectiveUserType,
  source,
}) {
  if (!openai) {
    return null;
  }

  try {
    const prompt = `
You are the AI engine for ClickShield, a Web3 and consumer security platform.

You receive:
- A URL that was just scanned
- The output of a deterministic rule engine (risk level, threat type, score, reason)
- Basic context: is this a consumer or business user, and the source (extension, mobile, dashboard, api).

Your job:
1. Briefly validate or lightly refine the rule engine's assessment.
2. Write a concise, business-friendly narrative (2-3 sentences) explaining the risk in clear language.
3. If the URL looks extremely benign, you can slightly reinforce SAFE, but do not override to SAFE if rules said DANGEROUS.
4. Focus heavily on wallet drainers, seed phrase theft, phishing, and common Web3 scam patterns.
5. Avoid long walls of text. No bullet points. No markdown. No headings.

Return ONLY a short paragraph (2–3 sentences) suitable for showing in a security dashboard or browser overlay.
`;

    const inputDescription = {
      url,
      ruleResult,
      userType: effectiveUserType,
      source,
    };

    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: prompt,
        },
        {
          role: 'user',
          content: JSON.stringify(inputDescription),
        },
      ],
    });

    const output = response.output?.[0]?.content?.[0];
    const text = output && output.text ? output.text.trim() : null;

    if (!text) {
      return null;
    }

    return {
      aiNarrative: text,
      aiModel: response.model || 'gpt-4.1-mini',
    };
  } catch (err) {
    console.error(
      '[ClickShield][AI] AI analysis failed:',
      err.message || err
    );
    return null;
  }
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

    // 1. Run rule engine (deterministic baseline)
    const ruleResult = runRuleEngine(url);

    const now = new Date().toISOString();
    const id =
      Date.now().toString() + Math.random().toString(36).slice(2);

    // Base response (rule-only)
    const responseBody = {
      url,
      riskLevel: ruleResult.ruleRiskLevel,
      riskScore: ruleResult.ruleScore,
      threatType: ruleResult.ruleThreatCategory,
      reason: ruleResult.ruleReason,
      shortAdvice:
        ruleResult.ruleRiskLevel === 'SAFE'
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

    // 2. Optional AI layer (narrative on top of rules)
    let aiResult = null;
    try {
      aiResult = await runAiAnalysis({
        url,
        ruleResult,
        effectiveUserType,
        source,
      });
    } catch (err) {
      console.error(
        '[ClickShield][AI] Unexpected AI error:',
        err.message || err
      );
    }

    if (aiResult && aiResult.aiNarrative) {
      responseBody.engine = 'RULE_PLUS_AI';
      responseBody.ai = aiResult;
    }

    // 3. Update in-memory recentScans buffer
    try {
      recentScans.unshift({
        id,
        url: responseBody.url,
        riskLevel: responseBody.riskLevel,
        riskScore: responseBody.riskScore,
        threatType: responseBody.threatType,
        userEmail: responseBody.context.userEmail || 'unknown',
        userType: responseBody.context.userType || effectiveUserType,
        orgId: responseBody.context.orgId || null,
        orgName: responseBody.context.orgName || null,
        deviceId: responseBody.context.deviceId || null,
        checkedAt: responseBody.checkedAt,
        source: responseBody.source || source,
        engine: responseBody.engine,
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
// ================ EXPORT ENDPOINTS ===================
// =====================================================

// Export recent scans as JSON (business-friendly)
app.get('/export/recent-scans.json', (req, res) => {
  const payload = {
    exportedAt: new Date().toISOString(),
    total: recentScans.length,
    scans: recentScans,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="clickshield-recent-scans.json"'
  );
  res.json(payload);
});

// Export recent scans as CSV
app.get('/export/recent-scans.csv', (req, res) => {
  const headers = [
    'id',
    'url',
    'riskLevel',
    'riskScore',
    'threatType',
    'userEmail',
    'userType',
    'orgId',
    'orgName',
    'deviceId',
    'checkedAt',
    'source',
    'engine',
  ];

  function escapeCsvValue(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const lines = [];
  lines.push(headers.join(','));

  for (const s of recentScans) {
    const row = [
      s.id,
      s.url,
      s.riskLevel,
      s.riskScore,
      s.threatType,
      s.userEmail,
      s.userType,
      s.orgId,
      s.orgName,
      s.deviceId,
      s.checkedAt,
      s.source,
      s.engine,
    ].map(escapeCsvValue);
    lines.push(row.join(','));
  }

  const csv = lines.join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="clickshield-recent-scans.csv"'
  );
  res.send(csv);
});

// =====================================================
// ================== START SERVER =====================
// =====================================================

app.listen(PORT, () => {
  console.log(`ClickShield backend running on port ${PORT}`);
});
