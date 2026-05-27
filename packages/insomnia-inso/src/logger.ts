<<<<<<< Updated upstream
import type { ConsolaOptions, LogObject, LogType } from 'consola';
=======
import type { ConsolaOptions, LogObject, logType } from 'consola';
>>>>>>> Stashed changes
import { createConsola } from 'consola';

type LogsByType = Partial<Record<LogType, string[]>>;

type ModifiedConsola = ReturnType<typeof createConsola> & { __getLogs: () => LogsByType };

const consolaLogger = createConsola({
<<<<<<< Updated upstream
=======
  fancy: true,
>>>>>>> Stashed changes
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
