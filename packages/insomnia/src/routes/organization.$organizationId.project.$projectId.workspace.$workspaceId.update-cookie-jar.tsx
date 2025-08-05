import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.update-cookie-jar';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { cookieJarId, patch } = await request.json();

  invariant(typeof cookieJarId === 'string', 'Cookie Jar ID is required');

  const cookieJar = await models.cookieJar.getById(cookieJarId);

  invariant(cookieJar, 'Cookie Jar not found');

  const updatedCookieJar = await models.cookieJar.update(cookieJar, patch);

  return updatedCookieJar;
}

export function useUpdateCookieJarActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({
      organizationId,
      projectId,
      workspaceId,
      cookieJarId,
      patch,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      cookieJarId: string;
      patch: any;
    }) => {
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/update-cookie-jar', {
        organizationId,
        projectId,
        workspaceId,
      });

      return fetcherSubmit(JSON.stringify({ cookieJarId, patch }), {
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
