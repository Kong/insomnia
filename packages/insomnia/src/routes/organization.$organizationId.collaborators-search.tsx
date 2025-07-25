import { href, useFetcher } from 'react-router';

import { userSession } from '~/models';
import { insomniaFetch } from '~/ui/insomniaFetch';

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

export function useCollaboratorsSearchLoaderFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientLoader>(args);

  function load({ organizationId, query }: { organizationId: string; query?: string }) {
    return fetcher.load(
      `${href(`/organization/:organizationId/collaborators-search`, { organizationId })}?${encodeURIComponent(query || '')}`,
    );
  }

  return {
    ...fetcher,
    load,
  };
}
