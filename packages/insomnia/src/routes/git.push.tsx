import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import type { Route } from './+types/git.push';

interface PushGitData {
  projectId: string;
  workspaceId?: string;
  force?: boolean;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as PushGitData;

  return window.main.git.pushToGitRemote(data);
}

export function useGitProjectPushActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    (data: PushGitData) => {
      return fetcherSubmit(JSON.stringify(data), {
        method: 'POST',
        action: href('/git/push'),
        encType: 'application/json',
      });
    },
    [fetcherSubmit],
  );

  return { ...fetcherRest, submit };
}
