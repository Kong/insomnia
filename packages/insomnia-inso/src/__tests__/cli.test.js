// @flow
import * as cli from '../cli';
import { generateConfig } from '../commands/generate-config';
import { lintSpecification } from '../commands/lint-specification';
import { runInsomniaTests } from '../commands/run-tests';

jest.mock('../commands/generate-config');
jest.mock('../commands/lint-specification');
jest.mock('../commands/run-tests');

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
    (lintSpecification: any).mockResolvedValue(true);
    (runInsomniaTests: any).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('global options', () => {
    it('should throw error if app data dir argument is missing', () => {
      expect(() => inso('-a')).toThrowError();
    });

    it('should throw error if working dir argument is missing', () => {
      expect(() => inso('-w')).toThrowError();
    });
  });

  describe('generate config', () => {
    it('should call generateConfig with no arg and default type', () => {
      inso('generate config');
      expect(generateConfig).toHaveBeenCalledWith(undefined, {
        type: 'declarative',
      });
    });

    it('should throw error if type argument is missing', () => {
      expect(() => inso('generate config -t')).toThrowError();
    });

    it('should throw error if output argument is missing', () => {
      expect(() => inso('generate config -o')).toThrowError();
    });

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

    it('should call generateConfig with global options', () => {
      inso('generate config -t kubernetes -w testing/dir file.yaml');
      expect(generateConfig).toHaveBeenCalledWith(
        'file.yaml',
        expect.objectContaining({
          type: 'kubernetes',
          workingDir: 'testing/dir',
        }),
      );
    });
  });

  describe('lint specification', () => {
    it('should call lintSpecification with no arg', () => {
      inso('lint spec');
      expect(lintSpecification).toHaveBeenCalledWith(undefined, {});
    });

    it('should call lintSpecification with expected options', () => {
      inso('lint spec file.yaml');
      expect(lintSpecification).toHaveBeenCalledWith('file.yaml', {});
    });

    it('should call generateConfig with global options', () => {
      inso('lint spec file.yaml -w dir1 -a dir2 --ci');
      expect(lintSpecification).toHaveBeenCalledWith('file.yaml', {
        workingDir: 'dir1',
        appDataDir: 'dir2',
        ci: true,
      });
    });
  });

  describe('run test', () => {
    it('should call runInsomniaTests with no arg and default reporter', () => {
      inso('run test');
      expect(runInsomniaTests).toHaveBeenCalledWith(undefined, { reporter: 'spec' });
    });

    it('should throw error if env argument is missing', () => {
      expect(() => inso('run test -e')).toThrowError();
    });

    it('should throw error if testNamePattern argument is missing', () => {
      expect(() => inso('run test -t')).toThrowError();
    });

    it('should throw error if reporter argument is missing', () => {
      expect(() => inso('run test -r')).toThrowError();
    });

    it('should call runInsomniaTests with expected options', () => {
      inso('run test uts_123 -e env_123 -t name -r min -b --keep-file');
      expect(runInsomniaTests).toHaveBeenCalledWith('uts_123', {
        reporter: 'min',
        keepFile: true,
        bail: true,
        env: 'env_123',
        testNamePattern: 'name',
      });
    });

    it('should call runInsomniaTests with global options', () => {
      inso('run test uts_123 -w dir1 -a dir2 --ci');
      expect(runInsomniaTests).toHaveBeenCalledWith(
        'uts_123',
        expect.objectContaining({
          workingDir: 'dir1',
          appDataDir: 'dir2',
          ci: true,
        }),
      );
    });
  });
});
