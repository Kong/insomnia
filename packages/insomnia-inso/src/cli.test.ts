import { parseArgsStringToArgv } from 'string-argv';

import * as packageJson from '../package.json';
import * as cli from './cli';
import { exportSpecification as _exportSpecification } from './commands/export-specification';
import { generateConfig as _generateConfig } from './commands/generate-config';
import { lintSpecification as _lintSpecification } from './commands/lint-specification';
import { runInsomniaTests as _runInsomniaTests } from './commands/run-tests';
import { globalBeforeAll, globalBeforeEach } from './jest/before';
import { logger } from './logger';
import { exit as _exit } from './util';

jest.mock('./commands/generate-config');
jest.mock('./commands/lint-specification');
jest.mock('./commands/run-tests');
jest.mock('./commands/export-specification');
jest.unmock('cosmiconfig');
jest.mock('./util');

const initInso = () => {
  return (...args: string[]): void => {
    const cliArgs = parseArgsStringToArgv(`node test ${args.join(' ')}`);
    return cli.go(cliArgs, true);
  };
};

const generateConfig = _generateConfig as jest.MockedFunction<typeof _generateConfig>;
const lintSpecification = _lintSpecification as jest.MockedFunction<typeof _lintSpecification>;
const runInsomniaTests = _runInsomniaTests as jest.MockedFunction<typeof _runInsomniaTests>;
const exportSpecification = _exportSpecification as jest.MockedFunction<typeof _exportSpecification>;
const exit = _exit as jest.MockedFunction<typeof _exit>;

describe('cli', () => {
  beforeAll(() => {
    globalBeforeAll();
  });

  let inso = initInso();

  beforeEach(() => {
    globalBeforeEach();
    inso = initInso();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    generateConfig.mockResolvedValue(true);
    lintSpecification.mockResolvedValue(true);
    runInsomniaTests.mockResolvedValue(true);
    exportSpecification.mockResolvedValue(true);
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
      logger.wrapAll();
      expect(() => inso(args)).toThrowError(packageJson.version);
      logger.restoreAll();
    });

    it('should print options', () => {
      inso('generate config file.yaml -t declarative --printOptions --verbose');

      const logs = logger.__getLogs();

      expect(logs.log?.[0]).toContainEqual({
        type: 'declarative',
        format: 'yaml',
        printOptions: true,
        verbose: true,
      });
    });
  });

  describe('generate config', () => {
    it('should call generateConfig with no arg and default type', () => {
      inso('generate config');
      expect(generateConfig).toHaveBeenCalledWith(undefined, {
        type: 'declarative',
        format: 'yaml',
      });
    });

    it('should throw error if type argument is missing', () => {
      expect(() => inso('generate config -t')).toThrowError();
    });

    it('should throw error if output argument is missing', () => {
      expect(() => inso('generate config -o')).toThrowError();
    });

    it('should throw error if tags argument is missing', () => {
      expect(() => inso('generate config --tags')).toThrowError();
    });

    it('should call generateConfig with undefined output argument', () => {
      inso('generate config -t declarative file.yaml');
      expect(generateConfig).toHaveBeenCalledWith('file.yaml', {
        type: 'declarative',
        format: 'yaml',
      });
    });

    it('should call generateConfig with all expected arguments', () => {
      inso('generate config -t kubernetes -o output.yaml --tags "a,b,c" file.yaml');
      expect(generateConfig).toHaveBeenCalledWith(
        'file.yaml',
        expect.objectContaining({
          type: 'kubernetes',
          output: 'output.yaml',
          tags: 'a,b,c',
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
      inso('lint spec file.yaml -w dir1 -a dir2 --src src --ci');
      expect(lintSpecification).toHaveBeenCalledWith('file.yaml', {
        workingDir: 'dir1',
        appDataDir: 'dir2',
        src: 'src',
        ci: true,
      });
    });
  });

  describe('run test', () => {
    it('should call runInsomniaTests with no arg and default reporter', () => {
      inso('run test');
      expect(runInsomniaTests).toHaveBeenCalledWith(undefined, {
        reporter: 'spec',
      });
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
      inso('run test uts_123 -w dir1 -a dir2 --src src --ci');
      expect(runInsomniaTests).toHaveBeenCalledWith(
        'uts_123',
        expect.objectContaining({
          workingDir: 'dir1',
          appDataDir: 'dir2',
          src: 'src',
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
      expect(exportSpecification).toHaveBeenCalledWith('spc_123', {
        output: 'output.yaml',
      });
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
    const insorcFilePath = '--config src/fixtures/.insorc-with-scripts.yaml';

    const expectExitWith = async (result: boolean): Promise<void> =>
      expect(
        exit.mock.calls[0][0],
      ).resolves.toBe(result);

    it('should call script command by default', () => {
      inso('gen-conf', insorcFilePath);
      expect(generateConfig).toHaveBeenCalledWith(
        'Designer Demo',
        expect.objectContaining({
          type: 'declarative',
        }),
      );
    });

    it('should call script command', () => {
      inso('script gen-conf', insorcFilePath);
      expect(generateConfig).toHaveBeenCalledWith(
        'Designer Demo',
        expect.objectContaining({
          type: 'declarative',
        }),
      );
    });

    it('should warn if script task does not start with inso', async () => {
      inso('invalid-script', insorcFilePath);

      const logs = logger.__getLogs();

      expect(logs.fatal).toContain('Tasks in a script should start with `inso`.');
      expect(generateConfig).not.toHaveBeenCalledWith();
      await expectExitWith(false);
    });

    it('should call nested command', async () => {
      inso('gen-conf:k8s', insorcFilePath);
      expect(generateConfig).toHaveBeenCalledWith(
        'Designer Demo',
        expect.objectContaining({
          type: 'kubernetes',
        }),
      );

      const logs = logger.__getLogs();

      expect(logs.debug).toEqual([
        '>> inso gen-conf --type kubernetes',
        '>> inso generate config Designer Demo --type declarative --type kubernetes',
      ]);
      await expectExitWith(true);
    });

    it('should call nested command and pass through props', async () => {
      inso('gen-conf:k8s --type declarative', insorcFilePath);
      expect(generateConfig).toHaveBeenCalledWith(
        'Designer Demo',
        expect.objectContaining({
          type: 'declarative',
        }),
      );
      await expectExitWith(true);
    });

    it('should override env setting from command', async () => {
      inso('test:200s --env NewEnv', insorcFilePath);
      expect(runInsomniaTests).toHaveBeenCalledWith(
        'Designer Demo',
        expect.objectContaining({
          env: 'NewEnv',
        }),
      );
      await expectExitWith(true);
    });

    it('should fail if script not found', async () => {
      inso('not-found-script', insorcFilePath);

      const logs = logger.__getLogs();

      expect(logs.fatal).toContain(
        'Could not find inso script "not-found-script" in the config file.',
      );
      await expectExitWith(false);
    });
  });
});
