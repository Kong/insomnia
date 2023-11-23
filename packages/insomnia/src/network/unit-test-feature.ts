import { RENDER_PURPOSE_SEND } from '../common/render';
import { stats } from '../models';
import { getBodyBuffer } from '../models/response';
import { fetchRequestData, responseTransform, sendCurlAndWriteTimeline, tryToInterpolateRequest, tryToTransformRequestWithPlugins } from './network';

export function getSendRequestCallback() {
  return async function sendRequest(requestId: string) {
    stats.incrementExecutedRequests();
    // NOTE: unit tests will use the UI selected environment
    const { request,
      environment,
      settings,
      clientCertificates,
      caCert,
      activeEnvironmentId } = await fetchRequestData(requestId);

    const renderResult = await tryToInterpolateRequest(request, environment._id, RENDER_PURPOSE_SEND);
    const renderedRequest = await tryToTransformRequestWithPlugins(renderResult);

    // TODO: remove this temporary hack to support GraphQL variables in the request body properly
    if (renderedRequest && renderedRequest.body?.text && renderedRequest.body?.mimeType === 'application/graphql') {
      try {
        const parsedBody = JSON.parse(renderedRequest.body.text);
        if (typeof parsedBody.variables === 'string') {
          parsedBody.variables = JSON.parse(parsedBody.variables);
          renderedRequest.body.text = JSON.stringify(parsedBody, null, 2);
        }
      } catch (e) {
        console.error('Failed to parse GraphQL variables', e);
      }
    }

    const response = await sendCurlAndWriteTimeline(
      renderedRequest,
      clientCertificates,
      caCert,
      settings,
    );
    const res = await responseTransform(response, activeEnvironmentId, renderedRequest, renderResult.context);
    const { statusCode: status, statusMessage, headers: headerArray, elapsedTime: responseTime } = res;
    const headers = headerArray?.reduce((acc, { name, value }) => ({ ...acc, [name.toLowerCase() || '']: value || '' }), []);
    const bodyBuffer = await getBodyBuffer(res) as Buffer;
    const data = bodyBuffer ? bodyBuffer.toString('utf8') : undefined;
    return { status, statusMessage, data, headers, responseTime };

  };
}
