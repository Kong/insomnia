import { beforeEach, describe, expect, it } from '@jest/globals';

import { globalBeforeEach } from '../../../__jest__/before-each';
import * as models from '../../index';
import { queryAllWorkspaceUrls } from '../query-all-workspace-urls';

describe('queryAllWorkspaceUrls', () => {
  beforeEach(globalBeforeEach);

  it('should return empty array when no requests exist', async () => {
    const w = await models.workspace.create({
      name: 'Workspace',
    });
    await expect(queryAllWorkspaceUrls(w._id, models.request.type)).resolves.toHaveLength(0);
    await expect(queryAllWorkspaceUrls(w._id, models.grpcRequest.type)).resolves.toHaveLength(0);
  });

  it('should return urls and exclude that of the selected request', async () => {
    const w = await models.workspace.create({
      name: 'Workspace',
    });
    const r1 = await models.request.create({
      name: 'Request 1',
      parentId: w._id,
      url: 'r1.url',
    });
    const gr1 = await models.grpcRequest.create({
      name: 'Grpc Request 1',
      parentId: w._id,
      url: 'gr1.url',
    });
    const gr2 = await models.grpcRequest.create({
      name: 'Grpc Request 2',
      parentId: w._id,
      url: 'gr2.url',
    });
    const f2 = await models.requestGroup.create({
      name: 'Folder 2',
      parentId: w._id,
    });
    const r2 = await models.request.create({
      name: 'Request 2',
      parentId: f2._id,
      url: 'r2.url',
    });
    // Should ignore all of the following
    await models.grpcRequest.create({
      name: 'Duplicate grpc url',
      parentId: w._id,
      url: gr2.url,
    });
    await models.request.create({
      name: 'Duplicate url',
      parentId: f2._id,
      url: r2.url,
    });
    await models.request.create({
      name: 'Undefined url',
      parentId: f2._id,
      url: undefined,
    });
    await models.grpcRequest.create({
      name: 'Undefined url',
      parentId: w._id,
      url: undefined,
    });
    const w2 = await models.workspace.create({
      name: 'Workspace 2',
    });
    await models.request.create({
      name: 'Different workspace',
      parentId: w2._id,
      url: 'diff.url',
    });
    await models.grpcRequest.create({
      name: 'Different workspace',
      parentId: w2._id,
      url: 'diff.url',
    });
    // All items
    await expect(queryAllWorkspaceUrls(w._id, models.request.type)).resolves.toStrictEqual(
      expect.arrayContaining([r1.url, r2.url]),
    );
    await expect(queryAllWorkspaceUrls(w._id, models.grpcRequest.type)).resolves.toStrictEqual(
      expect.arrayContaining([gr1.url, gr2.url]),
    );
    // Ignore url of the selected request id
    await expect(queryAllWorkspaceUrls(w._id, models.request.type, r1._id)).resolves.toStrictEqual(
      expect.arrayContaining([r2.url]),
    );
    await expect(queryAllWorkspaceUrls(w._id, models.grpcRequest.type, gr1._id)).resolves.toStrictEqual(
      expect.arrayContaining([gr2.url]),
    );
  });
});
