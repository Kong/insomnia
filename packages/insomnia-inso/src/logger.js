// @flow
import consola from 'consola';

export const noConsoleLog = async <T>(callback: () => Promise<T>): Promise<T> => {
  const oldConsoleLog = console.log;
  (console: Object).log = () => {};

  try {
    return await callback();
  } finally {
    (console: Object).log = oldConsoleLog;
  }
};

const logger = consola.create({
  reporters: [new consola.FancyReporter({ formatOptions: { date: false } })],
});

export const configureLogger = (verbose: boolean = false, ci: boolean = false) => {
  logger.level = verbose ? consola.LogLevel.Verbose : consola.LogLevel.Info;
  ci && logger.setReporters([new consola.BasicReporter()]);
};

export default logger;
