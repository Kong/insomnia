import type { FC } from 'react';

import type { useGitProjectInitCloneActionFetcher } from '~/routes/git.init-clone';

interface Props {
  initCloneGitRepositoryFetcher: ReturnType<typeof useGitProjectInitCloneActionFetcher>;
  insomniaFiles:
    | Extract<ReturnType<typeof useGitProjectInitCloneActionFetcher>['data'], { files: any }>['files']
    | undefined;
}

export const GitRepoScanResult: FC<Props> = ({ initCloneGitRepositoryFetcher, insomniaFiles }) => {
  return;
};
