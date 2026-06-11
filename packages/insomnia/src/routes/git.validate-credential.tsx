import { href } from 'react-router';

import { createFetcherLoadHook } from '~/utils/router';

import type { validateGitCredentialById } from '../main/git-service';

export async function clientLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());

  return window.main.git.validateGitCredentialById({
    credentialsId: params.credentialsId,
  });
}

export const useGitValidateCredentialFetcher = createFetcherLoadHook(
  load =>
    ({ credentialsId }: { credentialsId: string }) => {
      const searchParams = new URLSearchParams({ credentialsId });
      return load(`${href('/git/validate-credential')}?${searchParams.toString()}`);
    },
  clientLoader as unknown as typeof validateGitCredentialById,
);
