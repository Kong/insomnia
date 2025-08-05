import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import { EnvironmentType } from '~/models/environment';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.environment.create';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const { isPrivate, environmentType = EnvironmentType.KVPAIR } = await request.json();

  const baseEnvironment = await models.environment.getByParentId(workspaceId);

  invariant(baseEnvironment, 'Base environment not found');

  const environment = await models.environment.create({
    parentId: baseEnvironment._id,
    environmentType,
    isPrivate,
  });

  return environment;
}

export function useEnvironmentCreateActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({
      organizationId,
      projectId,
      workspaceId,
      params,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      params: { isPrivate: boolean; environmentType?: string };
    }) => {
      return fetcherSubmit(JSON.stringify(params), {
        method: 'POST',
        action: href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId/environment/create`, {
          organizationId,
          projectId,
          workspaceId,
        }),
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
