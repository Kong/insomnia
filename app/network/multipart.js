// @flow
import mimes from 'mime-types';
import {PassThrough} from 'stream';
import MultiStream from 'multistream';
import fs from 'fs';
import path from 'path';
import type {RequestBodyParameter} from '../models/request';

export const DEFAULT_BOUNDARY = 'X-INSOMNIA-BOUNDARY';

export async function buildMultipart (params: Array<RequestBodyParameter>) {
  return new Promise(async resolve => {
    const streams = [];
    const lineBreak = '\r\n';
    let totalSize = 0;

    const addFile = async (path: string) => {
      return new Promise(resolve => {
        const {size} = fs.statSync(path);
        const stream = fs.createReadStream(path);
        // NOTE: Not sure why Multistream doesn't handle this. Seems like it should.
        stream.on('readable', () => {
          streams.push(stream);
          totalSize += size;
          resolve();
        });
      });
    };

    const addString = (v: string) => {
      const buffer = Buffer.from(v);
      const stream = new PassThrough();
      stream.end(buffer);
      streams.push(stream);
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
        const contentType = mimes.lookup(fileName) || 'application/octet-stream';
        addString(
          'Content-Disposition: form-data; ' +
          `name="${name.replace(/"/g, '\\"')}"; ` +
          `filename="${path.basename(fileName).replace(/"/g, '\\"')}"`
        );
        addString(lineBreak);
        addString(`Content-Type: ${contentType}`);
        addString(lineBreak);
        addString(lineBreak);
        await addFile(fileName);
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

    const body = MultiStream(streams);
    window.body = body;
    body.on('readable', () => {
      resolve({boundary: DEFAULT_BOUNDARY, body, contentLength: totalSize});
    });
  });
}
