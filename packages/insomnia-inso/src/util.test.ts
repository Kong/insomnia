import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { globalBeforeAll, globalBeforeEach } from './jest/before';
import { logger } from './logger';
import { exit, InsoError } from './util';

describe('exit()', () => {
  beforeAll(() => {
    globalBeforeAll();
  });

  beforeEach(() => {
    globalBeforeEach();
  });

  it('should exit 0 if successful result', async () => {
    const exitSpy = jest.spyOn(process, 'exit');
    await exit(new Promise(resolve => resolve(true)));
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should exit 1 if unsuccessful result', async () => {
    const exitSpy = jest.spyOn(process, 'exit');
    await exit(new Promise(resolve => resolve(false)));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it.only('should exit 1 and print to console if rejected', async () => {
    const exitSpy = jest.spyOn(process, 'exit');
    const error = new Error('message');
    await exit(new Promise((_, reject) => reject(error)));

    const logs = logger.__getLogs();

    expect(logs.fatal).toEqual([error]);
    expect(logs.error).toEqual([]);
    expect(logs.info).toEqual(['To view tracing information, re-run `inso` with `--verbose`']);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit 1 and print to console if rejected with InsoError', async () => {
    const exitSpy = jest.spyOn(process, 'exit');
    const cause = new Error('message');
    const insoError = new InsoError('inso error', cause);
    await exit(new Promise((_, reject) => reject(insoError)));

    const logs = logger.__getLogs();

    expect(logs.fatal).toEqual([insoError.message]);
    expect(logs.error).toEqual([cause]);
    expect(logs.info).toEqual(['To view tracing information, re-run `inso` with `--verbose`']);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit 1 and print to console and if rejected with InsoError without cause', async () => {
    const exitSpy = jest.spyOn(process, 'exit');
    const insoError = new InsoError('inso error');
    await exit(new Promise((_, reject) => reject(insoError)));

    const logs = logger.__getLogs();

    expect(logs.fatal).toEqual([insoError.message]);
    expect(logs.error).toEqual([]);
    expect(logs.info).toEqual(['To view tracing information, re-run `inso` with `--verbose`']);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
