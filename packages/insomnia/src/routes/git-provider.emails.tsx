import { href } from 'react-router';

import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/git-provider.emails';

interface GitProviderEmailsInput {
  credentialsId: string;
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const credentialsId = url.searchParams.get('credentialsId') || '';

  if (!credentialsId) {
    return { emails: [], errors: ['No credential provided'] };
  }

  const emailsResult = await window.main.git.getGitProviderEmails({ credentialsId });

  return emailsResult;
}

export const useGitProviderEmailsLoaderFetcher = createFetcherLoadHook(
  load =>
    ({ credentialsId }: GitProviderEmailsInput) => {
      const params = new URLSearchParams();
      params.append('credentialsId', credentialsId);

      return load(`${href('/git-provider/emails')}?${params.toString()}`);
    },
  clientLoader,
);
