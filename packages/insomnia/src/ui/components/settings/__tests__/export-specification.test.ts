// @vitest-environment jsdom
import { AnalyticsEvent } from 'insomnia/src/ui/analytics';
import { showError, showModal } from 'insomnia/src/ui/components/modals';
import { exportSpecificationToFile } from 'insomnia/src/ui/components/settings/import-export';
import { services } from 'insomnia-data';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('~/root', () => ({
  useRootLoaderData: () => ({}),
}));

vi.mock('insomnia/src/ui/components/modals', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    showModal: vi.fn(),
    showError: vi.fn(),
  };
});

const YAML_SPEC = ['openapi: 3.0.0', 'info:', '  title: Pet Store', '  version: 1.0.0', 'paths: {}'].join('\n');
const JSON_SPEC = JSON.stringify({ openapi: '3.0.0', info: { title: 'Pet Store', version: '1.0.0' }, paths: {} });

const mockShowModal = vi.mocked(showModal);
const mockShowError = vi.mocked(showError);
const mockShowSaveDialog = vi.fn();
const mockWriteFile = vi.fn();
const mockTrackAnalyticsEvent = vi.fn();

/**
 * Drives the SelectModal shown by exportSpecificationToFile() as if the user had
 * picked a format and pressed Done. The modal host is mocked, so we invoke the
 * onDone callback directly.
 */
const selectExportFormat = async (format: 'json' | 'yaml') => {
  const selectModalCall = mockShowModal.mock.calls.find(
    ([, options]) => typeof (options as { onDone?: unknown })?.onDone === 'function',
  );
  expect(selectModalCall, 'expected a format selection modal to be shown').toBeTruthy();
  const [, options] = selectModalCall! as unknown as [{ name?: string }, { onDone: (format: string | null) => Promise<void> }];
  mockShowModal.mockClear();
  await options.onDone(format);
};

const writtenFiles = () => mockWriteFile.mock.calls.map(([{ path, content }]) => ({ path, content }));

describe('exportSpecificationToFile()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(window, {
      dialog: { showSaveDialog: mockShowSaveDialog },
      main: { writeFile: mockWriteFile, trackAnalyticsEvent: mockTrackAnalyticsEvent },
      app: { getPath: () => '/desktop' },
      path: {
        join: (...args: string[]) => args.join('/'),
        dirname: (path: string) => path.slice(0, path.lastIndexOf('/')),
      },
    });
    mockShowSaveDialog.mockResolvedValue({ filePath: '/tmp/export/out.yaml', canceled: false });
    window.localStorage.clear();
  });

  it('shows an error modal when the API collection has no specification', async () => {
    const workspace = await services.workspace.create({ name: 'Empty API Collection', scope: 'collection' });

    await exportSpecificationToFile(workspace);
    expect(mockShowModal).toHaveBeenCalledTimes(1);
    let [, options] = mockShowModal.mock.calls[0] as unknown as [{ name?: string }, { title: string }];
    expect(options.title).toBe('Cannot export');

    // Same guard covers a spec record whose contents were cleared
    mockShowModal.mockClear();
    await services.apiSpec.updateOrCreateForParentId(workspace._id, { contents: '', contentType: 'yaml' });

    await exportSpecificationToFile(workspace);
    expect(mockShowModal).toHaveBeenCalledTimes(1);
    [, options] = mockShowModal.mock.calls[0] as unknown as [{ name?: string }, { title: string }];
    expect(options.title).toBe('Cannot export');
  });

  it('writes the spec unchanged when the requested format matches the source format', async () => {
    const workspace = await services.workspace.create({ name: 'YAML API Collection', scope: 'collection' });
    await services.apiSpec.updateOrCreateForParentId(workspace._id, { contents: YAML_SPEC, contentType: 'yaml' });

    await exportSpecificationToFile(workspace);
    await selectExportFormat('yaml');

    expect(mockShowError).not.toHaveBeenCalled();
    expect(writtenFiles()).toEqual([{ path: '/tmp/export/out.yaml', content: YAML_SPEC }]);
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith({
      event: AnalyticsEvent.dataExport,
      properties: { type: 'yaml', scope: 'collection' },
    });
  });

  it('converts a YAML spec to JSON when requested', async () => {
    const workspace = await services.workspace.create({ name: 'Converted API Collection', scope: 'collection' });
    await services.apiSpec.updateOrCreateForParentId(workspace._id, { contents: YAML_SPEC, contentType: 'yaml' });

    await exportSpecificationToFile(workspace);
    await selectExportFormat('json');

    expect(mockShowError).not.toHaveBeenCalled();
    const [{ path, content }] = writtenFiles();
    expect(path).toBe('/tmp/export/out.yaml');
    expect(JSON.parse(content)).toMatchObject({ openapi: '3.0.0', info: { title: 'Pet Store' } });
  });

  it('converts a JSON spec to YAML when requested', async () => {
    const workspace = await services.workspace.create({ name: 'JSON API Collection', scope: 'collection' });
    await services.apiSpec.updateOrCreateForParentId(workspace._id, { contents: JSON_SPEC, contentType: 'json' });

    await exportSpecificationToFile(workspace);
    await selectExportFormat('yaml');

    expect(mockShowError).not.toHaveBeenCalled();
    const [{ content }] = writtenFiles();
    expect(content).toContain('openapi: 3.0.0');
    expect(content).toContain('title: Pet Store');
  });

  it('reports an error instead of writing a file when the spec cannot be converted', async () => {
    const workspace = await services.workspace.create({ name: 'Invalid API Collection', scope: 'collection' });
    await services.apiSpec.updateOrCreateForParentId(workspace._id, {
      contents: 'openapi: [unclosed',
      contentType: 'yaml',
    });

    await exportSpecificationToFile(workspace);
    await selectExportFormat('json');

    expect(mockShowError).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('does not write a file when the save dialog is cancelled', async () => {
    const workspace = await services.workspace.create({ name: 'Cancelled API Collection', scope: 'collection' });
    await services.apiSpec.updateOrCreateForParentId(workspace._id, { contents: YAML_SPEC, contentType: 'yaml' });
    mockShowSaveDialog.mockResolvedValue({ filePath: undefined, canceled: true });

    await exportSpecificationToFile(workspace);
    await selectExportFormat('yaml');

    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});
