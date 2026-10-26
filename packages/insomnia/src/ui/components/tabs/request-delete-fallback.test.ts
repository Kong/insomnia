import { models } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

import { getRequestDeleteFallbackUrl, isRequestLikeDocType } from './request-delete-fallback';
import type { BaseTab } from './tab';

const makeTab = (overrides: Partial<BaseTab> = {}): BaseTab => ({
  type: 'request',
  name: 'Get Widgets',
  url: '/organization/org_1/project/proj_1/workspace/wrk_1/debug/request/req_1',
  organizationId: 'org_1',
  projectId: 'proj_1',
  workspaceId: 'wrk_1',
  projectName: 'My Project',
  workspaceName: 'My Collection',
  id: 'req_1',
  ...overrides,
});

describe('isRequestLikeDocType', () => {
  it.each([
    models.request.type,
    models.grpcRequest.type,
    models.webSocketRequest.type,
    models.socketIORequest.type,
  ])('returns true for %s', docType => {
    expect(isRequestLikeDocType(docType)).toBe(true);
  });

  it.each([
    models.requestGroup.type,
    models.workspace.type,
    models.project.type,
    models.unitTestSuite.type,
  ])('returns false for %s', docType => {
    expect(isRequestLikeDocType(docType)).toBe(false);
  });
});

describe('getRequestDeleteFallbackUrl', () => {
  it('points at the folder debug page when the request lived in a folder', () => {
    const closingTab = makeTab();

    const url = getRequestDeleteFallbackUrl({
      parentId: 'fld_1',
      closingTab,
      organizationId: 'org_1',
      projectId: 'proj_1',
    });

    expect(url).toBe('/organization/org_1/project/proj_1/workspace/wrk_1/debug/request-group/fld_1');
  });

  it('points at the collection root when the request was a direct child of the workspace', () => {
    const closingTab = makeTab();

    const url = getRequestDeleteFallbackUrl({
      parentId: 'wrk_1',
      closingTab,
      organizationId: 'org_1',
      projectId: 'proj_1',
    });

    expect(url).toBe('/organization/org_1/project/proj_1/workspace/wrk_1/debug');
  });

  it('uses the closing tab workspaceId, not the current route params, to build the URL', () => {
    // the request being deleted may belong to a different workspace/tab than
    // the one currently focused, so the fallback must key off the closing tab
    const closingTab = makeTab({ workspaceId: 'wrk_other' });

    const url = getRequestDeleteFallbackUrl({
      parentId: 'wrk_other',
      closingTab,
      organizationId: 'org_1',
      projectId: 'proj_1',
    });

    expect(url).toBe('/organization/org_1/project/proj_1/workspace/wrk_other/debug');
  });

  it('returns undefined when the tab being closed cannot be found', () => {
    const url = getRequestDeleteFallbackUrl({
      parentId: 'fld_1',
      closingTab: undefined,
      organizationId: 'org_1',
      projectId: 'proj_1',
    });

    expect(url).toBeUndefined();
  });

  it('returns undefined when there is no parentId', () => {
    const url = getRequestDeleteFallbackUrl({
      parentId: undefined,
      closingTab: makeTab(),
      organizationId: 'org_1',
      projectId: 'proj_1',
    });

    expect(url).toBeUndefined();
  });
});
