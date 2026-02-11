import { href, type LoaderFunctionArgs } from 'react-router';

import { gitCredentials } from '~/models';
import { isGitCredentialsV2 } from '~/models/git-credentials';
import { createFetcherLoadHook } from '~/utils/router';

export async function clientLoader(_args: LoaderFunctionArgs) {
  const credentials = await gitCredentials.all();
  const providers = await window.main.git.listGitProviders();
  // Filter out only GitCredentialsV2 in case there are some legacy credentials in some edge cases (migration failed or user downgraded then upgraded again)
  const gitCredentialsV2 = credentials.filter(credential => isGitCredentialsV2(credential));

  return { credentials: gitCredentialsV2, providers };
}

export const useGitCredentialsLoaderFetcher = createFetcherLoadHook(
  load => () => {
    return load(`${href('/git-credentials')}`);
  },
  clientLoader,
);
