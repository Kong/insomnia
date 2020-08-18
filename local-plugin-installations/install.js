const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

// Start build if ran from CLI
if (require.main === module) {
  process.nextTick(async () => {
    await module.exports.start();
  });
}

module.exports.start = async function() {
  const basePath = path.resolve(__dirname);
  const dirs = fs.readdirSync(basePath);

  const pluginDirs = dirs.filter(s => s.startsWith('insomnia-plugin'));

  const promises = pluginDirs.map(dir => {
    return new Promise((resolve, reject) => {
      childProcess.execFile(
        escape(process.execPath),
        [
          '--no-deprecation', // Because Yarn still uses `new Buffer()`
          escape(_getYarnPath()),
          'install',
          '--cwd',
          escape(dir),
          '--no-lockfile',
          '--production',
          '--no-progress',
        ],
        {
          timeout: 5 * 60 * 1000,
          maxBuffer: 1024 * 1024,
          cwd: dir,
          shell: true, // Some package installs require a shell
          env: {
            NODE_ENV: 'production',
          },
        },
        (err, stdout, stderr) => {
          // Check yarn/electron process exit code.
          // In certain environments electron can exit with error even if the command was perfomed sucesfully.
          // Checking for sucess message in output is a workaround for false errors.
          if (err && !stdout.toString().includes('success')) {
            reject(new Error(`${dir} install error: ${err.message}`));
            return;
          }

          resolve({ dir });
        },
      );
    });
  });

  Promise.all(promises).catch(e => {
    console.error(e);
    process.exit(1);
  });
};

function _getYarnPath() {
  const yarnPath = path.resolve(process.argv[2]);
  return yarnPath;
}

function escape(p) {
  if (path.sep === path.win32.sep) {
    // Quote for Windows paths
    return `"${p}"`;
  } else {
    // Escape whitespace and parenthesis with backslashes for Unix paths
    return p.replace(/([\s()])/g, '\\$1');
  }
}
