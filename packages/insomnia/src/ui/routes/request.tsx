import { createWriteStream } from 'node:fs';
import path from 'node:path';

import * as contentDisposition from 'content-disposition';
import fs from 'fs';
import { GRAPHQL_TRANSPORT_WS_PROTOCOL, MessageType } from 'graphql-ws';
import type { RequestTestResult } from 'insomnia-sdk';
import { extension as mimeExtension } from 'mime-types';
import { type ActionFunction, type LoaderFunction, redirect } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

import { version } from '../../../package.json';
import { CONTENT_TYPE_EVENT_STREAM, CONTENT_TYPE_GRAPHQL, CONTENT_TYPE_JSON, METHOD_GET, METHOD_POST } from '../../common/constants';
import { type ChangeBufferEvent, database } from '../../common/database';
import { getContentDispositionHeader } from '../../common/misc';
import { type RenderedRequest } from '../../common/render';
import type { ResponsePatch } from '../../main/network/libcurl-promise';
import type { TimingStep } from '../../main/network/request-timing';
import type { BaseModel } from '../../models';
import * as models from '../../models';
import type { CookieJar } from '../../models/cookie-jar';
import type { Environment, UserUploadEnvironment } from '../../models/environment';
import { type GrpcRequest, isGrpcRequestId } from '../../models/grpc-request';
import type { GrpcRequestMeta } from '../../models/grpc-request-meta';
import * as requestOperations from '../../models/helpers/request-operations';
import type { MockRoute } from '../../models/mock-route';
import type { MockServer } from '../../models/mock-server';
import { isGraphqlSubscriptionRequest } from '../../models/request';
import { getPathParametersFromUrl, isEventStreamRequest, isRequest, type Request, type RequestAuthentication, type RequestBody, type RequestHeader, type RequestParameter } from '../../models/request';
import { isRequestMeta, type RequestMeta } from '../../models/request-meta';
import type { RequestVersion } from '../../models/request-version';
import type { Response } from '../../models/response';
import type { ResponseInfo, RunnerResultPerRequestPerIteration } from '../../models/runner-test-result';
import { isWebSocketRequest, isWebSocketRequestId, type WebSocketRequest } from '../../models/websocket-request';
import { isWebSocketResponse, type WebSocketResponse } from '../../models/websocket-response';
import { getAuthHeader } from '../../network/authentication';
import { fetchRequestData, responseTransform, sendCurlAndWriteTimeline, tryToExecuteAfterResponseScript, tryToExecutePreRequestScript, tryToInterpolateRequest, tryToTransformRequestWithPlugins } from '../../network/network';
import { RenderErrorSubType } from '../../templating';
import { parseGraphQLReqeustBody } from '../../utils/graph-ql';
import { invariant } from '../../utils/invariant';
import { SegmentEvent } from '../analytics';
import { updateMimeType } from '../components/dropdowns/content-type-dropdown';
import type { CreateRequestType } from '../hooks/use-request';

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
  mockServerAndRoutes: (MockServer & { routes: MockRoute[] })[];
}

export const defaultSendActionRuntime = {
  appendTimeline: async (timelinePath: string, logs: string[]) => {
    await fs.promises.appendFile(timelinePath, logs.join('\n'));
  },
};

export const loader: LoaderFunction = async ({ params }): Promise<RequestLoaderData | WebSocketRequestLoaderData | GrpcRequestLoaderData> => {
  const { organizationId, projectId, requestId, workspaceId } = params;
  invariant(requestId, 'Request ID is required');
  invariant(workspaceId, 'Workspace ID is required');
  invariant(projectId, 'Project ID is required');
  const activeRequest = await requestOperations.getById(requestId);
  if (!activeRequest) {
    throw redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug`);
  }
  const activeWorkspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  invariant(activeWorkspaceMeta, 'Active workspace meta not found');
  // NOTE: loaders shouldnt mutate data, this should be moved somewhere else
  await models.workspaceMeta.updateByParentId(workspaceId, { activeRequestId: requestId });
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
  const isGraphqlWsRequest = isGraphqlSubscriptionRequest(activeRequest);

  const responseModelName = isWebSocketRequestId(requestId) || isGraphqlWsRequest ? 'webSocketResponse' : 'response';
  const activeResponse = activeRequestMeta.activeResponseId
    ? await models[responseModelName].getById(activeRequestMeta.activeResponseId)
    : await models[responseModelName].getLatestForRequest(requestId, activeWorkspaceMeta.activeEnvironmentId);
  const allResponses = await models[responseModelName].findByParentId(requestId) as (Response | WebSocketResponse)[];
  const filteredResponses = allResponses
    .filter((r: Response | WebSocketResponse) => r.environmentId === activeWorkspaceMeta.activeEnvironmentId);
  const responses = (filterResponsesByEnv ? filteredResponses : allResponses)
    .sort((a: BaseModel, b: BaseModel) => (a.created > b.created ? -1 : 1));

  // Q(gatzjames): load mock servers here or somewhere else?
  const mockServers = await models.mockServer.findByProjectId(projectId);
  const mockRoutes = await database.find<MockRoute>(models.mockRoute.type, { parentId: { $in: mockServers.map(s => s._id) } });
  const mockServerAndRoutes = mockServers.map(mockServer => ({
    ...mockServer,
    routes: mockRoutes.filter(route => route.parentId === mockServer._id),
  }));
  // set empty activeResponse if graphql websocket request and activeResponse is not websocket response
  if (isGraphqlWsRequest && activeResponse && !isWebSocketResponse(activeResponse)) {
    return {
      activeRequest,
      activeRequestMeta,
      activeResponse: null,
      responses: [],
      requestVersions: [],
      mockServerAndRoutes,
    } as RequestLoaderData | WebSocketRequestLoaderData;
  }
  return {
    activeRequest,
    activeRequestMeta,
    activeResponse,
    responses,
    requestVersions: await models.requestVersion.findByParentId(requestId),
    mockServerAndRoutes,
  } as RequestLoaderData | WebSocketRequestLoaderData;
};

export const createRequestAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, projectId, workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const { requestType, parentId, req } = await request.json() as { requestType: CreateRequestType; parentId?: string; req?: Request };

  const settings = await models.settings.getOrCreate();
  const defaultHeaders = settings.disableAppVersionUserAgent ? [] : [{ name: 'User-Agent', value: `insomnia/${version}` }];

  let activeRequestId;
  if (requestType === 'HTTP') {
    activeRequestId = (await models.request.create({
      parentId: parentId || workspaceId,
      method: METHOD_GET,
      name: 'New Request',
      headers: defaultHeaders,
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
        ...defaultHeaders,
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
        ...defaultHeaders,
        { name: 'Accept', value: CONTENT_TYPE_EVENT_STREAM },
      ],
      name: 'New Event Stream',
    }))._id;
  }
  if (requestType === 'WebSocket') {
    activeRequestId = (await models.webSocketRequest.create({
      parentId: parentId || workspaceId,
      name: 'New WebSocket Request',
      headers: defaultHeaders,
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

  const isRequestURLChanged = (isRequest(req) || isWebSocketRequest(req)) && patch.url && patch.url !== req.url;

  if (isRequestURLChanged) {
    const { url } = patch as Request | WebSocketRequest;

    // Check the URL for path parameters and store them in the request
    const urlPathParameters = getPathParametersFromUrl(url);

    const pathParameters = urlPathParameters.map(name => ({
      name,
      value: req.pathParameters?.find(p => p.name === name)?.value || '',
    }));

    patch.pathParameters = pathParameters;
  }

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
    if (request.url.includes(id)) {
      return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug`);
    }
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
  if (isGraphqlSubscriptionRequest(req)) {
    window.main.webSocket.open({
      requestId,
      workspaceId,
      // replace url with ws/wss for graphql subscriptions
      url: rendered.url.replace('http', 'ws').replace('https', 'wss'),
      headers: [
        ...rendered.headers,
        // add graphql-transport-ws protocol for graphql subscription
        {
          name: 'sec-websocket-protocol',
          value: GRAPHQL_TRANSPORT_WS_PROTOCOL,
        },
      ],
      isGraphqlSubscriptionRequest: true,
      // graphql-ws protocol needs to send ConnectionInit message first. Refer: https://github.com/enisdenjo/graphql-ws/blob/master/PROTOCOL.md
      initialPayload: JSON.stringify({
        type: MessageType.ConnectionInit,
      }),
      authentication: rendered.authentication,
      cookieJar: rendered.cookieJar,
    });
  }
  if (isEventStreamRequest(req)) {
    const renderedRequest = { ...req, ...rendered } as RenderedRequest;
    const authHeader = await getAuthHeader(renderedRequest, rendered.url);
    window.main.curl.open({
      requestId,
      workspaceId,
      url: rendered.url,
      headers: rendered.headers,
      authHeader,
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
  requestId: string;
  shouldPromptForPathAfterResponse?: boolean;
  ignoreUndefinedEnvVariable?: boolean;
}

export interface SendActionRuntime {
  appendTimeline: (timelinePath: string, logs: string[]) => Promise<void>;
}

export const sendAction: ActionFunction = async ({ request, params }) => {
  const { requestId, workspaceId } = params;
  invariant(typeof requestId === 'string', 'Request ID is required');
  invariant(workspaceId, 'Workspace ID is required');
  const { shouldPromptForPathAfterResponse, ignoreUndefinedEnvVariable } = await request.json() as SendActionParams;

  try {
    return await sendActionImplementation({
      requestId,
      shouldPromptForPathAfterResponse,
      ignoreUndefinedEnvVariable,
    });
  } catch (err) {
    console.log('[request] Failed to send request', err);
    const e = err.error || err;
    const url = new URL(request.url);

    // when after-script error, there is no error in response, we need to set error info into response, so that we can show it in response viewer
    if (err.response && err.requestMeta && err.response._id) {
      if (!err.response.error) {
        err.response.error = e;
        err.response.statusMessage = 'Error';
        err.response.statusCode = 0;
      }
      // this part is for persisting useful info (e.g. timeline) for debugging, even there is an error
      const existingResponse = await models.response.getById(err.response._id);
      const response = existingResponse || await models.response.create(err.response, err.maxHistoryResponses);
      await models.requestMeta.update(err.requestMeta, { activeResponseId: response._id });
    } else {
      // if the error is not from response, we need to set it to url param and show it in modal
      url.searchParams.set('error', e);
      if (e?.extraInfo && e?.extraInfo?.subType === RenderErrorSubType.EnvironmentVariable) {
        url.searchParams.set('envVariableMissing', '1');
        url.searchParams.set('undefinedEnvironmentVariables', e?.extraInfo?.undefinedEnvironmentVariables);
      }
    }

    window.main.completeExecutionStep({ requestId });
    return redirect(`${url.pathname}?${url.searchParams}`);
  }
};

export type RunnerSource = 'runner';
export interface CollectionRunnerContext {
  source: RunnerSource;
  environmentId: string;
  iterationCount: number;
  iterationData: object;
  duration: number; // millisecond
  testCount: number;
  avgRespTime: number; // millisecond
  iterationResults: RunnerResultPerRequestPerIteration;
  done: boolean;
  responsesInfo: ResponseInfo[];
  transientVariables: Environment;
}

export interface RunnerContextForRequest {
  requestId: string;
  requestName: string;
  requestUrl: string;
  statusCode: number;
  duration: number; // millisecond
  size: number;
  results: RequestTestResult[];
  responseId: string;
}

export const sendActionImplementation = async (options: {
    requestId: string;
    shouldPromptForPathAfterResponse: boolean | undefined;
    ignoreUndefinedEnvVariable: boolean | undefined;
    testResultCollector?: RunnerContextForRequest;
    iteration?: number;
    iterationCount?: number;
    userUploadEnvironment?: UserUploadEnvironment;
    transientVariables?: Environment;
    runtime?: SendActionRuntime;
}) => {
  const {
    requestId,
    userUploadEnvironment,
    shouldPromptForPathAfterResponse,
    ignoreUndefinedEnvVariable,
    testResultCollector,
    iteration,
    iterationCount,
    transientVariables: nullableTransientVariables,
    runtime = defaultSendActionRuntime,
  } = options;

  window.main.startExecution({ requestId });
  const requestData = await fetchRequestData(requestId);
  const requestMeta = await models.requestMeta.getByParentId(requestId);
  const transientVariables = nullableTransientVariables || {
    ...models.environment.init(),
    _id: uuidv4(),
    type: models.environment.type,
    parentId: requestData.environment.parentId,
    modified: 0,
    created: Date.now(),
    name: 'Transient Environment',
    data: {},
  };

  window.main.addExecutionStep({ requestId, stepName: 'Executing pre-request script' });
  const mutatedContext = await tryToExecutePreRequestScript(requestData, transientVariables, userUploadEnvironment, iteration, iterationCount, runtime);
  if ('error' in mutatedContext) {
    throw {
      // create response with error info, so that we can store response in db and show it in response viewer
      response: {
        _id: requestData.responseId,
        parentId: requestId,
        environemntId: requestData.environment,
        statusMessage: 'Error',
        error: mutatedContext.error,
      },
      maxHistoryResponses: requestData.settings.maxHistoryResponses,
      requestMeta,
      error: mutatedContext.error,
    };
  }
  if (mutatedContext.execution?.skipRequest) {
    // cancel request running if skipRequest in pre-request script
    const responseId = requestData.responseId;
    const responsePatch = {
      _id: responseId,
      parentId: requestId,
      environemntId: requestData.environment,
      statusMessage: 'Cancelled',
      error: 'Request was cancelled by pre-request script',
    };
    // create and update response to activeResponse
    await models.response.create(responsePatch, requestData.settings.maxHistoryResponses);
    await models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: responseId });
    window.main.completeExecutionStep({ requestId });
    return mutatedContext;
  }

  window.main.completeExecutionStep({ requestId });

  // disable after-response script here to avoiding rendering it
  // @TODO This should be handled in a better way. Maybe remove the key from the request object we pass in tryToInterpolateRequest
  const afterResponseScript = mutatedContext.request.afterResponseScript ? `${mutatedContext.request.afterResponseScript}` : undefined;
  mutatedContext.request.afterResponseScript = '';

  window.main.addExecutionStep({ requestId, stepName: 'Rendering request' });
  const renderedResult = await tryToInterpolateRequest({
    request: mutatedContext.request,
    environment: mutatedContext.environment,
    purpose: 'send',
    extraInfo: undefined,
    baseEnvironment: mutatedContext.baseEnvironment,
    userUploadEnvironment: mutatedContext.userUploadEnvironment,
    transientVariables: mutatedContext.transientVariables,
    ignoreUndefinedEnvVariable,
  });
  const renderedRequest = await tryToTransformRequestWithPlugins(renderedResult);
  window.main.completeExecutionStep({ requestId });

  // TODO: remove this temporary hack to support GraphQL variables in the request body properly
  parseGraphQLReqeustBody(renderedRequest);

  invariant(requestMeta, 'RequestMeta not found');

  window.main.addExecutionStep({ requestId, stepName: 'Sending request' });
  const response = await sendCurlAndWriteTimeline(
    renderedRequest,
    mutatedContext.clientCertificates,
    requestData.caCert,
    mutatedContext.settings,
    requestData.timelinePath,
    requestData.responseId,
    runtime,
  );
  window.main.completeExecutionStep({ requestId });
  if ('error' in response) {
    throw {
      response: await responseTransform(response, requestData.activeEnvironmentId, renderedRequest, renderedResult.context),
      maxHistoryResponses: requestData.settings.maxHistoryResponses,
      requestMeta,
      error: response.error,
    };
  }

  const baseResponsePatch = await responseTransform(response, requestData.activeEnvironmentId, renderedRequest, renderedResult.context);
  const is2XXWithBodyPath = baseResponsePatch.statusCode && baseResponsePatch.statusCode >= 200 && baseResponsePatch.statusCode < 300 && baseResponsePatch.bodyPath;
  const shouldWriteToFile = shouldPromptForPathAfterResponse && is2XXWithBodyPath;

  mutatedContext.request.afterResponseScript = afterResponseScript;
  window.main.addExecutionStep({ requestId, stepName: 'Executing after-response script' });
  const postMutatedContext = await tryToExecuteAfterResponseScript({
    ...requestData,
    ...mutatedContext,
    transientVariables: mutatedContext.transientVariables || transientVariables,
    response,
    iteration,
    iterationCount,
    runtime,
  });
  if ('error' in postMutatedContext) {
    throw {
      response: await responseTransform(response, requestData.activeEnvironmentId, renderedRequest, renderedResult.context),
      maxHistoryResponses: requestData.settings.maxHistoryResponses,
      requestMeta,
      error: postMutatedContext.error,
    };
  }

  window.main.completeExecutionStep({ requestId });

  const preTestResults = (mutatedContext.requestTestResults || []).map(
    (result: RequestTestResult): RequestTestResult => ({ ...result, category: 'pre-request' }),
  );
  const postTestResults = (postMutatedContext?.requestTestResults || []).map(
    (result: RequestTestResult): RequestTestResult => ({ ...result, category: 'after-response' }),
  ) || [];
  if (testResultCollector) {
    testResultCollector.results = [
      ...testResultCollector.results,
      ...preTestResults,
      ...postTestResults,
    ];
    const timingSteps = await window.main.getExecution({ requestId });
    testResultCollector.duration = timingSteps.reduce((acc: number, cur: TimingStep) => {
      return acc + (cur.duration || 0);
    }, 0);
    testResultCollector.responseId = response._id;
  }
  const responsePatch = postMutatedContext ?
    {
      ...baseResponsePatch,
      // both pre-request and after-response test results are collected
      requestTestResults: [
        ...preTestResults,
        ...postTestResults,
      ],
    }
    : baseResponsePatch;

  if (!shouldWriteToFile) {
    const response = await models.response.create(responsePatch, requestData.settings.maxHistoryResponses);
    await models.requestMeta.update(requestMeta, { activeResponseId: response._id });
    return postMutatedContext;
  }

  if (requestMeta.downloadPath) {
    const header = getContentDispositionHeader(responsePatch.headers || []);
    const name = header
      ? contentDisposition.parse(header.value).parameters.filename
      : `${requestData.request.name.replace(/\s/g, '-').toLowerCase()}.${responsePatch.contentType && mimeExtension(responsePatch.contentType) || 'unknown'}`;
    return writeToDownloadPath(path.join(requestMeta.downloadPath, name), responsePatch, requestMeta, requestData.settings.maxHistoryResponses);
  } else {
    const defaultPath = window.localStorage.getItem('insomnia.sendAndDownloadLocation');
    const { filePath } = await window.dialog.showSaveDialog({
      title: 'Select Download Location',
      buttonLabel: 'Save',
      // NOTE: An error will be thrown if defaultPath is supplied but not a String
      ...(defaultPath ? { defaultPath } : {}),
    });
    if (!filePath) {
      return null;
    }
    window.localStorage.setItem('insomnia.sendAndDownloadLocation', filePath);
    return writeToDownloadPath(filePath, responsePatch, requestMeta, requestData.settings.maxHistoryResponses);
  }
};

export const createAndSendToMockbinAction: ActionFunction = async ({ request }) => {
  const patch = await request.json() as Partial<Request>;
  invariant(typeof patch.url === 'string', 'URL is required');
  invariant(typeof patch.method === 'string', 'method is required');
  invariant(typeof patch.parentId === 'string', 'mock route ID is required');
  const mockRoute = await models.mockRoute.getById(patch.parentId);
  invariant(mockRoute, 'mock route not found');
  // Get or create a testing request for this mock route
  const childRequests = await models.request.findByParentId(mockRoute._id);
  const testRequest = childRequests[0] || (await models.request.create({ parentId: mockRoute._id, isPrivate: true }));
  invariant(testRequest, 'mock route is missing a testing request');
  const req = await models.request.update(testRequest, patch);

  const {
    environment,
    settings,
    clientCertificates,
    caCert,
    activeEnvironmentId,
    timelinePath,
    responseId,
  } = await fetchRequestData(req._id);
  window.main.startExecution({ requestId: req._id });
  window.main.addExecutionStep({
    requestId: req._id,
    stepName: 'Rendering request',
  }
  );

  const renderResult = await tryToInterpolateRequest({ request: req, environment: environment._id, purpose: 'send' });
  const renderedRequest = await tryToTransformRequestWithPlugins(renderResult);

  window.main.completeExecutionStep({ requestId: req._id });
  window.main.addExecutionStep({
    requestId: req._id,
    stepName: 'Sending request',
  });

  const res = await sendCurlAndWriteTimeline(
    renderedRequest,
    clientCertificates,
    caCert,
    settings,
    timelinePath,
    responseId,
  );

  const response = await responseTransform(res, activeEnvironmentId, renderedRequest, renderResult.context);
  await models.response.create(response);
  window.main.completeExecutionStep({ requestId: req._id });
  return null;
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
