import { describe, expect, it } from '@jest/globals';

import * as models from '../../models';
import { WorkspaceScopeKeys } from '../../models/workspace';
import { getWorkspaceLabel } from '../get-workspace-label';
import { strings } from '../strings';

describe('getWorkspaceLabel', () => {
  it('should return document label', () => {
    const w = models.workspace.init();
    w.scope = WorkspaceScopeKeys.design;
    expect(getWorkspaceLabel(w)).toBe(strings.document);
  });

  it('should return collection label', () => {
    const w = models.workspace.init();
    w.scope = WorkspaceScopeKeys.collection;
    expect(getWorkspaceLabel(w)).toBe(strings.collection);
  });
});
