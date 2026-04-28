import { href } from 'react-router';

import { services } from '~/insomnia-data';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.cacert.delete';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const caCertificate = await services.caCertificate.getByParentId(workspaceId);
  invariant(caCertificate, 'CA Certificate not found');
  await services.caCertificate.removeWhere(workspaceId);
  return null;
}

export const useCaCertDeleteActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
    }) => {
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/cacert/delete', {
        organizationId,
        projectId,
        workspaceId,
      });

      return submit(
        {},
        {
          action: url,
          method: 'POST',
        },
      );
    },
  clientAction,
);
