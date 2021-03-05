// @flow

import * as models from '../../../models';
import getWorkspaceName from '../get-workspace-name';

describe('getWorkspaceName', () => {
  it('returns workspace name', () => {
    const w = models.workspace.init();
    const s = models.apiSpec.init();
    w.scope = 'collection';
    expect(getWorkspaceName(w, s)).toBe(w.name);
  });

  it('returns api spec name', () => {
    const w = models.workspace.init();
    const s = models.apiSpec.init();
    w.scope = 'designer';
    expect(getWorkspaceName(w, s)).toBe(s.fileName);
  });
});
