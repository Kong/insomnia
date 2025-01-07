import { type ExtraRenderInfo } from '../../common/render';
import * as models from '../../models';
import type { Request } from '../../models/request';
import { fetchRequestData, responseTransform, sendCurlAndWriteTimeline, tryToInterpolateRequest, tryToTransformRequestWithPlugins } from '../../network/network';

export function init() {
  return {
    network: {
      async sendRequest(req: Request, extraInfo?: ExtraRenderInfo) {
        const { request,
          environment,
          settings,
          clientCertificates,
          caCert,
          activeEnvironmentId,
          timelinePath,
          responseId,
        } = await fetchRequestData(req._id);

        const renderResult = await tryToInterpolateRequest({ request, environment: environment._id, purpose: 'send', extraInfo });
        const renderedRequest = await tryToTransformRequestWithPlugins(renderResult);
        const response = await sendCurlAndWriteTimeline(
          renderedRequest,
          clientCertificates,
          caCert,
          settings,
          timelinePath,
          responseId
        );
        const responsePatch = await responseTransform(response, activeEnvironmentId, renderedRequest, renderResult.context);
        return models.response.create(responsePatch, settings.maxHistoryResponses);
      },
    },
  };
}
