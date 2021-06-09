import { exit, logErrorExit1, getDefaultAppName, getVersion, isDevelopment, noop, parseObjFromKeyValuePair } from './util';
import * as packageJson from '../package.json';
import { globalBeforeAll, globalBeforeEach } from './jest/before';
import { logger } from './logger';
import { InsoError } from './errors';

describe('exit()', () => {
  beforeAll(() => {
    globalBeforeAll();
  });

  beforeEach(() => {
    globalBeforeEach();
  });

  it('should exit 0 if successful result', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    await exit(new Promise((resolve) => resolve(true)));
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should exit 1 if unsuccessful result', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    await exit(new Promise((resolve) => resolve(false)));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it.only('should exit 1 and print to console if rejected', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const error = new Error('message');
    await exit(new Promise((resolve, reject) => reject(error)));

    const logs = logger.__getLogs();

    expect(logs.fatal).toEqual([]);
    expect(logs.error).toEqual([error]);
    expect(logs.info).toEqual(['To view tracing information, re-run `inso` with `--verbose`']);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit 1 and print to console if rejected with InsoError', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const cause = new Error('message');
    const insoError = new InsoError('inso error', cause);
    await exit(new Promise((resolve, reject) => reject(insoError)));

    const logs = logger.__getLogs();

    expect(logs.fatal).toEqual([insoError.message]);
    expect(logs.error).toEqual([cause]);
    expect(logs.info).toEqual(['To view tracing information, re-run `inso` with `--verbose`']);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit 1 and print to console and if rejected with InsoError without cause', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const insoError = new InsoError('inso error');
    await exit(new Promise((resolve, reject) => reject(insoError)));

    const logs = logger.__getLogs();

    expect(logs.fatal).toEqual([insoError.message]);
    expect(logs.error).toEqual([]);
    expect(logs.info).toEqual(['To view tracing information, re-run `inso` with `--verbose`']);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe('logErrorExit1()', () => {
  beforeAll(() => {
    globalBeforeAll();
  });

  beforeEach(() => {
    globalBeforeEach();
  });

  it('should exit 1 and print error to console', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const error = new Error('message');
    await logErrorExit1(error);

    const logs = logger.__getLogs();

    expect(logs.error).toEqual([error]);
    expect(logs.info).toEqual(['To view tracing information, re-run `inso` with `--verbose`']);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit 1', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    await logErrorExit1();

    const logs = logger.__getLogs();

    expect(logs.error).toEqual([]);
    expect(logs.info).toEqual(['To view tracing information, re-run `inso` with `--verbose`']);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe('getDefaultAppName()', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV }; // make a copy
  });

  afterAll(() => {
    process.env = OLD_ENV; // restore old env
  });

  it('should return value if set', () => {
    const value = 'dir';
    process.env.DEFAULT_APP_NAME = value;
    expect(getDefaultAppName()).toBe(value);
  });

  it('should throw error if not set', () => {
    process.env.DEFAULT_APP_NAME = '';
    expect(getDefaultAppName).toThrowError('Environment variable DEFAULT_APP_NAME is not set.');
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
});

describe('parseObjFromKeyValuePair()', function() {
  it('should return true if key-value pairs are decoded properly', async () => {
    const arr = [
      'key1=value1',
      'key2=value2',
      'path=/tmp/9047ue.txt',
      'delimiter="="',
      'delimiter2==',
      'someBoolStuff=true',
      'someNumber=5',
      'someNumber2=10.52',
    ];

    const expected = {
      key1: 'value1',
      key2: 'value2',
      path: '/tmp/9047ue.txt',
      delimiter: '"="',
      delimiter2: '=',
      someBoolStuff: true,
      someNumber: 5,
      someNumber2: 10.52,
    };

    expect(parseObjFromKeyValuePair(arr)).toBe(expected);
  });
});

describe('noop()', () => {
  it('should return nothing', () => {
    expect(noop()).toBe(undefined);

    // @ts-expect-error -- intentionally testing invalid inputs
    expect(noop('argument')).toBe(undefined);
  });
});
