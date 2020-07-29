// @flow
import * as cli from '../cli';
import { generateConfig } from '../commands/generate-config';
import { lintSpecification } from '../commands/lint-specification';
import { runInsomniaTests } from '../commands/run-tests';
import { exportSpecification } from '../commands/export-specification';
import { parseArgsStringToArgv } from 'string-argv';
import * as packageJson from '../../package.json';

jest.mock('../commands/generate-config');
jest.mock('../commands/lint-specification');
jest.mock('../commands/run-tests');
jest.mock('../commands/export-specification');
jest.unmock('cosmiconfig');

const initInso = () => {
  return (...args: Array<string>): void => {
    const cliArgs = parseArgsStringToArgv(`node test ${args.join(' ')}`);

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

    it.each(['-v', '--version'])('inso %s should print version from package.json', args => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      expect(() => inso(args)).toThrowError(packageJson.version);
    });

    it.each(['-v', '--version'])('inso %s should print "dev" if running in development', args => {
      const oldNodeEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';
      expect(() => inso(args)).toThrowError('dev');

      process.env.NODE_ENV = oldNodeEnv;
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
      inso('run test uts_123 -e env_123 -t name -r min -b --keepFile');
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

  describe('export spec', () => {
    it('should call exportSpec with no arg', () => {
      inso('export spec');
      expect(exportSpecification).toHaveBeenCalledWith(undefined, {});
    });

    it('should call exportSpec with all expected arguments', () => {
      inso('export spec spc_123 -o output.yaml');
      expect(exportSpecification).toHaveBeenCalledWith('spc_123', { output: 'output.yaml' });
    });

    it('should call generateConfig with global options', () => {
      inso('export spec spc_123 -w testing/dir');
      expect(exportSpecification).toHaveBeenCalledWith(
        'spc_123',
        expect.objectContaining({
          workingDir: 'testing/dir',
        }),
      );
    });
  });

  describe('script', () => {
    let consoleLogSpy;
    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    const insorcFilePath = '--config src/__fixtures__/.insorc-with-scripts.yaml';

    it('should call script command by default', () => {
      inso('gen-conf', insorcFilePath);

      expect(generateConfig).toHaveBeenCalledWith(
        'Designer Demo',
        expect.objectContaining({ type: 'declarative' }),
      );
    });

    it('should call script command', () => {
      inso('script gen-conf', insorcFilePath);

      expect(generateConfig).toHaveBeenCalledWith(
        'Designer Demo',
        expect.objectContaining({ type: 'declarative' }),
      );
    });

    it('should warn if script task does not start with inso', () => {
      inso('invalid-script', insorcFilePath);

      expect(consoleLogSpy).toHaveBeenCalledWith("Tasks in the script should start with 'inso'.");
      expect(generateConfig).not.toHaveBeenCalledWith();
    });

    it('should call nested command', () => {
      inso('gen-conf:k8s', insorcFilePath);

      expect(generateConfig).toHaveBeenCalledWith(
        'Designer Demo',
        expect.objectContaining({ type: 'kubernetes' }),
      );

      expect(consoleLogSpy).toHaveBeenNthCalledWith(1, '>> inso gen-conf --type kubernetes');
      expect(consoleLogSpy).toHaveBeenNthCalledWith(
        2,
        '>> inso generate config Designer Demo --type declarative --type kubernetes',
      );
    });

    it('should call nested command and pass through props', () => {
      inso('gen-conf:k8s --type declarative', insorcFilePath);

      expect(generateConfig).toHaveBeenCalledWith(
        'Designer Demo',
        expect.objectContaining({ type: 'declarative' }),
      );
    });

    it('should override env setting from command', () => {
      inso('test:200s --env NewEnv', insorcFilePath);

      expect(runInsomniaTests).toHaveBeenCalledWith(
        'Designer Demo',
        expect.objectContaining({
          env: 'NewEnv',
        }),
      );
    });

    it('should fail if script not found', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      inso('not-found-script', insorcFilePath);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Could not find inso script "not-found-script" in the config file.',
      );
    });
  });
});
