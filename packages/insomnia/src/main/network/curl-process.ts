import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { v4 as uuidv4 } from 'uuid';

import { jsonToCurl } from './curl-args';
import { readResponseFromFile } from './curl-output-parse';
import type { CurlRequestOptions } from './libcurl-promise';
const getDataDirectory = () => process.env.INSOMNIA_DATA_PATH || window.app.getPath('userData');

export const curlRequest = async (options: CurlRequestOptions) => {
  const responsesDir = path.join(getDataDirectory(), 'responses');
  await fs.promises.mkdir(responsesDir, { recursive: true });
  const responseBodyPath = path.join(responsesDir, uuidv4() + '.traceresponse');
  const extraArgs = [`--trace-ascii '${responseBodyPath}'`];

  const curlArgs = jsonToCurl(options);
  const childProcess = spawn('curl', [...extraArgs, ...curlArgs], {
    shell: true,
  });
  const output: string = await new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', data => {
      stdout += data.toString();
    });

    childProcess.stderr.on('data', data => {
      stderr += data.toString();
    });

    childProcess.on('close', code => {
      if (code !== 0) {
        const lines = stderr.split(/\r?\n/);
        const errorLines: string[] = [];

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('curl:')) {
            errorLines.push(trimmed);
          }
        }
        reject(errorLines.join('\n') || `Curl command failed with exit code ${code}`);
      } else {
        resolve(stdout);
      }
    });
  });
  return readResponseFromFile(responseBodyPath);
};
