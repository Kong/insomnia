import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import type { Route } from './+types/git.fetch';

interface FetchGitData {
  projectId: string;
  workspaceId?: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  console.log('Client action for git fetch', request);
  const data = (await request.json()) as FetchGitData;
  return window.main.git.gitFetchAction(data);
}

export function useGitProjectFetchActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const {
    submit: fetcherSubmit,
    ...fetcherRest
  } = useFetcher<typeof clientAction>(args);

  const submit = useCallback((data: FetchGitData) => {
    console.log('Submitting git fetch action', data);
    return fetcherSubmit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/fetch'),
      encType: 'application/json',
    });
  }, [fetcherSubmit]);

  return {
    ...fetcherRest,
    submit,
  };
}
