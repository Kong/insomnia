import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import type { ClientCertificate } from '~/models/client-certificate';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.clientcert.new';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const patch = await request.json();
  const certificate = await models.clientCertificate.create(patch);

  return {
    certificate,
  };
}

export function useClientCertNewActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
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
      patch: Partial<ClientCertificate>;
    }) => {
      return fetcherSubmit(JSON.stringify(patch), {
        method: 'POST',
        action: href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId/clientcert/new`, {
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
