// @flow

import insomniaTesting from 'insomnia-testing';
import { runInsomniaTests, TestReporterEnum } from '../run-tests';
import fs from 'fs';
import os from 'os';
import path from 'path';
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

  it('should generate and delete temporary test file', async () => {
    await runInsomniaTests(base);

    // RegExp catering for both Windows and Mac :(
    const pathRegex = /\/|\\tmpDir\/|\\insomnia-cli\/|\\0\.\d+\.test\.js/;
    expect(fs.promises.mkdir).toHaveBeenCalledWith(path.normalize('/tmpDir/insomnia-cli'), {
      recursive: true,
    });

    expect(insomniaTesting.generateToFile).toHaveBeenCalledWith(
      expect.stringMatching(pathRegex),
      expect.anything(),
    );
    expect(insomniaTesting.runTestsCli).toHaveBeenCalledWith(
      expect.stringMatching(pathRegex),
      base,
    );

    expect(fs.promises.unlink).toHaveBeenCalledWith(expect.stringMatching(pathRegex));
  });

  it('should keep the generated test file', async function() {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await runInsomniaTests({ ...base, keepFile: true });

    const pathRegex = /\/tmpDir\/insomnia-cli\/0.\d+.test.js/;
    expect(fs.promises.unlink).not.toHaveBeenCalledWith(expect.stringMatching(pathRegex));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test file at'));
  });

  it('should forward options to insomnia-testing', async () => {
    const options = { ...base, reporter: 'min', bail: true };
    await runInsomniaTests(options);

    expect(insomniaTesting.runTestsCli).toHaveBeenCalledWith(
      expect.stringContaining('.test.js'),
      options,
    );
  });

  it('should return false if test results have any failures', async function() {
    mock(insomniaTesting.runTests).mockResolvedValue({ stats: { failures: 2 } });

    const result = await runInsomniaTests(base);

    expect(result).toBe(false);
  });

  it('should return true if test results have no failures', async function() {
    mock(insomniaTesting.runTests).mockResolvedValue({ stats: { failures: 0 } });

    const result = await runInsomniaTests(base);

    expect(result).toBe(true);
  });
});
