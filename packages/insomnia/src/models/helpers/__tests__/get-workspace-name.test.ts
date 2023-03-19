import { describe, expect, it } from '@jest/globals';

import * as models from '../../../models';
import { ApiSpec } from '../../api-spec';
import { Workspace, WorkspaceScopeKeys } from '../../workspace';
import getWorkspaceName from '../get-workspace-name';

describe('getWorkspaceName', () => {
  it('returns workspace name', () => {
    const w = models.workspace.init() as Workspace;
    const s = models.apiSpec.init() as ApiSpec;
    w.scope = WorkspaceScopeKeys.collection;
    expect(getWorkspaceName(w, s)).toBe(w.name);
  });

  it('returns api spec name', () => {
    const w = models.workspace.init() as Workspace;
    const s = models.apiSpec.init() as ApiSpec;
    w.scope = WorkspaceScopeKeys.design;
    expect(getWorkspaceName(w, s)).toBe(s.fileName);
  });
});
