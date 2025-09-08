import { href } from 'react-router';

import type { ChangeBufferEvent } from '~/common/database';
import type { CookieJar } from '~/models/cookie-jar';
import * as requestOperations from '~/models/helpers/request-operations';
import { type TransportType } from '~/models/mcp-request';
import type { RequestAuthentication, RequestHeader } from '~/models/request';
import { isRequestMeta } from '~/models/request-meta';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.mcp.request.$requestId.connect';

export interface ConnectActionParams {
  url: string;
  headers: RequestHeader[];
  authentication: RequestAuthentication;
  cookieJar: CookieJar;
  suppressUserAgent: boolean;
  transportType?: TransportType;
  query?: Record<string, string>;
}

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { requestId, workspaceId } = params;

  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');
  invariant(workspaceId, 'Workspace ID is required');
  //const rendered = (await request.json()) as ConnectActionParams;

  // TODO: Integrate with mcp ipc main
  // HACK: even more elaborate hack to get the request to update
  return new Promise(resolve => {
    const unsubscribe = window.main.on('db.changes', async (_, changes: ChangeBufferEvent[]) => {
      for (const change of changes) {
        const [event, doc] = change;
        if (isRequestMeta(doc) && doc.parentId === requestId && event === 'update') {
          resolve(null);
          unsubscribe();
          return;
        }
      }
    });
  });
}

export const useRequestConnectActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      requestId,
      connectParams,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      requestId: string;
      connectParams: ConnectActionParams;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/mcp/request/:requestId/connect',
        {
          organizationId,
          projectId,
          workspaceId,
          requestId,
        },
      );

      return submit(JSON.stringify(connectParams), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
