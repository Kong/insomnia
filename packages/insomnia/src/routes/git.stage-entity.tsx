import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/git.stage-entity';

interface StagePartialGitChangeData {
  filepath: string;
  content: string;
  projectId: string;
  workspaceId?: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as StagePartialGitChangeData;
  return window.main.git.stagePartialContent(data);
}

export const useGitProjectStagePartialContentActionFetcher = createFetcherSubmitHook(
  submit => (data: StagePartialGitChangeData) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/stage-entity'),
      encType: 'application/json',
    });
  },
  clientAction,
);
