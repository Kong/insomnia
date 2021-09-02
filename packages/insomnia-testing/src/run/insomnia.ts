export type SendRequestCallback<TResponse> = (requestId: string) => Promise<TResponse>;

export interface InsomniaOptions<TResponse> {
  sendRequest: SendRequestCallback<TResponse>;
  bail?: boolean;
  keepFile?: boolean;
  testFilter?: string;
}

/**
 * An instance of Insomnia will be exposed as a global variable during
 * tests, and will provide a bunch of utility functions for sending
 * requests, etc.
 */
export class Insomnia<TResponse = {}> {
  activeRequestId: string | null;
  activeEnvironmentId: string | null = null;
  sendRequest: SendRequestCallback<TResponse>;

  constructor(options: InsomniaOptions<TResponse>) {
    this.sendRequest = options.sendRequest; // Things that are set per test

    this.activeRequestId = null;
  }

  setActiveRequestId(id: string) {
    this.activeRequestId = id;
  }

  clearActiveRequest() {
    this.activeRequestId = null;
  }

  /**
   *
   * @param reqId - request ID to send. Specifying nothing will send the active request
   */
  async send(reqId: string | null = null) {
    // Default to active request if nothing is specified
    const requestId = reqId || this.activeRequestId;

    if (!requestId) {
      throw new Error('No selected request');
    }

    const result = await this.sendRequest(requestId);
    return result;
  }
}
