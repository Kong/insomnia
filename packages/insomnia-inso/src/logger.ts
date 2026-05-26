import type { ConsolaOptions, LogObject, logType } from 'consola';
import { createConsola } from 'consola';

type LogsByType = Partial<Record<logType, string[]>>;

type ModifiedConsola = ReturnType<typeof createConsola> & { __getLogs: () => LogsByType };

const consolaLogger = createConsola({
  fancy: true,
  formatOptions: {
    date: false,
  },
});

(consolaLogger as ModifiedConsola).__getLogs = () => ({});

export const logger = consolaLogger as ModifiedConsola;

export class BasicReporter {
  log(logObj: LogObject, _ctx: { options: ConsolaOptions }) {
    process.stdout.write(logObj.args.join(' ') + '\n');
  }
}
