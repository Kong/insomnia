import { noConsoleLog } from './logger';
describe('logger', () => {
  describe('noConsoleLog()', () => {
    const originalConsoleLog = console.log;

    afterAll(() => {
      console.log = originalConsoleLog;
    });

    it('should overwrite and reset console.log during callback', async () => {
      const consoleLogMock = jest.fn();
      console.log = consoleLogMock;
      await noConsoleLog(async () => {
        console.log('test');
      });
      expect(console.log).toBe(consoleLogMock);
      expect(consoleLogMock).not.toHaveBeenCalled();
    });
  });
});
