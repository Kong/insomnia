import { generate as _generate, runTestsCli as _runTestsCli } from 'insomnia-testing';
import { runInsomniaTests, RunTestsOptions, isReporterFailure } from './run-tests';
import { globalBeforeAll, globalBeforeEach } from '../jest/before';
import { logger } from '../logger';
import { GenerateConfigOptions } from './generate-config';

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
    appDataDir: 'src/db/fixtures/nedb',
    ci: true,
  };

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
      reporterOptions: {},
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

  it('should return true if reporter options are decoded properly', async () => {
    const contents = 'generated test contents';
    generate.mockReturnValue(contents);

    const options = {
      ...base,
      bail: false,
      keepFile: false,
      reporter: 'custom-reporter',
      reporterOptions: [
        'key1=value1',
        'key2=value2',
        'path=/tmp/9047ue.txt',
        'delimiter="="',
        'delimiter2==',
        'someBoolStuff=true',
        'someNumber=5',
        'someNumber2=10.52',
      ],
      env: 'env_env_ca046a738f001eb3090261a537b1b78f86c2094c_sub',
    };

    await runInsomniaTests('spc_46c5a4a40e83445a9bd9d9758b86c16c', options);

    expect(runTestsCli).toHaveBeenCalledWith(contents, {
      bail: false,
      keepFile: false,
      reporter: 'custom-reporter',
      reporterOptions: {
        key1: 'value1',
        key2: 'value2',
        path: '/tmp/9047ue.txt',
        delimiter: '"="',
        delimiter2: '=',
        someBoolStuff: true,
        someNumber: 5,
        someNumber2: 10.52,
      },
      sendRequest: expect.any(Function),
    });
  });

  it('should return true if test results have no failures', async function() {
    runTestsCli.mockResolvedValue(true);
    const result = await runInsomniaTests('spc_46c5a4a40e83445a9bd9d9758b86c16c', {
      ...base,
      env: 'env_env_ca046a738f001eb3090261a537b1b78f86c2094c_sub',
    });
    expect(result).toBe(true);
  });

  it('should return false if environment is undefined', async () => {
    const result = await runInsomniaTests('spc_46c5a4a40e83445a9bd9d9758b86c16c', {
      ...base,
      workingDir: 'src/db/__fixtures__/git-repo',
      env: undefined,
    });

    await expect(result).toBe(false);
    expect(logger.__getLogs().fatal).toEqual([
      'No environment identified; cannot run tests without a valid environment.',
    ]);
  });

  it('should return falsy value if reporter is not found', async () => {
    const contents = 'generated test contents';
    generate.mockReturnValue(contents);

    const result = await runInsomniaTests('spc_46c5a4a40e83445a9bd9d9758b86c16c', {
      ...base,
      env: 'env_env_ca046a738f001eb3090261a537b1b78f86c2094c_sub',
      reporter: 'does-not-exists',
    });

    await expect(result).toBeFalsy();
  });

  it('should prompt cli for test suites', async () => {
    const result = await runInsomniaTests(undefined, {
      ...base,
      env: 'env_env_ca046a738f001eb3090261a537b1b78f86c2094c_sub',
    });
    await expect(result).toBe(false);
  });

  it('should report failure with logger name', async () => {
    isReporterFailure('unknown-reporter', 'An invalid reporter has been provided');
    expect(logger.__getLogs().fatal).toEqual([
      'Reporter "unknown-reporter" not found: An invalid reporter has been provided',
    ]);
  });

  it('should report an unknown failure', async () => {
    isReporterFailure('unknown-reporter', 'Javascript crashed');
    expect(logger.__getLogs().fatal).toEqual(['Javascript crashed']);
  });
});
