import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import type { CaCertificate } from '~/models/ca-certificate';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.cacert.update';

type CertificatePatch = { _id: string } & Partial<CaCertificate>;

export async function clientAction({ request }: Route.ClientActionArgs) {
  const patch = (await request.json()) as CertificatePatch;
  const caCertificate = await models.caCertificate.getById(patch._id);
  invariant(caCertificate, 'CA Certificate not found');

  await models.caCertificate.update(caCertificate, patch);

  return null;
}

export function useCACertUpdateActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
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
      patch: CertificatePatch;
    }) => {
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/cacert/update', {
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
