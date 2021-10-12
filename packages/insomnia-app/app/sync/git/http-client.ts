import { axiosRequest } from '../../network/axios-request';

/** This is a client for isomorphic-git {@link https://isomorphic-git.org/docs/en/http} */
export const httpClient = {
  request: async config => {
    let response;
    let body: Buffer | null = null;

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
      if (!err.response){
        // NOTE: config.url is unreachable
        throw err;
      }
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
  },
};
