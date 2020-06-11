// @flow
import commander from 'commander';

function createCommand(cmd: string | null, exitOverride?: boolean) {
  const command = new commander.Command(cmd)
    .storeOptionsAsProperties(false)
    .passCommandToAction(false);

  if (exitOverride) {
    return command.exitOverride();
  }

  return command;
}

export default {
  createCommand,
};
