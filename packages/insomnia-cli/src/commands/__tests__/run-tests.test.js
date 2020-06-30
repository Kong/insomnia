// @flow

import insomniaTesting from 'insomnia-testing';
import type { RunTestsOptions } from '../run-tests';
import { runInsomniaTests, TestReporterEnum } from '../run-tests';

jest.mock('insomnia-testing');

describe('runInsomniaTests()', () => {
  // make flow happy
  const mock = (mockFn: any) => mockFn;
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const base: RunTestsOptions = {
    reporter: TestReporterEnum.spec,
  };

  it('should should not generate if type arg is invalid', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await runInsomniaTests(({ reporter: 'invalid' }: Object));

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
      sendRequest: expect.any(Function),
    };
    await runInsomniaTests(options);

    expect(insomniaTesting.runTestsCli).toHaveBeenCalledWith(contents, options);
  });

  it('should return false if test results have any failures', async function() {
    mock(insomniaTesting.runTestsCli).mockResolvedValue(false);

    const result = await runInsomniaTests(base);

    expect(result).toBe(false);
  });

  it('should return true if test results have no failures', async function() {
    mock(insomniaTesting.runTestsCli).mockResolvedValue(true);

    const result = await runInsomniaTests(base);

    expect(result).toBe(true);
  });
});
