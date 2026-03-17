import { href } from 'react-router';

import { services } from '~/insomnia-data';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.cacert.new';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const patch = await request.json();
  await services.caCertificate.create(patch);
  return null;
}

export const useCACertNewActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      patch,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      patch: Record<string, any>;
    }) => {
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/cacert/new', {
        organizationId,
        projectId,
        workspaceId,
      });

      return submit(JSON.stringify(patch), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
