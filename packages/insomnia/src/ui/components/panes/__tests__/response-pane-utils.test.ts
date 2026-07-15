import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadResponseBody } from '../response-pane-utils';

const mockWriteFile = vi.fn();
const mockShowSaveDialog = vi.fn();
const mockWriteResponseBodyToFile = vi.fn();

beforeEach(() => {
  vi.stubGlobal('window', {
    dialog: { showSaveDialog: mockShowSaveDialog },
    main: { writeFile: mockWriteFile, writeResponseBodyToFile: mockWriteResponseBodyToFile },
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
        { contentType: 'application/json', bodyBuffer: new TextEncoder().encode('{}') },
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
        { contentType: 'application/json', bodyBuffer: new TextEncoder().encode('{}') },
        false,
      );

      expect(mockShowSaveDialog).toHaveBeenCalledOnce();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  describe('prettify branch (prettify=true, JSON content-type)', () => {
    it('writes a prettified JSON string, not raw bytes', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.json' });
      const rawJson = '{"b":2,"a":1}';

      await downloadResponseBody(
        { name: 'My Request' },
        { contentType: 'application/json', bodyBuffer: new TextEncoder().encode(rawJson) },
        true,
      );

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const { path, content } = mockWriteFile.mock.calls[0][0];
      expect(path).toBe('/tmp/out.json');
      // content must be a formatted string, not raw bytes
      expect(typeof content).toBe('string');
      expect(content).toContain('"b": 2');
      expect(content).toContain('"a": 1');
    });
  });

  describe('raw-bytes branch (default)', () => {
    it('writes raw bytes when prettify is false, preserving binary content', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.png' });
      // PNG magic bytes — would be corrupted by a UTF-8 round-trip
      const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      await downloadResponseBody({ name: 'My Request' }, { contentType: 'image/png', bodyBuffer: binaryData }, false);

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const { path, content } = mockWriteFile.mock.calls[0][0];
      expect(path).toBe('/tmp/out.png');
      expect(content).toBeInstanceOf(Uint8Array);
      expect(content).toEqual(binaryData);
    });

    it('writes raw bytes when prettify is true but the content-type is not JSON', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.txt' });
      const textData = new TextEncoder().encode('Hello, World!');

      await downloadResponseBody({ name: 'My Request' }, { contentType: 'text/plain', bodyBuffer: textData }, true);

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const { content } = mockWriteFile.mock.calls[0][0];
      expect(content).toBeInstanceOf(Uint8Array);
      expect(content).toEqual(textData);
    });

    it('writes empty bytes when bodyBuffer is null', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.bin' });

      await downloadResponseBody(
        { name: 'My Request' },
        { contentType: 'application/octet-stream', bodyBuffer: null },
        false,
      );

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const { content } = mockWriteFile.mock.calls[0][0];
      expect(content).toBeInstanceOf(Uint8Array);
      expect(content.length).toBe(0);
    });
  });

  describe('large responses (bodyBuffer absent, body on disk)', () => {
    it('copies the body from disk instead of writing an empty file', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/large.json' });

      // The loader leaves bodyBuffer undefined above LARGE_RESPONSE_MB; before this fix that
      // produced a 0-byte export.
      await downloadResponseBody(
        { name: 'My Request' },
        { contentType: 'application/json', bodyPath: '/responses/abc.response' },
        false,
      );

      expect(mockWriteResponseBodyToFile).toHaveBeenCalledWith({
        sourcePath: '/responses/abc.response',
        destinationPath: '/tmp/large.json',
        bodyCompression: null,
      });
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('forwards zip compression so the copy is gunzipped', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/large.json' });

      await downloadResponseBody(
        { name: 'My Request' },
        { contentType: 'application/json', bodyPath: '/responses/abc.response', bodyCompression: 'zip' },
        false,
      );

      expect(mockWriteResponseBodyToFile).toHaveBeenCalledWith(
        expect.objectContaining({ bodyCompression: 'zip' }),
      );
    });

    it('treats __NEEDS_MIGRATION__ compression as uncompressed', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/large.json' });

      await downloadResponseBody(
        {
          name: 'My Request',
        },
        {
          contentType: 'application/json',
          bodyPath: '/responses/abc.response',
          bodyCompression: '__NEEDS_MIGRATION__',
        },
        false,
      );

      expect(mockWriteResponseBodyToFile).toHaveBeenCalledWith(expect.objectContaining({ bodyCompression: null }));
    });

    it('prefers the streaming copy over an in-memory buffer for the raw export', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.json' });

      await downloadResponseBody(
        { name: 'My Request' },
        {
          contentType: 'application/json',
          bodyBuffer: new TextEncoder().encode('{}'),
          bodyPath: '/responses/abc.response',
        },
        false,
      );

      expect(mockWriteResponseBodyToFile).toHaveBeenCalledOnce();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  describe('prettify falls back to reading the body from disk', () => {
    it('prettifies a disk-backed body via getBodyBuffer', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.json' });
      const getBodyBuffer = vi.fn().mockResolvedValue(new TextEncoder().encode('{"b":2,"a":1}'));

      await downloadResponseBody(
        { name: 'My Request' },
        { contentType: 'application/json', bodyPath: '/responses/abc.response' },
        true,
        getBodyBuffer,
      );

      expect(getBodyBuffer).toHaveBeenCalledOnce();
      expect(mockWriteResponseBodyToFile).not.toHaveBeenCalled();
      const { content } = mockWriteFile.mock.calls[0][0];
      expect(typeof content).toBe('string');
      expect(content).toContain('"b": 2');
    });

    it('throws the read-failure message when getBodyBuffer returns a string', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.json' });
      const getBodyBuffer = vi.fn().mockResolvedValue('Failed to read response body');

      await expect(
        downloadResponseBody(
          { name: 'My Request' },
          { contentType: 'application/json', bodyPath: '/responses/abc.response' },
          true,
          getBodyBuffer,
        ),
      ).rejects.toThrow('Failed to read response body');

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('throws rather than writing an empty file when the disk read yields nothing', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.json' });
      const getBodyBuffer = vi.fn().mockResolvedValue(null);

      await expect(
        downloadResponseBody(
          { name: 'My Request' },
          { contentType: 'application/json', bodyPath: '/responses/abc.response' },
          true,
          getBodyBuffer,
        ),
      ).rejects.toThrow('Failed to read response body from filesystem');

      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });
});
