import { createBuilder } from '@develohpanda/fluent-builder';
import { baseModelSchema, workspaceModelSchema } from '../../../models/__schemas__/model-schemas';
import { deleteKeys, resetKeys, shouldIgnoreKey } from '../ignore-keys';

const baseModelBuilder = createBuilder(baseModelSchema);
const workspaceModelBuilder = createBuilder(workspaceModelSchema);

describe('shouldIgnoreKey()', () => {
  it('should always ignore keys', () => {
    const base = baseModelBuilder.build();
    const workspace = workspaceModelBuilder.build();

    // don't ignore _id
    expect(shouldIgnoreKey('_id', base)).toBe(false);
    expect(shouldIgnoreKey('_id', workspace)).toBe(false);

    // ignore modified
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

describe('deleteKeys', () => {
  it('should always delete the modified key', () => {
    const base = baseModelBuilder.build();
    const workspace = workspaceModelBuilder.build();

    deleteKeys(base);
    deleteKeys(workspace);

    expect(Object.keys(base)).not.toContain('modified');
    expect(Object.keys(workspace)).not.toContain('modified');
  });
});

describe('resetKeys', () => {
  it('should clear parentId from the workspace', () => {
    const base = baseModelBuilder.parentId('abc').build();
    const workspace = workspaceModelBuilder.parentId('abc').build();

    resetKeys(base);
    resetKeys(workspace);

    expect(base.parentId).toBe('abc');
    expect(workspace.parentId).toBeNull();
  });
});
