// @flow
import { exit, logErrorExit1, getDefaultAppDataDir, getVersion, isDevelopment } from '../util';
import * as packageJson from '../../package.json';

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
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const error = new Error('message');
    await exit(new Promise((resolve, reject) => reject(error)));

    expect(errorSpy).toHaveBeenCalledWith(error);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe('logErrorExit1()', () => {
  it('should exit 1 and print error to console', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const error = new Error('message');
    await logErrorExit1(error);

    expect(errorSpy).toHaveBeenCalledWith(error);
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

describe('getVersion()', () => {
  it('should return version from packageJson', () => {
    expect(getVersion()).toBe(packageJson.version);
  });

  it('should return dev if running in development', () => {
    const oldNodeEnv = process.env.NODE_ENV;

    process.env.NODE_ENV = 'development';
    expect(getVersion()).toBe('dev');

    process.env.NODE_ENV = oldNodeEnv;
  });
});

describe('isDevelopment()', () => {
  it('should return true if NODE_ENV is development', () => {
    const oldNodeEnv = process.env.NODE_ENV;

    process.env.NODE_ENV = 'development';
    expect(isDevelopment()).toBe(true);

    process.env.NODE_ENV = oldNodeEnv;
  });

  it('should return false if NODE_ENV is not development', () => {
    const oldNodeEnv = process.env.NODE_ENV;

    process.env.NODE_ENV = 'production';
    expect(isDevelopment()).toBe(false);

    process.env.NODE_ENV = oldNodeEnv;
  });

  it('should return dev if running in development', () => {});
});
