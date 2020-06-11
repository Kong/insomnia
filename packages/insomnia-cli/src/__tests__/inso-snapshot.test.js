// @flow
import execa from 'execa';
import { getBinPathSync } from 'get-bin-path';

// MAKE SURE YOU BUILD THE PROJECT BEFORE RUNNING THESE TESTS.
// These tests use the executable /bin/inso, which relies on /dist.

describe('Snapshot for', () => {
  it.each(['-h', '--help', 'help', 'generate -h', 'generate config -h'])(
    '"inso %s"',
    async args => {
      const { stdout } = await execa.node(getBinPathSync(), args.split(' '));
      expect(stdout).toMatchSnapshot();
    },
  );
});
