import execa from 'execa';
import { getBinPathSync } from 'get-bin-path';
import { resolve } from 'path';

describe('run test', () => {
  const npmPackage = getBinPathSync({ cwd: '../insomnia-inso' });
  const singleExecutable = resolve('../insomnia-inso/binaries/insomnia-inso');

  it.each([
    npmPackage,
    singleExecutable,
  ])('can run unit test with %s', binPath => {
    if (!binPath) {
      fail('The inso executable was not found.  Check if it has moved.');
    }

    const { failed } = execa.sync(binPath, [
      'run',
      '--src', 'fixtures/inso-nedb',
      'test',
      '--env', 'Dev',
      'TestSuite',
    ]);

    expect(failed).toBe(false);
  });
});
