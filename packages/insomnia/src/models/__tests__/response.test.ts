import { beforeEach, describe, expect, it } from '@jest/globals';
import electron from 'electron';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

import { globalBeforeEach } from '../../__jest__/before-each';
import * as models from '../../models';

describe('migrate()', () => {
  beforeEach(globalBeforeEach);

  it('does it', async () => {
    const bodyPath = path.join(electron.app.getPath('userData'), 'foo.zip');
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
