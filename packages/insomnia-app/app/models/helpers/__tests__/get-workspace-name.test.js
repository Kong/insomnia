// @flow

import * as models from '../../../models';
import getWorkspaceName from '../get-workspace-name';
import { WorkspaceScopeKeys } from '../../workspace';

describe('getWorkspaceName', () => {
  it('returns workspace name', () => {
    const w = models.workspace.init();
    const s = models.apiSpec.init();
    w.scope = WorkspaceScopeKeys.collection;
    expect(getWorkspaceName(w, s)).toBe(w.name);
  });

  it('returns api spec name', () => {
    const w = models.workspace.init();
    const s = models.apiSpec.init();
    w.scope = WorkspaceScopeKeys.design;
    expect(getWorkspaceName(w, s)).toBe(s.fileName);
  });
});
