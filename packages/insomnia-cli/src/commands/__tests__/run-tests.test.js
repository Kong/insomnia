// @flow

import insomniaTesting from 'insomnia-testing';
import { runInsomniaTests } from '../run-tests';
import fs from 'fs';
import os from 'os';

jest.mock('insomnia-testing');
jest.mock('os');
jest.mock('console');

describe('runInsomniaTests()', () => {
  // make flow happy
  const mock = (mockFn: any) => mockFn;
  beforeEach(() => {
    mock(os.tmpdir).mockReturnValue('/tmpDir');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should should not generate if type arg is invalid', async function() {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await runInsomniaTests(({ reporter: 'invalid' }: Object));

    expect(insomniaTesting.runTests).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Reporter "invalid" not unrecognized. Options are [dot, list, spec, min, progress].',
    );
  });

  it('should generate and delete temporary test file', async function() {
    // Mock test generation
    const contents = 'generated test contents';
    mock(insomniaTesting.generate).mockReturnValue(contents);

    const writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

    await runInsomniaTests({});

    const pathRegex = /\/tmpDir\/0.\d+.test.js/;
    expect(writeFileSpy).toHaveBeenCalledWith(expect.stringMatching(pathRegex), contents);

    expect(insomniaTesting.runTests).toHaveBeenCalledWith(expect.stringMatching(pathRegex), {});

    expect(unlinkSpy).toHaveBeenCalledWith(expect.stringMatching(pathRegex));
  });

  it('should forward options to insomnia-testing', async function() {
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

    const contents = 'generated test contents';
    mock(insomniaTesting.generate).mockResolvedValue(contents);

    const options = { reporter: 'min', bail: true };
    await runInsomniaTests(options);

    expect(insomniaTesting.runTests).toHaveBeenCalledWith(
      expect.stringContaining('.test.js'),
      options,
    );
  });
});
