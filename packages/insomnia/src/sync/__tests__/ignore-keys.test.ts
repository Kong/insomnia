import { createBuilder } from '@develohpanda/fluent-builder';
import { describe, expect, it } from '@jest/globals';

import { baseModelSchema, workspaceModelSchema } from '../../models/__schemas__/model-schemas';
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

    // do ignore modified
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

    // Don't delete _id
    expect('_id' in base).toBe(true);
    expect('_id' in workspace).toBe(true);

    // Do delete modified
    expect('modified' in base).not.toBe(true);
    expect('modified' in workspace).not.toBe(true);
  });
});

describe('resetKeys', () => {
  it('should clear parentId from the workspace', () => {
    const base = baseModelBuilder._id('123').parentId('abc').build();
    const workspace = workspaceModelBuilder._id('123').parentId('abc').build();

    resetKeys(base);
    resetKeys(workspace);

    // Don't reset _id
    expect(base._id).toBe('123');
    expect(workspace._id).toBe('123');

    // Do reset parentId for a workspace
    expect(base.parentId).toBe('abc');
    expect(workspace.parentId).toBeNull();
  });
});
