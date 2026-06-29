import type { Request, RequestBody, RequestParameter } from 'insomnia-data';
import { services } from 'insomnia-data';
import { href, redirect } from 'react-router';

import {
  CONTENT_TYPE_EVENT_STREAM,
  CONTENT_TYPE_GRAPHQL,
  CONTENT_TYPE_JSON,
  METHOD_GET,
  METHOD_POST,
} from '~/common/constants';
import { invariant } from '~/common/utils/invariant';
import type { RequestCreatedMetricsProperties } from '~/ui/analytics';
import { AnalyticsEvent } from '~/ui/analytics';
import { trackCioEvent } from '~/ui/hooks/use-cio';
import type { CreateRequestType } from '~/ui/hooks/use-request';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new';

export async function clientAction({ params, request }: Route.ClientActionArgs) {
  const { organizationId, projectId, workspaceId } = params;

  const { requestType, parentId, req, metrics } = (await request.json()) as {
    requestType: CreateRequestType;
    parentId?: string;
    req?: Partial<Request>;
    metrics?: RequestCreatedMetricsProperties;
  };

  let activeRequestId;
  if (requestType === 'HTTP') {
    activeRequestId = (
      await services.request.create({
        parentId: parentId || workspaceId,
        method: METHOD_GET,
        name: req?.name || 'New Request',
        url: req?.url || '',
        headers: [],
      })
    )._id;
  }
  if (requestType === 'gRPC') {
    activeRequestId = (
      await services.grpcRequest.create({
        parentId: parentId || workspaceId,
        name: 'New Request',
      })
    )._id;
  }
  if (requestType === 'GraphQL') {
    activeRequestId = (
      await services.request.create({
        parentId: parentId || workspaceId,
        method: METHOD_POST,
        headers: [{ name: 'Content-Type', value: CONTENT_TYPE_JSON }],
        body: {
          mimeType: CONTENT_TYPE_GRAPHQL,
          text: req?.body?.text || '',
        },
        name: req?.name || 'New Request',
        url: req?.url || '',
        authentication: req?.authentication,
      })
    )._id;
  }
  if (requestType === 'Event Stream') {
    activeRequestId = (
      await services.request.create({
        parentId: parentId || workspaceId,
        method: METHOD_GET,
        url: '',
        headers: [{ name: 'Accept', value: CONTENT_TYPE_EVENT_STREAM }],
        name: 'New Event Stream',
      })
    )._id;
  }
  if (requestType === 'WebSocket') {
    activeRequestId = (
      await services.webSocketRequest.create({
        parentId: parentId || workspaceId,
        name: 'New WebSocket Request',
        headers: [],
      })
    )._id;
  }
  if (requestType === 'SocketIO') {
    activeRequestId = (
      await services.socketIORequest.create({
        parentId: parentId || workspaceId,
        name: 'New Socket.IO Request',
        headers: [],
      })
    )._id;
  }
  if (requestType === 'From Curl') {
    if (!req) {
      return null;
    }
    try {
      activeRequestId = (
        await services.request.create({
          parentId: parentId || workspaceId,
          url: req.url,
          name: req.name || 'New Request',
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
  services.stats.incrementCreatedRequests();

  const certificates = await services.clientCertificate.findByParentId(workspaceId);

  const requestCreatedProperties = {
    requestType,
    protocol: requestType,
    project_id: projectId,
    collection_id: workspaceId,
    request_key_id: activeRequestId,
    has_prescript: !!req?.preRequestScript,
    has_postscript: !!req?.afterResponseScript,
    request_header_names: req?.headers?.map(h => h.name) || [],
    count_cookies: req?.headers?.find(h => h.name.toLowerCase() === 'cookie')
      ? req.headers?.find(h => h.name.toLowerCase() === 'cookie')?.value.split(';').length
      : 0,
    count_certificates: certificates.length,
    count_headers: req?.headers?.length || 0,
    count_query_parameters: req?.parameters?.length || 0,
    count_path_parameters: req?.pathParameters?.length || 0,
    count_prescript_lines: req?.preRequestScript ? req.preRequestScript.split('\n').length : 0,
    count_postscript_lines: req?.afterResponseScript ? req.afterResponseScript.split('\n').length : 0,
    auth_type:
      req?.authentication && typeof req.authentication === 'object' && 'type' in req.authentication
        ? req.authentication.type
        : 'none',
    has_docs: !!req?.description,
    source: metrics?.source,
  };

  window.main.trackAnalyticsEvent({
    event: AnalyticsEvent.requestCreated,
    properties: requestCreatedProperties,
  });

  // Send to Customer.io directly so the event is tied to the identified user's
  // email-bearing profile (only fires when logged in). See INS-2678.
  trackCioEvent(AnalyticsEvent.requestCreated, requestCreatedProperties);

  return redirect(
    href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId`, {
      organizationId,
      projectId,
      workspaceId,
      requestId: activeRequestId,
    }),
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
      metrics,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      requestType: CreateRequestType;
      parentId?: string;
      req?: Partial<Request>;
      metrics?: RequestCreatedMetricsProperties;
    }) => {
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/new', {
        organizationId,
        projectId,
        workspaceId,
      });

      return submit(JSON.stringify({ requestType, parentId, req, metrics }), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
