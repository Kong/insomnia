// @flow
import axios from 'axios';

export type Request = {
  _id: string,
  url?: string,
  method?: string,
  body?: {
    text?: string,
  },
  headers?: Array<{
    name: string,
    value: string,
    description?: string,
    disabled?: boolean,
  }>,
};

export type Response = {
  status: number,
  statusText: string,
  data: Object,
  headers: {
    [string]: string,
  },
};

type SendRequestCallback = (requestId: string) => Promise<$Shape<Response>>;

export type InsomniaOptions = {
  requests?: Array<$Shape<Request>>,
  sendRequest?: SendRequestCallback,
  bail?: boolean,
  keepFile?: boolean,
  testFilter?: string,
};

/**
 * An instance of Insomnia will be exposed as a global variable during
 * tests, and will provide a bunch of utility functions for sending
 * requests, etc.
 */
export default class Insomnia {
  requests: Array<$Shape<Request>>;
  activeRequestId: string | null;
  activeEnvironmentId: string | null;
  sendRequest: SendRequestCallback | null;

  constructor(options: InsomniaOptions = {}) {
    this.requests = options.requests || [];
    this.sendRequest = options.sendRequest || null;

    // Things that are set per test
    this.activeRequestId = null;
  }

  setActiveRequestId(id: string): void {
    this.activeRequestId = id;
  }

  clearActiveRequest(): void {
    this.activeRequestId = null;
  }

  /**
   *
   * @param reqId - request ID to send. Specifying nothing will send the active request
   * @returns {Promise<{headers: *, data: *, statusText: (string|string), status: *}>}
   */
  async send(reqId: string | null = null): Promise<Response> {
    // Default to active request if nothing is specified
    reqId = reqId || this.activeRequestId;

    const { sendRequest } = this;
    if (typeof sendRequest === 'function' && typeof reqId === 'string') {
      return sendRequest(reqId);
    }

    const req = this.requests.find(r => r._id === reqId);

    if (!req) {
      throw new Error('Request not provided to test');
    }

    const axiosHeaders = {};
    for (const h of req.headers || []) {
      if (h.disabled) {
        continue;
      }

      axiosHeaders[h.name] = h.value;
    }

    const options = {
      url: req.url || '',
      method: req.method || 'GET',
      data: req.body ? req.body.text : null,
      headers: axiosHeaders,

      // Don't follow redirects,
      maxRedirects: 0,

      // Don't throw errors on status != 200
      validateStatus: () => true,

      // Force NodeJS adapter or Electron will default to XMLHttpRequest
      adapter: require('axios/lib/adapters/http'),
    };

    const resp = await axios.request(options);
    console.log('[tests] Received response', { response: resp });

    return {
      status: resp.status,
      statusText: resp.statusText,
      data: resp.data,
      headers: resp.headers,
    };
  }
}
