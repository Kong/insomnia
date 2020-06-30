// @flow
import execa from 'execa';
import { getBinPathSync } from 'get-bin-path';
import * as packageJson from '../../package.json';

// MAKE SURE YOU BUILD THE PROJECT BEFORE RUNNING THESE TESTS.
// These tests use the executable /bin/inso, which relies on /dist.

describe('Snapshot for', () => {
  it.each([
    '-h',
    '--help',
    'help',
    'generate -h',
    'generate config -h',
    'run -h',
    'run test -h',
    'lint -h',
    'lint spec -h',
  ])(
    '"inso %s"',
    async args => {
      const { stdout } = await execa(getBinPathSync(), args.split(' '));
      expect(stdout).toMatchSnapshot();
    },
    30000,
  );
});

describe('Inso version', () => {
  it.each(['-v', '--version'])(
    'inso %s should print version from package.json',
    async args => {
      const { stdout } = await execa(getBinPathSync(), args.split(' '));
      expect(stdout).toBe(packageJson.version);
    },
    30000,
  );
});
