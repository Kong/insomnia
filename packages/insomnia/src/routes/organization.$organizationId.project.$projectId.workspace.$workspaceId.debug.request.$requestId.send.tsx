import { createWriteStream } from 'node:fs';
import path from 'node:path';

import contentDisposition from 'content-disposition';
import { extension as mimeExtension } from 'mime-types';
import { useCallback } from 'react';
import { href, redirect, useFetcher } from 'react-router';
import { v4 as uuidv4 } from 'uuid';

import { getContentDispositionHeader } from '~/common/misc';
import { isFsAccessingAllowed } from '~/common/validators';
import type { ResponsePatch } from '~/main/network/libcurl-promise';
import type { TimingStep } from '~/main/network/request-timing';
import * as models from '~/models';
import type { Environment, UserUploadEnvironment } from '~/models/environment';
import type { RequestMeta } from '~/models/request-meta';
import type { ResponseInfo, RunnerResultPerRequestPerIteration } from '~/models/runner-test-result';
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
import { parseGraphQLReqeustBody } from '~/utils/graph-ql';
import { invariant } from '~/utils/invariant';

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
  const mutatedContext = await tryToExecutePreRequestScript(
    requestData,
    transientVariables,
    userUploadEnvironment,
    iteration,
    iterationCount,
    runtime,
  );
  if ('error' in mutatedContext) {
    window.main.completeExecutionStep({ requestId });
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

  invariant(requestMeta, 'RequestMeta not found');

  isFsAccessingAllowed(renderedRequest, requestData.settings);

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
      response: await responseTransform(
        response,
        requestData.activeEnvironmentId,
        renderedRequest,
        renderedResult.context,
      ),
      maxHistoryResponses: requestData.settings.maxHistoryResponses,
      requestMeta,
      error: response.error,
    };
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
    throw {
      response: await responseTransform(
        response,
        requestData.activeEnvironmentId,
        renderedRequest,
        renderedResult.context,
      ),
      maxHistoryResponses: requestData.settings.maxHistoryResponses,
      requestMeta,
      error: postMutatedContext.error,
    };
  }

  window.main.completeExecutionStep({ requestId });

  const preTestResults = (mutatedContext.requestTestResults || []).map(
    (result: RequestTestResult): RequestTestResult => ({ ...result, category: 'pre-request' }),
  );
  const postTestResults =
    (postMutatedContext?.requestTestResults || []).map(
      (result: RequestTestResult): RequestTestResult => ({ ...result, category: 'after-response' }),
    ) || [];
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
    return postMutatedContext;
  }

  if (requestMeta.downloadPath) {
    const header = getContentDispositionHeader(responsePatch.headers || []);
    const name = header
      ? contentDisposition.parse(header.value).parameters.filename
      : `${requestData.request.name.replace(/\s/g, '-').toLowerCase()}.${(responsePatch.contentType && mimeExtension(responsePatch.contentType)) || 'unknown'}`;
    return writeToDownloadPath(
      path.join(requestMeta.downloadPath, name),
      responsePatch,
      requestMeta,
      requestData.settings.maxHistoryResponses,
    );
  }
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
};

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { requestId } = params;
  const { shouldPromptForPathAfterResponse, ignoreUndefinedEnvVariable } = (await request.json()) as SendActionParams;

  try {
    return await sendActionImplementation({
      requestId,
      shouldPromptForPathAfterResponse,
      ignoreUndefinedEnvVariable,
    });
  } catch (error) {
    const err = error as unknown as {
      error: any;
      response?: ResponsePatch & { _id: string };
      requestMeta?: RequestMeta;
      maxHistoryResponses?: number;
    };

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
      const response = existingResponse || (await models.response.create(err.response, err.maxHistoryResponses));
      await models.requestMeta.update(err.requestMeta, { activeResponseId: response._id });
    } else {
      // if the error is not from response, we need to set it to url param and show it in modal
      url.searchParams.set('error', e);
      if (e?.extraInfo && e?.extraInfo?.subType === 'environmentVariable') {
        url.searchParams.set('envVariableMissing', '1');
        url.searchParams.set('undefinedEnvironmentVariables', e?.extraInfo?.undefinedEnvironmentVariables);
      }
    }

    window.main.completeExecutionStep({ requestId });
    return redirect(`${url.pathname}?${url.searchParams}`);
  }
}

export function useDebugRequestSendActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
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
      return fetcherSubmit(JSON.stringify(params), {
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
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
