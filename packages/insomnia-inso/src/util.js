// @flow
import commander from 'commander';
import * as packageJson from '../package.json';

export type GlobalOptions = {
  appDataDir?: string,
  workingDir?: string,
  ci?: boolean,
};

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

export function logErrorExit1(err: Error) {
  console.error(err);

  process.exit(1);
}

export async function exit(result: Promise<boolean>): Promise<void> {
  return result.then(r => process.exit(r ? 0 : 1)).catch(logErrorExit1);
}

export function getDefaultAppDataDir(): string {
  const dir = process.env.DEFAULT_APP_DATA_DIR;

  if (!dir) {
    throw new Error('Environment variable DEFAULT_APP_DATA_DIR is not set.');
  }

  return dir;
}
