import { HttpClient } from 'isomorphic-git';

/** This is a client for isomorphic-git {@link https://isomorphic-git.org/docs/en/http} */
export const httpClient: HttpClient = {
  request: async config => {
    console.log('httpClient', config);

    try {
      const response = await window.main.axiosRequest({
        url: config.url,
        method: config.method,
        headers: config.headers,
        data: Array.isArray(config.body) && Buffer.concat(config.body),
        responseType: 'arraybuffer',
        maxRedirects: 10,
      });
      console.log('httpClient response', response);
      return {
        url: response.request.res.responseUrl,
        method: response.request.method,
        headers: response.headers,
        body: [response.data],
        statusCode: response.status,
        statusMessage: response.statusText,
      };
    } catch (err) {
      console.log('httpClient error', err);
      if (!err.response) {
        // NOTE: config.url is unreachable
        throw err;
      }
      const response = err.response || { request:{}, config:{}, headers:{}, data:{} };
      return {
        url: response.request.res.responseUrl,
        method: response.request.method,
        headers: response.headers,
        body: [response.data],
        statusCode: response.status,
        statusMessage: response.statusText,
      };
    }
  },
};
