// @flow
import axios from 'axios';

export type Request = {
  _id: string,
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
  requests: Array<$Shape<Request>>;

  /**
   * @param requests - map of ID -> Request to be used when referencing requests by Id
   */
  constructor(requests?: Array<$Shape<Request>>) {
    this.requests = requests || [];
  }

  /**
   *
   * @param reqOrId - raw request object or an ID to reference a request
   * @returns {Promise<{headers: *, data: *, statusText: (string|string), status: *}>}
   */
  async send(reqOrId: string | Request): Promise<Response> {
    const req = typeof reqOrId === 'string' ? this.requests.find(r => r._id === reqOrId) : reqOrId;

    if (typeof reqOrId === 'string' && !req) {
      throw new Error(`Failed to find request by ID ${reqOrId}`);
    }

    if (!req) {
      throw new Error('Request not provided to test');
    }

    const options = {
      url: req.url || '',
      method: req.method || 'GET',
      headers: req.headers || {},

      // Don't follow redirects,
      maxRedirects: 0,

      // Don't throw errors on status != 200
      validateStatus: () => true,
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
