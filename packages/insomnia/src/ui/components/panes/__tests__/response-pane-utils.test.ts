import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadResponseBody } from '../response-pane-utils';

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

      await downloadResponseBody(
        null,
        { contentType: 'application/json', bodyBuffer: Buffer.from('{}') },
        false,
      );

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

      await downloadResponseBody(
        { name: 'My Request' },
        { contentType: 'image/png', bodyBuffer: binaryData },
        false,
      );

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const { path, content } = mockWriteFile.mock.calls[0][0];
      expect(path).toBe('/tmp/out.png');
      expect(Buffer.isBuffer(content)).toBe(true);
      expect(content).toEqual(binaryData);
    });

    it('writes the raw Buffer when prettify is true but the content-type is not JSON', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.txt' });
      const textData = Buffer.from('Hello, World!');

      await downloadResponseBody(
        { name: 'My Request' },
        { contentType: 'text/plain', bodyBuffer: textData },
        true,
      );

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
});
