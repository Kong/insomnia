import { href, type LoaderFunctionArgs } from 'react-router';

import { gitCredentials } from '~/models';
import { createFetcherLoadHook } from '~/utils/router';

export async function clientLoader(_args: LoaderFunctionArgs) {
  const credentials = await gitCredentials.all();
  const providers = await window.main.git.listGitProviders();

  return { credentials, providers };
}

export const useGitCredentialsLoaderFetcher = createFetcherLoadHook(
  load => () => {
    return load(`${href('/git-credentials')}`);
  },
  clientLoader,
);
