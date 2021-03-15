// @flow
import * as models from '../../models';
import { strings } from '../strings';
import { getWorkspaceLabel } from '../get-workspace-label';

describe('getWorkspaceLabel', () => {
  it('should return document label', () => {
    const w = models.workspace.init();
    w.scope = 'design';
    expect(getWorkspaceLabel(w)).toBe(strings.document);
  });

  it('should return collection label', () => {
    const w = models.workspace.init();
    w.scope = 'collection';
    expect(getWorkspaceLabel(w)).toBe(strings.collection);
  });
});
