import childProcess from 'child_process';
import * as electron from 'electron';
import fs from 'fs';
import fsx from 'fs-extra';
import mkdirp from 'mkdirp';
import path from 'path';

import { isDevelopment, isWindows, PLUGIN_PATH } from '../common/constants';
import { getTempDir } from '../common/electron-helpers';

const YARN_DEPRECATED_WARN = /(?<keyword>warning)(?<dependencies>[^>:].+[>:])(?<issue>.+)/;

interface InsomniaPlugin {
  // Insomnia attribute from package.json
  insomnia: {
    name: string;
    displayName: string;
    description: string;

    // Used by the plugin hub, not currently used by Insomnia app
    // Each image is relative to package root
    images?: {
      icon?: string;
      cover?: string;
    };

    unlisted?: boolean;

    publisher?: {
      name: string;
      // absolute URL
      icon: string;
    };
  };

  // NPM specific properties
  name: string;
  version: string;
  dist: {
    shasum: string;
    tarball: string;
  };
}

export default async function(lookupName: string) {
  return new Promise<void>(async (resolve, reject) => {
    let info: InsomniaPlugin | null = null;

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
        reject(new Error(`Failed to make plugin request ${info?.dist.tarball}: ${err.message}`));
      });
      const { tmpDir } = await _installPluginToTmpDir(lookupName);
      console.log(`[plugins] Moving plugin from ${tmpDir} to ${pluginDir}`);

      // Move entire module to plugins folder
      fsx.moveSync(
        path.join(tmpDir, moduleName),
        pluginDir,
        { overwrite: true },
      );

      // Move each dependency into node_modules folder
      const pluginModulesDir = path.join(pluginDir, 'node_modules');
      mkdirp.sync(pluginModulesDir);

      for (const name of fs.readdirSync(tmpDir)) {
        const src = path.join(tmpDir, name);

        if (name === moduleName || !fs.statSync(src).isDirectory()) {
          continue;
        }

        const dest = path.join(pluginModulesDir, name);
        fsx.moveSync(src, dest, {
          overwrite: true,
        });
      }
    } catch (err) {
      reject(err);
      return;
    }

    resolve();
  });
}

async function _isInsomniaPlugin(lookupName: string) {
  return new Promise<InsomniaPlugin>((resolve, reject) => {
    console.log('[plugins] Fetching module info from npm');
    childProcess.execFile(
      escape(process.execPath),
      [
        '--no-deprecation', // Because Yarn still uses `new Buffer()`
        escape(_getYarnPath()),
        'info',
        lookupName,
        '--json',
      ],
      {
        timeout: 5 * 60 * 1000,
        maxBuffer: 1024 * 1024,
        shell: true,
        env: {
          NODE_ENV: 'production',
          ELECTRON_RUN_AS_NODE: 'true',
        },
      },
      (err, stdout, stderr) => {
        if (stderr) {
          reject(new Error(`Yarn error ${stderr.toString()}`));
          return;
        }

        let yarnOutput;

        try {
          yarnOutput = JSON.parse(stdout.toString());
        } catch (ex) {
          // Output is not JSON. Check if yarn/electron terminated with non-zero exit code.
          // In certain environments electron can exit with error even if output is OK.
          // Parsing is attempted before checking exit code as workaround for false errors.
          if (err) {
            reject(new Error(`${lookupName} npm error: ${err.message}`));
          } else {
            reject(new Error(`Yarn response not JSON: ${ex.message}`));
          }

          return;
        }

        const data = yarnOutput.data;

        if (!data.hasOwnProperty('insomnia')) {
          reject(new Error(`"${lookupName}" not a plugin! Package missing "insomnia" attribute`));
          return;
        }

        console.log(`[plugins] Detected Insomnia plugin ${data.name}`);
        const insomniaPlugin: InsomniaPlugin = {
          insomnia: data.insomnia,
          name: data.name,
          version: data.version,
          dist: {
            shasum: data.dist.shasum,
            tarball: data.dist.tarball,
          },
        };
        resolve(insomniaPlugin);
      },
    );
  });
}

async function _installPluginToTmpDir(lookupName: string) {
  return new Promise<{ tmpDir: string }>((resolve, reject) => {
    const tmpDir = path.join(getTempDir(), `${lookupName}-${Date.now()}`);
    mkdirp.sync(tmpDir);
    console.log(`[plugins] Installing plugin to ${tmpDir}`);
    childProcess.execFile(
      escape(process.execPath),
      [
        '--no-deprecation', // Because Yarn still uses `new Buffer()`
        escape(_getYarnPath()),
        'add',
        lookupName,
        '--modules-folder',
        escape(tmpDir),
        '--cwd',
        escape(tmpDir),
        '--no-lockfile',
        '--production',
        '--no-progress',
      ],
      {
        timeout: 5 * 60 * 1000,
        maxBuffer: 1024 * 1024,
        cwd: tmpDir,
        shell: true,
        // Some package installs require a shell
        env: {
          NODE_ENV: 'production',
          ELECTRON_RUN_AS_NODE: 'true',
        },
      },
      (err, stdout, stderr) => {
        // Check yarn/electron process exit code.
        // In certain environments electron can exit with error even if the command was performed successfully.
        // Checking for success message in output is a workaround for false errors.
        if (err && !stdout.toString().includes('success')) {
          reject(new Error(`${lookupName} install error: ${err.message}`));
          return;
        }

        if (stderr && !containsOnlyDeprecationWarnings(stderr)) {
          reject(new Error(`Yarn error ${stderr.toString()}`));
          return;
        }

        resolve({
          tmpDir,
        });
      },
    );
  });
}

export function containsOnlyDeprecationWarnings(stderr) {
  // Split on line breaks and remove falsy values (null, undefined, 0, -0, NaN, "", false)
  const arr = stderr.split(/\r?\n/).filter(e => e);
  // Retrieve all matching deprecated dependency warning
  const warnings = arr.filter(e => isDeprecatedDependencies(e));
  // Print each deprecation warnings to the console, so we don't hide them.
  warnings.forEach(e => console.warn('[plugins] deprecation warning during installation: ', e));
  // If they mismatch, it means there are warnings and errors
  return warnings.length === arr.length;
}

/**
 * Provided a string, it checks for the following message:<br>
 * <<[warning] xxx > yyy > zzz: yyy<n is [no longer maintained] and [not recommended for usage] <br>
 * due to the number of issues. Please, [upgrade your dependencies] to xxx>> <br>
 * @param str The error message
 * @returns {boolean} Returns true if it's a deprecated warning
 */
export function isDeprecatedDependencies(str: string) {
  // The issue contains the message as it is without the dependency list
  const message = YARN_DEPRECATED_WARN.exec(str)?.groups?.issue;
  // Strict check, everything must be matched to be a false positive
  // !! is not a mistake, makes it returns boolean instead of undefined on error
  return !!(
    message &&
    message.includes('no longer maintained') &&
    message.includes('not recommended for usage') &&
    message.includes('upgrade your dependencies')
  );
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
  if (isWindows()) {
    // Quote for Windows paths
    return `"${p}"`;
  } else {
    // Escape whitespace and parenthesis with backslashes for Unix paths
    return p.replace(/([\s()])/g, '\\$1');
  }
}
