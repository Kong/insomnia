import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/cloud-credentials.$cloudCredentialId.delete';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { cloudCredentialId } = params;
  invariant(typeof cloudCredentialId === 'string', 'Cloud Credential ID is required');
  const cloudCredential = await models.cloudCredential.getById(cloudCredentialId);
  invariant(cloudCredential, 'Cloud Credential not found');
  await models.cloudCredential.remove(cloudCredential);
  return null;
}

export function useDeleteCloudCredentialActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcher } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    function submit({ cloudCredentialId }: { cloudCredentialId: string }) {
      return fetcherSubmit(
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
    [fetcherSubmit],
  );

  return {
    ...fetcher,
    submit,
  };
}
