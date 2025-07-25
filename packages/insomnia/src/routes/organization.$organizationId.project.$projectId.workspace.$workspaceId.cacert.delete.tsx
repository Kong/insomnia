import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.cacert.delete';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const caCertificate = await models.caCertificate.findByParentId(workspaceId);
  invariant(caCertificate, 'CA Certificate not found');
  await models.caCertificate.removeWhere(workspaceId);
  return null;
}

export function useCaCertDeleteActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientAction>(args);

  function submit({
    organizationId,
    projectId,
    workspaceId,
  }: {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  }) {
    const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/cacert/delete', {
      organizationId,
      projectId,
      workspaceId,
    });

    return fetcher.submit({}, {
      action: url,
      method: 'POST',
    });
  }

  return {
    ...fetcher,
    submit,
  };
}
