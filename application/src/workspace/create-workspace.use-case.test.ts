import { describe, expect, it } from 'vitest';

import { createWorkspace } from './create-workspace.use-case';
import { createFakeWorkspaceRepository } from './testing/fake-workspace-repository';

describe('createWorkspace', () => {
  it('creates a new workspace through the repository', async () => {
    const repository = createFakeWorkspaceRepository();

    const created = await createWorkspace(repository, {
      name: 'New Workspace',
      scope: 'collection',
      parentId: 'proj_1',
    });

    expect(created.name).toBe('New Workspace');
    expect(await repository.findById(created._id)).toEqual(created);
  });
});
