// @flow
import commander from 'commander';
import { extractCommandOptions, loadCosmiConfig } from '../get-options';
import path from 'path';

jest.unmock('cosmiconfig');

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
  const fixturesDir = path.join(process.cwd(), 'src', '__fixtures__');

  it.each([undefined, '.insorc.yaml'])(
    'should load .insorc.yaml config file in fixtures dir',
    file => {
      const result = loadCosmiConfig(fixturesDir, file);

      expect(result).toEqual({
        __configFile: {
          settings: { ci: true },
          scripts: { lint: 'lint spec' },
          filePath: path.join(fixturesDir, '.insorc.yaml'),
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

  it('should return empty object if config file is blank', () => {
    const result = loadCosmiConfig(fixturesDir, '.insorc-blank.yaml');
    expect(result).toEqual({});
  });
});
