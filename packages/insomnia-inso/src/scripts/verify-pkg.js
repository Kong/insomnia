const spawn = require('child_process').spawn;
const resolve = require('path').resolve;
const basePath = resolve('binaries/inso');
const childProcess = spawn(basePath, ['--help']);
childProcess.stdout.on('data', data => {
  console.log(`stdout: ${data}`);
});
childProcess.stderr.on('data', data => {
  console.log(`stderr: ${data}`);
});
childProcess.on('error', err => {
  console.error(`Error: ${err.message}`);
});
childProcess.on('exit', (code, signal) => {
  if (code !== 0) {
    console.error(`Child process exited with code ${code} and signal ${signal}`);
  } else {
    console.log('Child process finished successfully');
  }
});
