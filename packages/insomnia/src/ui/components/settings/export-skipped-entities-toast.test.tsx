// @vitest-environment jsdom
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExportEntityError, InsomniaV5ExportResult } from '~/common/insomnia-v5';
import { showToast } from '~/ui/components/toast-notification';

import { showExportSkippedEntitiesToast } from './export-skipped-entities-toast';

vi.mock('~/ui/components/toast-notification', () => ({
  showToast: vi.fn(),
}));

const skip = (name: string, message = 'expected string, received null'): ExportEntityError => ({
  entityId: `req_${name}`,
  entityType: 'Request',
  name,
  path: 'collection[0]',
  issues: [{ path: 'authentication', message }],
});

const result = (overrides: Partial<InsomniaV5ExportResult> = {}): InsomniaV5ExportResult => ({
  yaml: 'type: collection.insomnia.rest/5.0\n',
  errors: [],
  ...overrides,
});

const renderedDescription = () => {
  const [content] = vi.mocked(showToast).mock.calls[0];
  return renderToStaticMarkup(content.description as ReactElement);
};

describe('showExportSkippedEntitiesToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stays quiet when nothing was skipped', () => {
    showExportSkippedEntitiesToast([{ result: result() }, { result: result() }]);

    expect(showToast).not.toHaveBeenCalled();
  });

  it('names each skipped entity and keeps the toast on screen', () => {
    showExportSkippedEntitiesToast([{ workspaceName: 'Broken Workspace', result: result({ errors: [skip('Get users')] }) }]);

    const [content, options] = vi.mocked(showToast).mock.calls[0];
    expect(options).toEqual({ timeout: null });
    expect(content.status).toBe('error');
    expect(content.title).toBe('Export completed with 1 skipped entity');
    expect(renderedDescription()).toContain('Broken Workspace: Get users (Request) — expected string, received null');
  });

  it('says nothing was written when a workspace could not be exported at all, naming the entities', () => {
    showExportSkippedEntitiesToast([
      { workspaceName: 'Broken Workspace', result: { yaml: '', errors: [skip('Broken Request')] } },
    ]);

    const description = renderedDescription();
    expect(description).toContain('Broken Workspace: export failed, no file was written');
    expect(description).toContain('Broken Workspace: Broken Request (Request) — expected string, received null');
  });

  it('lists at most five entries and counts the rest', () => {
    const errors = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'].map(name => skip(name));
    showExportSkippedEntitiesToast([{ result: result({ errors }) }]);

    expect(vi.mocked(showToast).mock.calls[0][0].title).toBe('Export completed with 7 skipped entities');
    const description = renderedDescription();
    expect(description).toContain('Five (Request)');
    expect(description).not.toContain('Six');
    expect(description).toContain('and 2 more');
  });
});
