import { createBuilder } from '@develohpanda/fluent-builder';
import { baseModelSchema, workspaceModelSchema } from '../../../models/__schemas__/model-schemas';
import { clearIgnoredKeys, shouldIgnoreKey } from '../ignore-keys';

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

describe('clearIgnoredKeys', () => {
  it('should always delete the modified key', () => {
    const base = baseModelBuilder.build();
    const workspace = workspaceModelBuilder.build();

    clearIgnoredKeys(base);
    clearIgnoredKeys(workspace);

    expect(Object.keys(base)).not.toContain('modified');
    expect(Object.keys(workspace)).not.toContain('modified');
  });

  it('should clear parentId from the workspace', () => {
    const base = baseModelBuilder.parentId('abc').build();
    const workspace = workspaceModelBuilder.parentId('abc').build();

    clearIgnoredKeys(base);
    clearIgnoredKeys(workspace);

    expect(base.parentId).toBe('abc');
    expect(workspace.parentId).toBeNull();
  });
});
