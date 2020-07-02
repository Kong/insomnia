// @flow
import commander from 'commander';
import { getAllOptions, exit, logErrorExit1 } from '../util';

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

describe('exit()', () => {
  it('should exit 0 if successful result', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    await exit(new Promise(resolve => resolve(true)));

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should exit 1 if unsuccessful result', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    await exit(new Promise(resolve => resolve(false)));

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit 1 and print to console and if rejected', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const error = new Error('message');
    await exit(new Promise((resolve, reject) => reject(error)));

    expect(errorSpy).toHaveBeenCalledWith(error);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe('logErrorExit1()', () => {
  it('should exit 1 and print error to console', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const error = new Error('message');
    await logErrorExit1(error);

    expect(errorSpy).toHaveBeenCalledWith(error);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
