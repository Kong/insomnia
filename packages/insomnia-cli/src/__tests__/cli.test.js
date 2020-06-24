// @flow
import * as cli from '../cli';
import { generateConfig } from '../commands/generate-config';

jest.mock('../commands/generate-config');

const initInso = () => {
  return (args: string): void => {
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
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation(() => {});
    (generateConfig: any).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should error when required --type option is missing', () =>
    expect(() => inso('generate config file.yaml')).toThrowError());

  it('should error when filePath is missing', () =>
    expect(() => inso('generate config -t declarative')).toThrowError());

  it('should call generateConfig with undefined output argument', () => {
    inso('generate config -t declarative file.yaml');
    expect(generateConfig).toHaveBeenCalledWith('file.yaml', {
      type: 'declarative',
    });
  });

  it('should call generateConfig with all expected arguments', () => {
    inso('generate config -t kubernetes -o output.yaml file.yaml');
    expect(generateConfig).toHaveBeenCalledWith(
      'file.yaml',
      expect.objectContaining({
        type: 'kubernetes',
        output: 'output.yaml',
      }),
    );
  });

  it('should call generateConfig with global option', () => {
    inso('generate config -t kubernetes --working-dir testing/dir file.yaml');
    expect(generateConfig).toHaveBeenCalledWith(
      'file.yaml',
      expect.objectContaining({
        type: 'kubernetes',
        workingDir: 'testing/dir',
      }),
    );
  });
});
