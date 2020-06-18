// @flow
import commander from 'commander';
import { getAllOptions } from '../util';

describe('getAllOptions()', () => {
  it('should combine options from all commands into one object', () => {
    const command = new commander.Command('command');

    command
      .command('subCommand')
      .option('-s, --subCmd')
      .action(cmd => {
        expect(getAllOptions(cmd)).toEqual({
          global: true,
          subCmd: true,
        });
      });

    const parent = new commander.Command().option('-g, --global').addCommand(command);

    parent.parse('node test command subCommand --global --subCmd'.split(' '));
  });
});
