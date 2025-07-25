import { href, useFetcher } from 'react-router';

import type { Route } from './+types/git.stage';

interface StageGitChangesData {
  paths: string[];
  projectId: string;
  workspaceId?: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as StageGitChangesData;
  return window.main.git.stageChanges(data);
}

export function useGitProjectStageActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientAction>(args);

  function submit(data: StageGitChangesData) {
    return fetcher.submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/stage'),
      encType: 'application/json',
    });
  }

  return {
    ...fetcher,
    submit,
  };
}
