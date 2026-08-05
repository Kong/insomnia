import { PassThrough } from 'node:stream';

import multiparty from 'multiparty';

export interface Part {
  id: number;
  title: string;
  name: string;
  bytes: number;
  value: Uint8Array;
  filename: string | null;
  headers: { name: string; value: string }[];
}
export function multipartBufferToArray({
  bodyBuffer,
  contentType,
}: {
  bodyBuffer: Uint8Array | null;
  contentType: string;
}): Promise<Part[]> {
  return new Promise((resolve, reject) => {
    const parts: Part[] = [];

    if (!bodyBuffer) {
      return resolve(parts);
    }

    const fakeReq = new PassThrough();
    // @ts-expect-error -- TSCONVERSION investigate `stream` types
    fakeReq.headers = {
      'content-type': contentType,
    };
    const form = new multiparty.Form();
    let id = 0;
    form.on('part', part => {
      const dataBuffers: any[] = [];
      part.on('data', data => {
        dataBuffers.push(data);
      });
      part.on('error', err => {
        reject(new Error(`Failed to parse part: ${err.message}`));
      });
      part.on('end', () => {
        const title = part.filename ? `${part.name} (${part.filename})` : part.name;
        parts.push({
          id,
          title,
          value: dataBuffers ? Buffer.concat(dataBuffers) : Buffer.from(''),
          name: part.name,
          filename: part.filename || null,
          bytes: part.byteCount,
          headers: Object.keys(part.headers).map(name => ({
            name,
            value: part.headers[name],
          })),
        });
        id += 1;
      });
    });
    form.on('error', err => {
      reject(err);
    });
    form.on('close', () => {
      resolve(parts);
    });
    // @ts-expect-error -- TSCONVERSION
    form.parse(fakeReq);
    fakeReq.write(bodyBuffer);
    fakeReq.end();
  });
}
