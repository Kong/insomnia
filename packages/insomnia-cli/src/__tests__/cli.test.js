import * as cli from '../cli';
import execa from 'execa-wrap';
import * as packageJson from '../../package.json';
import { generateConfig } from '../commands/generate';
jest.mock('../commands/generate');

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
  let inso = initInso();
  beforeEach(() => {
    inso = initInso();
  });

  it.each(['-h', '--help', 'help', 'generate -h', 'generate config -h'])(
    'shows help page with "%s"',
    async args => {
      await insoSnapshot(args);
    },
  );

  it.each(['-v', '--version'])('should print version from package.json - "%s"', async arg => {
    expect(await execa('bin/inso', [arg], { filter: ['stdout'] })).toContain(packageJson.version);
  });

  describe('generate config', () => {
    it('should error when required --type option is missing', async () => {
      await insoSnapshot('generate config');
    });

    it('should error when filePath is missing', async () => {
      await insoSnapshot('generate config -t declarative');
    });

    it('should call generateConfig', async () => {
      inso('generate config -t declarative file.yaml');
      expect(generateConfig).toHaveBeenCalledWith({
        filePath: 'file.yaml',
        type: 'declarative',
        output: undefined,
      });
    });
  });
});
