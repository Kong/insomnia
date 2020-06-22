// @flow

import insomniaTesting from 'insomnia-testing';
import { runInsomniaTests } from '../run-tests';

jest.mock('insomnia-testing');

describe('runInsomniaTests()', () => {
  it('should should not generate if type arg is invalid', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await runInsomniaTests(({ reporter: 'invalid' }: Object));

    expect(insomniaTesting.runTests).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Reporter "invalid" not unrecognized. Options are [dot, list, spec, min, progress].',
    );
  });
});
