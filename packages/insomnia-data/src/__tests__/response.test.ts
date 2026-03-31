import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { services } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

describe('migrate()', () => {
  it('does it', async () => {
    const bodyPath = path.join(tmpdir(), 'foo.zip');
    fs.writeFileSync(bodyPath, zlib.gzipSync('Hello World!'));
    const response = await services.response.create({
      parentId: 'pid',
      bodyPath,
    });
    const body = (await services.helpers.getResponseBodyBuffer(response)).toString();
    expect(response.bodyCompression).toBe('zip');
    expect(body).toBe('Hello World!');
  });

  it('migrates leaves bodyCompression for null', async () => {
    expect(
      (
        await services.response.create({
          parentId: 'pid',
          bodyPath: '/foo/bar',
          bodyCompression: null,
        })
      ).bodyCompression,
    ).toBe(null);
  });

  it('migrates sets bodyCompression to zip if does not have one yet', async () => {
    expect(
      (
        await services.response.create({
          parentId: 'pid',
          bodyPath: '/foo/bar',
        })
      ).bodyCompression,
    ).toBe('zip');
  });

  it('migrates leaves bodyCompression if string', async () => {
    expect(
      (
        await services.response.create({
          parentId: 'pid',
          bodyPath: '/foo/bar',
          bodyCompression: 'zip',
        })
      ).bodyCompression,
    ).toBe('zip');
  });
});
