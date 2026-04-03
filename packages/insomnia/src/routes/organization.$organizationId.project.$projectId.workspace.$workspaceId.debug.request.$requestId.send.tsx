import { createWriteStream } from 'node:fs';
import path from 'node:path';

import contentDisposition from 'content-disposition';
import { extension as mimeExtension } from 'mime-types';
import { href, redirect } from 'react-router';
import { v4 as uuidv4 } from 'uuid';

import { getContentDispositionHeader } from '~/common/misc';
import { type ResponseInfo, type RunnerResultPerRequestPerIteration, services } from '~/insomnia-data';
import type { ResponsePatch } from '~/main/network/libcurl-promise';
import type { TimingStep } from '~/main/network/request-timing';
import * as models from '~/models';
import type { Environment, UserUploadEnvironment } from '~/models/environment';
import { getBodyStream } from '~/models/helpers/response-operations';
import type { RequestMeta } from '~/models/request-meta';
import {
  defaultSendActionRuntime,
  fetchRequestData,
  responseTransform,
  type SendActionRuntime,
  sendCurlAndWriteTimeline,
  tryToExecuteAfterResponseScript,
  tryToExecutePreRequestScript,
  tryToInterpolateRequest,
  tryToTransformRequestWithPlugins,
} from '~/network/network';
import { SegmentEvent } from '~/ui/analytics';
import { parseGraphQLReqeustBody } from '~/utils/graph-ql';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { RequestTestResult } from '../../../insomnia-scripting-environment/src/objects';
import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.send';

export interface SendActionParams {
  requestId: string;
  shouldPromptForPathAfterResponse?: boolean;
  ignoreUndefinedEnvVariable?: boolean;
}

export interface CollectionRunnerContext {
  source: 'runner';
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

const writeToDownloadPath = (
  downloadPathAndName: string,
  responsePatch: ResponsePatch,
  requestMeta: RequestMeta,
  maxHistoryResponses: number,
) => {
  invariant(downloadPathAndName, 'filename should be set by now');

  const to = createWriteStream(downloadPathAndName);
  const readStream = getBodyStream(responsePatch);
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

// Can fail with errors from:
// 1. pre-request script
// 2. request sending
// 3. after-response script
// In each case we create a new response with the error message and set it to active response
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
}): Promise<{ nextRequestIdOrName: string | undefined } | undefined> => {
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
  const requestMeta = await models.requestMeta.getOrCreateByParentId(requestId);
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
  const mutatedContext = await tryToExecutePreRequestScript(
    requestData,
    transientVariables,
    userUploadEnvironment,
    iteration,
    iterationCount,
    runtime,
  );

  if ('error' in mutatedContext) {
    const createdResponse = await models.response.create(
      {
        _id: requestData.responseId,
        parentId: requestId,
        environmentId: requestData.environment._id,
        statusMessage: 'Error',
        error: mutatedContext.error,
        timelinePath: requestData.timelinePath,
      },
      requestData.settings.maxHistoryResponses,
    );
    await models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: createdResponse._id });
    window.main.completeExecutionStep({ requestId });
    return { nextRequestIdOrName: mutatedContext.execution?.nextRequestIdOrName };
  }

  if (mutatedContext.execution?.skipRequest) {
    // cancel request running if skipRequest in pre-request script

    // create and update response to activeResponse
    const createdResponse = await models.response.create(
      {
        _id: requestData.responseId,
        parentId: requestId,
        environmentId: requestData.environment._id,
        statusMessage: 'Cancelled',
        error: 'Request was cancelled by pre-request script',
        timelinePath: requestData.timelinePath,
      },
      requestData.settings.maxHistoryResponses,
    );
    await models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: createdResponse._id });
    window.main.completeExecutionStep({ requestId });
    return { nextRequestIdOrName: mutatedContext.execution?.nextRequestIdOrName };
  }

  window.main.completeExecutionStep({ requestId });

  // disable after-response script here to avoiding rendering it
  // @TODO This should be handled in a better way. Maybe remove the key from the request object we pass in tryToInterpolateRequest
  const afterResponseScript = mutatedContext.request.afterResponseScript
    ? `${mutatedContext.request.afterResponseScript}`
    : undefined;
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
    const createdResponse = await models.response.create(
      {
        _id: requestData.responseId,
        parentId: requestId,
        environmentId: requestData.environment._id,
        statusMessage: 'Error',
        error: response.error,
        timelinePath: requestData.timelinePath,
      },
      requestData.settings.maxHistoryResponses,
    );
    await models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: createdResponse._id });
    window.main.completeExecutionStep({ requestId });
    return { nextRequestIdOrName: mutatedContext.execution?.nextRequestIdOrName };
  }

  const baseResponsePatch = await responseTransform(
    response,
    requestData.activeEnvironmentId,
    renderedRequest,
    renderedResult.context,
  );
  const is2XXWithBodyPath =
    baseResponsePatch.statusCode &&
    baseResponsePatch.statusCode >= 200 &&
    baseResponsePatch.statusCode < 300 &&
    baseResponsePatch.bodyPath;
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
    const createdResponse = await models.response.create(
      {
        _id: requestData.responseId,
        parentId: requestId,
        environmentId: requestData.environment._id,
        statusMessage: 'Error',
        error: postMutatedContext.error,
        timelinePath: requestData.timelinePath,
      },
      requestData.settings.maxHistoryResponses,
    );
    await models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: createdResponse._id });
    window.main.completeExecutionStep({ requestId });
    return { nextRequestIdOrName: postMutatedContext.execution?.nextRequestIdOrName };
  }

  window.main.completeExecutionStep({ requestId });

  const preTestResults = mutatedContext.requestTestResults || [];
  const postTestResults = postMutatedContext?.requestTestResults || [];
  if (testResultCollector) {
    testResultCollector.results = [...testResultCollector.results, ...preTestResults, ...postTestResults];
    const timingSteps = await window.main.getExecution({ requestId });
    testResultCollector.duration = timingSteps.reduce((acc: number, cur: TimingStep) => {
      return acc + (cur.duration || 0);
    }, 0);
    testResultCollector.responseId = response._id;
  }
  const responsePatch = postMutatedContext
    ? {
        ...baseResponsePatch,
        // both pre-request and after-response test results are collected
        requestTestResults: [...preTestResults, ...postTestResults],
      }
    : baseResponsePatch;

  if (!shouldWriteToFile) {
    const response = await models.response.create(responsePatch, requestData.settings.maxHistoryResponses);
    await models.requestMeta.update(requestMeta, { activeResponseId: response._id });
    return { nextRequestIdOrName: postMutatedContext.execution?.nextRequestIdOrName };
  }

  if (requestMeta.downloadPath) {
    const header = getContentDispositionHeader(responsePatch.headers || []);
    const name = header
      ? contentDisposition.parse(header.value).parameters.filename
      : `${requestData.request.name.replace(/\s/g, '-').toLowerCase()}.${(responsePatch.contentType && mimeExtension(responsePatch.contentType)) || 'unknown'}`;
    writeToDownloadPath(
      path.join(requestMeta.downloadPath, name),
      responsePatch,
      requestMeta,
      requestData.settings.maxHistoryResponses,
    );
    return { nextRequestIdOrName: postMutatedContext.execution?.nextRequestIdOrName };
  }
  const defaultPath = window.localStorage.getItem('insomnia.sendAndDownloadLocation');
  const { filePath } = await window.dialog.showSaveDialog({
    title: 'Select Download Location',
    buttonLabel: 'Save',
    // NOTE: An error will be thrown if defaultPath is supplied but not a String
    ...(defaultPath ? { defaultPath } : {}),
  });
  if (!filePath) {
    return { nextRequestIdOrName: postMutatedContext.execution?.nextRequestIdOrName };
  }
  window.localStorage.setItem('insomnia.sendAndDownloadLocation', filePath);
  writeToDownloadPath(filePath, responsePatch, requestMeta, requestData.settings.maxHistoryResponses);
  return { nextRequestIdOrName: postMutatedContext.execution?.nextRequestIdOrName };
};

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { requestId } = params;
  const { shouldPromptForPathAfterResponse, ignoreUndefinedEnvVariable } = (await request.json()) as SendActionParams;

  try {
    await sendActionImplementation({
      requestId,
      shouldPromptForPathAfterResponse,
      ignoreUndefinedEnvVariable,
    });

    const requestMeta = await models.requestMeta.getByParentId(requestId);

    if (requestMeta?.activeResponseId) {
      const response = await models.response.getById(requestMeta.activeResponseId);
      if (response) {
        const settings = await services.settings.getOrCreate();
        const activeRequest = await models.request.getById(requestId);

        if (activeRequest) {
          window.main.trackSegmentEvent({
            event: SegmentEvent.requestExecuted,
            properties: {
              preferredHttpVersion: settings.preferredHttpVersion,
              // @ts-expect-error -- who cares
              authenticationType: activeRequest.authentication?.type,
              mimeType: activeRequest.body.mimeType,
              protocol: activeRequest.type,
              response_header_names: activeRequest.headers.map(h => h.name),
              count_headers: response.headers.length,
              count_cookies: response.headers.find(h => h.name === 'set-cookie')?.value.split(',').length || 0,
              count_tests: response.requestTestResults?.length || 0,
            },
          });
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[request] Failed to send request', error);
    // TODO: consider if interpolation errors should be handled in the send request catch block
    // idea: move missing env variable detection to tryToInterpolateRequest
    const url = new URL(request.url);

    // if the error is not from response, we need to set it to url param and show it in modal
    const e = error.error || error;
    url.searchParams.set('error', e);
    if (e?.extraInfo && e?.extraInfo?.subType === 'environmentVariable') {
      url.searchParams.set('envVariableMissing', '1');
      url.searchParams.set('undefinedEnvironmentVariables', e?.extraInfo?.undefinedEnvironmentVariables);
    }

    window.main.completeExecutionStep({ requestId });
    return redirect(`${url.pathname}?${url.searchParams}`);
  }
}

export const useDebugRequestSendActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      requestId,
      params,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      requestId: string;
      params: { shouldPromptForPathAfterResponse?: boolean; ignoreUndefinedEnvVariable?: boolean };
    }) => {
      return submit(JSON.stringify(params), {
        method: 'POST',
        action: href(
          `/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId/send`,
          {
            organizationId,
            projectId,
            workspaceId,
            requestId,
          },
        ),
        encType: 'application/json',
      });
    },
  clientAction,
);
