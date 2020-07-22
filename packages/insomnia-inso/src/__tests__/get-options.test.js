// @flow
import commander from 'commander';
import { extractCommandOptions, loadCosmiConfig } from '../get-options';

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
  it('should call search if config file is not defined', () => {
    const result = loadCosmiConfig('.', 'test');
    // expect(cosmiconfig().loadSync).toHaveBeenCalledTimes(1);
    expect(result).toEqual({});
  });
});
