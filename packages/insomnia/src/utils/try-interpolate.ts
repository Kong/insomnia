import { getRenderContext, render } from '../common/render';
import type { GrpcRequest } from '../models/grpc-request';
import type { Request } from '../models/request';
import type { WebSocketRequest } from '../models/websocket-request';
import { showModal } from '../ui/components/modals';
import { RequestRenderErrorModal } from '../ui/components/modals/request-render-error-modal';

// NOTE: template interpolation is tightly coupled with modal implementation
export const tryToInterpolateRequestOrShowRenderErrorModal = async ({ request, environmentId, payload }: { request: Request | WebSocketRequest | GrpcRequest; environmentId: string; payload: any }): Promise<any> => {
  try {
    const renderContext = await getRenderContext({ request, environment: environmentId, purpose: 'send' });
    return await render(payload, renderContext);
  } catch (error) {
    if (error.type === 'render') {
      showModal(RequestRenderErrorModal, { request, error });
      return;
    }
    throw error;
  }
};
