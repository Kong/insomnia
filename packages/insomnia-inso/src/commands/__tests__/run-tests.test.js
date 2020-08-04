// @flow

import insomniaTesting from 'insomnia-testing';
import { runInsomniaTests, TestReporterEnum } from '../run-tests';
import { globalBeforeAll, globalBeforeEach } from '../../../__jest__/before';
import logger from '../../logger';

jest.mock('insomnia-testing');
jest.mock('insomnia-send-request');

describe('runInsomniaTests()', () => {
  beforeAll(() => {
    globalBeforeAll();
  });
  beforeEach(() => {
    globalBeforeEach();
  });

  // make flow happy
  const mock = (mockFn: any) => mockFn;
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const base = {
    reporter: TestReporterEnum.spec,
    appDataDir: 'src/db/__fixtures__/nedb',
    ci: true,
  };

  it('should should not generate if type arg is invalid', async () => {
    await runInsomniaTests(null, ({ reporter: 'invalid' }: Object));

    expect(insomniaTesting.runTestsCli).not.toHaveBeenCalled();
    expect(logger.__getLogs().fatal).toEqual([
      'Reporter "invalid" not unrecognized. Options are [dot, list, spec, min, progress].',
    ]);
  });

  it('should forward options to insomnia-testing', async () => {
    const contents = 'generated test contents';
    mock(insomniaTesting.generate).mockResolvedValue(contents);

    const options = {
      ...base,
      reporter: 'min',
      bail: true,
      keepFile: false,
      testNamePattern: 'Math',
      env: 'env_env_ca046a738f001eb3090261a537b1b78f86c2094c_sub',
    };
    await runInsomniaTests('spc_46c5a4a40e83445a9bd9d9758b86c16c', options);

    expect(insomniaTesting.runTestsCli).toHaveBeenCalledWith(contents, {
      reporter: 'min',
      bail: true,
      keepFile: false,
      sendRequest: expect.any(Function),
      testFilter: 'Math',
    });
  });

  it('should return false if test results have any failures', async function() {
    mock(insomniaTesting.runTestsCli).mockResolvedValue(false);

    const result = await runInsomniaTests('spc_46c5a4a40e83445a9bd9d9758b86c16c', {
      ...base,
      env: 'env_env_ca046a738f001eb3090261a537b1b78f86c2094c_sub',
    });

    expect(result).toBe(false);
  });

  it('should return false if test suites could not be found', async () => {
    const result = await runInsomniaTests('not-found', {
      ...base,
      workingDir: 'src/db/__fixtures__/git-repo',
    });

    expect(result).toBe(false);
    expect(logger.__getLogs().fatal).toEqual(['No test suites found; cannot run tests.']);
  });

  it('should return false if environment could not be found', async () => {
    const result = runInsomniaTests('spc_46c5a4a40e83445a9bd9d9758b86c16c', {
      ...base,
      workingDir: 'src/db/__fixtures__/git-repo',
      env: 'not-found',
    });

    await expect(result).rejects.toThrowError(
      'Expected single sub environment in the data store, but found none.',
    );
  });

  it('should return true if test results have no failures', async function() {
    mock(insomniaTesting.runTestsCli).mockResolvedValue(true);

    const result = await runInsomniaTests('spc_46c5a4a40e83445a9bd9d9758b86c16c', {
      ...base,
      env: 'env_env_ca046a738f001eb3090261a537b1b78f86c2094c_sub',
    });

    expect(result).toBe(true);
  });
});
