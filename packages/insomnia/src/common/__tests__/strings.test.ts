import { describe, expect, it } from 'vitest';

import * as models from '../../models';
import { getWorkspaceLabel } from '../get-workspace-label';
import { strings } from '../strings';

describe('getWorkspaceLabel', () => {
  it('should return document label', () => {
    const w = models.workspace.init();
    w.scope = models.workspace.WorkspaceScopeKeys.design;
    expect(getWorkspaceLabel(w)).toBe(strings.document);
  });

  it('should return collection label', () => {
    const w = models.workspace.init();
    w.scope = models.workspace.WorkspaceScopeKeys.collection;
    expect(getWorkspaceLabel(w)).toBe(strings.collection);
  });
});
