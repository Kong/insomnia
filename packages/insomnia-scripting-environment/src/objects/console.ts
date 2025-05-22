/**
 * Represents the various levels of logging that can be used in the application.
 *
 * - `debug`: Detailed information typically used for debugging purposes.
 * - `info`: General informational messages that highlight the progress of the application.
 * - `log`: Standard logging level for general-purpose messages.
 * - `warn`: Indicates a potential issue or something that requires attention.
 * - `error`: Represents error messages for critical issues or failures.
 */
type LogLevel = 'debug' | 'info' | 'log' | 'warn' | 'error';

/** @ignore */
export interface Row {
  value: string;
  name: string;
  timestamp: number;
}

/**
 * A custom console implementation that provides logging functionality
 * with various log levels and the ability to store log entries.
 *
 * @remarks
 * - The `clear` method is currently not supported and will throw an error if called.
 *
 * @example
 * ```javascript
 * console.log('This is a log message');
 * console.warn('This is a warning');
 * console.error('This is an error');
 * console.debug({ key: 'value' });
 * console.info('Informational message');
 * ```
 */
export class Console {
  rows: Row[] = [];

  // TODO: support replacing substitution
  /** @ignore */
  printLog = (rows: Row[], level: LogLevel, ...values: any) => {
    try {
      const content = values
        .map((value: any) => {
          return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
        })
        .join(' ');

      const row = {
        value: `${level}: ${content}`,
        name: 'Text',
        timestamp: Date.now(),
      };

      rows.push(row);
    } catch (e) {
      rows.push({
        value: 'error: ' + JSON.stringify(e, null, 2),
        name: 'Text',
        timestamp: Date.now(),
      });
    }
  };

  /**
   * Logs the provided values to the console with a log level of 'log'.
   *
   * @param values - The values to be logged. Accepts any number of arguments of any type.
   */
  log = (...values: any[]) => {
    this.printLog(this.rows, 'log', ...values);
  };

  /**
   * Logs the provided values to the console with a log level of 'warn'.
   *
   * @param values - The values to be logged. Accepts any number of arguments of any type.
   */
  warn = (...values: any[]) => {
    this.printLog(this.rows, 'warn', ...values);
  };

  /**
   * Logs the provided values to the console with a log level of 'debug'.
   *
   * @param values - The values to be logged. Accepts any number of arguments of any type.
   */
  debug = (...values: any[]) => {
    this.printLog(this.rows, 'debug', ...values);
  };

  /**
   * Logs the provided values to the console with a log level of 'info'.
   *
   * @param values - The values to be logged. Accepts any number of arguments of any type.
   */
  info = (...values: any[]) => {
    this.printLog(this.rows, 'info', ...values);
  };

  /**
   * Logs the provided values to the console with a log level of 'error'.
   *
   * @param values - The values to be logged. Accepts any number of arguments of any type.
   */
  error = (...values: any[]) => {
    this.printLog(this.rows, 'error', ...values);
  };

  /**
   * Clears the console output for the specified log level.
   * This method is currently not supported.
   */
  clear = (_level: LogLevel, _message?: any, ..._optionalParams: any[]) => {
    throw new Error('currently "clear" is not supported for the timeline');
  };

  /** @ignore */
  dumpLogs = () => {
    return this.rows.map(row => JSON.stringify(row) + '\n').join('\n');
  };

  /** @ignore */
  dumpLogsAsArray = () => {
    return this.rows.map(row => JSON.stringify(row) + '\n');
  };
}

/** @ignore */
let builtInConsole = new Console();
/** @ignore */
export function getExistingConsole() {
  return builtInConsole;
}
/** @ignore */
export function getNewConsole() {
  builtInConsole = new Console();
  return builtInConsole;
}
