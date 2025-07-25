import { href, useFetcher } from 'react-router';

import type { Route } from './+types/git.migrate-legacy-insomnia-folder-to-file';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { projectId } = (await request.json()) as {
    projectId: string;
  };
  return window.main.git.migrateLegacyInsomniaFolderToFile({ projectId });
}

export function useGitProjectMigrateLegacyInsomniaFolderActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientAction>(args);

  function submit({ projectId }: { projectId: string }) {
    return fetcher.submit(
      {
        projectId,
      },
      {
        method: 'POST',
        action: href('/git/migrate-legacy-insomnia-folder-to-file'),
      },
    );
  }

  return {
    ...fetcher,
    submit,
  };
}
