import { useMutation } from '@tanstack/react-query';
import type { AllTypes, Environment, Project, Request, RequestGroup, ResponseHeader, Workspace } from 'insomnia-data';
import { database as db, models, services } from 'insomnia-data';
import { v4 as uuidv4 } from 'uuid';

import { generateId } from '~/common/misc';
import {
  createSensitiveValueCollector,
  redactResponsePatch,
  redactText,
  withRedaction,
} from '~/common/network/sensitive-value-collector';
import { collectConfidentialRawValues } from '~/common/render';
import type { RenderContextAncestor } from '~/common/templating/types';
import { parseGraphQLReqeustBody } from '~/common/utils/graph-ql';
import { invariant } from '~/common/utils/invariant';
import {
  defaultSendActionRuntime,
  responseTransform,
  type SendActionRuntime,
  sendCurlAndWriteTimeline,
  tryToExecutePreRequestScript,
  tryToInterpolateRequest,
  tryToTransformRequestWithPlugins,
} from '~/network/network';
import { getRuntime } from '~/runtimes';
import { showError } from '~/ui/components/modals';

// Result of sending the example's request snapshot through the network pipeline.
// It is never persisted as a Response document.
export interface ExampleTryItResult {
  url?: string;
  error?: string;
  statusCode?: number;
  statusMessage?: string;
  contentType?: string;
  headers?: ResponseHeader[];
  bodyBuffer?: Uint8Array;
  bytesRead?: number;
  bytesContent?: number;
  elapsedTime?: number;
  timeline?: string[];
}

const ANCESTOR_TYPES: AllTypes[] = [
  models.request.type,
  models.requestGroup.type,
  models.workspace.type,
  models.project.type,
  models.mockRoute.type,
  models.mockServer.type,
];

/**
 * Send an example's request snapshot through the normal send pipeline without
 * persisting a response. This is an execution, not a cache write, which is why
 * it lives outside `use-example-mutations`; it still uses `useMutation` so the
 * UI has one async-write convention (pending state, error toasts) for this
 * screen.
 */
export async function runExampleTryIt({
  requestId,
  exampleId,
}: {
  requestId: string;
  exampleId: string;
}): Promise<ExampleTryItResult> {
  const example = await services.example.getById(exampleId);
  if (!example) {
    return { error: 'Example not found' };
  }
  if (example.parentId !== requestId) {
    return { error: 'Example does not belong to this request' };
  }
  const parentRequest = await services.request.getById(requestId);
  if (!parentRequest) {
    return { error: 'Request not found' };
  }
  if (!models.example.canHostExamples(parentRequest)) {
    return { error: 'Try it is only supported for plain HTTP requests' };
  }

  // In-memory Request: parent request doc overlaid with the example snapshot.
  // It is never written to the database, so responses created from it would not
  // be attached to anything — the result is returned to the view instead.
  // The `_id` is borrowed from the example (not the parent request) so
  // execution steps, cancellation and per-request UI state key off the example
  // being tried; since no Response document is ever persisted from this send,
  // the non-canonical id cannot leak into the database.
  const request: Request = {
    ...parentRequest,
    method: example.request.method,
    url: example.request.url,
    parameters: example.request.parameters,
    pathParameters: example.request.pathParameters ?? parentRequest.pathParameters,
    headers: example.request.headers,
    body: example.request.body,
    authentication: example.request.authentication as Request['authentication'],
    _id: example._id,
    name: example.name,
  };
  // The in-memory request is never persisted, so dropping the after-response
  // script before sending cannot lose user data (same rationale as send.tsx,
  // which temporarily clears it around the send).
  request.afterResponseScript = '';

  const ancestors = await db.withAncestors<Request | RequestGroup | Workspace | Project>(parentRequest, ANCESTOR_TYPES);
  const workspaceDoc = ancestors.find(models.workspace.isWorkspace);
  invariant(workspaceDoc?._id, 'failed to find workspace');
  const workspaceId = workspaceDoc._id;

  const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspaceId);
  const activeEnvironmentId = workspaceMeta.activeEnvironmentId;
  const activeEnvironment = activeEnvironmentId && (await services.environment.getById(activeEnvironmentId));
  const baseEnvironment = await services.environment.getOrCreateForParentId(workspaceId);
  const environment = activeEnvironment || baseEnvironment;
  invariant(environment, 'failed to find environment ' + activeEnvironmentId);

  const cookieJar = await services.cookieJar.getOrCreateForParentId(workspaceId);

  let activeGlobalEnvironment: Environment | undefined;
  let activeGlobalBaseEnvironment: Environment | undefined;
  if (workspaceMeta?.activeGlobalEnvironmentId) {
    activeGlobalEnvironment =
      (await services.environment.getById(workspaceMeta.activeGlobalEnvironmentId)) || undefined;
    const activeGlobalEnvironmentParentId = activeGlobalEnvironment?.parentId || '';
    if (activeGlobalEnvironmentParentId.startsWith('wrk_')) {
      activeGlobalBaseEnvironment = activeGlobalEnvironment;
    } else if (activeGlobalEnvironmentParentId.startsWith('env_')) {
      activeGlobalBaseEnvironment =
        (await services.environment.getById(activeGlobalEnvironmentParentId)) || undefined;
    }
  }

  const settings = await services.settings.get();
  invariant(settings, 'failed to create settings');
  const clientCertificates = await services.clientCertificate.findByParentId(workspaceId);
  const caCert = await services.caCertificate.getByParentId(workspaceId);

  const responseId = generateId('res');
  // Try it writes no Response document, but the send pipeline still appends to
  // a timeline file and console logs would otherwise carry rendered secrets.
  // Mirror send.tsx: pre-fill from confidential env values, then redact every
  // timeline write through the shared runtime and redact the returned patch.
  const collector = createSensitiveValueCollector(settings.hideSecretValuesInPreviewAndConsole ?? true);
  if (collector) {
    collectConfidentialRawValues(
      {
        ancestors: ancestors as RenderContextAncestor[],
        rootEnvironment: baseEnvironment,
        subEnvironment: environment,
        rootGlobalEnvironment: activeGlobalBaseEnvironment,
        subGlobalEnvironment: activeGlobalEnvironment,
      },
      collector,
    );
  }
  const runtime: SendActionRuntime = withRedaction(defaultSendActionRuntime, collector);
  const timelinePath = await getRuntime().network.getTimelinePath(responseId);

  const executionId = example._id;
  window.main.startExecution({ requestId: executionId });

  try {
    const requestData = {
      request,
      environment,
      baseEnvironment,
      activeGlobalEnvironment,
      activeGlobalBaseEnvironment,
      activeEnvironmentId: environment._id,
      settings,
      clientCertificates,
      caCert,
      cookieJar,
      workspace: workspaceDoc,
      timelinePath,
      responseId,
      ancestors,
    };

    const transientVariables: Environment = {
      ...models.environment.init(),
      _id: uuidv4(),
      type: models.environment.type,
      parentId: environment.parentId,
      modified: 0,
      created: Date.now(),
      name: 'Transient Environment',
      data: {},
    };

    window.main.addExecutionStep({ requestId: executionId, stepName: 'Executing pre-request script' });
    const mutatedContext = await tryToExecutePreRequestScript(
      requestData,
      transientVariables,
      undefined,
      undefined,
      undefined,
      runtime,
      collector,
    );
    window.main.completeExecutionStep({ requestId: executionId });

    if ('error' in mutatedContext) {
      return { error: redactText(mutatedContext.error, collector) };
    }

    window.main.addExecutionStep({ requestId: executionId, stepName: 'Rendering request' });
    const renderedResult = await tryToInterpolateRequest({
      request: mutatedContext.request,
      environment: mutatedContext.environment,
      purpose: 'send',
      baseEnvironment: mutatedContext.baseEnvironment,
      transientVariables: mutatedContext.transientVariables,
      sensitiveValueCollector: collector,
    });
    const renderedRequest = await tryToTransformRequestWithPlugins(renderedResult);
    window.main.completeExecutionStep({ requestId: executionId });

    // Same temporary GraphQL fix-up as send.tsx: when the body is GraphQL,
    // variables live in the JSON body object and need splitting into the
    // request's GraphQL body shape before sending.
    parseGraphQLReqeustBody(renderedRequest);

    window.main.addExecutionStep({ requestId: executionId, stepName: 'Sending request' });
    const response = await sendCurlAndWriteTimeline(
      renderedRequest,
      clientCertificates,
      caCert,
      settings,
      timelinePath,
      responseId,
      runtime,
    );
    window.main.completeExecutionStep({ requestId: executionId });

    const patch = redactResponsePatch(
      await responseTransform(response, environment._id, renderedRequest, renderedResult.context),
      collector,
    );

    const bodyBufferOrFailure =
      !patch.error && patch.bodyPath ? await services.helpers.getResponseBodyBuffer(patch) : undefined;
    const bodyBuffer =
      typeof bodyBufferOrFailure === 'string' || bodyBufferOrFailure === undefined
        ? undefined
        : new Uint8Array(bodyBufferOrFailure);

    return {
      url: patch.url,
      error: patch.error,
      statusCode: patch.statusCode,
      statusMessage: patch.statusMessage,
      contentType: patch.contentType,
      headers: patch.headers as ResponseHeader[] | undefined,
      bodyBuffer,
      bytesRead: patch.bytesRead,
      elapsedTime: patch.elapsedTime,
      timeline: 'timeline' in response ? response.timeline : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: redactText(message, collector) };
  } finally {
    window.main.completeExecutionStep({ requestId: executionId });
  }
}

export const useTryExample = () => {
  return useMutation({
    mutationFn: runExampleTryIt,
    onError: err => showError(err instanceof Error ? err : new Error(String(err))),
  });
};
