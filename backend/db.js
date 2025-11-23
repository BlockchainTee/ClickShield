'use strict';

const path = require('path');
const Database = require('better-sqlite3');

// Open (or create) the SQLite database file in the backend folder
const dbPath = path.join(__dirname, 'clickshield.db');
const db = new Database(dbPath);

// ----- ORGS TABLE -----
db.exec(`
  CREATE TABLE IF NOT EXISTS orgs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
`);

// Seed a demo org if it does not exist
const seedOrgStmt = db.prepare(`
  INSERT OR IGNORE INTO orgs (id, name, createdAt)
  VALUES (@id, @name, @createdAt);
`);

seedOrgStmt.run({
  id: 'demo-acme',
  name: 'Acme Corp',
  createdAt: new Date().toISOString(),
});

// Helper to fetch org by id
const getOrgByIdStmt = db.prepare(`
  SELECT id, name, createdAt
  FROM orgs
  WHERE id = ?
  LIMIT 1;
`);

function getOrgById(id) {
  return getOrgByIdStmt.get(id);
}

// ----- USERS + ORG MEMBERSHIPS (SaaS model) -----

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    createdAt TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS org_memberships (
    id TEXT PRIMARY KEY,
    orgId TEXT NOT NULL,
    userId TEXT NOT NULL,
    role TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
`);

// Seed a demo security admin user + membership
const seedUserStmt = db.prepare(`
  INSERT OR IGNORE INTO users (id, email, name, createdAt)
  VALUES (@id, @email, @name, @createdAt);
`);

const seedMembershipStmt = db.prepare(`
  INSERT OR IGNORE INTO org_memberships (id, orgId, userId, role, createdAt)
  VALUES (@id, @orgId, @userId, @role, @createdAt);
`);

const demoAdminUserId = 'user-admin-demo';

seedUserStmt.run({
  id: demoAdminUserId,
  email: 'security@acmecorp.com',
  name: 'Acme Security Admin',
  createdAt: new Date().toISOString(),
});

seedMembershipStmt.run({
  id: 'm-admin-demo-acme',
  orgId: 'demo-acme',
  userId: demoAdminUserId,
  role: 'admin',
  createdAt: new Date().toISOString(),
});

const getUserByEmailStmt = db.prepare(`
  SELECT id, email, name, createdAt
  FROM users
  WHERE email = ?
  LIMIT 1;
`);

function getUserByEmail(email) {
  return getUserByEmailStmt.get(email);
}

const getOrgMembersForOrgStmt = db.prepare(`
  SELECT
    om.id AS membershipId,
    om.orgId,
    om.userId,
    om.role,
    om.createdAt,
    u.email,
    u.name
  FROM org_memberships om
  JOIN users u ON u.id = om.userId
  WHERE om.orgId = ?;
`);

function getOrgMembersForOrg(orgId) {
  return getOrgMembersForOrgStmt.all(orgId);
}

// ----- SCANS TABLE -----
db.exec(`
  CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    riskLevel TEXT NOT NULL,
    threatType TEXT,
    userEmail TEXT,
    userType TEXT,
    orgId TEXT,
    orgName TEXT,
    deviceId TEXT,
    checkedAt TEXT NOT NULL,
    riskScore INTEGER
  );
`);

// If scans table already existed, add riskScore column if missing
try {
  db.exec(`ALTER TABLE scans ADD COLUMN riskScore INTEGER;`);
} catch (err) {
  // Ignore "duplicate column name" or similar errors
}

// ----- INSERT + BASIC FETCH -----

const insertScanStmt = db.prepare(`
  INSERT INTO scans (
    id,
    url,
    riskLevel,
    threatType,
    userEmail,
    userType,
    orgId,
    orgName,
    deviceId,
    checkedAt,
    riskScore
  ) VALUES (
    @id,
    @url,
    @riskLevel,
    @threatType,
    @userEmail,
    @userType,
    @orgId,
    @orgName,
    @deviceId,
    @checkedAt,
    @riskScore
  );
`);

const getOrgScansStmt = db.prepare(`
  SELECT
    id,
    url,
    riskLevel,
    threatType,
    userEmail,
    checkedAt AS scannedAt,
    riskScore
  FROM scans
  WHERE
    userType = @userType
    AND orgId = @orgId
  ORDER BY datetime(checkedAt) DESC
  LIMIT 200;
`);

function insertScan(scan) {
  insertScanStmt.run(scan);
}

function getOrgScans({ userType, orgId }) {
  return getOrgScansStmt.all({ userType, orgId });
}

// ----- METRICS QUERIES -----

// Counts by riskLevel, all time
const getOrgCountsAllTimeStmt = db.prepare(`
  SELECT riskLevel, COUNT(*) AS count
  FROM scans
  WHERE userType = @userType AND orgId = @orgId
  GROUP BY riskLevel;
`);

// Counts by riskLevel, since a given ISO date
const getOrgCountsSinceStmt = db.prepare(`
  SELECT riskLevel, COUNT(*) AS count
  FROM scans
  WHERE userType = @userType AND orgId = @orgId AND datetime(checkedAt) >= datetime(@since)
  GROUP BY riskLevel;
`);

// Daily totals for last N days (we'll control since from server.js)
const getOrgDailyCountsStmt = db.prepare(`
  SELECT
    date(checkedAt) AS day,
    COUNT(*) AS total,
    SUM(CASE WHEN riskLevel = 'DANGEROUS' THEN 1 ELSE 0 END) AS dangerous,
    SUM(CASE WHEN riskLevel = 'SUSPICIOUS' THEN 1 ELSE 0 END) AS suspicious,
    SUM(CASE WHEN riskLevel = 'SAFE' THEN 1 ELSE 0 END) AS safe
  FROM scans
  WHERE userType = @userType AND orgId = @orgId AND datetime(checkedAt) >= datetime(@since)
  GROUP BY date(checkedAt)
  ORDER BY day DESC
  LIMIT 14;
`);

// Top threats since a given date
const getOrgTopThreatsSinceStmt = db.prepare(`
  SELECT
    url,
    riskLevel,
    COUNT(*) AS count
  FROM scans
  WHERE userType = @userType
    AND orgId = @orgId
    AND datetime(checkedAt) >= datetime(@since)
  GROUP BY url, riskLevel
  ORDER BY count DESC
  LIMIT @limit;
`);

// Top targeted users since a given date
const getOrgTopUsersSinceStmt = db.prepare(`
  SELECT
    userEmail,
    COUNT(*) AS count,
    SUM(CASE WHEN riskLevel = 'DANGEROUS' THEN 1 ELSE 0 END) AS dangerous
  FROM scans
  WHERE userType = @userType
    AND orgId = @orgId
    AND datetime(checkedAt) >= datetime(@since)
  GROUP BY userEmail
  ORDER BY dangerous DESC, count DESC
  LIMIT @limit;
`);

function getOrgRiskCounts({ userType, orgId }) {
  return getOrgCountsAllTimeStmt.all({ userType, orgId });
}

function getOrgRiskCountsSince({ userType, orgId, since }) {
  return getOrgCountsSinceStmt.all({ userType, orgId, since });
}

function getOrgDailyCounts({ userType, orgId, since }) {
  return getOrgDailyCountsStmt.all({ userType, orgId, since });
}

function getOrgTopThreatsSince({ userType, orgId, since, limit }) {
  return getOrgTopThreatsSinceStmt.all({ userType, orgId, since, limit });
}

function getOrgTopUsersSince({ userType, orgId, since, limit }) {
  return getOrgTopUsersSinceStmt.all({ userType, orgId, since, limit });
}

module.exports = {
  // scans + orgs
  insertScan,
  getOrgScans,
  getOrgById,
  getOrgRiskCounts,
  getOrgRiskCountsSince,
  getOrgDailyCounts,
  getOrgTopThreatsSince,
  getOrgTopUsersSince,
  // users + memberships
  getUserByEmail,
  getOrgMembersForOrg,
};
