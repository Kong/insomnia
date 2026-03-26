import { checkSeats } from 'insomnia-api';
import { href } from 'react-router';
import { v4 as uuidv4 } from 'uuid';

import { services } from '~/insomnia-data';
import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.collaborators-check-seats';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { id: sessionId } = await services.userSession.get();

  const { organizationId } = params;

  try {
    // Check whether the user can add a new collaborator
    // Use a random email to avoid hitting any existing member emails
    const checkResponseData = await checkSeats({
      organizationId,
      sessionId,
      emails: [`insomnia-mock-check-seats-${uuidv4()}@example.net`],
    });
    return checkResponseData;
  } catch {
    return { isAllowed: true };
  }
}

export const useCollaboratorsCheckSeatsLoaderFetcher = createFetcherLoadHook(
  load =>
    ({ organizationId, query }: { organizationId: string; query?: string }) => {
      return load(
        `${href(`/organization/:organizationId/collaborators-check-seats`, { organizationId })}?${encodeURIComponent(query || '')}`,
      );
    },
  clientLoader,
);
