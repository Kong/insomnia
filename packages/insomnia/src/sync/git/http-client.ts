/** This is a client for isomorphic-git {@link https://isomorphic-git.org/docs/en/http} */
export const httpClient = {
  request: async (config: any) => {
    let response;

    if (config.headers && !config.headers.Accept) {
      config.headers.Accept = '*/*';
    }

    try {
      // hosted-git-info was adding git+ to the beginning of the url which isn't supported by axios after 0.27.0
      const withoutGitPlus = config.url.replace(/^git\+/, '');
      response = await window.main.axiosRequest({
        url: withoutGitPlus,
        method: config.method,
        headers: config.headers,
        data: config.body,
        responseType: 'arraybuffer',
        maxRedirects: 10,
      });
    } catch (err) {
      console.log('[git-http-client] Error thrown', err.message);
      // NOTE: config.url is unreachable
      throw err;
    }

    return {
      url: config.url,
      method: config.method,
      headers: response.headers,
      body: [response.data],
      statusCode: response.status,
      statusMessage: response.statusText,
    };
  },
};
