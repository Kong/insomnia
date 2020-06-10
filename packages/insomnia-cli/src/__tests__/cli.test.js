import * as cli from '../cli';
import execa from 'execa-wrap';
import * as packageJson from '../../package.json';

const initInso = () => {
  return args => {
    const cliArgs = `node test ${args}`.split(' ');
    // console.log('calling cli.go with: %o', cliArgs);
    return cli.go(cliArgs);
  };
};

const insoSnapshot = async args =>
  expect(await execa('bin/inso', args.split(' '))).toMatchSnapshot();

describe('inso', () => {
  it.each(['-h', '--help', 'help', 'generate -h', 'generate config -h'])(
    'shows help page with "%s"',
    async args => {
      await insoSnapshot(args);
    },
  );

  it('should print version from package.json', async () => {
    expect(await execa('bin/inso', ['-v'], { filter: ['stdout'] })).toContain(packageJson.version);
  });

  describe('generate config', () => {
    it('should error when required --type option is missing', async () => {
      await insoSnapshot('generate config');
    });

    it('should error when filePath is missing', async () => {
      await insoSnapshot('generate config -t declarative');
    });
  });
});
