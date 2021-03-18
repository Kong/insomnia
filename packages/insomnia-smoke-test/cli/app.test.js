import execa from 'execa';
import { getBinPathSync } from 'get-bin-path';

describe('run test', () => {
  it('can run unit test', () => {
    const command = 'run test -a fixtures/inso-nedb TestSuite -e Dev';

    const { failed } = execa.sync(getBinPathSync({ cwd: '../insomnia-inso' }), command.split(' '));

    expect(failed).toBe(false);
  });
});
