import fs from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import zlib from 'zlib';

import * as models from '../../models';

describe('migrate()', () => {

  it('does it', async () => {
    const bodyPath = path.join(tmpdir(), 'foo.zip');
    fs.writeFileSync(bodyPath, zlib.gzipSync('Hello World!'));
    const response = await models.initModel(models.response.type, {
      bodyPath,
    });
    const body = await models.response.getBodyBuffer(response).toString();
    expect(response.bodyCompression).toBe('zip');
    expect(body).toBe('Hello World!');
  });

  it('migrates leaves bodyCompression for null', async () => {
    expect(
      (
        await models.initModel(models.response.type, {
          bodyPath: '/foo/bar',
          bodyCompression: null,
        })
      ).bodyCompression,
    ).toBe(null);
  });

  it('migrates sets bodyCompression to zip if does not have one yet', async () => {
    expect(
      (
        await models.initModel(models.response.type, {
          bodyPath: '/foo/bar',
        })
      ).bodyCompression,
    ).toBe('zip');
  });

  it('migrates leaves bodyCompression if string', async () => {
    expect(
      (
        await models.initModel(models.response.type, {
          bodyPath: '/foo/bar',
          bodyCompression: 'zip',
        })
      ).bodyCompression,
    ).toBe('zip');
  });
});
