import { describe, expect, it } from 'vitest';

import { init, rewriteReferences, type WorkspaceMeta } from './workspace-meta';

const mkMeta = (overrides: Partial<WorkspaceMeta> = {}): WorkspaceMeta =>
  ({
    type: 'WorkspaceMeta',
    ...init(),
    _id: 'wrkm_1',
    parentId: 'wrk_1',
    ...overrides,
  }) as WorkspaceMeta;

const idMapping = new Map([
  ['env_old', 'env_new'],
  ['genv_old', 'genv_new'],
  ['req_old', 'req_new'],
  ['suite_old', 'suite_new'],
]);

describe('rewriteReferences', () => {
  it('remaps every active reference present in the mapping', () => {
    const meta = mkMeta({
      activeEnvironmentId: 'env_old',
      activeGlobalEnvironmentId: 'genv_old',
      activeRequestId: 'req_old',
      activeUnitTestSuiteId: 'suite_old',
    });

    expect(rewriteReferences(meta, idMapping)).toEqual({
      ...meta,
      activeEnvironmentId: 'env_new',
      activeGlobalEnvironmentId: 'genv_new',
      activeRequestId: 'req_new',
      activeUnitTestSuiteId: 'suite_new',
    });
  });

  it('keeps references that are not in the mapping unchanged', () => {
    const meta = mkMeta({
      activeEnvironmentId: 'env_unknown',
      activeRequestId: 'req_unknown',
    });

    const rewritten = rewriteReferences(meta, idMapping);

    expect(rewritten.activeEnvironmentId).toBe('env_unknown');
    expect(rewritten.activeRequestId).toBe('req_unknown');
  });

  it('keeps null references null', () => {
    const meta = mkMeta();

    expect(rewriteReferences(meta, idMapping)).toEqual(meta);
  });
});
