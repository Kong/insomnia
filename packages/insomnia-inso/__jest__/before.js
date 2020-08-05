import logger from '../src/logger';

export function globalBeforeAll() {
  logger.__getLogs = () => {
    const logs = {};
    // Taken from https://github.com/nuxt-contrib/consola/blob/master/src/types.js
    [
      'silent',
      'fatal',
      'error',
      'warn',
      'log',
      'info',
      'success',
      'debug',
      'trace',
      'verbose',
    ].forEach(level => {
      logs[level] = logger[level].mock.calls.map(c => (c.length === 1 ? c[0] : c));
    });
    return logs;
  };
}

export function globalBeforeEach() {
  logger.mockTypes(() => jest.fn());
}
