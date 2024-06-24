import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MockedFunction } from 'jest-mock';
import { parseArgsStringToArgv } from 'string-argv';

import * as packageJson from '../package.json';
import * as cli from './cli';
import { exportSpecification as _exportSpecification } from './commands/export-specification';
import { lintSpecification as _lintSpecification } from './commands/lint-specification';
import { runInsomniaTests as _runInsomniaTests } from './commands/run-tests';
import { globalBeforeAll, globalBeforeEach } from './jest/before';
import { logger } from './logger';
import { exit as _exit } from './util';

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

const lintSpecification = _lintSpecification as MockedFunction<typeof _lintSpecification>;
const runInsomniaTests = _runInsomniaTests as MockedFunction<typeof _runInsomniaTests>;
const exportSpecification = _exportSpecification as MockedFunction<typeof _exportSpecification>;
const exit = _exit as MockedFunction<typeof _exit>;

describe('cli', () => {
  beforeAll(() => {
    globalBeforeAll();
  });

  let inso = initInso();

  beforeEach(() => {
    globalBeforeEach();
    inso = initInso();
    jest.spyOn(console, 'error').mockImplementation(() => { });
    lintSpecification.mockResolvedValue(true);
    runInsomniaTests.mockResolvedValue(true);
    exportSpecification.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('global options', () => {
    it.each(['-v', '--version'])('inso %s should print version from package.json', args => {
      logger.wrapAll();
      expect(() => inso(args)).toThrowError(packageJson.version);
      logger.restoreAll();
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
      inso('lint spec file.yaml -w dir1 --src src --ci');
      expect(lintSpecification).toHaveBeenCalledWith('file.yaml', {
        workingDir: 'dir1',
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
      inso('run test uts_123 -w dir1 --src src --ci');
      expect(runInsomniaTests).toHaveBeenCalledWith(
        'uts_123',
        expect.objectContaining({
          workingDir: 'dir1',
          src: 'src',
          ci: true,
        }),
      );
    });
  });

  describe('export spec', () => {
    it('should call exportSpec with no arg', () => {
      inso('export spec');
      expect(exportSpecification).toHaveBeenCalledWith(undefined,
        { skipAnnotations: false });
    });

    it('should call exportSpec with all expected arguments', () => {
      inso('export spec spc_123 -o output.yaml -s');
      expect(exportSpecification).toHaveBeenCalledWith('spc_123', {
        output: 'output.yaml', skipAnnotations: true,
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

    it('should warn if script task does not start with inso', async () => {
      inso('invalid-script', insorcFilePath);

      const logs = logger.__getLogs();

      expect(logs.fatal).toContain('Tasks in a script should start with `inso`.');
      await expectExitWith(false);
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
