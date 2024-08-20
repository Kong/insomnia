import { stats } from '../models';
import { getBodyBuffer } from '../models/response';
import { parseGraphQLReqeustBody } from '../utils/graph-ql';
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
      activeEnvironmentId,
      timelinePath,
      responseId,
    } = await fetchRequestData(requestId);
    const renderResult = await tryToInterpolateRequest({ request, environment: environment._id, purpose: 'send' });
    const renderedRequest = await tryToTransformRequestWithPlugins(renderResult);

    // TODO: remove this temporary hack to support GraphQL variables in the request body properly
    parseGraphQLReqeustBody(renderedRequest);

    const response = await sendCurlAndWriteTimeline(
      renderedRequest,
      clientCertificates,
      caCert,
      settings,
      timelinePath,
      responseId
    );
    const res = await responseTransform(response, activeEnvironmentId, renderedRequest, renderResult.context);
    const { statusCode: status, statusMessage, headers: headerArray, elapsedTime: responseTime } = res;
    const headers = headerArray?.reduce((acc, { name, value }) => ({ ...acc, [name.toLowerCase() || '']: value || '' }), []);
    const bodyBuffer = await getBodyBuffer(res) as Buffer;
    const data = bodyBuffer ? bodyBuffer.toString('utf8') : undefined;
    return { status, statusMessage, data, headers, responseTime };

  };
}
