import { spawn } from 'child_process';
import { app } from 'electron';
import path from 'path';

function run(args: readonly string[] | undefined, done: (...args: any[]) => void) {
  const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
  spawn(updateExe, args, {
    detached: true,
  }).on('close', done);
}

export function checkIfRestartNeeded() {
  if (process.platform !== 'win32') {
    return false;
  }

  const cmd = process.argv[1];
  console.log('processing squirrel command `%s`', cmd);
  const target = path.basename(process.execPath);

  switch (cmd) {
    case '--squirrel-install':
      run(['--createShortcut=' + target + ''], app.quit);
      return true;

    case '--squirrel-uninstall':
      run(['--removeShortcut=' + target + ''], app.quit);
      return true;

    case '--squirrel-updated':
    case '--squirrel-obsolete':
      app.quit();
      return true;

    default:
      return false;
  }
}
