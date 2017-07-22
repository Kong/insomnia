// @flow
import childProcess from 'child_process';
import {PLUGIN_PATH} from '../common/constants';

export default async function (moduleName: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      await _isInsomniaPlugin(moduleName);
    } catch (err) {
      reject(err);
      return;
    }

    childProcess.exec(
      `npm install --prefix '${PLUGIN_PATH}' ${moduleName}`,
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr));
        } else {
          resolve();
        }
      }
    );
  });
}

async function _isInsomniaPlugin (moduleName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    childProcess.exec(
      `npm show ${moduleName} insomnia`,
      (err, stdout, stderr) => {
        if (err && stderr.includes('E404')) {
          reject(new Error(`${moduleName} not found on npm`));
          return;
        }

        if (stdout) {
          resolve();
        } else {
          reject(new Error(`"insomnia" attribute missing in ${moduleName}'s package.json`));
        }
      }
    );
  });
}
