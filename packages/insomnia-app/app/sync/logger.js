export default class Logger {
  constructor() {
    this._logs = [];
  }

  debug(message, ...args) {
    this._log('debug', message, ...args);
  }

  warn(message, ...args) {
    this._log('warn', message, ...args);
  }

  error(message, ...args) {
    this._log('error', message, ...args);
  }

  tail() {
    return this._logs;
  }

  /** @private */
  _log(type, message, ...args) {
    let fn;
    if (type === 'debug') {
      fn = 'log';
    } else if (type === 'warn') {
      fn = 'warn';
    } else {
      fn = 'error';
    }

    console[fn](`[sync] ${message}`, ...args);
    const date = new Date();
    this._logs.push({ type, date, message });
  }
}
