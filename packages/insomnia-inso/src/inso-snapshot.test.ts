import { describe, expect, it } from '@jest/globals';
import execa from 'execa';
import path from 'path';

// MAKE SURE YOU BUILD THE PROJECT BEFORE RUNNING THESE TESTS.
// npm run build -w insomnia-inso
// npm run serve -w insomnia-smoke-test
// These tests use the executable /bin/inso, which relies on /dist.
describe('Help snapshots', () => {
  it.each([
    '-h',
    '--help',
    'help',
    'generate -h',
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

describe('Run Collection Snapshots', () => {
  it.each([
    'run collection -w ../../packages/insomnia-smoke-test/fixtures/simple.yaml --verbose -e env_2eecf85b7f wrk_0702a5 --requestNamePattern http',
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
