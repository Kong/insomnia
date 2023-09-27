import { createWriteStream } from 'node:fs';
import path from 'node:path';

import * as contentDisposition from 'content-disposition';
import { extension as mimeExtension } from 'mime-types';
import { ActionFunction, LoaderFunction, redirect } from 'react-router-dom';

import { version } from '../../../package.json';
import { CONTENT_TYPE_EVENT_STREAM, CONTENT_TYPE_GRAPHQL, CONTENT_TYPE_JSON, METHOD_GET, METHOD_POST } from '../../common/constants';
import { ChangeBufferEvent, database } from '../../common/database';
import { getContentDispositionHeader } from '../../common/misc';
import { RENDER_PURPOSE_SEND, RenderedRequest } from '../../common/render';
import { ResponsePatch } from '../../main/network/libcurl-promise';
import * as models from '../../models';
import { BaseModel } from '../../models';
import { CookieJar } from '../../models/cookie-jar';
import { GrpcRequest, isGrpcRequestId } from '../../models/grpc-request';
import { GrpcRequestMeta } from '../../models/grpc-request-meta';
import * as requestOperations from '../../models/helpers/request-operations';
import { isEventStreamRequest, isRequest, Request, RequestAuthentication, RequestBody, RequestHeader, RequestParameter } from '../../models/request';
import { isRequestMeta, RequestMeta } from '../../models/request-meta';
import { RequestVersion } from '../../models/request-version';
import { Response } from '../../models/response';
import { isWebSocketRequestId, WebSocketRequest } from '../../models/websocket-request';
import { WebSocketResponse } from '../../models/websocket-response';
import { fetchRequestData, responseTransform, sendCurlAndWriteTimeline, tryToInterpolateRequest } from '../../network/network';
import { invariant } from '../../utils/invariant';
import { SegmentEvent } from '../analytics';
import { updateMimeType } from '../components/dropdowns/content-type-dropdown';
import { CreateRequestType } from '../hooks/use-request';

export interface WebSocketRequestLoaderData {
  activeRequest: WebSocketRequest;
  activeRequestMeta: RequestMeta;
  activeResponse: WebSocketResponse | null;
  responses: WebSocketResponse[];
  requestVersions: RequestVersion[];
}
export interface GrpcRequestLoaderData {
  activeRequest: GrpcRequest;
  activeRequestMeta: GrpcRequestMeta;
  activeResponse: null;
  responses: [];
  requestVersions: RequestVersion[];
}
export interface RequestLoaderData {
  activeRequest: Request;
  activeRequestMeta: RequestMeta;
  activeResponse: Response | null;
  responses: Response[];
  requestVersions: RequestVersion[];
}

export const loader: LoaderFunction = async ({ params }): Promise<RequestLoaderData | WebSocketRequestLoaderData | GrpcRequestLoaderData> => {
  const { organizationId, projectId, requestId, workspaceId } = params;
  invariant(requestId, 'Request ID is required');
  invariant(workspaceId, 'Workspace ID is required');
  const activeRequest = await requestOperations.getById(requestId);
  if (!activeRequest) {
    throw redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug`);
  }
  const activeWorkspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  invariant(activeWorkspaceMeta, 'Active workspace meta not found');
  // NOTE: loaders shouldnt mutate data, this should be moved somewhere else
  await models.workspaceMeta.update(activeWorkspaceMeta, { activeRequestId: requestId });
  if (isGrpcRequestId(requestId)) {
    return {
      activeRequest,
      activeRequestMeta: await models.grpcRequestMeta.updateOrCreateByParentId(requestId, { lastActive: Date.now() }),
      activeResponse: null,
      responses: [],
      requestVersions: [],
    } as GrpcRequestLoaderData;
  }
  const activeRequestMeta = await models.requestMeta.updateOrCreateByParentId(requestId, { lastActive: Date.now() });
  invariant(activeRequestMeta, 'Request meta not found');
  const { filterResponsesByEnv } = await models.settings.get();

  const responseModelName = isWebSocketRequestId(requestId) ? 'webSocketResponse' : 'response';
  const activeResponse = activeRequestMeta.activeResponseId
    ? await models[responseModelName].getById(activeRequestMeta.activeResponseId)
    : await models[responseModelName].getLatestForRequest(requestId, activeWorkspaceMeta.activeEnvironmentId);
  const allResponses = await models[responseModelName].findByParentId(requestId) as (Response | WebSocketResponse)[];
  const filteredResponses = allResponses
    .filter((r: Response | WebSocketResponse) => r.environmentId === activeWorkspaceMeta.activeEnvironmentId);
  const responses = (filterResponsesByEnv ? filteredResponses : allResponses)
    .sort((a: BaseModel, b: BaseModel) => (a.created > b.created ? -1 : 1));
  return {
    activeRequest,
    activeRequestMeta,
    activeResponse,
    responses,
    requestVersions: await models.requestVersion.findByParentId(requestId),
  } as RequestLoaderData | WebSocketRequestLoaderData;
};

export const createRequestAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, projectId, workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const { requestType, parentId, req } = await request.json() as { requestType: CreateRequestType; parentId?: string; req?: Request };

  let activeRequestId;
  if (requestType === 'HTTP') {
    activeRequestId = (await models.request.create({
      parentId: parentId || workspaceId,
      method: METHOD_GET,
      name: 'New Request',
      headers: [{ name: 'User-Agent', value: `insomnia/${version}` }],
    }))._id;
  }
  if (requestType === 'gRPC') {
    activeRequestId = (await models.grpcRequest.create({
      parentId: parentId || workspaceId,
      name: 'New Request',
    }))._id;
  }
  if (requestType === 'GraphQL') {
    activeRequestId = (await models.request.create({
      parentId: parentId || workspaceId,
      method: METHOD_POST,
      headers: [
        { name: 'User-Agent', value: `insomnia/${version}` },
        { name: 'Content-Type', value: CONTENT_TYPE_JSON },
      ],
      body: {
        mimeType: CONTENT_TYPE_GRAPHQL,
        text: '',
      },
      name: 'New Request',
    }))._id;
  }
  if (requestType === 'Event Stream') {
    activeRequestId = (await models.request.create({
      parentId: parentId || workspaceId,
      method: METHOD_GET,
      url: '',
      headers: [
        { name: 'User-Agent', value: `insomnia/${version}` },
        { name: 'Accept', value: CONTENT_TYPE_EVENT_STREAM },
      ],
      name: 'New Event Stream',
    }))._id;
  }
  if (requestType === 'WebSocket') {
    activeRequestId = (await models.webSocketRequest.create({
      parentId: parentId || workspaceId,
      name: 'New WebSocket Request',
      headers: [{ name: 'User-Agent', value: `insomnia/${version}` }],
    }))._id;
  }
  if (requestType === 'From Curl') {
    if (!req) {
      return null;
    }
    try {
      activeRequestId = (await models.request.create({
        parentId: parentId || workspaceId,
        url: req.url,
        method: req.method,
        headers: req.headers,
        body: req.body as RequestBody,
        authentication: req.authentication,
        parameters: req.parameters as RequestParameter[],
      }))._id;
    } catch (error) {
      console.error(error);
      return null;
    }
  }
  invariant(typeof activeRequestId === 'string', 'Request ID is required');
  models.stats.incrementCreatedRequests();
  window.main.trackSegmentEvent({ event: SegmentEvent.requestCreate, properties: { requestType } });

  return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${activeRequestId}`);
};
export const updateRequestAction: ActionFunction = async ({ request, params }) => {
  const { requestId } = params;
  invariant(typeof requestId === 'string', 'Request ID is required');
  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');
  const patch = await request.json();
  // TODO: if gRPC, we should also copy the protofile to the destination workspace - INS-267
  const isMimeTypeChanged = isRequest(req) && patch.body && patch.body.mimeType !== req.body.mimeType;
  if (isMimeTypeChanged) {
    await requestOperations.update(req, { ...patch, ...updateMimeType(req, patch.body?.mimeType) });
    return null;
  }

  await requestOperations.update(req, patch);
  return null;
};

export const deleteRequestAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, projectId, workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const formData = await request.formData();
  const id = formData.get('id') as string;
  const req = await requestOperations.getById(id);
  invariant(req, 'Request not found');
  models.stats.incrementDeletedRequests();
  await requestOperations.remove(req);
  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  invariant(workspaceMeta, 'Workspace meta not found');
  if (workspaceMeta.activeRequestId === id) {
    await models.workspaceMeta.updateByParentId(workspaceId, { activeRequestId: null });
    return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug`);
  }
  return null;
};

export const duplicateRequestAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, projectId, workspaceId, requestId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  invariant(typeof requestId === 'string', 'Request ID is required');
  const { name, parentId } = await request.json();

  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');
  if (parentId) {
    const workspace = await models.workspace.getById(parentId);
    invariant(workspace, 'Workspace is required');
    // TODO: if gRPC, we should also copy the protofile to the destination workspace - INS-267
    // Move to top of sort order
    const newRequest = await requestOperations.duplicate(req, { name, parentId, metaSortKey: -1e9 });
    invariant(newRequest, 'Failed to duplicate request');
    models.stats.incrementCreatedRequests();
    return null;
  }
  const newRequest = await requestOperations.duplicate(req, { name });
  invariant(newRequest, 'Failed to duplicate request');
  models.stats.incrementCreatedRequests();
  return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${newRequest._id}`);
};

export const updateRequestMetaAction: ActionFunction = async ({ request, params }) => {
  const { requestId } = params;
  invariant(typeof requestId === 'string', 'Request ID is required');
  const patch = await request.json() as Partial<RequestMeta | GrpcRequestMeta>;
  if (isGrpcRequestId(requestId)) {
    await models.grpcRequestMeta.updateOrCreateByParentId(requestId, patch);
    return null;
  }
  await models.requestMeta.updateOrCreateByParentId(requestId, patch);
  return null;
};
export interface ConnectActionParams {
  url: string;
  headers: RequestHeader[];
  authentication: RequestAuthentication;
  cookieJar: CookieJar;
  suppressUserAgent: boolean;
}
export const connectAction: ActionFunction = async ({ request, params }) => {
  const { requestId, workspaceId } = params;
  invariant(typeof requestId === 'string', 'Request ID is required');
  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');
  invariant(workspaceId, 'Workspace ID is required');
  const rendered = await request.json() as ConnectActionParams;
  if (isWebSocketRequestId(requestId)) {
    window.main.webSocket.open({
      requestId,
      workspaceId,
      url: rendered.url,
      headers: rendered.headers,
      authentication: rendered.authentication,
      cookieJar: rendered.cookieJar,
    });
  }
  if (isEventStreamRequest(req)) {
    window.main.curl.open({
      requestId,
      workspaceId,
      url: rendered.url,
      headers: rendered.headers,
      authentication: rendered.authentication,
      cookieJar: rendered.cookieJar,
      suppressUserAgent: rendered.suppressUserAgent,
    });
  }
  // HACK: even more elaborate hack to get the request to update
  return new Promise(resolve => {
    database.onChange(async (changes: ChangeBufferEvent[]) => {
      for (const change of changes) {
        const [event, doc] = change;
        if (isRequestMeta(doc) && doc.parentId === requestId && event === 'update') {
          resolve(null);
        }
      }
    });
  });
};
const writeToDownloadPath = (downloadPathAndName: string, responsePatch: ResponsePatch, requestMeta: RequestMeta, maxHistoryResponses: number) => {
  invariant(downloadPathAndName, 'filename should be set by now');

  const to = createWriteStream(downloadPathAndName);
  const readStream = models.response.getBodyStream(responsePatch);
  if (!readStream || typeof readStream === 'string') {
    return null;
  }
  readStream.pipe(to);

  return new Promise(resolve => {
    readStream.on('end', async () => {
      responsePatch.error = `Saved to ${downloadPathAndName}`;
      const response = await models.response.create(responsePatch, maxHistoryResponses);
      await models.requestMeta.update(requestMeta, { activeResponseId: response._id });
      resolve(null);
    });
    readStream.on('error', async err => {
      console.warn('Failed to download request after sending', responsePatch.bodyPath, err);
      const response = await models.response.create(responsePatch, maxHistoryResponses);
      await models.requestMeta.update(requestMeta, { activeResponseId: response._id });
      resolve(null);
    });
  });

};
export interface SendActionParams {
  renderedRequest: RenderedRequest;
  shouldPromptForPathAfterResponse?: boolean;
}
export const sendAction: ActionFunction = async ({ request, params }) => {
  const { requestId, workspaceId } = params;
  invariant(typeof requestId === 'string', 'Request ID is required');
  const req = await requestOperations.getById(requestId) as Request;
  invariant(req, 'Request not found');
  invariant(workspaceId, 'Workspace ID is required');
  const {
    environment,
    settings,
    clientCertificates,
    caCert,
    activeEnvironmentId } = await fetchRequestData(requestId);
  const { renderedRequest, shouldPromptForPathAfterResponse } = await request.json() as SendActionParams;
  const renderResult = await tryToInterpolateRequest(req, environment._id, RENDER_PURPOSE_SEND);

  const response = await sendCurlAndWriteTimeline(
    renderedRequest,
    clientCertificates,
    caCert,
    settings,
  );
  const requestMeta = await models.requestMeta.getByParentId(requestId);
  invariant(requestMeta, 'RequestMeta not found');
  const responsePatch = await responseTransform(response, activeEnvironmentId, renderedRequest, renderResult.context);
  const is2XXWithBodyPath = responsePatch.statusCode && responsePatch.statusCode >= 200 && responsePatch.statusCode < 300 && responsePatch.bodyPath;
  const shouldWriteToFile = shouldPromptForPathAfterResponse && is2XXWithBodyPath;
  if (!shouldWriteToFile) {
    const response = await models.response.create(responsePatch, settings.maxHistoryResponses);
    await models.requestMeta.update(requestMeta, { activeResponseId: response._id });
    // setLoading(false);
    return null;
  }
  if (requestMeta.downloadPath) {
    const header = getContentDispositionHeader(responsePatch.headers || []);
    const name = header
      ? contentDisposition.parse(header.value).parameters.filename
      : `${req.name.replace(/\s/g, '-').toLowerCase()}.${responsePatch.contentType && mimeExtension(responsePatch.contentType) || 'unknown'}`;
    return writeToDownloadPath(path.join(requestMeta.downloadPath, name), responsePatch, requestMeta, settings.maxHistoryResponses);
  } else {
    const defaultPath = window.localStorage.getItem('insomnia.sendAndDownloadLocation');
    const { filePath } = await window.dialog.showSaveDialog({
      title: 'Select Download Location',
      buttonLabel: 'Save',
      // NOTE: An error will be thrown if defaultPath is supplied but not a String
      ...(defaultPath ? { defaultPath } : {}),
    });
    if (!filePath) {
      // setLoading(false);
      return null;
    }
    window.localStorage.setItem('insomnia.sendAndDownloadLocation', filePath);
    return writeToDownloadPath(filePath, responsePatch, requestMeta, settings.maxHistoryResponses);
  }
};
export const deleteAllResponsesAction: ActionFunction = async ({ params }) => {
  const { workspaceId, requestId } = params;
  invariant(typeof requestId === 'string', 'Request ID is required');
  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');
  invariant(workspaceId, 'Workspace ID is required');
  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  invariant(workspaceMeta, 'Active workspace meta not found');
  if (isWebSocketRequestId(requestId)) {
    await models.webSocketResponse.removeForRequest(requestId, workspaceMeta.activeEnvironmentId);
  } else {
    await models.response.removeForRequest(requestId, workspaceMeta.activeEnvironmentId);
  }
  return null;
};

export const deleteResponseAction: ActionFunction = async ({ request, params }) => {
  const { workspaceId, requestId } = params;
  invariant(typeof requestId === 'string', 'Request ID is required');
  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');
  const { responseId } = await request.json();
  invariant(typeof responseId === 'string', 'Response ID is required');
  invariant(workspaceId, 'Workspace ID is required');
  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  invariant(workspaceMeta, 'Active workspace meta not found');
  if (isWebSocketRequestId(requestId)) {
    const res = await models.webSocketResponse.getById(responseId);
    invariant(res, 'Response not found');
    await models.webSocketResponse.remove(res);
    const response = await models.webSocketResponse.getLatestForRequest(requestId, workspaceMeta.activeEnvironmentId);
    if (response?.requestVersionId) {
      await models.requestVersion.restore(response.requestVersionId);
    }
    await models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: response?._id || null });
  } else {
    const res = await models.response.getById(responseId);
    invariant(res, 'Response not found');
    await models.response.remove(res);
    const response = await models.response.getLatestForRequest(requestId, workspaceMeta.activeEnvironmentId);
    if (response?.requestVersionId) {
      await models.requestVersion.restore(response.requestVersionId);
    }
    await models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: response?._id || null });
  }

  return null;
};
