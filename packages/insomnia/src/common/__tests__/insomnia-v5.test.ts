import { describe, expect, it } from 'vitest';

import * as models from '../../models';
import { getInsomniaV5DataExport } from '../insomnia-v5';

describe('getInsomniaV5DataExport', () => {
  it('should preserve empty string environments', async () => {
    const workspace = await models.workspace.create({
      _id: 'wrk_id',
      name: 'Workspace Name',
      created: 0,
      modified: 0,
      description: 'workspace description',
    });

    await models.environment.create({
      _id: 'env_id',
      name: 'Environment Name',
      parentId: workspace._id,
      created: 0,
      modified: 0,
      data: {
        foo: 'bar',
        empty: '',
      },
    });

    const result = await getInsomniaV5DataExport({ workspaceId: 'wrk_id', includePrivateEnvironments: false });

    expect(result).toEqual(`type: collection.insomnia.rest/5.0
name: Workspace Name
meta:
  id: wrk_id
  created: 0
  modified: 0
  description: workspace description
environments:
  name: Environment Name
  meta:
    id: env_id
    created: 0
    modified: 0
    isPrivate: false
  data:
    foo: bar
    empty: ""
`);
  });
});
