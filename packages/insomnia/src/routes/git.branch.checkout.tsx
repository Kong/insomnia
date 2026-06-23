import { href } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { createFetcherSubmitHook } from '~/ui/utils/router';

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

export const useGitProjectCheckoutBranchActionFetcher = createFetcherSubmitHook(
  submit => (data: CheckoutGitBranchData) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/git/branch/checkout'),
      encType: 'application/json',
    });
  },
  clientAction,
);
