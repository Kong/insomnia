import { cp, mkdir, readdir, stat, writeFile } from 'node:fs/promises';

import childProcess from 'child_process';
import * as electron from 'electron';
import { app } from 'electron';
import path from 'path';

import { isDevelopment, isWindows } from '../common/constants';
import * as models from '../models';

const YARN_DEPRECATED_WARN = /(?<keyword>warning)(?<dependencies>[^>:].+[>:])(?<issue>.+)/;

interface InsomniaPlugin {
  // Insomnia attribute from package.json
  insomnia: {
    name: string;
    displayName: string;
    description: string;

    // Used by the plugin hub, not currently used by Insomnia
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
      const pluginDir = path.join(process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData'), 'plugins', moduleName);

      // Make plugin directory
      await mkdir(pluginDir, { recursive: true });

      // Download the module
      try {
        await electron.net.fetch(info.dist.tarball);
      } catch (err) {
        reject(new Error(`Failed to make plugin request ${info?.dist.tarball}: ${err.message}`));
        return;
      }

      const { tmpDir } = await _installPluginToTmpDir(lookupName);
      console.log(`[plugins] Moving plugin from ${tmpDir} to ${pluginDir}`);

      // Move entire module to plugins folder
      await cp(path.join(tmpDir, moduleName), pluginDir, { recursive: true, verbatimSymlinks: true });

      // Move each dependency into node_modules folder
      const pluginModulesDir = path.join(pluginDir, 'node_modules');
      await mkdir(pluginModulesDir, { recursive: true });

      for (const filename of await readdir(tmpDir)) {
        const src = path.join(tmpDir, filename);
        const file = await stat(src);
        if (filename === moduleName || !file.isDirectory()) {
          continue;
        }

        const dest = path.join(pluginModulesDir, filename);
        await cp(src, dest, { recursive: true, verbatimSymlinks: true });
      }
    } catch (err) {
      reject(err);
      return;
    }

    resolve();
  });
}

async function _isInsomniaPlugin(lookupName: string) {
  return new Promise<InsomniaPlugin>(async (resolve, reject) => {
    console.log('[plugins] Fetching module info from npm');
    childProcess.execFile(
      escape(process.execPath),
      [
        '--no-deprecation', // Because Yarn still uses `new Buffer()`
        escape(_getYarnPath()),
        'info',
        lookupName,
        '--json',
        '--registry',
        'https://registry.npmjs.org/',
      ],
      {
        timeout: 5 * 60 * 1000,
        maxBuffer: 1024 * 1024,
        shell: true,
        env: await _getYarnEnvValues(),
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

async function _getYarnEnvValues() {
  const settings = await models.settings.get();
  const yarnEnv: Record<string, string> = {
    NODE_ENV: 'production',
    ELECTRON_RUN_AS_NODE: 'true',
  };
  if (settings.pluginNodeExtraCerts) {
    yarnEnv.NODE_EXTRA_CA_CERTS = settings.pluginNodeExtraCerts;
  }
  if (settings.proxyEnabled) {
    if (settings.httpProxy) {
      yarnEnv.HTTP_PROXY = settings.httpProxy;
    }
    if (settings.httpsProxy) {
      yarnEnv.HTTPS_PROXY = settings.httpsProxy;
    }
    if (settings.noProxy) {
      yarnEnv.NO_PROXY = settings.noProxy;
    }
  }
  return yarnEnv;
}

async function _installPluginToTmpDir(lookupName: string) {
  return new Promise<{ tmpDir: string }>(async (resolve, reject) => {
    const tmpDir = path.join(electron.app.getPath('temp'), `${lookupName}-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    // Write a dummy package.json so that yarn doesn't traverse up the directory tree
    await writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({ license: 'ISC', workspaces: [] }), 'utf-8');

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
        '--ignore-workspace-root-check',
        '--registry',
        'https://registry.npmjs.org/',
      ],
      {
        timeout: 5 * 60 * 1000,
        maxBuffer: 1024 * 1024,
        cwd: tmpDir,
        shell: true,
        // Some package installs require a shell
        env: await _getYarnEnvValues(),
      },
      (err, stdout, stderr) => {
        console.log('[plugins] Install complete', { err, stdout, stderr });
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

export function containsOnlyDeprecationWarnings(stderr: string) {
  // Split on line breaks and remove falsy values (null, undefined, 0, -0, NaN, "", false)
  const arr = stderr.split(/\r?\n/).filter(error => error);
  // Retrieve all matching deprecated dependency warning
  const warnings = arr.filter(error => isDeprecatedDependencies(error));
  // Print each deprecation warnings to the console, so we don't hide them.
  warnings.forEach(warning => console.warn('[plugins] deprecation warning during installation: ', warning));
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
  // TODO: This is brittle. Make finding this more robust.
  if (isDevelopment()) {
    return path.resolve(app.getAppPath(), './bin/yarn-standalone.js');
  } else {
    return path.resolve(app.getAppPath(), '../bin/yarn-standalone.js');
  }
}

function escape(p: string) {
  if (isWindows()) {
    // Quote for Windows paths
    return `"${p}"`;
  } else {
    // Escape whitespace and parenthesis with backslashes for Unix paths
    return p.replace(/([\s()])/g, '\\$1');
  }
}
