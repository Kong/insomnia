import path from 'path';
import { spawn } from 'child_process';
import { app } from 'electron';

function run(args, done) {
  const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
  spawn(updateExe, args, {
    detached: true,
  }).on('close', done);
}

function check() {
  if (process.platform === 'win32') {
    const cmd = process.argv[1];
    console.log('processing squirrel command `%s`', cmd);
    const target = path.basename(process.execPath);

    if (cmd === '--squirrel-install') {
      run(['--createShortcut=' + target + ''], app.quit);
      return true;
    }

    if (cmd === '--squirrel-updated') {
      app.quit();
      return true;
    }

    if (cmd === '--squirrel-uninstall') {
      run(['--removeShortcut=' + target + ''], app.quit);
      return true;
    }

    if (cmd === '--squirrel-obsolete') {
      app.quit();
      return true;
    }
  }
  return false;
}

module.exports = check();
