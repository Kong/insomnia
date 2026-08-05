import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/ui/utils/router';

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

export const useGitProjectStageActionFetcher = createFetcherSubmitHook(
  submit => (data: StageGitChangesData) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/stage'),
      encType: 'application/json',
    });
  },
  clientAction,
);
