import { axiosRequest } from '../../network/axios-request';

/**
 * This is an http plugin for isomorphic-git that uses our axios helper to make
 * requests.
 */
export async function httpPlugin(config) {
  let response;

  let body = null;
  if (Array.isArray(config.body)) {
    body = Buffer.concat(config.body);
  }

  try {
    response = await axiosRequest({
      url: config.url,
      method: config.method,
      headers: config.headers,
      data: body,
      responseType: 'arraybuffer',
      maxRedirects: 10,
    });
  } catch (err) {
    response = err.response;
  }

  return {
    url: response.request.res.responseUrl,
    method: response.request.method,
    headers: response.headers,
    body: [response.data],
    statusCode: response.status,
    statusMessage: response.statusText,
  };
}
