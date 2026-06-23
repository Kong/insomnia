import { services } from 'insomnia-data';
import { href, type LoaderFunctionArgs } from 'react-router';

import { createFetcherLoadHook } from '~/ui/utils/router';

export async function clientLoader(_args: LoaderFunctionArgs) {
  const credentials = await services.gitCredentials.all();
  const providers = await window.main.git.listGitProviders();

  return { credentials, providers };
}

export const useGitCredentialsLoaderFetcher = createFetcherLoadHook(
  load => () => {
    return load(`${href('/git-credentials')}`);
  },
  clientLoader,
);
