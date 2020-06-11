// @flow
import * as cli from '../cli';
import { generateConfig } from '../commands/generate';

jest.mock('../commands/generate');

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
  });

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
