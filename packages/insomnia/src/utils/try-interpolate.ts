import type { GrpcRequest, McpRequest } from '~/insomnia-data';

import { getRenderContext, render } from '../common/render';
import type { Request } from '../models/request';
import type { SocketIORequest } from '../models/socket-io-request';
import type { WebSocketRequest } from '../models/websocket-request';
import { RenderError } from '../templating/render-error';
import { showModal } from '../ui/components/modals';
import { RequestRenderErrorModal } from '../ui/components/modals/request-render-error-modal';

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
