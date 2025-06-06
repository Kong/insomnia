import * as models from '../../models';
import {
  fetchRequestData,
  responseTransform,
  sendCurlAndWriteTimeline,
  tryToInterpolateRequest,
  tryToTransformRequestWithPlugins,
} from '../../network/network';
import type { PluginTemplateTagContext } from '../../templating/types';

export function init(): {
  network: PluginTemplateTagContext['network'];
} {
  return {
    network: {
      async sendRequest(req, extraInfo) {
        const {
          request,
          environment,
          settings,
          clientCertificates,
          caCert,
          activeEnvironmentId,
          timelinePath,
          responseId,
        } = await fetchRequestData(req._id, extraInfo?.environmentId);

        const renderResult = await tryToInterpolateRequest({
          request,
          environment: environment._id,
          purpose: 'send',
          extraInfo,
        });
        const renderedRequest = await tryToTransformRequestWithPlugins(renderResult);
        const response = await sendCurlAndWriteTimeline(
          renderedRequest,
          clientCertificates,
          caCert,
          settings,
          timelinePath,
          responseId,
        );
        const responsePatch = await responseTransform(
          response,
          activeEnvironmentId,
          renderedRequest,
          renderResult.context,
        );
        return models.response.create(responsePatch, settings.maxHistoryResponses);
      },
    },
  };
}
