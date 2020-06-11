// @flow
import execa from 'execa-wrap';

// MAKE SURE YOU BUILD THE PROJECT BEFORE RUNNING THESE TESTS.
// These tests use the executable /bin/inso, which relies on /dist.
describe('bin/inso snapshots', () => {
  describe('base', () => {
    it.each([
      '-h',
      '--help',
      'help',
      'generate -h',
      'generate config -h',
    ])('shows help page with "%s"', async args =>
      expect(await execa('bin/inso', args.split(' '))).toMatchSnapshot(),
    );
  });
});
