// @flow
import commander from 'commander';
import getOptions, { extractCommandOptions, loadCosmiConfig } from '../get-options';
import path from 'path';

jest.unmock('cosmiconfig');

const fixturesDir = path.join('src', '__fixtures__');

describe('extractCommandOptions()', () => {
  it('should combine options from all commands into one object', () => {
    const command = new commander.Command('command').exitOverride();

    command
      .command('subCommand')
      .option('-s, --subCmd')
      .action(cmd => {
        expect(extractCommandOptions(cmd)).toEqual({
          global: true,
          subCmd: true,
        });
      });

    const parent = new commander.Command()
      .exitOverride()
      .option('-g, --global')
      .addCommand(command);

    parent.parse('command subCommand --global --subCmd'.split(' '), { from: 'user' });
  });
});

describe('loadCosmiConfig()', () => {
  it.each([undefined, '.insorc.yaml'])(
    'should load .insorc.yaml config file in fixtures dir',
    file => {
      const result = loadCosmiConfig(fixturesDir, file);

      expect(result).toEqual({
        __configFile: {
          settings: { duplicate: 'configFile', fromConfig: 'configFile' },
          scripts: { lint: 'lint spec' },
          filePath: path.resolve(fixturesDir, '.insorc.yaml'),
        },
      });
    },
  );

  it('should return empty object and report error if specified config file not found', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = loadCosmiConfig(fixturesDir, 'other.yaml');

    expect(result).toEqual({});
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should return empty object and not report error if no config file not found during search', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = loadCosmiConfig('.');

    expect(result).toEqual({});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should return empty object if config file is blank', () => {
    const result = loadCosmiConfig(fixturesDir, '.insorc-blank.yaml');
    expect(result).toEqual({});
  });

  it('should return blank properties and ignore extra items if settings and scripts not found in file', () => {
    const result = loadCosmiConfig(fixturesDir, '.insorc-missing-properties.yaml');
    expect(result).toEqual({
      __configFile: {
        settings: {},
        scripts: {},
        filePath: path.resolve(fixturesDir, '.insorc-missing-properties.yaml'),
      },
    });
  });
});

describe('getOptions', () => {
  it('should load default options', () => {
    const commandOptions = { opts: () => ({}) };
    const defaultOptions = { duplicate: 'default' };

    const result = getOptions(commandOptions, defaultOptions);

    expect(result).toEqual({ duplicate: 'default' });
  });

  it('should combine default options with command options, favouring command', () => {
    const commandOptions = { opts: () => ({ duplicate: 'command' }) };
    const defaultOptions = { duplicate: 'default', fromDefault: 'default' };

    const result = getOptions(commandOptions, defaultOptions);

    expect(result).toEqual({ duplicate: 'command', fromDefault: 'default' });
  });

  it.each([undefined, '.insorc.yaml'])(
    'should favour command options over config file over default',
    file => {
      // Will also load src/__fixtures__/.insorc.yaml
      const commandOptions = {
        opts: () => ({
          duplicate: 'command',
          fromCommand: 'command',
          workingDir: fixturesDir,
          config: file,
        }),
      };
      const defaultOptions = { duplicate: 'default', fromDefault: 'default' };

      const result = getOptions(commandOptions, defaultOptions);

      expect(result).toEqual({
        duplicate: 'command',
        fromCommand: 'command',
        fromDefault: 'default',
        fromConfig: 'configFile',
        workingDir: fixturesDir,
        config: file,
        __configFile: {
          settings: { duplicate: 'configFile', fromConfig: 'configFile' },
          scripts: { lint: 'lint spec' },
          filePath: path.resolve(fixturesDir, '.insorc.yaml'),
        },
      });
    },
  );
});
