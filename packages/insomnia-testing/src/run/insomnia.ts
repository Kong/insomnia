import axios, { Method } from 'axios';

// @ts-expect-error we're pulling straight out of the lib here in a way that is not intended, but axios does not directly expose this adapter
import httpAdapter from 'axios/lib/adapters/http';

export type Request = {
  _id: string;
  url?: string;
  method?: string;
  body?: {
    text?: string;
  };
  headers?: {
    name: string;
    value: string;
    description?: string;
    disabled?: boolean;
  }[];
};

export type Response = {
  status: number;
  statusText: string;
  data: {
    [key: string]: unknown;
  };
  headers: {
    [key: string]: string;
  };
};

export type SendRequestCallback = (requestId: string) => Promise<Response>;

export type InsomniaOptions = {
  requests?: Request[];
  sendRequest?: SendRequestCallback;
  bail?: boolean;
  keepFile?: boolean;
  testFilter?: string;
};

/**
 * An instance of Insomnia will be exposed as a global variable during
 * tests, and will provide a bunch of utility functions for sending
 * requests, etc.
 */
export default class Insomnia {
  requests: Request[];
  activeRequestId: string | null;
  activeEnvironmentId: string | null = null;
  sendRequest: SendRequestCallback | null;

  constructor(options: InsomniaOptions = {}) {
    this.requests = options.requests || [];
    this.sendRequest = options.sendRequest || null; // Things that are set per test

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

    const request = this.requests.find(request => request._id === reqId);

    if (!request) {
      throw new Error('Request not provided to test');
    }

    const { headers, url = '', method, body } = request;

    const axiosHeaders = headers?.reduce((accumulator, { disabled, name, value }) => {
      return {
        ...accumulator,
        ...(disabled ? {} : { [name]: value }),
      };
    });

    const response = await axios.request({
      url,
      method: (method as Method) || 'GET',
      data: body?.text,
      headers: axiosHeaders,

      // Don't follow redirects,
      maxRedirects: 0,

      // Don't throw errors on status != 200
      validateStatus: () => true,

      // Force NodeJS adapter or Electron will default to XMLHttpRequest
      adapter: httpAdapter,
    });

    console.log('[tests] Received response', {
      response: response,
    });

    return {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      headers: response.headers,
    };
  }
}
