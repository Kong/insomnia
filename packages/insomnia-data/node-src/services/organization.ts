import { getSpaces, type Organization } from 'insomnia-api';

import * as userSessionService from './user-session';

function sortOrganizations(organizations: Organization[]): Organization[] {
  const owned = organizations
    .filter(organization => organization.is_owner)
    .sort((a, b) => a.name.localeCompare(b.name));
  const notOwned = organizations
    .filter(organization => !organization.is_owner)
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...owned, ...notOwned];
}

/**
 * List organizations (spaces) from the Insomnia cloud API.
 */
export async function list(): Promise<Organization[]> {
  const { id: sessionId, accountId } = await userSessionService.get();

  if (!sessionId || !accountId) {
    return [];
  }

  const organizations = await getSpaces({ sessionId });

  return sortOrganizations(organizations);
}

/**
 * Get a single organization by ID.
 */
export async function get(id: string): Promise<Organization | undefined> {
  const all = await list();
  return all.find(org => org.id === id);
}
