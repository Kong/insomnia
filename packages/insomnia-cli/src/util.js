// @flow
import commander from 'commander';
import * as packageJson from '../package.json';

export function createCommand(exitOverride: boolean, cmd?: string) {
  const command = new commander.Command(cmd)
    .storeOptionsAsProperties(false)
    .passCommandToAction(false);

  if (exitOverride) {
    return command.exitOverride();
  }

  return command;
}

export function getVersion() {
  return packageJson.version;
}
