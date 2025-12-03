// server.js - clean, stable ClickShield backend with optional AI layer

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const crypto = require('crypto');

// >>> ENV SETUP (keep this exactly as-is)
require('dotenv').config({ override: true });
console.log(
  '[ClickShield][AI] Loaded OPENAI_API_KEY prefix:',
  process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.slice(0, 10) : 'none'
);
// <<< ENV SETUP

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

// Document encryption key (for encrypted doc scanning)
const DOC_ENCRYPTION_KEY_HEX = process.env.DOC_ENCRYPTION_KEY || null;
if (!DOC_ENCRYPTION_KEY_HEX) {
  console.warn(
    '[ClickShield][DOC] DOC_ENCRYPTION_KEY not set. Encrypted document scanning will run in RULE_ONLY mode.'
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

async function runAiAnalysis({ url, ruleResult, effectiveUserType, source }) {
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
    const status = err.status || err.statusCode || null;

    console.error(
      '[ClickShield][AI] AI analysis failed:',
      status ? `${status} ${err.message || err}` : err.message || err
    );

    // AUTO-DISABLE AI for this process after a 401
    if (status === 401) {
      console.error(
        '[ClickShield][AI] Disabling AI for this process (401). Running in RULE_ONLY mode.'
      );
      openai = null;
    }

    return null;
  }
}

// >>> Document security helpers

function runDocumentRuleEngine(content) {
  const text = (content || '').toString();
  const lower = text.toLowerCase();

  let docRiskLevel = 'SAFE';
  let docThreatType = 'GENERIC';
  let docScore = 10;
  let docReason =
    'No obvious wallet recovery data, private keys, API secrets, or phishing patterns detected.';

  // 1) Wallet / secrets detection
  const walletIndicators = [
    'seed phrase',
    'seed-phrase',
    'recovery phrase',
    'recovery-phrase',
    'mnemonic',
    'private key',
    'private-key',
    'secret recovery phrase',
  ];

  const apiIndicators = [
    'api key',
    'api_key',
    'bearer ',
    'authorization: bearer',
    'sk-',
  ];

  const phishingIndicators = [
    'invoice notice',
    'payment is overdue',
    'overdue payment',
    'avoid legal action',
    'legal action',
    'account suspension',
    'your account will be suspended',
    'click the link below',
    'click the link to',
    'secure-payments',
    'secure payment portal',
    'verify your account',
    'login to avoid',
    'login to prevent',
    'update your billing',
  ];

  const urlRegex = /https?:\/\/[^\s"')]+/gi;
  const hasUrl = urlRegex.test(text);

  let secretHits = [];
  let phishingHits = [];

  for (const k of walletIndicators) {
    if (lower.includes(k)) secretHits.push(k);
  }
  for (const k of apiIndicators) {
    if (lower.includes(k)) secretHits.push(k);
  }
  for (const k of phishingIndicators) {
    if (lower.includes(k)) phishingHits.push(k);
  }

  if (secretHits.length > 0) {
    docRiskLevel = 'SENSITIVE';
    docThreatType = 'SECRETS_OR_WALLET_DATA';
    docScore = 90;
    docReason =
      'Document appears to contain wallet recovery phrases or API / secret tokens. Treat and store as highly sensitive.';
  } else if (hasUrl && phishingHits.length > 0) {
    docRiskLevel = 'DANGEROUS';
    docThreatType = 'PHISHING_DOC';
    docScore = 80;
    docReason =
      'Document looks like a phishing or scam message (invoice / payment / legal threat) containing a link. Treat with extreme caution.';
  } else if (text.length < 40 && docRiskLevel === 'SAFE') {
    docScore = 15;
    docReason =
      'Very short document with no known secret or phishing patterns detected. Appears low-risk but handle carefully if it was pasted from a secure source.';
  }

  return {
    docRiskLevel,
    docThreatType,
    docScore,
    docReason,
  };
}

function encryptDocumentContent(plaintext) {
  if (!DOC_ENCRYPTION_KEY_HEX || DOC_ENCRYPTION_KEY_HEX.length !== 64) {
    return {
      mode: 'PLAIN_NO_KEY',
      ciphertext: null,
      iv: null,
      authTag: null,
      note:
        'DOC_ENCRYPTION_KEY is not set or invalid; document was only processed in-memory and not encrypted for storage.',
    };
  }

  const key = Buffer.from(DOC_ENCRYPTION_KEY_HEX, 'hex');

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    mode: 'AES-256-GCM',
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

// =====================================================
// ===== ENCRYPTED DOCUMENT SCANNING ENDPOINT ==========
// =====================================================

app.post('/scan-document-encrypted', async (req, res) => {
  try {
    const {
      content,
      filename,
      mimeType,
      userId,
      userEmail,
      orgId,
      orgName,
      userType,
      source,
    } = req.body || {};

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content (string) is required' });
    }

    const effectiveUserType =
      userType === 'business' ? 'business' : 'consumer';

    const ruleResult = runDocumentRuleEngine(content);

    const now = new Date().toISOString();
    const id = Date.now().toString() + Math.random().toString(36).slice(2);

    const encryptionResult = encryptDocumentContent(content);

    let aiResult = null;
    if (openai) {
      try {
        const prompt = `
You are the document security AI for ClickShield.

You receive:
- A short classification from a document rule engine
- Basic metadata (filename, mimeType, user type: consumer or business)

Your job:
1. Explain in 2–3 sentences whether this document looks sensitive or risky.
2. Call out if it appears to contain crypto wallet recovery data, private keys, or API secrets.
3. Use calm, business-friendly language. No markdown, no bullet points.
`;

        const inputDescription = {
          filename: filename || null,
          mimeType: mimeType || null,
          ruleResult,
          userType: effectiveUserType,
          source: source || 'document',
        };

        const response = await openai.responses.create({
          model: 'gpt-4.1-mini',
          input: [
            { role: 'system', content: prompt },
            {
              role: 'user',
              content: JSON.stringify(inputDescription),
            },
          ],
        });

        const output = response.output?.[0]?.content?.[0];
        const text = output && output.text ? output.text.trim() : null;

        if (text) {
          aiResult = {
            aiNarrative: text,
            aiModel: response.model || 'gpt-4.1-mini',
          };
        }
      } catch (err) {
        console.error(
          '[ClickShield][DOC][AI] AI analysis failed:',
          err.message || err
        );
      }
    }

    const responseBody = {
      id,
      filename: filename || null,
      mimeType: mimeType || null,
      riskLevel: ruleResult.docRiskLevel,
      riskScore: ruleResult.docScore,
      threatType: ruleResult.docThreatType,
      reason: ruleResult.docReason,
      checkedAt: now,
      source: source || 'document',
      engine: aiResult ? 'RULE_PLUS_AI' : 'RULE_ONLY',
      context: {
        userType: effectiveUserType,
        orgId: orgId || null,
        orgName: orgName || null,
        userId: userId || null,
        userEmail: userEmail || null,
      },
      encryption: encryptionResult,
      ai: aiResult || null,
    };

    try {
      recentScans.unshift({
        id,
        url: filename || '(document)',
        riskLevel: responseBody.riskLevel,
        riskScore: responseBody.riskScore,
        threatType: responseBody.threatType,
        userEmail: userEmail || 'unknown',
        userType: effectiveUserType,
        orgId: orgId || null,
        orgName: orgName || null,
        deviceId: 'doc-scan',
        checkedAt: now,
        source: responseBody.source,
        engine: responseBody.engine,
      });
      if (recentScans.length > RECENT_SCANS_MAX) {
        recentScans.length = RECENT_SCANS_MAX;
      }
    } catch (err) {
      console.error(
        '[ClickShield][DOC] Failed to update recentScans:',
        err.message || err
      );
    }

    res.json(responseBody);
  } catch (err) {
    console.error('Error in /scan-document-encrypted:', err.message || err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// =============== SOURCE DERIVATION ===================
// =====================================================

function deriveSourceFromBody(body = {}) {
  try {
    const rawSource =
      (body.source || body.userType || body.user_type || '')
        .toString()
        .toLowerCase();

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
      return res.status(400).json({ error: 'url is required as a string' });
    }

    const source = deriveSourceFromBody(req.body);
    const effectiveUserType =
      userType === 'business' ? 'business' : 'consumer';

    const ruleResult = runRuleEngine(url);

    const now = new Date().toISOString();
    const id = Date.now().toString() + Math.random().toString(36).slice(2);

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
      source,
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
// ===== MOBILE REAL-TIME SAFE BROWSING ENDPOINT =======
// =====================================================

app.post('/mobile-safe-browse', async (req, res) => {
  try {
    const {
      url,
      deviceId,
      platform,
      appVersion,
      userId,
      userEmail,
      orgId,
      orgName,
    } = req.body || {};

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required as a string' });
    }

    const source = 'mobile';
    const effectiveUserType = 'consumer';

    const ruleResult = runRuleEngine(url);

    const now = new Date().toISOString();
    const id = Date.now().toString() + Math.random().toString(36).slice(2);

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
      source,
      engine: 'RULE_ONLY',
      context: {
        userType: effectiveUserType,
        orgId: orgId || 'personal',
        orgName: orgName || 'Personal',
        userId: userId || 'mobile-safe-browse-user',
        userEmail: userEmail || 'mobile-safe-browse@clickshield.app',
        deviceId: deviceId || `mobile-${platform || 'unknown'}`,
        platform: platform || null,
        appVersion: appVersion || null,
      },
    };

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
        '[ClickShield][AI] Unexpected AI error (mobile-safe-browse):',
        err.message || err
      );
    }

    if (aiResult && aiResult.aiNarrative) {
      responseBody.engine = 'RULE_PLUS_AI';
      responseBody.ai = aiResult;
    }

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
        '[ClickShield] Failed to update recentScans (mobile-safe-browse):',
        err.message || err
      );
    }

    res.json(responseBody);
  } catch (err) {
    console.error('Error in /mobile-safe-browse:', err.message || err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// =========== ELITE ENTERPRISE ADMIN ROUTES ===========
// =====================================================

// In-memory sample orgs so the Admin Suite works without a DB
const ADMIN_SAMPLE_ORGS = [
  {
    orgId: 'demo-acme',
    name: 'Acme Corp',
    plan: 'Enterprise',
    risk: 'medium',
    status: 'active',
    seats: 200,
    primaryDomain: 'acmecorp.com',
    activeUsers: 143,
    lastSeen: new Date().toISOString(),
    lastHighRiskEvent: null,
  },
  {
    orgId: 'org-1',
    name: 'Acme Financial Group',
    plan: 'Enterprise',
    risk: 'high',
    status: 'active',
    seats: 184,
    primaryDomain: 'acme-fin.com',
    activeUsers: 121,
    lastSeen: new Date().toISOString(),
    lastHighRiskEvent: null,
  },
];

const ADMIN_SAMPLE_INTEGRATIONS = [
  {
    id: 'int-slack-demo-acme',
    orgId: 'demo-acme',
    provider: 'Slack',
    status: 'connected',
    target: '#clickshield-alerts',
    lastEvent: 'Test phishing alert · 5m ago',
  },
  {
    id: 'int-teams-demo-acme',
    orgId: 'demo-acme',
    provider: 'Teams',
    status: 'connected',
    target: 'SecOps War Room',
    lastEvent: 'ClickShield test event · 10m ago',
  },
  {
    id: 'int-notion-demo-acme',
    orgId: 'demo-acme',
    provider: 'Notion',
    status: 'connected',
    target: 'Runbooks / ClickShield',
    lastEvent: 'Playbook linked for last incident',
  },
  {
    id: 'int-jira-demo-acme',
    orgId: 'demo-acme',
    provider: 'Jira',
    status: 'connected',
    target: 'SEC-BOARD',
    lastEvent: 'Incident SEC-231 opened from ClickShield',
  },
  {
    id: 'int-email-demo-acme',
    orgId: 'demo-acme',
    provider: 'Email',
    status: 'connected',
    target: 'soc-oncall@acmecorp.com',
    lastEvent: 'Daily digest delivered · 06:00 UTC',
  },
];

// Per-org alerts & exports config (stub for now)
const ADMIN_SAMPLE_ALERTS_EXPORTS = [
  {
    orgId: 'demo-acme',
    alertChannels: [
      'Slack · #clickshield-alerts',
      'Teams · SecOps War Room',
    ],
    exportTargets: [
      'Notion · Runbooks / ClickShield',
      'Jira · SEC-BOARD',
    ],
    siem: {
      enabled: false,
      provider: null,
      endpoint: null,
    },
    schedule: {
      dailyDigest: true,
      weeklyReport: true,
    },
  },
];

function findOrgAlertsExports(orgId) {
  return (
    ADMIN_SAMPLE_ALERTS_EXPORTS.find((cfg) => cfg.orgId === orgId) || null
  );
}

function findOrgOverview(orgId) {
  return ADMIN_SAMPLE_ORGS.find((org) => org.orgId === orgId) || null;
}

function findOrgIntegrations(orgId) {
  return ADMIN_SAMPLE_INTEGRATIONS.filter((int) => int.orgId === orgId);
}

function normalizeProviderFromParam(providerParam) {
  if (!providerParam) return null;
  const p = providerParam.toLowerCase();
  if (p === 'slack') return 'Slack';
  if (p === 'teams') return 'Teams';
  if (p === 'notion') return 'Notion';
  if (p === 'jira') return 'Jira';
  if (p === 'email') return 'Email';
  return null;
}

// GET /admin/orgs/:orgId/overview
app.get('/admin/orgs/:orgId/overview', (req, res) => {
  const { orgId } = req.params;
  const overview = findOrgOverview(orgId);

  if (!overview) {
    return res.status(404).json({
      overview: {
        orgId,
        name: 'Unknown organization',
        plan: 'Free',
        risk: 'low',
        status: 'active',
        seats: 0,
        primaryDomain: null,
        activeUsers: 0,
        lastSeen: null,
        lastHighRiskEvent: null,
      },
    });
  }

  res.json({ overview });
});

// GET /admin/orgs/:orgId/integrations
app.get('/admin/orgs/:orgId/integrations', (req, res) => {
  const { orgId } = req.params;
  const integrations = findOrgIntegrations(orgId);

  res.json({
    orgId,
    integrations,
  });
});

// GET /admin/orgs/:orgId/alerts-exports
app.get('/admin/orgs/:orgId/alerts-exports', (req, res) => {
  const { orgId } = req.params;
  const cfg = findOrgAlertsExports(orgId);

  if (!cfg) {
    return res.json({
      orgId,
      alertChannels: [],
      exportTargets: [],
      siem: {
        enabled: false,
        provider: null,
        endpoint: null,
      },
      schedule: {
        dailyDigest: false,
        weeklyReport: true,
      },
    });
  }

  res.json(cfg);
});

// POST /admin/orgs/:orgId/integrations/:provider/test-event
app.post('/admin/orgs/:orgId/integrations/:provider/test-event', (req, res) => {
  const { orgId, provider: providerParam } = req.params;
  const provider = normalizeProviderFromParam(providerParam);

  if (!provider || (provider !== 'Slack' && provider !== 'Teams')) {
    return res.status(400).json({
      ok: false,
      provider: provider || 'Unknown',
      orgId,
      delivered: false,
      message: 'Only Slack and Teams test events are supported right now.',
    });
  }

  const body = req.body || {};
  const actorEmail = body.actorEmail || 'admin@clickshield.local';

  console.log(
    `[Admin][TestEvent] Simulated ${provider} test event for org=${orgId}, actor=${actorEmail}`
  );

  return res.status(200).json({
    ok: true,
    provider,
    orgId,
    delivered: true,
    message: `${provider} test event simulated. Wire a real webhook URL in the backend when you’re ready.`,
  });
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

// AI-powered dashboard digest for the last 7 days
app.get('/dashboard-ai-digest', async (req, res) => {
  try {
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

    if (!openai) {
      const plainDigest =
        totalScans === 0
          ? 'No scans were recorded for this period. ClickShield will summarize threats once activity begins.'
          : `In the last 7 days, ClickShield processed ${totalScans} links: ${dangerousCount} dangerous, ${suspiciousCount} suspicious, and ${safeCount} safe. Top threat types were ${topThreatTypes
              .map((t) => `${t.type} (${t.count})`)
              .join(', ') || 'not yet observed'}.`;

      return res.json({
        weekStart,
        weekEnd,
        totalScans,
        dangerousCount,
        suspiciousCount,
        safeCount,
        topThreatTypes,
        aiDigest: {
          digest: plainDigest,
          model: 'RULE_ONLY',
        },
      });
    }

    const summaryForModel = {
      weekStart,
      weekEnd,
      totalScans,
      dangerousCount,
      suspiciousCount,
      safeCount,
      topThreatTypes,
      sampleScans: inRange.slice(0, 20).map((s) => ({
        url: s.url,
        riskLevel: s.riskLevel,
        riskScore: s.riskScore,
        threatType: s.threatType,
        source: s.source,
        userType: s.userType,
        checkedAt: s.checkedAt,
      })),
    };

    const prompt = `
You are the AI analyst for ClickShield, a Web3 and consumer security platform.

You are given a 7-day summary of URL scans:
- Counts of SAFE, SUSPICIOUS, and DANGEROUS links
- Top threat types
- Example scans with risk levels and threat categories

Write a short, executive-friendly summary (2–4 sentences) of what happened this week:
- Highlight whether threat activity is high or low
- Call out any notable phishing / drainer / wallet-connect patterns
- Mention if most scans look safe, or if users are frequently hitting risky links

Do NOT use bullet points, lists, markdown, or headings.
Return only the paragraph of text.
`;

    let digestText = null;
    let modelUsed = 'gpt-4.1-mini';

    try {
      const response = await openai.responses.create({
        model: 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content: prompt,
          },
          {
            role: 'user',
            content: JSON.stringify(summaryForModel),
          },
        ],
      });

      const output = response.output?.[0]?.content?.[0];
      const text = output && output.text ? output.text.trim() : null;
      if (text) {
        digestText = text;
        modelUsed = response.model || 'gpt-4.1-mini';
      }
    } catch (err) {
      console.error(
        '[ClickShield][AI] Failed to generate dashboard digest:',
        err.message || err
      );
    }

    if (!digestText) {
      digestText =
        totalScans === 0
          ? 'No scans were recorded for this period. ClickShield will summarize threats once activity begins.'
          : `In the last 7 days, ClickShield processed ${totalScans} links: ${dangerousCount} dangerous, ${suspiciousCount} suspicious, and ${safeCount} safe. Top threat types were ${topThreatTypes
              .map((t) => `${t.type} (${t.count})`)
              .join(', ') || 'not yet observed'}.`;
      modelUsed = 'RULE_ONLY_FALLBACK';
    }

    res.json({
      weekStart,
      weekEnd,
      totalScans,
      dangerousCount,
      suspiciousCount,
      safeCount,
      topThreatTypes,
      aiDigest: {
        digest: digestText,
        model: modelUsed,
      },
    });
  } catch (err) {
    console.error('Error in /dashboard-ai-digest:', err.message || err);
    res.status(500).json({ error: 'Internal server error' });
  }
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
