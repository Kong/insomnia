// @flow
import * as electron from 'electron';
import fs from 'fs';
import fsx from 'fs-extra';
import childProcess from 'child_process';
import { getTempDir, isDevelopment, PLUGIN_PATH } from '../common/constants';
import mkdirp from 'mkdirp';
import path from 'path';

export default async function(lookupName: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    let info: Object = {};
    try {
      info = await _isInsomniaPlugin(lookupName);

      // Get actual module name without version suffixes and things
      const moduleName = info.name;

      const pluginDir = path.join(PLUGIN_PATH, moduleName);

      // Make plugin directory
      mkdirp.sync(pluginDir);

      // Download the module
      const request = electron.remote.net.request(info.dist.tarball);
      request.on('error', err => {
        reject(new Error(`Failed to make plugin request ${info.dist.tarball}: ${err.message}`));
      });

      const { tmpDir } = await _installPluginToTmpDir(lookupName);
      console.log(`[plugins] Moving plugin from ${tmpDir} to ${pluginDir}`);

      // Move entire module to plugins folder
      fsx.moveSync(path.join(tmpDir, moduleName), pluginDir, {
        overwrite: true
      });

      // Move each dependency into node_modules folder
      const pluginModulesDir = path.join(pluginDir, 'node_modules');
      mkdirp.sync(pluginModulesDir);
      for (const name of fs.readdirSync(tmpDir)) {
        const src = path.join(tmpDir, name);
        if (name === moduleName || !fs.statSync(src).isDirectory()) {
          continue;
        }

        const dest = path.join(pluginModulesDir, name);
        fsx.moveSync(src, dest, { overwrite: true });
      }
    } catch (err) {
      reject(err);
      return;
    }

    resolve();
  });
}

async function _isInsomniaPlugin(lookupName: string): Promise<Object> {
  return new Promise((resolve, reject) => {
    console.log(`[plugins] Fetching module info from npm`);
    childProcess.execFile(
      escape(process.execPath),
      [
        '--no-deprecation', // Because Yarn still uses `new Buffer()`
        _getYarnPath(),
        'info',
        lookupName,
        '--json'
      ],
      {
        timeout: 5 * 60 * 1000,
        maxBuffer: 1024 * 1024,
        shell: true,
        env: {
          NODE_ENV: 'production',
          ELECTRON_RUN_AS_NODE: 'true'
        }
      },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`${lookupName} npm error: ${err.message}`));
          return;
        }

        if (stderr) {
          reject(new Error(`Yarn error ${stderr.toString('utf8')}`));
          return;
        }

        let yarnOutput;
        try {
          yarnOutput = JSON.parse(stdout.toString('utf8'));
        } catch (err) {
          reject(new Error(`Yarn response not JSON: ${err.message}`));
          return;
        }

        const data = yarnOutput.data;
        if (!data.hasOwnProperty('insomnia')) {
          reject(new Error(`"${lookupName}" not a plugin! Package missing "insomnia" attribute`));
          return;
        }

        console.log(`[plugins] Detected Insomnia plugin ${data.name}`);

        resolve({
          insomnia: data.insomnia,
          name: data.name,
          version: data.version,
          dist: {
            shasum: data.dist.shasum,
            tarball: data.dist.tarball
          }
        });
      }
    );
  });
}

async function _installPluginToTmpDir(lookupName: string): Promise<{ tmpDir: string }> {
  return new Promise((resolve, reject) => {
    const tmpDir = path.join(getTempDir(), `${lookupName}-${Date.now()}`);
    mkdirp.sync(tmpDir);
    console.log(`[plugins] Installing plugin to ${tmpDir}`);
    childProcess.execFile(
      escape(process.execPath),
      [
        '--no-deprecation', // Because Yarn still uses `new Buffer()`
        _getYarnPath(),
        'add',
        lookupName,
        '--modules-folder',
        tmpDir,
        '--cwd',
        tmpDir,
        '--no-lockfile',
        '--production',
        '--no-progress'
      ],
      {
        timeout: 5 * 60 * 1000,
        maxBuffer: 1024 * 1024,
        cwd: tmpDir,
        shell: true, // Some package installs require a shell
        env: {
          NODE_ENV: 'production',
          ELECTRON_RUN_AS_NODE: 'true'
        }
      },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`${lookupName} install error: ${err.message}`));
          return;
        }

        if (stderr) {
          reject(new Error(`Yarn error ${stderr.toString('utf8')}`));
          return;
        }

        resolve({ tmpDir });
      }
    );
  });
}

function _getYarnPath() {
  const { app } = electron.remote || electron;

  // TODO: This is brittle. Make finding this more robust.
  if (isDevelopment()) {
    return path.resolve(app.getAppPath(), './bin/yarn-standalone.js');
  } else {
    return path.resolve(app.getAppPath(), '../bin/yarn-standalone.js');
  }
}

function escape(p) {
  return p.replace(/(\s+)/g, '\\$1');
}
