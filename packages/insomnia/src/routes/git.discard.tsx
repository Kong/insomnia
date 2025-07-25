import { href, useFetcher } from 'react-router';

import type { Route } from './+types/git.discard';

interface DiscardGitChangesData {
  paths: string[];
  projectId: string;
  workspaceId?: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as DiscardGitChangesData;

  return window.main.git.discardChanges(data);
}

export function useGitProjectDiscardActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientAction>(args);

  function submit(data: DiscardGitChangesData) {
    return fetcher.submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/discard'),
      encType: 'application/json',
    });
  }

  return {
    ...fetcher,
    submit,
  };
}
