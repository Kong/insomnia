import { createBuilder } from '@develohpanda/fluent-builder';
import { baseModelSchema, workspaceModelSchema } from '../../../models/__schemas__/model-schemas';
import { deleteIgnoredKeys, shouldIgnoreKey } from '../ignore-keys';

const baseModelBuilder = createBuilder(baseModelSchema);
const workspaceModelBuilder = createBuilder(workspaceModelSchema);

describe('shouldIgnoreKey()', () => {
  it('should always ignore keys', () => {
    const base = baseModelBuilder.build();
    const workspace = workspaceModelBuilder.build();

    expect(shouldIgnoreKey('modified', base)).toBe(true);
    expect(shouldIgnoreKey('modified', workspace)).toBe(true);
  });

  it('should always ignore parent id from workspace', () => {
    const base = baseModelBuilder.build();
    const workspace = workspaceModelBuilder.build();

    expect(shouldIgnoreKey('parentId', base)).toBe(false);
    expect(shouldIgnoreKey('parentId', workspace)).toBe(true);
  });
});

describe('deleteIgnoredKeys', () => {
  it('should always delete the ignored keys', () => {
    const base = baseModelBuilder.build();

    deleteIgnoredKeys(base);

    expect(Object.keys(base)).not.toContain('modified');
  });

  it('should delete parentId from the workspace', () => {
    const base = baseModelBuilder.build();
    const workspace = workspaceModelBuilder.build();

    deleteIgnoredKeys(base);
    deleteIgnoredKeys(workspace);

    expect(Object.keys(base)).toContain('parentId');
    expect(Object.keys(workspace)).not.toContain('parentId');
  });
});
