import { href, useFetcher } from 'react-router';

import { invariant } from '~/utils/invariant';

import type { Route } from './+types/git.branch.checkout';

interface CheckoutGitBranchData {
  branch: string;
  projectId: string;
  workspaceId?: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as CheckoutGitBranchData;

  invariant(typeof data.branch === 'string', 'Branch is required');

  return window.main.git.checkoutGitBranch(data);
}

export function useGitProjectCheckoutBranchActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientAction>(args);

  function submit(data: CheckoutGitBranchData) {
    return fetcher.submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/branch/checkout'),
      encType: 'application/json',
    });
  }

  return {
    ...fetcher,
    submit,
  };
}
