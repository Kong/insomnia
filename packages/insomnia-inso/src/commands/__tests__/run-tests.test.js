// @flow

import insomniaTesting from 'insomnia-testing';
import type { RunTestsOptions } from '../run-tests';
import { runInsomniaTests, TestReporterEnum } from '../run-tests';

jest.mock('insomnia-testing');
jest.mock('insomnia-send-request');

describe('runInsomniaTests()', () => {
  // make flow happy
  const mock = (mockFn: any) => mockFn;
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const base: RunTestsOptions = {
    reporter: TestReporterEnum.spec,
    appDataDir: 'src/db/__fixtures__/nedb',
    ci: true,
  };

  it('should should not generate if type arg is invalid', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await runInsomniaTests(null, ({ reporter: 'invalid' }: Object));

    expect(insomniaTesting.runTestsCli).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Reporter "invalid" not unrecognized. Options are [dot, list, spec, min, progress].',
    );
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

  it('should return true if test results have no failures', async function() {
    mock(insomniaTesting.runTestsCli).mockResolvedValue(true);

    const result = await runInsomniaTests('spc_46c5a4a40e83445a9bd9d9758b86c16c', {
      ...base,
      env: 'env_env_ca046a738f001eb3090261a537b1b78f86c2094c_sub',
    });

    expect(result).toBe(true);
  });
});
