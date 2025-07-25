import { href, useFetcher } from 'react-router';

import * as models from '~/models';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.cacert.new';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const patch = await request.json();
  await models.caCertificate.create(patch);
  return null;
}

export function useCACertNewActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
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
    patch: Record<string, any>;
  }) {
    const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/cacert/new', {
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
