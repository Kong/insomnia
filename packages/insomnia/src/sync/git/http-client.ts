import { HttpClient } from 'isomorphic-git';
import { request } from 'isomorphic-git/http/web';

/** This is a client for isomorphic-git {@link https://isomorphic-git.org/docs/en/http} */
export const httpClient: HttpClient = {
  request: async config => {
    if (!config.headers) {
      config.headers = {};
    }

    const originalUrl = new URL(config.url);

    config.url = `insomnia-api://insomnia${originalUrl.pathname}${originalUrl.search}`;
    config.headers['X-Origin'] = originalUrl.origin;

    return request(config);
  },
};
