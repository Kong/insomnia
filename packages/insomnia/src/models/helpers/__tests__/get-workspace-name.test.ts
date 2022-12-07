import * as models from '@insomnia/models';
import { describe, expect, it } from '@jest/globals';

import { WorkspaceScopeKeys } from '../../workspace';
import getWorkspaceName from '../get-workspace-name';

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
