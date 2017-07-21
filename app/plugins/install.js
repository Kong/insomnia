// @flow
import childProcess from 'child_process';
import {PLUGIN_PATH} from '../common/constants';

export default async function (moduleName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    childProcess.exec(
      `npm install --prefix '${PLUGIN_PATH}' ${moduleName}`,
      (err, stdout, stderr) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}
