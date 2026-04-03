import { searchCollaborators } from 'insomnia-api';
import { href } from 'react-router';

import { services } from '~/insomnia-data';
import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.collaborators-search';

export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  const { id: sessionId } = await services.userSession.get();

  const { organizationId } = params;

  try {
    const requestUrl = new URL(request.url);
    const searchParams = Object.fromEntries(requestUrl.searchParams.entries());

    const collaboratorsSearchList = await searchCollaborators({
      sessionId,
      organizationId,
      keyword: searchParams.query || '',
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
        `${href(`/organization/:organizationId/collaborators-search`, { organizationId })}?query=${encodeURIComponent(query || '')}`,
      );
    },
  clientLoader,
);
