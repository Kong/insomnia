import { href } from 'react-router';

import * as models from '~/models';
import type { ClientCertificate } from '~/models/client-certificate';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.clientcert.new';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const patch = await request.json();
  const certificate = await models.clientCertificate.create(patch);

  return {
    certificate,
  };
}

export const useClientCertNewActionFetcher = createFetcherSubmitHook(
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
      patch: Partial<ClientCertificate>;
    }) => {
      return submit(JSON.stringify(patch), {
        method: 'POST',
        action: href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId/clientcert/new`, {
          organizationId,
          projectId,
          workspaceId,
        }),
        encType: 'application/json',
      });
    },
  clientAction,
);
