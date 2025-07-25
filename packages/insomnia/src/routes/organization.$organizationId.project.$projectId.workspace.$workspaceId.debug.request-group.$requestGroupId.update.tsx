import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import type { RequestGroup } from '~/models/request-group';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId.update-meta';

export async function clientAction({ request, params }: Route.ActionArgs) {
  const { requestGroupId } = params;

  const reqGroup = await models.requestGroup.getById(requestGroupId);
  invariant(reqGroup, 'Request Group not found');

  const patch = (await request.json()) as Partial<RequestGroup>;

  await models.requestGroup.update(reqGroup, patch);

  return null;
}

export function useRequestGroupUpdateActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientAction>(args);

  function submit({
    organizationId,
    projectId,
    workspaceId,
    requestGroupId,
    patch,
  }: {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    requestGroupId: string;
    patch: Partial<RequestGroup>;
  }) {
    const url = href(
      '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request-group/:requestGroupId/update',
      {
        organizationId,
        projectId,
        workspaceId,
        requestGroupId,
      },
    );

    return fetcher.submit(JSON.stringify(patch), {
      action: url,
      method: 'POST',
      encType: 'application/json',
    });
  }

  return {
    ...fetcher,
    submit,
  };
}
