// @flow
import commander from 'commander';
import * as packageJson from '../package.json';

export type GlobalOptions<T> = {|
  workingDir?: string,
  ...T,
|};

export function createCommand(exitOverride: boolean, cmd?: string) {
  const command = new commander.Command(cmd).storeOptionsAsProperties(false);

  // TODO: can probably remove this
  if (exitOverride) {
    return command.exitOverride();
  }

  return command;
}

export function getVersion() {
  return packageJson.version;
}

export function getAllOptions<T>(cmd: Object): T {
  let opts = {};
  let command = cmd;

  do {
    // overwrite options with more specific ones
    opts = { ...command.opts(), ...opts };
    command = command.parent;
  } while (command);

  return opts;
}

export function exit(result: boolean) {
  process.exit(result ? 1 : 0);
}

export function logErrorExit1(err: Error) {
  console.error(err);

  process.exit(1);
}
