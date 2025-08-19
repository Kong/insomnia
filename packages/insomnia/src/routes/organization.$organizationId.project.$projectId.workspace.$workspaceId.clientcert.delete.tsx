import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.clientcert.delete';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { _id } = await request.json();
  const clientCertificate = await models.clientCertificate.getById(_id);
  invariant(clientCertificate, 'CA Certificate not found');

  await models.clientCertificate.remove(clientCertificate);
  return null;
}

export function useClientCertDeleteActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({
      organizationId,
      projectId,
      workspaceId,
      _id,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      _id: string;
    }) => {
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/clientcert/delete', {
        organizationId,
        projectId,
        workspaceId,
      });

      return fetcherSubmit(JSON.stringify({ _id }), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
