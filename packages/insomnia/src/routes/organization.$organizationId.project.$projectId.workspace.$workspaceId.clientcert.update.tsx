import { href } from 'react-router';

import type { ClientCertificate } from '~/insomnia-data';
import { services } from '~/insomnia-data';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.clientcert.update';

type CertificatePatch = { _id: string } & Partial<ClientCertificate>;

export async function clientAction({ request }: Route.ClientActionArgs) {
  const patch = (await request.json()) as CertificatePatch;
  const clientCertificate = await services.clientCertificate.getById(patch._id);
  invariant(clientCertificate, 'Client Certificate not found');

  await services.clientCertificate.update(clientCertificate, patch);

  return null;
}

export const useClientCertUpdateActionFetcher = createFetcherSubmitHook(
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
      patch: CertificatePatch;
    }) => {
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/clientcert/update', {
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
