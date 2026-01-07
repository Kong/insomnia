import { href } from 'react-router';

import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/git-provider.repositories';

interface GitProviderRepositoriesInput {
  credentialsId: string;
  refresh?: boolean;
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const credentialsId = url.searchParams.get('credentialsId') || '';
  const refresh = url.searchParams.get('refresh') === 'true';

  if (!credentialsId) {
    return { repos: [], errors: ['No credential provided'] };
  }

  const repositoriesResult = await window.main.git.getGitProviderRepositories({ credentialsId, refresh });

  return repositoriesResult;
}

export const useGitProviderRepositoriesLoaderFetcher = createFetcherLoadHook(
  load =>
    ({ credentialsId, refresh }: GitProviderRepositoriesInput) => {
      const params = new URLSearchParams();
      params.append('credentialsId', credentialsId);
      if (refresh) {
        params.append('refresh', 'true');
      }

      return load(`${href('/git-provider/repositories')}?${params.toString()}`);
    },
  clientLoader,
);
