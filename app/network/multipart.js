// @flow
import mimes from 'mime-types';
import fs from 'fs';
import path from 'path';
import type {RequestBodyParameter} from '../models/request';

export function buildMultipart (params: Array<RequestBodyParameter>): {boundary: string, body: Buffer} {
  const buffers = [];
  const boundary = '--------------------------f454e8380a65f4a3';
  const lineBreak = '\r\n';

  const add = (v: Buffer | string) => {
    if (typeof v === 'string') {
      buffers.push(Buffer.from(v, 'utf8'));
    } else {
      buffers.push(v);
    }
  };

  for (const param of params) {
    const noName = !param.name;
    const noValue = !(param.value || param.fileName);

    if (noName && noValue) {
      continue;
    }

    add(`${boundary}`);
    add(lineBreak);

    if (param.type === 'file' && param.fileName) {
      const name = param.name || '';
      const fileName = param.fileName;
      const contentType = mimes.lookup(fileName) || 'application/octet-stream';
      add(
        'Content-Disposition: form-data; ' +
        `name="${name.replace(/"/g, '\\"')}"; ` +
        `filename="${path.basename(fileName).replace(/"/g, '\\"')}"`
      );
      add(lineBreak);
      add(`Content-Type: ${contentType}`);
      add(lineBreak);
      add(lineBreak);
      add(fs.readFileSync(fileName));
    } else {
      const name = param.name || '';
      const value = param.value || '';
      add(`Content-Disposition: form-data; name="${name}"`);
      add(lineBreak);
      add(lineBreak);
      add(value);
    }

    add(lineBreak);
  }

  add(`${boundary}--`);
  add(lineBreak);

  const body = Buffer.concat(buffers);
  return {boundary: boundary, body};
}
