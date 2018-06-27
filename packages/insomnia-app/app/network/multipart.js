// @flow
import * as electron from 'electron';
import mimes from 'mime-types';
import fs from 'fs';
import path from 'path';
import type { RequestBodyParameter } from '../models/request';

export const DEFAULT_BOUNDARY = 'X-INSOMNIA-BOUNDARY';

export async function buildMultipart(params: Array<RequestBodyParameter>) {
  return new Promise(async (resolve: Function, reject: Function) => {
    const filePath = path.join(
      electron.remote.app.getPath('temp'),
      Math.random() + '.body'
    );
    const writeStream = fs.createWriteStream(filePath);
    const lineBreak = '\r\n';
    let totalSize = 0;

    function addFile(path: string): Promise<void> {
      return new Promise((resolve, reject) => {
        let size;
        try {
          size = fs.statSync(path).size;
        } catch (err) {
          reject(err);
        }
        const stream = fs.createReadStream(path);
        stream.once('end', () => {
          resolve();
        });
        stream.pipe(
          writeStream,
          { end: false }
        );
        totalSize += size;
      });
    }

    const addString = (v: string) => {
      const buffer = Buffer.from(v);
      writeStream.write(buffer);
      totalSize += buffer.length;
    };

    for (const param of params) {
      const noName = !param.name;
      const noValue = !(param.value || param.fileName);

      if (noName && noValue) {
        continue;
      }

      addString(`--${DEFAULT_BOUNDARY}`);
      addString(lineBreak);

      if (param.type === 'file' && param.fileName) {
        const name = param.name || '';
        const fileName = param.fileName;
        const contentType =
          mimes.lookup(fileName) || 'application/octet-stream';
        addString(
          'Content-Disposition: form-data; ' +
            `name="${name.replace(/"/g, '\\"')}"; ` +
            `filename="${path.basename(fileName).replace(/"/g, '\\"')}"`
        );
        addString(lineBreak);
        addString(`Content-Type: ${contentType}`);
        addString(lineBreak);
        addString(lineBreak);
        try {
          await addFile(fileName);
        } catch (err) {
          return reject(err);
        }
      } else {
        const name = param.name || '';
        const value = param.value || '';
        addString(`Content-Disposition: form-data; name="${name}"`);
        addString(lineBreak);
        addString(lineBreak);
        addString(value);
      }

      addString(lineBreak);
    }

    addString(`--${DEFAULT_BOUNDARY}--`);
    addString(lineBreak);

    writeStream.on('error', err => {
      reject(err);
    });

    writeStream.on('close', () => {
      resolve({
        boundary: DEFAULT_BOUNDARY,
        filePath,
        contentLength: totalSize
      });
    });

    // We're done here. End the stream and tell FS to save/close the file.
    writeStream.end();
  });
}
