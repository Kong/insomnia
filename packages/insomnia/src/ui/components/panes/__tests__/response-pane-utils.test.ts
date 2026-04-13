import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getBodyBuffer } from '../../../../models/helpers/response-operations';
import { showToast } from '../../../../ui/components/toast-notification';

import { downloadResponseBody } from '../response-pane-utils';

vi.mock('../../../../models/helpers/response-operations', () => ({
  getBodyBuffer: vi.fn(),
}));

vi.mock('../../../../ui/components/toast-notification', () => ({
  showToast: vi.fn(),
}));

const mockGetBodyBuffer = vi.mocked(getBodyBuffer);
const mockShowToast = vi.mocked(showToast);

const mockWriteFile = vi.fn();
const mockShowSaveDialog = vi.fn();

beforeEach(() => {
  vi.stubGlobal('window', {
    dialog: { showSaveDialog: mockShowSaveDialog },
    main: { writeFile: mockWriteFile },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('downloadResponseBody', () => {
  describe('early-exit guards', () => {
    it('warns and skips the dialog when activeResponse is null', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await downloadResponseBody({ name: 'My Request' }, null, false);

      expect(warnSpy).toHaveBeenCalledWith('Nothing to download');
      expect(mockShowSaveDialog).not.toHaveBeenCalled();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('warns and skips the dialog when activeRequest is null', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await downloadResponseBody(null, { contentType: 'application/json', bodyBuffer: Buffer.from('{}') }, false);

      expect(warnSpy).toHaveBeenCalledWith('Nothing to download');
      expect(mockShowSaveDialog).not.toHaveBeenCalled();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  describe('save dialog cancelled', () => {
    it('opens the dialog but does not write when cancelled', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined });

      await downloadResponseBody(
        { name: 'My Request' },
        { contentType: 'application/json', bodyBuffer: Buffer.from('{}') },
        false,
      );

      expect(mockShowSaveDialog).toHaveBeenCalledOnce();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  describe('prettify branch (prettify=true, JSON content-type)', () => {
    it('writes a prettified JSON string, not a Buffer', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.json' });
      const rawJson = '{"b":2,"a":1}';

      await downloadResponseBody(
        { name: 'My Request' },
        { contentType: 'application/json', bodyBuffer: Buffer.from(rawJson) },
        true,
      );

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const { path, content } = mockWriteFile.mock.calls[0][0];
      expect(path).toBe('/tmp/out.json');
      // content must be a formatted string, not a Buffer
      expect(typeof content).toBe('string');
      expect(content).toContain('"b": 2');
      expect(content).toContain('"a": 1');
    });
  });

  describe('raw-bytes branch (default)', () => {
    it('writes the raw Buffer when prettify is false, preserving binary content', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.png' });
      // PNG magic bytes — would be corrupted by a UTF-8 round-trip
      const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      await downloadResponseBody({ name: 'My Request' }, { contentType: 'image/png', bodyBuffer: binaryData }, false);

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const { path, content } = mockWriteFile.mock.calls[0][0];
      expect(path).toBe('/tmp/out.png');
      expect(Buffer.isBuffer(content)).toBe(true);
      expect(content).toEqual(binaryData);
    });

    it('writes the raw Buffer when prettify is true but the content-type is not JSON', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.txt' });
      const textData = Buffer.from('Hello, World!');

      await downloadResponseBody({ name: 'My Request' }, { contentType: 'text/plain', bodyBuffer: textData }, true);

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const { content } = mockWriteFile.mock.calls[0][0];
      expect(Buffer.isBuffer(content)).toBe(true);
      expect(content).toEqual(textData);
    });

    it('writes an empty Buffer when bodyBuffer is null', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.bin' });

      await downloadResponseBody(
        { name: 'My Request' },
        { contentType: 'application/octet-stream', bodyBuffer: null },
        false,
      );

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const { content } = mockWriteFile.mock.calls[0][0];
      expect(Buffer.isBuffer(content)).toBe(true);
      expect(content.length).toBe(0);
    });
  });

  describe('large response fallback (bodyBuffer undefined, reads from disk)', () => {
    it('reads from disk via getBodyBuffer when bodyBuffer is undefined and writes raw Buffer', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.json' });
      const diskBody = Buffer.from('{"large": true}');
      mockGetBodyBuffer.mockResolvedValue(diskBody);

      await downloadResponseBody(
        { name: 'My Request' },
        { contentType: 'application/json', bodyPath: '/fake/body.response', bodyCompression: null },
        false,
      );

      expect(mockGetBodyBuffer).toHaveBeenCalledOnce();
      expect(mockWriteFile).toHaveBeenCalledOnce();
      const { content } = mockWriteFile.mock.calls[0][0];
      expect(Buffer.isBuffer(content)).toBe(true);
      expect(content).toEqual(diskBody);
    });

    it('writes empty Buffer when getBodyBuffer returns an empty buffer', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.bin' });
      mockGetBodyBuffer.mockResolvedValue(Buffer.alloc(0));

      await downloadResponseBody(
        { name: 'My Request' },
        { contentType: 'application/octet-stream', bodyPath: '/fake/body.response', bodyCompression: null },
        false,
      );

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const { content } = mockWriteFile.mock.calls[0][0];
      expect(Buffer.isBuffer(content)).toBe(true);
      expect(content.length).toBe(0);
    });

    it('does not crash and does not write when getBodyBuffer rejects, and shows an error toast', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.bin' });
      mockGetBodyBuffer.mockRejectedValue(new Error('disk read failed'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await downloadResponseBody(
        { name: 'My Request' },
        { contentType: 'application/octet-stream', bodyPath: '/fake/body.response', bodyCompression: null },
        false,
      );

      expect(errorSpy).toHaveBeenCalledWith('Failed to read response body for export', expect.any(Error));
      expect(mockShowToast).toHaveBeenCalledOnce();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('handles getBodyBuffer returning a string by converting to Buffer', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.txt' });
      mockGetBodyBuffer.mockResolvedValue('string response body');

      await downloadResponseBody(
        { name: 'My Request' },
        { contentType: 'text/plain', bodyPath: '/fake/body.response', bodyCompression: null },
        false,
      );

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const { content } = mockWriteFile.mock.calls[0][0];
      expect(Buffer.isBuffer(content)).toBe(true);
      expect(content.toString('utf8')).toBe('string response body');
    });
  });
});
