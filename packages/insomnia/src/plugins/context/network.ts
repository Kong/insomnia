import { ExtraRenderInfo, RENDER_PURPOSE_SEND } from '../../common/render';
import * as models from '../../models';
import type { Request } from '../../models/request';
import { RequestDataSet } from '../../models/request-dataset';
import { fetchRequestData, responseTransform, sendCurlAndWriteTimeline, tryToInterpolateRequest, tryToTransformRequestWithPlugins } from '../../network/network';

export function init() {
  return {
    network: {
      async sendRequest(req: Request, extraInfo?: ExtraRenderInfo, datasetId?: string) {
        const { request,
          environment,
          settings,
          clientCertificates,
          caCert,
          activeEnvironmentId } = await fetchRequestData(req._id);

          const dataset: RequestDataSet | null = await models.requestDataset.getById(datasetId || 'n/a');
          let backupDataset: RequestDataSet | null = null;
          if (dataset) {
            backupDataset = (await models.initModel(models.requestDataset.type, dataset)) as RequestDataSet;
          }

        const renderResult = await tryToInterpolateRequest(request, environment._id, RENDER_PURPOSE_SEND, extraInfo, dataset);
        const renderedRequest = await tryToTransformRequestWithPlugins(renderResult);
        const response = await sendCurlAndWriteTimeline(
          renderedRequest,
          clientCertificates,
          caCert,
          settings,
        );
        const responsePatch = await responseTransform(response, activeEnvironmentId, renderedRequest, renderResult.context);
        responsePatch.dataset = backupDataset;
        return models.response.create(responsePatch, settings.maxHistoryResponses);
      },
    },
  };
}
