// backend/src/routes/admin-orgs.router.ts

import { Router, Request, Response, NextFunction } from 'express';
import {
  OrgOverviewDto,
  OrgIntegrationDto,
  OrgOverviewResponse,
  OrgIntegrationsResponse,
  TestIntegrationEventRequest,
  TestIntegrationEventResponse,
  OrgIntegrationProvider,
} from '../types/admin-orgs';
import { normalizeProviderFromParam } from '../utils/integrations';

const router = Router();

/**
 * In-memory sample data so the admin UI can function
 * even before you have a real database wired up.
 * This keeps everything safe and non-breaking.
 */

const SAMPLE_ORGS: OrgOverviewDto[] = [
  {
    orgId: 'org-1',
    name: 'Acme Financial Group',
    plan: 'Enterprise',
    risk: 'medium',
    status: 'active',
    seats: 184,
    primaryDomain: 'acme-fin.com',
    activeUsers: 121,
    lastSeen: new Date().toISOString(),
    lastHighRiskEvent: null,
  },
  {
    orgId: 'org-2',
    name: 'Nordwave Logistics',
    plan: 'Pro',
    risk: 'low',
    status: 'active',
    seats: 63,
    primaryDomain: 'nordwave.io',
    activeUsers: 47,
    lastSeen: new Date().toISOString(),
    lastHighRiskEvent: null,
  },
];

const SAMPLE_INTEGRATIONS: OrgIntegrationDto[] = [
  {
    id: 'int-slack-org1',
    orgId: 'org-1',
    provider: 'Slack',
    status: 'connected',
    target: '#secops-alerts',
    lastEvent: 'Test phishing alert · 5m ago',
  },
  {
    id: 'int-teams-org1',
    orgId: 'org-1',
    provider: 'Teams',
    status: 'degraded',
    target: 'SecOps War Room',
    lastEvent: 'Delivery retries in progress',
  },
  {
    id: 'int-notion-org1',
    orgId: 'org-1',
    provider: 'Notion',
    status: 'connected',
    target: 'Runbooks / ClickShield',
    lastEvent: 'Playbook linked for last incident',
  },
  {
    id: 'int-jira-org1',
    orgId: 'org-1',
    provider: 'Jira',
    status: 'disconnected',
    target: 'SEC-BOARD',
    lastEvent: null,
  },
  {
    id: 'int-email-org1',
    orgId: 'org-1',
    provider: 'Email',
    status: 'connected',
    target: 'on-call@acme-fin.com',
    lastEvent: 'Daily digest delivered · 06:00 UTC',
  },
];

/**
 * Helpers – for now they just read from the in-memory arrays.
 * Later you can replace these with real DB calls without touching the router.
 */

function getOrgOverviewById(orgId: string): OrgOverviewDto | null {
  return SAMPLE_ORGS.find((org) => org.orgId === orgId) || null;
}

function getOrgIntegrationsByOrgId(orgId: string): OrgIntegrationDto[] {
  return SAMPLE_INTEGRATIONS.filter((int) => int.orgId === orgId);
}

/**
 * GET /admin/orgs/:orgId/overview
 * Returns a single DTO describing tenant posture for the dashboard modal.
 */
router.get(
  '/admin/orgs/:orgId/overview',
  async (
    req: Request<{ orgId: string }>,
    res: Response<OrgOverviewResponse>,
    next: NextFunction
  ) => {
    try {
      const { orgId } = req.params;
      const overview = getOrgOverviewById(orgId);

      if (!overview) {
        // Fallback instead of hard error – keeps UI stable
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

      return res.json({ overview });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /admin/orgs/:orgId/integrations
 * Returns collaboration / integrations config for a tenant.
 */
router.get(
  '/admin/orgs/:orgId/integrations',
  async (
    req: Request<{ orgId: string }>,
    res: Response<OrgIntegrationsResponse>,
    next: NextFunction
  ) => {
    try {
      const { orgId } = req.params;
      const integrations = getOrgIntegrationsByOrgId(orgId);

      // Never hard-fail; the frontend will just show an empty list if needed
      return res.json({
        orgId,
        integrations,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /admin/orgs/:orgId/integrations/:provider/test-event
 *
 * For now this is a SAFE STUB:
 * - It does not call Slack/Teams APIs yet
 * - It logs and returns a "simulated" success response
 *
 * This keeps the front-end happy and follows 5-second recovery
 * with zero external dependencies.
 */
router.post(
  '/admin/orgs/:orgId/integrations/:provider/test-event',
  async (
    req: Request<{ orgId: string; provider: string }, TestIntegrationEventResponse, TestIntegrationEventRequest>,
    res: Response<TestIntegrationEventResponse>,
    next: NextFunction
  ) => {
    try {
      const { orgId, provider: providerParam } = req.params;
      const provider: OrgIntegrationProvider | null = normalizeProviderFromParam(
        providerParam
      );

      if (!provider || (provider !== 'Slack' && provider !== 'Teams')) {
        return res.status(400).json({
          ok: false,
          provider: (provider || 'Slack') as OrgIntegrationProvider,
          orgId,
          delivered: false,
          message: 'Only Slack and Teams test events are supported right now.',
        });
      }

      const body = req.body || {};
      const actorEmail =
        body.actorEmail || 'admin@clickshield.local';

      // 🚧 STUB IMPLEMENTATION:
      // In the future, this is where you:
      // - look up webhook URL for this org + provider
      // - call Slack/Teams webhook with a test payload
      // - handle timeouts with < 5s deadlines
      console.log(
        `[admin-orgs] Simulated ${provider} test event for org=${orgId}, actor=${actorEmail}`
      );

      // For now we "deliver" successfully so the UI sees success,
      // but make it clear in the message that this is simulated.
      return res.status(200).json({
        ok: true,
        provider,
        orgId,
        delivered: true,
        message:
          `${provider} test event simulated. Wire a real webhook in the backend to send to the actual ${provider} channel.`,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
