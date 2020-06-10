// @flow
import axios from 'axios';

export type Request = {
  url?: string,
  method?: string,
  headers?: {
    [string]: string,
  },
};

export type Response = {
  status: number,
  statusText: string,
  data: Object,
  headers: {
    [string]: string,
  },
};

/**
 * An instance of Insomnia will be exposed as a global variable during
 * tests, and will provide a bunch of utility functions for sending
 * requests, etc.
 */
export default class Insomnia {
  async send(req: Request): Promise<Response> {
    const options = {
      url: req.url || '',
      method: req.method || 'GET',
      headers: req.headers || {},


      // Don't follow redirects,
      maxRedirects: 0,

      // Don't throw errors on status != 200
      validateStatus: status => true,
    };

    const resp = await axios.request(options);

    return {
      status: resp.status,
      statusText: resp.statusText,
      data: resp.data,
      headers: resp.headers,
    };
  }
}
