// @flow
import * as models from '../../models';
import { strings } from '../strings';
import { getWorkspaceLabel } from '../get-workspace-label';
import { WorkspaceScopeKeys } from '../../models/workspace';

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
