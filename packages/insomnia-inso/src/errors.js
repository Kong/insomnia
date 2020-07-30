// @flow

export class InsoError extends Error {
  cause: ?Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'InsoError';
    this.cause = cause;
  }
}
