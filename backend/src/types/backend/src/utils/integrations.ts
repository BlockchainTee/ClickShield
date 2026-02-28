// backend/src/utils/integrations.ts

import { OrgIntegrationProvider } from '../types/admin-orgs';

export function normalizeProviderFromParam(providerParam: string): OrgIntegrationProvider | null {
  const p = providerParam.toLowerCase();

  if (p === 'slack') return 'Slack';
  if (p === 'teams') return 'Teams';
  if (p === 'notion') return 'Notion';
  if (p === 'jira') return 'Jira';
  if (p === 'email') return 'Email';

  return null;
}
