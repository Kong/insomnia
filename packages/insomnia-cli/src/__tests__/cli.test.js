// @flow
import * as cli from '../cli';
import { generateConfig } from '../commands/generate';
import * as packageJson from '../../package.json';
import execa from 'execa-wrap';

jest.mock('../commands/generate');
const originalError = console.error;

const initInso = () => {
  return (args): void => {
    const cliArgs = `node test ${args}`
      .split(' ')
      .map(t => t.trim())
      .filter(t => t);

    // console.log('calling cli.go with: %o', cliArgs);
    return cli.go(cliArgs, true);
  };
};

describe('cli', () => {
  let inso = initInso();
  beforeEach(() => {
    inso = initInso();
    (console: any).error = jest.fn();
  });

  afterEach(() => {
    (console: any).error = originalError;
  });

  it.each(['-v', '--version'])('should print version from package.json - "%s"', async arg =>
    expect(await execa('bin/inso', [arg], { filter: ['stdout'] })).toContain(packageJson.version),
  );

  it('should error when required --type option is missing', () =>
    expect(() => inso('generate config file.yaml')).toThrowError());

  it('should error when filePath is missing', () =>
    expect(() => inso('generate config -t declarative')).toThrowError());

  it('should call generateConfig with undefined output argument', () => {
    inso('generate config -t declarative file.yaml');
    expect(generateConfig).toHaveBeenCalledWith({
      filePath: 'file.yaml',
      type: 'declarative',
      output: undefined,
    });
  });

  it('should call generateConfig with all expected arguments', () => {
    inso('generate config -t kubernetes -o output.yaml file.yaml');
    expect(generateConfig).toHaveBeenCalledWith({
      filePath: 'file.yaml',
      type: 'kubernetes',
      output: 'output.yaml',
    });
  });
});
