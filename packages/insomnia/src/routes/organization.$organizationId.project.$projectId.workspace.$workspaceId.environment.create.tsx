import { href } from 'react-router';

import { EnvironmentType, services } from '~/insomnia-data';
import { AnalyticsEvent } from '~/ui/analytics';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.environment.create';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const { isPrivate, environmentType = EnvironmentType.KVPAIR, source } = await request.json();

  const baseEnvironment = await services.environment.getByParentId(workspaceId);

  invariant(baseEnvironment, 'Base environment not found');

  const environment = await services.environment.create({
    parentId: baseEnvironment._id,
    environmentType,
    isPrivate,
  });

  window.main.trackAnalyticsEvent({
    event: AnalyticsEvent.environmentCreate,
    properties: { type: isPrivate ? 'private' : 'global', ...(source && { source }) },
  });

  return environment;
}

export const useEnvironmentCreateActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      params,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      params: { isPrivate: boolean; environmentType?: string; source?: string };
    }) => {
      return submit(JSON.stringify(params), {
        method: 'POST',
        action: href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId/environment/create`, {
          organizationId,
          projectId,
          workspaceId,
        }),
        encType: 'application/json',
      });
    },
  clientAction,
);
