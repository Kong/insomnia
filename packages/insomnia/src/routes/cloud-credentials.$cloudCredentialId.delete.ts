import { href } from 'react-router';

import * as models from '~/models';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/cloud-credentials.$cloudCredentialId.delete';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { cloudCredentialId } = params;
  invariant(typeof cloudCredentialId === 'string', 'Cloud Credential ID is required');
  const cloudCredential = await models.cloudCredential.getById(cloudCredentialId);
  invariant(cloudCredential, 'Cloud Credential not found');
  await models.cloudCredential.remove(cloudCredential);
  return null;
}

export const useDeleteCloudCredentialActionFetcher = createFetcherSubmitHook(
  submit =>
    ({ cloudCredentialId }: { cloudCredentialId: string }) => {
      return submit(
        {},
        {
          method: 'POST',
          action: href('/cloud-credentials/:cloudCredentialId/delete', {
            cloudCredentialId,
          }),
          encType: 'application/json',
        },
      );
    },
  clientAction,
);
