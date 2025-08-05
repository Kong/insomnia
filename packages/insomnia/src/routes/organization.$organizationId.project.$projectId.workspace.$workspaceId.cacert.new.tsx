import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.cacert.new';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const patch = await request.json();
  await models.caCertificate.create(patch);
  return null;
}

export function useCACertNewActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
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

      return fetcherSubmit(JSON.stringify(patch), {
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
