import { describe, expect, it } from '@jest/globals';
import execa from 'execa';
import path from 'path';

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
    'export -h',
    'export spec -h',
  ])(
    '"inso %s"',
    async args => {
      const binPath = path.resolve('../insomnia-inso/bin/inso');
      if (binPath === undefined) {
        throw new Error('unable to get binary path');
      }

      const { stdout } = await execa(binPath, args.split(' '));
      expect(stdout).toMatchSnapshot();
    },
    30000,
  );
});
