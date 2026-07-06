import { services } from 'insomnia-data';
import { href } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.clientcert.delete';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { _id } = await request.json();
  const clientCertificate = await services.clientCertificate.getById(_id);
  invariant(clientCertificate, 'CA Certificate not found');

  await services.clientCertificate.remove(clientCertificate);
  return null;
}

export const useClientCertDeleteActionFetcher = createFetcherSubmitHook(
  submit =>
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

      return submit(JSON.stringify({ _id }), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
