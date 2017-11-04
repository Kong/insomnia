// @flow
import * as electron from 'electron';
import childProcess from 'child_process';
import {PLUGIN_PATH} from '../common/constants';
import mkdirp from 'mkdirp';
import path from 'path';
import * as tar from 'tar';
import * as crypto from 'crypto';

const YARN_PATH = path.resolve(__dirname, '../bin/yarn-standalone.js');

export default async function (moduleName: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    let info: Object = {};
    try {
      info = await _isInsomniaPlugin(moduleName);
    } catch (err) {
      reject(err);
      return;
    }

    const pluginDir = path.join(PLUGIN_PATH, moduleName);

    // Make plugin directory
    mkdirp.sync(pluginDir);

    // Download the module
    const request = electron.remote.net.request(info.dist.tarball);
    request.on('response', response => {
      const bodyBuffers = [];

      console.log(`[plugins] Downloading plugin tarball from ${info.dist.tarball}`);
      response.on('end', () => {
        console.log(`[plugins] Extracting plugin to ${pluginDir}`);
        const w = tar.extract({
          cwd: pluginDir, // Extract to plugin's directory
          strict: true, // Fail on anything
          strip: 1 // Skip the "package/*" parent folder
        });

        w.on('error', err => {
          reject(new Error(`Failed to extract ${info.dist.tarball}: ${err.message}`));
        });

        console.log(`[plugins] Running Yarn install in "${pluginDir}"`);
        w.on('end', () => {
          childProcess.execFile(
            process.execPath,
            [YARN_PATH, 'install'],
            {
              timeout: 5 * 60 * 1000,
              maxBuffer: 1024 * 1024,
              cwd: pluginDir,
              env: {
                'NODE_ENV': 'production',
                'ELECTRON_RUN_AS_NODE': 'true'
              }
            },
            (err, stdout, stderr) => {
              if (err) {
                reject(new Error(stderr));
              } else {
                resolve();
              }
            }
          );
        });

        const body = Buffer.concat(bodyBuffers);

        const shasum = crypto.createHash('sha1').update(body).digest('hex');
        if (shasum !== info.dist.shasum) {
          reject(new Error('Plugin shasum doesn\'t match npm'));
          return;
        }

        w.end(body);
      });

      response.on('data', chunk => {
        bodyBuffers.push(chunk);
      });
    });

    request.end();
  });
}

async function _isInsomniaPlugin (moduleName: string): Promise<Object> {
  return new Promise((resolve, reject) => {
    console.log(`[plugins] Fetching module info from npm`);
    childProcess.execFile(
      process.execPath,
      [YARN_PATH, 'info', moduleName, '--json'],
      {
        timeout: 5 * 60 * 1000,
        maxBuffer: 1024 * 1024,
        env: {
          'NODE_ENV': 'production',
          'ELECTRON_RUN_AS_NODE': 'true'
        }
      }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`${moduleName} install error: ${err.message}`));
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
          reject(new Error(`"${moduleName}" not a plugin! Package missing "insomnia" attribute`));
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
