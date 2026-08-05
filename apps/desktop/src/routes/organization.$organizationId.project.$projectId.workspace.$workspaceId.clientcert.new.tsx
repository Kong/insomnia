import type { ClientCertificate } from 'insomnia-data';
import { services } from 'insomnia-data';
import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.clientcert.new';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const patch = await request.json();
  const certificate = await services.clientCertificate.create(patch);

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
