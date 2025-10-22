import { href, redirect } from 'react-router';

import {
  CONTENT_TYPE_EVENT_STREAM,
  CONTENT_TYPE_GRAPHQL,
  CONTENT_TYPE_JSON,
  getAppVersion,
  METHOD_GET,
  METHOD_POST,
} from '~/common/constants';
import * as models from '~/models';
import type { Request, RequestBody, RequestParameter } from '~/models/request';
import { SegmentEvent } from '~/ui/analytics';
import type { CreateRequestType } from '~/ui/hooks/use-request';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new';

export async function clientAction({ params, request }: Route.ClientActionArgs) {
  const { organizationId, projectId, workspaceId } = params;

  const { requestType, parentId, req } = (await request.json()) as {
    requestType: CreateRequestType;
    parentId?: string;
    req?: Request;
  };

  const settings = await models.settings.getOrCreate();
  const defaultHeaders = settings.disableAppVersionUserAgent
    ? []
    : [{ name: 'User-Agent', value: `insomnia/${getAppVersion()}` }];

  let activeRequestId;
  if (requestType === 'HTTP') {
    activeRequestId = (
      await models.request.create({
        parentId: parentId || workspaceId,
        method: METHOD_GET,
        name: 'New Request',
        headers: defaultHeaders,
      })
    )._id;
  }
  if (requestType === 'gRPC') {
    activeRequestId = (
      await models.grpcRequest.create({
        parentId: parentId || workspaceId,
        name: 'New Request',
      })
    )._id;
  }
  if (requestType === 'GraphQL') {
    activeRequestId = (
      await models.request.create({
        parentId: parentId || workspaceId,
        method: METHOD_POST,
        headers: [...defaultHeaders, { name: 'Content-Type', value: CONTENT_TYPE_JSON }],
        body: {
          mimeType: CONTENT_TYPE_GRAPHQL,
          text: '',
        },
        name: 'New Request',
      })
    )._id;
  }
  if (requestType === 'Event Stream') {
    activeRequestId = (
      await models.request.create({
        parentId: parentId || workspaceId,
        method: METHOD_GET,
        url: '',
        headers: [...defaultHeaders, { name: 'Accept', value: CONTENT_TYPE_EVENT_STREAM }],
        name: 'New Event Stream',
      })
    )._id;
  }
  if (requestType === 'WebSocket') {
    activeRequestId = (
      await models.webSocketRequest.create({
        parentId: parentId || workspaceId,
        name: 'New WebSocket Request',
        headers: defaultHeaders,
      })
    )._id;
  }
  if (requestType === 'SocketIO') {
    activeRequestId = (
      await models.socketIORequest.create({
        parentId: parentId || workspaceId,
        name: 'New Socket.IO Request',
        headers: defaultHeaders,
      })
    )._id;
  }
  if (requestType === 'From Curl') {
    if (!req) {
      return null;
    }
    try {
      activeRequestId = (
        await models.request.create({
          parentId: parentId || workspaceId,
          url: req.url,
          method: req.method,
          headers: req.headers,
          body: req.body as RequestBody,
          authentication: req.authentication,
          parameters: req.parameters as RequestParameter[],
        })
      )._id;
    } catch (error) {
      console.error(error);
      return null;
    }
  }
  invariant(typeof activeRequestId === 'string', 'Request ID is required');
  models.stats.incrementCreatedRequests();
  window.main.trackSegmentEvent({ event: SegmentEvent.requestCreate, properties: { requestType } });

  // add a created query param to the URL to indicate that the request was just created, this is for distinguishing if we will create a temporary or permanent tab
  return redirect(
    `${href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId`, {
      organizationId,
      projectId,
      workspaceId,
      requestId: activeRequestId,
    })}?created=true`,
  );
}

export const useRequestNewActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      requestType,
      parentId,
      req,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      requestType: CreateRequestType;
      parentId?: string;
      req?: Partial<Request>;
    }) => {
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/new', {
        organizationId,
        projectId,
        workspaceId,
      });

      return submit(JSON.stringify({ requestType, parentId, req }), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
