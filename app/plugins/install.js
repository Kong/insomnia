// @flow
import * as electron from 'electron';
import childProcess from 'child_process';
import {PLUGIN_PATH} from '../common/constants';
import mkdirp from 'mkdirp';
import path from 'path';
import * as tar from 'tar';
import * as crypto from 'crypto';

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

      response.on('end', () => {
        const w = tar.extract({
          cwd: pluginDir, // Extract to plugin's directory
          strict: true, // Fail on anything
          strip: 1 // Skip the "package/*" parent folder
        });

        w.on('error', err => {
          reject(new Error(`Failed to extract ${info.dist.tarball}: ${err.message}`));
        });

        w.on('end', () => {
          childProcess.exec('npm install', {cwd: pluginDir}, (err, stdout, stderr) => {
            if (err) {
              reject(new Error(stderr));
            } else {
              resolve();
            }
          });
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
    childProcess.exec(
      `npm show ${moduleName} --json`, (err, stdout, stderr) => {
        if (err && stderr.includes('E404')) {
          reject(new Error(`${moduleName} not found on npm`));
          return;
        }

        const info = JSON.parse(stdout);

        if (!info.hasOwnProperty('insomnia')) {
          reject(new Error(`"${moduleName}" not a plugin! Package missing "insomnia" attribute`));
          return;
        }

        resolve({
          insomnia: info.insomnia,
          name: info.name,
          version: info.version,
          dist: {
            shasum: info.dist.shasum,
            tarball: info.dist.tarball
          }
        });
      }
    );
  });
}
