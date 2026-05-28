import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { describe, expect, it } from 'vitest';

import type { Response } from '~/insomnia-data';
import { models, services } from '~/insomnia-data';

import { initModel } from './index';

describe('migrate()', () => {
  it('does it', async () => {
    const bodyPath = path.join(tmpdir(), 'foo.zip');
    fs.writeFileSync(bodyPath, zlib.gzipSync('Hello World!'));
    const response = await initModel<Response>(models.response.type, {
      bodyPath,
    });
    const body = (await services.helpers.getResponseBodyBuffer(response)).toString();
    expect(response.bodyCompression).toBe('zip');
    expect(body).toBe('Hello World!');
  });

  it('migrates leaves bodyCompression for null', async () => {
    expect(
      (
        await initModel<Response>(models.response.type, {
          bodyPath: '/foo/bar',
          bodyCompression: null,
        })
      ).bodyCompression,
    ).toBe(null);
  });

  it('migrates sets bodyCompression to zip if does not have one yet', async () => {
    expect(
      (
        await initModel<Response>(models.response.type, {
          bodyPath: '/foo/bar',
        })
      ).bodyCompression,
    ).toBe('zip');
  });

  it('migrates leaves bodyCompression if string', async () => {
    expect(
      (
        await initModel<Response>(models.response.type, {
          bodyPath: '/foo/bar',
          bodyCompression: 'zip',
        })
      ).bodyCompression,
    ).toBe('zip');
  });
});
