// @flow
import commander from 'commander';
import { extractCommandOptions, loadCosmiConfig } from '../get-options';
import { cosmiconfigSync } from 'cosmiconfig';

jest.mock('cosmiconfig');

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
  it('should create cosmiconfig explorer with inso', () => {
    loadCosmiConfig('.');

    expect(cosmiconfigSync).toHaveBeenCalledWith('inso');
  });

  it('should try load defined config file', () => {
    const result = loadCosmiConfig('dir', 'test');

    expect(cosmiconfigSync().load).toHaveBeenCalledWith('dir/test');

    expect(result).toEqual({});
  });
});
