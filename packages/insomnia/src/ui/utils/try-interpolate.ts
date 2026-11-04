import type { GrpcRequest, McpRequest, Request, SocketIORequest, WebSocketRequest } from 'insomnia-data';
import { services } from 'insomnia-data';

import { createSensitiveValueCollector } from '~/common/network/sensitive-value-collector';
import { getRenderContext, render } from '~/common/render';
import { RenderError } from '~/common/templating/render-error';
import { showModal } from '~/ui/components/modals';
import { RequestRenderErrorModal } from '~/ui/components/modals/request-render-error-modal';

// NOTE: template interpolation is tightly coupled with modal implementation
export const tryToInterpolateRequestOrShowRenderErrorModal = async ({
  request,
  environmentId,
  payload,
}: {
  request: Request | WebSocketRequest | GrpcRequest | SocketIORequest | McpRequest;
  environmentId: string;
  payload: any;
}): Promise<any> => {
  try {
    const renderContext = await getRenderContext({ request, environment: environmentId, purpose: 'send' });
    return await render(payload, renderContext);
  } catch (error) {
    if (error instanceof RenderError) {
      showModal(RequestRenderErrorModal, { request, error });
      return;
    }
    throw error;
  }
};

// Same rendering as tryToInterpolateRequestOrShowRenderErrorModal, but also returns every
// confidential value registered during the render (normal confidential env vars, decrypted SECRET
// vault values, external vault tag results — see sensitive-value-collector.ts). WebSocket,
// SocketIO and MCP timeline/event-log writes happen in the main process, so this snapshot is what
// gets sent over IPC alongside the rendered payload for main to redact with before writing to disk.
// Returns undefined (after showing the render-error modal) on RenderError, same as the function above.
export const tryToInterpolateRequestAndCollectSensitiveValues = async ({
  request,
  environmentId,
  payload,
}: {
  request: Request | WebSocketRequest | GrpcRequest | SocketIORequest | McpRequest;
  environmentId: string;
  payload: any;
}): Promise<{ rendered: any; sensitiveValues: string[] } | undefined> => {
  try {
    const settings = await services.settings.get();
    const collector = createSensitiveValueCollector(settings.hideSecretValuesInPreviewAndConsole ?? true);
    const renderContext = await getRenderContext({
      request,
      environment: environmentId,
      purpose: 'send',
      sensitiveValueCollector: collector,
    });
    const rendered = await render(payload, renderContext);
    return { rendered, sensitiveValues: collector ? [...collector.values] : [] };
  } catch (error) {
    if (error instanceof RenderError) {
      showModal(RequestRenderErrorModal, { request, error });
      return undefined;
    }
    throw error;
  }
};
