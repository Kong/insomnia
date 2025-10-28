import { href } from 'react-router';
import { v4 as uuidv4 } from 'uuid';

import { userSession } from '~/models';
import { insomniaFetch } from '~/ui/insomniaFetch';
import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.collaborators-check-seats';

export const needsToUpgrade = 'NEEDS_TO_UPGRADE';
export const needsToIncreaseSeats = 'NEEDS_TO_INCREASE_SEATS';

export interface CheckSeatsResponse {
  isAllowed: boolean;
  code?: typeof needsToUpgrade | typeof needsToIncreaseSeats;
}

export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  const { id: sessionId } = await userSession.get();

  const { organizationId } = params;

  try {
    const checkResponseData = await insomniaFetch<CheckSeatsResponse>({
      method: 'POST',
      path: `/v1/organizations/${organizationId}/check-seats`,
      data: { emails: [`insomnia-mock-check-seats-${uuidv4()}@konghq.com`] },
      sessionId,
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
