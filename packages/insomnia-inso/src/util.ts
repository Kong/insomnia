import { logger } from './logger';

export class InsoError extends Error {
  cause?: Error | null;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'InsoError';
    this.cause = cause;
  }
}

export const exit = async (result: Promise<boolean>): Promise<void> => {
  return result.then(r => process.exit(r ? 0 : 1)).catch(err => {
    if (err instanceof InsoError) {
      logger.fatal(err.message);
      err.cause && logger.fatal(err.cause);
    } else if (err) {
      logger.fatal(err);
    }
    process.exit(1);
  });
};
