import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { app } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeResponseBodyToFile } from '../write-response-body-to-file';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(),
  },
}));

describe('writeResponseBodyToFile', () => {
  let tempDir: string;
  let responsesDir: string;
  let originalDataPath: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-response-download-'));
    responsesDir = path.join(tempDir, 'responses');
    fs.mkdirSync(responsesDir, { recursive: true });
    vi.mocked(app.getPath).mockReturnValue(tempDir);
    originalDataPath = process.env.INSOMNIA_DATA_PATH;
    process.env.INSOMNIA_DATA_PATH = tempDir;
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (originalDataPath === undefined) {
      delete process.env.INSOMNIA_DATA_PATH;
    } else {
      process.env.INSOMNIA_DATA_PATH = originalDataPath;
    }
    vi.clearAllMocks();
  });

  it('copies an uncompressed stored response file to the destination', async () => {
    const sourcePath = path.join(responsesDir, 'raw.response');
    const destinationPath = path.join(tempDir, 'downloads', 'raw.bin');
    fs.writeFileSync(sourcePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const result = await writeResponseBodyToFile({
      sourcePath,
      destinationPath,
      bodyCompression: null,
    });

    expect(result).toBe(destinationPath);
    expect(fs.readFileSync(destinationPath)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it('gunzips a compressed stored response file before writing', async () => {
    const sourcePath = path.join(responsesDir, 'compressed.response');
    const destinationPath = path.join(tempDir, 'downloads', 'compressed.txt');
    fs.writeFileSync(sourcePath, zlib.gzipSync('compressed body'));

    await writeResponseBodyToFile({
      sourcePath,
      destinationPath,
      bodyCompression: 'zip',
    });

    expect(fs.readFileSync(destinationPath, 'utf8')).toBe('compressed body');
  });

  it('rejects sources outside the responses directory', async () => {
    const sourcePath = path.join(tempDir, 'outside.response');
    const destinationPath = path.join(tempDir, 'downloads', 'outside.txt');
    fs.writeFileSync(sourcePath, 'outside');

    await expect(
      writeResponseBodyToFile({
        sourcePath,
        destinationPath,
        bodyCompression: null,
      }),
    ).rejects.toThrow(
      'writeResponseBodyToFile: sourcePath is outside the allowed responses directory or does not end in .response',
    );
  });

  it('rejects files in the responses directory that do not use the .response extension', async () => {
    const sourcePath = path.join(responsesDir, 'wrong-extension.txt');
    const destinationPath = path.join(tempDir, 'downloads', 'wrong-extension.txt');
    fs.writeFileSync(sourcePath, 'wrong extension');

    await expect(
      writeResponseBodyToFile({
        sourcePath,
        destinationPath,
        bodyCompression: null,
      }),
    ).rejects.toThrow(
      'writeResponseBodyToFile: sourcePath is outside the allowed responses directory or does not end in .response',
    );
  });
});
