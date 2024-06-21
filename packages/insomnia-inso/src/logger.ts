import consola, { BasicReporter, FancyReporter, LogLevel, logType } from 'consola';

export type LogsByType = { [t in logType]?: string[] };
export type ModifiedConsola = ReturnType<typeof consola.create> & { __getLogs: () => LogsByType };
const consolaLogger = consola.create({
  reporters: [
    new FancyReporter({
      formatOptions: {
        // @ts-expect-error something is wrong here, ultimately these types come from https://nodejs.org/api/util.html#util_util_inspect_object_options and `date` doesn't appear to be one of the options.
        date: false,
      },
    }),
  ],
});

(consolaLogger as ModifiedConsola).__getLogs = () => ({});
export const logger = consolaLogger as ModifiedConsola;
export const configureLogger = (quiet = false, ci = false) => {
  logger.level = quiet ? LogLevel.Info : LogLevel.Verbose;
  if (ci) {
    logger.setReporters([new BasicReporter()]);
  }
};
