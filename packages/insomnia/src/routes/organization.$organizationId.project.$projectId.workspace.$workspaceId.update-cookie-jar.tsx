import { services } from 'insomnia-data';
import { href } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.update-cookie-jar';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { cookieJarId, patch } = await request.json();

  invariant(typeof cookieJarId === 'string', 'Cookie Jar ID is required');

  const cookieJar = await services.cookieJar.getById(cookieJarId);

  invariant(cookieJar, 'Cookie Jar not found');

  const updatedCookieJar = await services.cookieJar.update(cookieJar, patch);

  return updatedCookieJar;
}

export const useUpdateCookieJarActionFetcher = createFetcherSubmitHook(
  submit =>
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

      return submit(JSON.stringify({ cookieJarId, patch }), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
