// @flow
import execa from 'execa';
import { getBinPathSync } from 'get-bin-path';
import * as packageJson from '../../package.json';

// MAKE SURE YOU BUILD THE PROJECT BEFORE RUNNING THESE TESTS.
// These tests use the executable /bin/inso, which relies on /dist.
describe('Snapshot for', () => {
  const exec = (args: string): Promise<Object> =>
    execa(getBinPathSync(), args.split(' '), { all: true, stripFinalNewline: true });

  it.each(['-h', '--help', 'help', 'generate -h', 'generate config -h'])('"inso %s"', async args =>
    expect((await exec(args)).all).toMatchSnapshot(),
  );

  it.each(['-v', '--version'])('inso %s should print version from package.json', async args => {
    expect((await exec(args)).all).toBe(packageJson.version);
  });
});
