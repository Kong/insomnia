import { logType } from 'consola';
import { logger, LogsByType } from '../logger';

// Taken from https://github.com/unjs/consola/blob/master/types/consola.d.ts#L16
const logTypes: logType[] = [
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
  'ready',
  'start',
];

export const globalBeforeAll = () => {
  logger.__getLogs = () => logTypes.reduce((accumulator, level) => {
      // @ts-expect-error the consola types are incomplete
      const calls = (logger[level] as jest.Mock).mock.calls.map(call => (
        call.length === 1 ? call[0] : call
      ));
      return {
        ...accumulator,
        [level]: calls,
      };
    }, {} as LogsByType);
  };

export const globalBeforeEach = () => {
  logger.mockTypes(() => jest.fn());
};
