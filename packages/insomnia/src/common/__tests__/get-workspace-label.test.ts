import type { Workspace } from 'insomnia-data';
import { models } from 'insomnia-data';
import { strings } from 'insomnia-data/common';
import { describe, expect, it } from 'vitest';

import { getWorkspaceLabel } from '../get-workspace-label';

describe('getWorkspaceLabel', () => {
  it('should return document label', () => {
    const w = models.workspace.init() as unknown as Workspace;
    w.scope = models.workspace.WorkspaceScopeKeys.design;
    expect(getWorkspaceLabel(w)).toBe(strings.document);
  });

  it('should return collection label', () => {
    const w = models.workspace.init() as unknown as Workspace;
    w.scope = models.workspace.WorkspaceScopeKeys.collection;
    expect(getWorkspaceLabel(w)).toBe(strings.collection);
  });
});
