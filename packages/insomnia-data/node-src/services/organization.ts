import { getOrganizations, type Organization } from 'insomnia-api';
import { models } from 'insomnia-data';

import * as userSessionService from './user-session';

function sortOrganizations(accountId: string, organizations: Organization[]): Organization[] {
  const owned = organizations
    .filter(organization => models.organization.isOwnerOfOrganization({ organization, accountId }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
  const notOwned = organizations
    .filter(organization => !models.organization.isOwnerOfOrganization({ organization, accountId }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
  return [...owned, ...notOwned];
}

/**
 * List organizations from the Insomnia cloud API.
 */
export async function list(): Promise<Organization[]> {
  const { id: sessionId, accountId } = await userSessionService.get();

  if (!sessionId || !accountId) {
    return [];
  }

  const result = await getOrganizations({ sessionId });
  const organizations = result?.organizations ?? [];

  return sortOrganizations(accountId, organizations);
}

/**
 * Get a single organization by ID.
 */
export async function get(id: string): Promise<Organization | undefined> {
  const all = await list();
  return all.find(org => org.id === id);
}
