/** This is a client for isomorphic-git {@link https://isomorphic-git.org/docs/en/http} */
export const httpClient = {
  request: async (config: any) => {
    let response;
    let body: Buffer | null = null;

    if (config.headers && !config.headers.Accept) {
      config.headers.Accept = '*/*';
    }

    if (Array.isArray(config.body)) {
      body = Buffer.concat(config.body);
    }

    try {
      // hosted-git-info was adding git+ to the beginning of the url which isn't supported by axios after 0.27.0
      const withoutGitPlus = config.url.replace(/^git\+/, '');
      response = await window.main.axiosRequest({
        url: withoutGitPlus,
        method: config.method,
        headers: config.headers,
        data: body,
        responseType: 'arraybuffer',
        maxRedirects: 10,
      });
    } catch (err) {
      if (!err.response) {
        // NOTE: config.url is unreachable
        throw err;
      }
      response = err.response;
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
