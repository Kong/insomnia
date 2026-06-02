import type { CaCertificate } from 'insomnia-data';
import { services } from 'insomnia-data';
import { href } from 'react-router';

import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.cacert.update';

type CertificatePatch = { _id: string } & Partial<CaCertificate>;

export async function clientAction({ request }: Route.ClientActionArgs) {
  const patch = (await request.json()) as CertificatePatch;
  const caCertificate = await services.caCertificate.getById(patch._id);
  invariant(caCertificate, 'CA Certificate not found');

  await services.caCertificate.update(caCertificate, patch);

  return null;
}

export const useCACertUpdateActionFetcher = createFetcherSubmitHook(
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
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/cacert/update', {
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
