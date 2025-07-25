import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import type { ClientCertificate } from '~/models/client-certificate';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.clientcert.update';

type CertificatePatch = { _id: string } & Partial<ClientCertificate>;

export async function clientAction({ request }: Route.ClientActionArgs) {
  const patch = (await request.json()) as CertificatePatch;
  const clientCertificate = await models.clientCertificate.getById(patch._id);
  invariant(clientCertificate, 'Client Certificate not found');

  await models.clientCertificate.update(clientCertificate, patch);

  return null;
}

export function useClientCertUpdateActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientAction>(args);

  function submit({
    organizationId,
    projectId,
    workspaceId,
    patch,
  }: {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    patch: CertificatePatch;
  }) {
    const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/clientcert/update', {
      organizationId,
      projectId,
      workspaceId,
    });

    return fetcher.submit(JSON.stringify(patch), {
      action: url,
      method: 'POST',
      encType: 'application/json',
    });
  }

  return {
    ...fetcher,
    submit,
  };
}
