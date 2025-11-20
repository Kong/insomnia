import { href } from 'react-router';

import { userSession } from '~/models';
import { insomniaFetch } from '~/ui/insomnia-fetch';
import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.collaborators-search';

type CollaboratorType = 'invite' | 'member' | 'group';

interface CollaboratorSearchResultItem {
  id: string;
  picture: string;
  type: CollaboratorType;
  name: string;
}

export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  const { id: sessionId } = await userSession.get();

  const { organizationId } = params;

  try {
    const requestUrl = new URL(request.url);
    const searchParams = Object.fromEntries(requestUrl.searchParams.entries());

    const collaboratorsSearchList = await insomniaFetch<CollaboratorSearchResultItem[]>({
      method: 'GET',
      path: `/v1/desktop/organizations/${organizationId}/collaborators/search/${searchParams.query}`,
      sessionId,
    });

    return collaboratorsSearchList;
  } catch {
    return [];
  }
}

export const useCollaboratorsSearchLoaderFetcher = createFetcherLoadHook(
  load =>
    ({ organizationId, query }: { organizationId: string; query?: string }) => {
      return load(
        `${href(`/organization/:organizationId/collaborators-search`, { organizationId })}?${encodeURIComponent(query || '')}`,
      );
    },
  clientLoader,
);
