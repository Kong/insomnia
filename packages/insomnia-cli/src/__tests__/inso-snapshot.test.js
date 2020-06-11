// @flow
import execa from 'execa-wrap';
import * as packageJson from '../../package.json';

// MAKE SURE YOU BUILD THE PROJECT BEFORE RUNNING THESE TESTS.
// These tests use the executable /bin/inso, which relies on /dist.
describe('bin/inso snapshots', () => {
  const insoSnapshot = async (args): Promise<void> =>
    expect(
      await execa(
        'bin/inso',
        args
          .split(' ')
          .map(t => t.trim())
          .filter(t => t),
      ),
    ).toMatchSnapshot();

  describe('base', () => {
    it.each(['-h', '--help', 'help', 'generate -h', 'generate config -h'])(
      'shows help page with "%s"',
      async args => await insoSnapshot(args),
    );

    it.each(['-v', '--version'])('should print version from package.json - "%s"', async arg =>
      expect(await execa('bin/inso', [arg], { filter: ['stdout'] })).toContain(packageJson.version),
    );
  });

  describe('generate config', () => {
    it('should error when required --type option is missing', async () =>
      await insoSnapshot('generate config'));

    it('should error when filePath is missing', async () =>
      await insoSnapshot('generate config -t declarative'));
  });
});
