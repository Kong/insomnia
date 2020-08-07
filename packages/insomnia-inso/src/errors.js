// @flow

import logger from './logger';

export class InsoError extends Error {
  cause: ?Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'InsoError';
    this.cause = cause;
  }
}

export const handleError = (err?: Error) => {
  if (err instanceof InsoError) {
    logger.fatal(err.message);
    err.cause && logger.error(err.cause);
  } else if (err) {
    logger.error(err);
  }
  logger.info('To view tracing information, re-run `inso` with `--verbose`');
};
