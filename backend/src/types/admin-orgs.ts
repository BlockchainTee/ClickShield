// backend/src/types/admin-orgs.ts

export type OrgPlan = 'Free' | 'Pro' | 'Enterprise';
export type OrgRiskLevel = 'low' | 'medium' | 'high';
export type OrgStatus = 'active' | 'suspended';

export interface OrgOverviewDto {
  orgId: string;
  name: string;
  plan: OrgPlan;
  risk: OrgRiskLevel;
  status: OrgStatus;
  seats: number;
  primaryDomain: string | null;
  activeUsers: number;
  lastSeen: string | null;
  lastHighRiskEvent: string | null;
}

export type OrgIntegrationProvider =
  | 'Slack'
  | 'Teams'
  | 'Notion'
  | 'Jira'
  | 'Email';

export type OrgIntegrationStatus =
  | 'connected'
  | 'degraded'
  | 'disconnected';

export interface OrgIntegrationDto {
  id: string;
  orgId: string;
  provider: OrgIntegrationProvider;
  status: OrgIntegrationStatus;
  target?: string;
  lastEvent?: string | null;
}

export interface OrgOverviewResponse {
  overview: OrgOverviewDto;
}

export interface OrgIntegrationsResponse {
  orgId: string;
  integrations: OrgIntegrationDto[];
}

export interface TestIntegrationEventRequest {
  actorEmail?: string;
  reason?: string;
}

export interface TestIntegrationEventResponse {
  ok: boolean;
  provider: OrgIntegrationProvider;
  orgId: string;
  delivered: boolean;
  message: string;
}
