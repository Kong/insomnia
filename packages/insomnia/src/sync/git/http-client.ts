import { externalFetch } from '../../ui/externalFetch';

/** This is a client for isomorphic-git {@link https://isomorphic-git.org/docs/en/http} */
export const httpClient = {
  request: async (config: any) => {
    if (config.headers && !config.headers.Accept) {
      config.headers.Accept = '*/*';
    }
    // hosted-git-info was adding git+ to the beginning of the url which isn't supported by axios after 0.27.0
    const withoutGitPlus = config.url.replace(/^git\+/, '');
    console.log('git request', withoutGitPlus, config.body);
    const response = await externalFetch<ArrayBuffer>({
      url: withoutGitPlus,
      method: config.method,
      headers: config.headers,
      body: JSON.stringify(config.body),
      responseType: 'arraybuffer',
    });
    return {
      url: config.url,
      method: config.method,
      headers: response.headers as Record<string, string>,
      body: [response.data],
      statusCode: response.status,
      statusMessage: response.statusText,
    };
  },
};
