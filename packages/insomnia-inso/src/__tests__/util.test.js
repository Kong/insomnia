// @flow
import { exit, logErrorExit1, getDefaultAppDataDir } from '../util';

describe('exit()', () => {
  it('should exit 0 if successful result', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    await exit(new Promise(resolve => resolve(true)));

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should exit 1 if unsuccessful result', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    await exit(new Promise(resolve => resolve(false)));

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit 1 and print to console and if rejected', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const error = new Error('message');
    await exit(new Promise((resolve, reject) => reject(error)));

    expect(logSpy).toHaveBeenCalledWith('Something went wrong: message');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe('logErrorExit1()', () => {
  it('should exit 1 and print error to console', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const error = new Error('message');
    await logErrorExit1(error);

    expect(logSpy).toHaveBeenCalledWith('Something went wrong: message');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe('getDefaultAppDataDir()', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV }; // make a copy
  });

  afterAll(() => {
    process.env = OLD_ENV; // restore old env
  });

  it('should return value if set', () => {
    const value = 'dir';
    process.env.DEFAULT_APP_DATA_DIR = value;
    expect(getDefaultAppDataDir()).toBe(value);
  });

  it('should throw error if not set', () => {
    process.env.DEFAULT_APP_DATA_DIR = '';

    expect(getDefaultAppDataDir).toThrowError(
      'Environment variable DEFAULT_APP_DATA_DIR is not set.',
    );
  });
});
