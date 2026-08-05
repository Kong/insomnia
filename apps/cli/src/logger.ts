import type { ConsolaOptions, LogObject, LogType } from 'consola';
import { createConsola } from 'consola';

import { FancyReporter } from './reporters/fancy-reporter';

type LogsByType = Partial<Record<LogType, string[]>>;

type ModifiedConsola = ReturnType<typeof createConsola> & { __getLogs: () => LogsByType };

const consolaLogger = createConsola({
  formatOptions: {
    date: false,
  },
  reporters: [new FancyReporter()],
});

(consolaLogger as ModifiedConsola).__getLogs = () => ({});

export const logger = consolaLogger as ModifiedConsola;

export class BasicReporter {
  log(logObj: LogObject, _ctx: { options: ConsolaOptions }) {
    process.stdout.write(logObj.args.join(' ') + '\n');
  }
}
