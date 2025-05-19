import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as models from '../../models';
import type { Workspace } from '../../models/workspace';
import { database } from '../database';
import { getInsomniaV5DataExport } from '../insomnia-v5';

vi.mock('../database', async () => ({
  database: {
    withDescendants: vi.fn(),
  },
}));

vi.mock('../../models', async () => {
  const realModels = await vi.importActual<typeof models>('../../models');
  return {
    ...realModels,
    workspace: {
      ...realModels.workspace,
      getById: vi.fn(),
    },
  };
});

describe('getInsomniaV5DataExport', () => {
  beforeEach(() => {
    vi.mocked(models.workspace.getById).mockImplementation(async () => {
      return {
        _id: 'workspaceId',
        parentId: 'parentId',
        scope: models.workspace.WorkspaceScopeKeys.environment,
      } as Workspace;
    });

    vi.mocked(database.withDescendants).mockImplementation(async () => {
      return [];
    });
  });

  it('should preserve empty string environments', async () => {
    vi.mocked(database.withDescendants).mockImplementation(async () => {
      return [
        {
          _id: 'env_b210e2144d84de0e3b953b955d7073da6c02423b',
          type: 'Environment',
          parentId: 'wrk_dd5a1073241447edba21eab535d818b2',
          modified: 1747643594039,
          created: 1747636809409,
          name: 'Base Environment',
          data: {
            foo: 'bar',
            empty: '',
          },
          dataPropertyOrder: null,
          color: null,
          isPrivate: false,
          metaSortKey: 1747636809409,
          environmentType: 'kv',
          kvPairData: [
            {
              id: 'envPair_b9eab0d77ac84182b42a9b99cea22ff8',
              name: 'foo',
              value: 'bar',
              type: 'str',
              enabled: true,
            },
            {
              id: 'envPair_39626eeee87d4c62b84c5a1b529d00b4',
              name: 'empty',
              value: '',
              type: 'str',
              enabled: true,
            },
          ],
        },
      ];
    });

    const result = await getInsomniaV5DataExport({ workspaceId: 'workspaceId', includePrivateEnvironments: false });

    expect(result).toEqual(`type: environment.insomnia.rest/5.0
meta:
  id: workspaceId
environments:
  name: Base Environment
  meta:
    id: env_b210e2144d84de0e3b953b955d7073da6c02423b
    created: 1747636809409
    modified: 1747643594039
    isPrivate: false
  data:
    foo: bar
    empty: ""
`);
  });
});
