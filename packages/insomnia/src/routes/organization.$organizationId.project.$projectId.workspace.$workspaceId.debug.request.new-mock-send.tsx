import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import type { Request } from '~/models/request';
import {
  fetchRequestData,
  responseTransform,
  sendCurlAndWriteTimeline,
  tryToInterpolateRequest,
  tryToTransformRequestWithPlugins,
} from '~/network/network';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new-mock-send';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const patch = (await request.json()) as Partial<Request>;
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

  const { environment, settings, clientCertificates, caCert, activeEnvironmentId, timelinePath, responseId } =
    await fetchRequestData(req._id);
  window.main.startExecution({ requestId: req._id });
  window.main.addExecutionStep({
    requestId: req._id,
    stepName: 'Rendering request',
  });

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
}

export function useRequestNewMockSendActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({
      organizationId,
      projectId,
      workspaceId,
      patch,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      patch: Partial<Request>;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/new-mock-send',
        {
          organizationId,
          projectId,
          workspaceId,
        },
      );

      return fetcherSubmit(JSON.stringify(patch), {
        action: url,
        method: 'POST',
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
