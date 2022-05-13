import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

import { globalBeforeEach } from '../../__jest__/before-each';
import { getDataDirectory } from '../../common/electron-helpers';
import * as models from '../../models';

describe('migrate()', () => {
  beforeEach(globalBeforeEach);

  it('does it', async () => {
    const bodyPath = path.join(getDataDirectory(), 'foo.zip');
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

/**
 * Create mock workspaces, requests, and responses as many as {@code count}.
 * @param responsesDir
 * @param count
 * @returns {Promise<string[]>} the created response ids
 */
async function createModels(responsesDir, count) {
  if (count < 1) {
    return [];
  }

  const responseIds = [];

  for (let index = 0; index < count; index++) {
    const workspaceId = 'wrk_' + index;
    const requestId = 'req_' + index;
    const responseId = 'res_' + index;
    await models.workspace.create({
      _id: workspaceId,
      created: 111,
      modified: 222,
    });
    await models.request.create({
      _id: requestId,
      parentId: workspaceId,
      created: 111,
      modified: 222,
      metaSortKey: 0,
      url: 'https://insomnia.rest',
    });
    await models.response.create({
      _id: responseId,
      parentId: requestId,
      statusCode: 200,
      body: 'foo',
      bodyPath: path.join(responsesDir, responseId),
    });
    responseIds.push(responseId);
  }

  return responseIds;
}
