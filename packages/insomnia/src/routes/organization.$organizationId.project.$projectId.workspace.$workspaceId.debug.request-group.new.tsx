import { href } from 'react-router';

import * as models from '~/models';
import { EnvironmentType } from '~/models/environment';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.new';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId } = params;
  const formData = await request.formData();
  const name = formData.get('name') as string;
  const parentId = formData.get('parentId') as string;
  // New folder environment to be key-value pair by default;
  const environmentType = (formData.get('environmentType') as EnvironmentType) || EnvironmentType.KVPAIR;
  const requestGroup = await models.requestGroup.create({ parentId: parentId || workspaceId, name, environmentType });

  await models.requestGroupMeta.create({ parentId: requestGroup._id, collapsed: false });

  return null;
}

export const useRequestGroupNewActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      name,
      parentId,
      environmentType,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      name: string;
      parentId?: string;
      environmentType?: EnvironmentType;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request-group/new',
        {
          organizationId,
          projectId,
          workspaceId,
        },
      );

      const formData = new FormData();
      formData.set('name', name);
      if (parentId) formData.set('parentId', parentId);
      if (environmentType) formData.set('environmentType', environmentType);

      return submit(formData, {
        action: url,
        method: 'POST',
      });
    },
  clientAction,
);
