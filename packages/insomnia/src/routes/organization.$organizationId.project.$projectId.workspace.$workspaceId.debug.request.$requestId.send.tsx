import contentDisposition from 'content-disposition';
import { extension as mimeExtension } from 'mime-types';
import { href, redirect } from 'react-router';
import { v4 as uuidv4 } from 'uuid';

import { CONTENT_TYPE_GRAPHQL } from '~/common/constants';
import { getContentDispositionHeader } from '~/common/misc';
import type {
  Environment,
  Request,
  RequestGroup,
  RequestMeta,
  RequestTestResult,
  ResponseInfo,
  RunnerResultPerRequestPerIteration,
  UserUploadEnvironment,
} from '~/insomnia-data';
import { database as db, models, services } from '~/insomnia-data';
import type { ResponsePatch } from '~/main/network/libcurl-promise';
import type { TimingStep } from '~/main/network/request-timing';
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
import { AnalyticsEvent, type ImportAttribution, importAttributionKey } from '~/ui/analytics';
import { parseGraphQLReqeustBody } from '~/utils/graph-ql';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.send';

export interface SendActionParams {
  requestId: string;
  workspaceId: string;
  projectId: string;
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

const writeToDownloadPath = async (
  downloadPathAndName: string,
  responsePatch: ResponsePatch,
  requestMeta: RequestMeta,
  maxHistoryResponses: number,
) => {
  invariant(downloadPathAndName, 'filename should be set by now');

  try {
    if (!responsePatch.bodyPath) {
      responsePatch.error = `Failed to save to ${downloadPathAndName}: unable to read response body`;
    } else {
      await window.main.writeResponseBodyToFile({
        sourcePath: responsePatch.bodyPath,
        destinationPath: downloadPathAndName,
        bodyCompression: responsePatch.bodyCompression,
      });
      responsePatch.error = `Saved to ${downloadPathAndName}`;
    }
  } catch (err) {
    responsePatch.error = `Failed to save to ${downloadPathAndName}`;
    console.warn('Failed to download request after sending', responsePatch.bodyPath, err);
  }

  const response = await services.response.create(responsePatch, maxHistoryResponses);
  await services.requestMeta.update(requestMeta, { activeResponseId: response._id });
  return null;
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
  const requestMeta = await services.requestMeta.getOrCreateByParentId(requestId);
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
    const createdResponse = await services.response.create(
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
    await services.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: createdResponse._id });
    window.main.completeExecutionStep({ requestId });
    return { nextRequestIdOrName: mutatedContext.execution?.nextRequestIdOrName };
  }

  if (mutatedContext.execution?.skipRequest) {
    // cancel request running if skipRequest in pre-request script

    // create and update response to activeResponse
    const createdResponse = await services.response.create(
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
    await services.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: createdResponse._id });
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
    const createdResponse = await services.response.create(
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
    await services.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: createdResponse._id });
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
    const createdResponse = await services.response.create(
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
    await services.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: createdResponse._id });
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
    const response = await services.response.create(responsePatch, requestData.settings.maxHistoryResponses);
    await services.requestMeta.update(requestMeta, { activeResponseId: response._id });
    return { nextRequestIdOrName: postMutatedContext.execution?.nextRequestIdOrName };
  }

  if (requestMeta.downloadPath) {
    const header = getContentDispositionHeader(responsePatch.headers || []);
    const name = header
      ? contentDisposition.parse(header.value).parameters.filename
      : `${requestData.request.name.replace(/\s/g, '-').toLowerCase()}.${(responsePatch.contentType && mimeExtension(responsePatch.contentType)) || 'unknown'}`;
    await writeToDownloadPath(
      window.path.join(requestMeta.downloadPath, name),
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
  await writeToDownloadPath(filePath, responsePatch, requestMeta, requestData.settings.maxHistoryResponses);
  return { nextRequestIdOrName: postMutatedContext.execution?.nextRequestIdOrName };
};

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { requestId } = params;
  const { shouldPromptForPathAfterResponse, ignoreUndefinedEnvVariable, workspaceId, projectId } =
    (await request.json()) as SendActionParams;

  try {
    await sendActionImplementation({
      requestId,
      shouldPromptForPathAfterResponse,
      ignoreUndefinedEnvVariable,
    });

    const requestMeta = await services.requestMeta.getByParentId(requestId);

    if (requestMeta?.activeResponseId) {
      const response = await services.response.getById(requestMeta.activeResponseId);
      if (response) {
        const settings = await services.settings.getOrCreate();
        const activeRequest = await services.request.getById(requestId);

        if (activeRequest) {
          const [requestAndAncestors, clientCertificates] = await Promise.all([
            db.withAncestors<Request | RequestGroup>(activeRequest as Request, [
              models.request.type,
              models.requestGroup.type,
            ]),
            services.clientCertificate.findByParentId(workspaceId),
          ]);
          const docsWithScripts = requestAndAncestors.filter(
            (doc): doc is Request | RequestGroup =>
              models.request.isRequest(doc) || models.requestGroup.isRequestGroup(doc),
          );
          const allPreScripts = docsWithScripts.map(doc => doc.preRequestScript).filter((s): s is string => !!s);
          const allPostScripts = docsWithScripts.map(doc => doc.afterResponseScript).filter((s): s is string => !!s);

          const requestType =
            activeRequest.body?.mimeType === CONTENT_TYPE_GRAPHQL
              ? 'GraphQL'
              : models.request.isEventStreamRequest(activeRequest)
                ? 'Event Stream'
                : 'HTTP';
          window.main.trackAnalyticsEvent({
            event: AnalyticsEvent.requestExecuted,
            properties: {
              project_id: projectId,
              collection_id: workspaceId,
              request_key_id: requestId,
              preferredHttpVersion: settings.preferredHttpVersion,
              // @ts-expect-error -- who cares
              authenticationType: activeRequest.authentication?.type,
              mimeType: activeRequest.body.mimeType,
              protocol: activeRequest.type,
              response_header_names: activeRequest.headers.map(h => h.name),
              count_headers: response.headers.length,
              count_cookies: response.headers.find(h => h.name === 'set-cookie')?.value.split(',').length || 0,
              count_tests: response.requestTestResults?.length || 0,
              has_prescript: allPreScripts.length > 0,
              has_postscript: allPostScripts.length > 0,
              count_prescript_lines: allPreScripts.reduce((sum, s) => sum + s.split('\n').length, 0),
              count_postscript_lines: allPostScripts.reduce((sum, s) => sum + s.split('\n').length, 0),
              count_query_parameters: activeRequest.parameters?.length ?? 0,
              count_path_parameters: activeRequest.pathParameters?.length ?? 0,
              has_docs: !!activeRequest.description,
              count_certificates: clientCertificates.length,
              request_type: requestType,
              source: 'request-pane',
            },
          });

          const attributionStorageKey = importAttributionKey(requestId);
          const jsonImportAttribution = window.localStorage.getItem(attributionStorageKey);
          if (jsonImportAttribution) {
            try {
              const importAttribution = JSON.parse(jsonImportAttribution) as ImportAttribution;
              window.main.trackAnalyticsEvent({
                event: AnalyticsEvent.importedRequestFirstSend,
                properties: {
                  ...importAttribution,
                  protocol: activeRequest.type,
                },
              });
            } finally {
              window.localStorage.removeItem(attributionStorageKey);
            }
          }
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
