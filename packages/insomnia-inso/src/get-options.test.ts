import commander from 'commander';
import { getOptions, extractCommandOptions, loadCosmiConfig } from './get-options';
import path from 'path';
import { noop } from './util';

jest.unmock('cosmiconfig');

const fixturesDir = path.join('src', 'fixtures');

describe('extractCommandOptions()', () => {
  it('should combine options from all commands into one object', () => {
    const command = new commander.Command('command').exitOverride();
    command
      .command('subCommand')
      .option('-s, --subCmd')
      .action((cmd) => {
        expect(extractCommandOptions(cmd)).toEqual({
          global: true,
          subCmd: true,
        });
      });
    const parent = new commander.Command()
      .exitOverride()
      .option('-g, --global')
      .addCommand(command);
    parent.parse('self inso command subCommand --global --subCmd'.split(' '));
  });
});

describe('loadCosmiConfig()', () => {
  it('should load .insorc.yaml config file in fixtures dir', () => {
    const result = loadCosmiConfig(path.join(fixturesDir, '.insorc.yaml'));
    expect(result).toEqual({
      __configFile: {
        options: {
          appDataDir: 'configFile',
          workingDir: 'workingDir',
          ci: true,
        },
        scripts: {
          lint: 'inso lint spec',
        },
        filePath: path.resolve(fixturesDir, '.insorc.yaml'),
      },
    });
    expect(result.__configFile?.options?.shouldBeIgnored).toBe(undefined);
  });

  it('should return empty object and report error if specified config file not found', () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(noop);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(noop);
    const result = loadCosmiConfig('not-found.yaml');
    expect(result).toEqual({});
    expect(consoleLogSpy).toHaveBeenCalledWith('Could not find config file at not-found.yaml.');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should return empty object if config file is blank', () => {
    const result = loadCosmiConfig(path.join(fixturesDir, '.insorc-blank.yaml'));
    expect(result).toEqual({});
  });

  it('should return blank properties and ignore extra items if settings and scripts not found in file', () => {
    const result = loadCosmiConfig(path.join(fixturesDir, '.insorc-missing-properties.yaml'));
    expect(result).toEqual({
      __configFile: {
        options: {},
        scripts: {},
        filePath: path.resolve(fixturesDir, '.insorc-missing-properties.yaml'),
      },
    });
  });
});

describe('getOptions', () => {
  it('should load default options', () => {
    const commandOptions = {
      opts: () => ({}),
    };
    const defaultOptions = {
      appDataDir: 'default',
    };
    const result = getOptions(commandOptions, defaultOptions);
    expect(result).toEqual({
      appDataDir: 'default',
    });
  });

  it('should combine default options with command options, favouring command', () => {
    const commandOptions = {
      opts: () => ({
        appDataDir: 'command',
      }),
    };
    const defaultOptions = {
      appDataDir: 'default',
      anotherDefault: '0',
    };
    const result = getOptions(commandOptions, defaultOptions);
    expect(result).toEqual({
      appDataDir: 'command',
      anotherDefault: '0',
    });
  });

  it('should combine config file options with default options, favouring config file', () => {
    // Will also load src/fixtures/.insorc.yaml
    const commandOptions = {
      opts: () => ({
        config: path.join(fixturesDir, '.insorc.yaml'),
      }),
    };
    const defaultOptions = {
      appDataDir: 'default',
      anotherDefault: '0',
    };
    const result = getOptions(commandOptions, defaultOptions);
    expect(result).toEqual({
      appDataDir: 'configFile',
      workingDir: 'workingDir',
      ci: true,
      anotherDefault: '0',
      config: path.join(fixturesDir, '.insorc.yaml'),
      __configFile: {
        options: {
          appDataDir: 'configFile',
          workingDir: 'workingDir',
          ci: true,
        },
        scripts: {
          lint: 'inso lint spec',
        },
        filePath: path.resolve(fixturesDir, '.insorc.yaml'),
      },
    });
  });

  it('should print error to console if config file not found', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(noop);
    const errSpy = jest.spyOn(console, 'error').mockImplementation(noop);
    const configFilePath = path.join(fixturesDir, '.insorc-not-found.yaml');
    // Will also load src/fixtures/.insorc.yaml
    const commandOptions = {
      opts: () => ({
        config: configFilePath,
      }),
    };
    const defaultOptions = {
      appDataDir: 'default',
      anotherDefault: '0',
    };
    const result = getOptions(commandOptions, defaultOptions);
    expect(result).toEqual({
      appDataDir: 'default',
      anotherDefault: '0',
      config: configFilePath,
    });
    expect(logSpy).toHaveBeenCalledWith(`Could not find config file at ${configFilePath}.`);
    expect(errSpy).toHaveBeenCalled();
  });
});
