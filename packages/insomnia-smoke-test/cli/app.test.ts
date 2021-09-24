import { isNonGlibcLinux } from 'detect-libc';
import execa from 'execa';
import { getBinPathSync } from 'get-bin-path';
import { platform } from 'os';
import { resolve } from 'path';

const isAlpineLinux = () => {
  const nodePlatform = platform();
  if (nodePlatform !== 'linux') {
    return false;
  }

  return isNonGlibcLinux;
};

/** the `pkg` npm has its own platforms that it appends on the end of binaries which are similar but different to NodeJS */
const getPkgPlatform = () => {
  const nodePlatform = platform();

  switch (nodePlatform) {
    case 'darwin':
      return 'macos';

    case 'win32':
      return 'win';

    case 'linux':
      if (isAlpineLinux()) {
        return 'alpine';
      }
      return 'linux';

    default:
      throw new Error(`you are running smoke tests on an unsupported platform: ${nodePlatform}`);
  }
};

describe('run test', () => {
  const npmPackage = getBinPathSync({ cwd: '../insomnia-inso' });
  const singleExecutable = resolve(`../insomnia-inso/binaries/insomnia-inso-${getPkgPlatform()}`);

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
