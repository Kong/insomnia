// @flow
import * as models from '../../models';
import { getWorkspaceLabel, strings } from '../strings';

describe('getWorkspaceLabel', () => {
  it('should return document label', () => {
    const w = models.workspace.init();
    w.scope = 'designer';
    expect(getWorkspaceLabel(w)).toBe(strings.document);
  });

  it('should return collection label', () => {
    const w = models.workspace.init();
    w.scope = 'collection';
    expect(getWorkspaceLabel(w)).toBe(strings.collection);
  });
});
