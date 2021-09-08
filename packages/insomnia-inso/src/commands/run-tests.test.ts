import { generate as _generate, runTestsCli as _runTestsCli } from 'insomnia-testing';

import { globalBeforeAll, globalBeforeEach } from '../jest/before';
import { logger } from '../logger';
import { GenerateConfigOptions } from './generate-config';
import { runInsomniaTests, RunTestsOptions } from './run-tests';

jest.mock('insomnia-testing');
jest.mock('insomnia-send-request');

const generate = _generate as jest.MockedFunction<typeof _generate>;
const runTestsCli = _runTestsCli as jest.MockedFunction<typeof _runTestsCli>;

describe('runInsomniaTests()', () => {
  beforeAll(() => {
    globalBeforeAll();
  });

  beforeEach(() => {
    globalBeforeEach();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const base: RunTestsOptions = {
    reporter: 'spec',
    src: 'src/db/fixtures/nedb',
    ci: true,
  };

  it('should should not  as _generate if type arg is invalid', async () => {
    await runInsomniaTests(null, {
      // @ts-expect-error this is intentionally passing in a bad value
      reporter: 'invalid',
    });
    expect(runTestsCli).not.toHaveBeenCalled();
    expect(logger.__getLogs().fatal).toEqual([
      'Reporter "invalid" not unrecognized. Options are [dot, list, min, progress, spec].',
    ]);
  });

  it('should forward options to insomnia-testing', async () => {
    const contents = 'generated test contents';
    generate.mockReturnValue(contents);

    const options: Partial<GenerateConfigOptions> = {
      ...base,
      // @ts-expect-error not sure why this was an invalid value, but I'm going to leave it here
      reporter: 'min',
      bail: true,
      keepFile: false,
      testNamePattern: 'Math',
      env: 'env_env_ca046a738f001eb3090261a537b1b78f86c2094c_sub',
    };

    await runInsomniaTests('spc_46c5a4a40e83445a9bd9d9758b86c16c', options);
    expect(runTestsCli).toHaveBeenCalledWith(contents, {
      reporter: 'min',
      bail: true,
      keepFile: false,
      sendRequest: expect.any(Function),
      testFilter: 'Math',
    });
  });

  it('should return false if test results have any failures', async function() {
    runTestsCli.mockResolvedValue(false);
    const result = await runInsomniaTests('spc_46c5a4a40e83445a9bd9d9758b86c16c', {
      ...base,
      env: 'env_env_ca046a738f001eb3090261a537b1b78f86c2094c_sub',
    });
    expect(result).toBe(false);
  });

  it('should return false if test suites could not be found', async () => {
    const result = await runInsomniaTests('not-found', {
      ...base,
      workingDir: 'src/db/fixtures/git-repo',
    });
    expect(result).toBe(false);
    expect(logger.__getLogs().fatal).toEqual(['No test suites found; cannot run tests.']);
  });

  it('should return false if environment could not be found', async () => {
    const result = runInsomniaTests('spc_46c5a4a40e83445a9bd9d9758b86c16c', {
      ...base,
      workingDir: 'src/db/fixtures/git-repo',
      env: 'not-found',
    });
    await expect(result).rejects.toThrowError(
      'Expected single sub environment in the data store, but found none.',
    );
  });

  it('should return true if test results have no failures', async function() {
    runTestsCli.mockResolvedValue(true);
    const result = await runInsomniaTests('spc_46c5a4a40e83445a9bd9d9758b86c16c', {
      ...base,
      env: 'env_env_ca046a738f001eb3090261a537b1b78f86c2094c_sub',
    });
    expect(result).toBe(true);
  });
});
