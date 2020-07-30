// @flow

import consola from 'consola';

export class InsoError extends Error {
  cause: ?Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'InsoError';
    this.cause = cause;
  }
}

export const handleError = (err: Error) => {
  if (err instanceof InsoError) {
    consola.fatal(err.message);
    err.cause && consola.error(err.cause);
  } else if (err) {
    consola.error(err);
  }
  consola.info('To view tracing information, re-run `inso` with `--verbose`');
};
