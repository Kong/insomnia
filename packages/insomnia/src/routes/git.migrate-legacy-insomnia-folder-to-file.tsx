import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/git.migrate-legacy-insomnia-folder-to-file';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { projectId } = (await request.json()) as {
    projectId: string;
  };
  return window.main.git.migrateLegacyInsomniaFolderToFile({ projectId });
}

export const useGitProjectMigrateLegacyInsomniaFolderActionFetcher = createFetcherSubmitHook(
  submit =>
    ({ projectId }: { projectId: string }) => {
      return submit(
        {
          projectId,
        },
        {
          method: 'POST',
          action: href('/git/migrate-legacy-insomnia-folder-to-file'),
          encType: 'application/json',
        },
      );
    },
  clientAction,
);
