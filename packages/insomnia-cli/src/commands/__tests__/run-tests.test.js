// @flow

import insomniaTesting from 'insomnia-testing';
import { runInsomniaTests, TestReporterEnum } from '../run-tests';
import os from 'os';
import type { RunTestsOptions } from '../run-tests';

jest.mock('insomnia-testing');
jest.mock('os');
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    unlink: jest.fn(),
  },
}));

describe('runInsomniaTests()', () => {
  // make flow happy
  const mock = (mockFn: any) => mockFn;
  beforeEach(() => {
    mock(os.tmpdir).mockReturnValue('/tmpDir');
  });

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

    const options = { ...base, reporter: 'min', bail: true, keepFile: false };
    await runInsomniaTests(options);

    expect(insomniaTesting.runTestsCli).toHaveBeenCalledWith(contents, options);
  });

  it('should return false if test results have any failures', async function() {
    mock(insomniaTesting.runTests).mockResolvedValue(false);

    const result = await runInsomniaTests(base);

    expect(result).toBe(false);
  });

  it('should return true if test results have no failures', async function() {
    mock(insomniaTesting.runTests).mockResolvedValue(true);

    const result = await runInsomniaTests(base);

    expect(result).toBe(true);
  });
});
