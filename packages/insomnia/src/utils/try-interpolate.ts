import { getRenderContext, render, RENDER_PURPOSE_SEND } from '../common/render';
import { GrpcRequest } from '../models/grpc-request';
import { Request } from '../models/request';
import { WebSocketRequest } from '../models/websocket-request';
import { showModal } from '../ui/components/modals';
import { RequestRenderErrorModal } from '../ui/components/modals/request-render-error-modal';

// NOTE: template interpolation is tightly coupled with modal implementation
export const tryToInterpolateRequestOrShowRenderErrorModal = async ({ request, environmentId, payload }: { request: Request | WebSocketRequest | GrpcRequest; environmentId: string; payload: any }): Promise<any> => {
  try {
    const renderContext = await getRenderContext({ request, environmentId, purpose: RENDER_PURPOSE_SEND });
    return await render(payload, renderContext);
  } catch (error) {
    if (error.type === 'render') {
      showModal(RequestRenderErrorModal, { request, error });
      return;
    }
    throw error;
  }
};
