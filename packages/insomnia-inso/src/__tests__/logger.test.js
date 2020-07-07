// @flow
import { noConsoleLog } from '../logger';

describe('logger', () => {
  describe('noConsoleLog()', () => {
    it('should overwrite console.log during callback', async () => {
      const consoleLogMock = jest.fn();
      (console: Object).log = consoleLogMock;

      await noConsoleLog(async () => {
        console.log('test');
      });

      expect(console.log).toBe(consoleLogMock);
      expect(consoleLogMock).not.toHaveBeenCalled();
    });
  });
});
