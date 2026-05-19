import { href, redirect } from 'react-router';

import { services } from '~/insomnia-data';
import { SegmentEvent } from '~/ui/analytics';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.delete';

export async function clientAction({ params, request }: Route.ClientActionArgs) {
  const { organizationId, projectId, workspaceId } = params;

  const formData = await request.formData();
  const id = formData.get('id') as string;
  const req = await services.helpers.getRequestById(id);
  invariant(req, 'Request not found');
  services.stats.incrementDeletedRequests();
  await services.helpers.removeRequest(req);
  const workspaceMeta = await services.workspaceMeta.getByParentId(workspaceId);
  invariant(workspaceMeta, 'Workspace meta not found');

  window.main.trackSegmentEvent({
    event: SegmentEvent.requestDeleted,
  });

  if (workspaceMeta.activeRequestId === id) {
    await services.workspaceMeta.updateByParentId(workspaceId, { activeRequestId: null });

    if (request.url.includes(id)) {
      return redirect(
        href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug', {
          organizationId,
          projectId,
          workspaceId,
        }),
      );
    }
  }
  return null;
}

export const useRequestDeleteActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      id,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      id: string;
    }) => {
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/delete', {
        organizationId,
        projectId,
        workspaceId,
      });

      const formData = new FormData();
      formData.append('id', id);

      return submit(formData, {
        action: url,
        method: 'POST',
      });
    },
  clientAction,
);
