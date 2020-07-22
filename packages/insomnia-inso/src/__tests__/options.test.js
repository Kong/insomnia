// @flow
import commander from 'commander';
import loadOptions from '../load-options';

describe('loadOptions()', () => {
  it('should combine options from all commands into one object', () => {
    const command = new commander.Command('command').exitOverride();

    command
      .command('subCommand')
      .option('-s, --subCmd')
      .action(cmd => {
        expect(loadOptions(cmd)).toEqual({
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
