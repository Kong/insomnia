import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeFileForRenderer } from '../write-file-for-renderer';

// File modes, links and renames over open files are POSIX behavior: on Windows the access follows the ACL of the folder
const describePosix = process.platform === 'win32' ? describe.skip : describe;

const modeOf = (filePath: string) => fs.statSync(filePath).mode & 0o777;

describe('writeFileForRenderer()', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'write-file-for-renderer-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes text and binary content, and creates the missing folders', async () => {
    const textPath = path.join(dir, 'a', 'b', 'text.txt');
    const binaryPath = path.join(dir, 'binary.bin');

    expect(await writeFileForRenderer({ path: textPath, content: 'hello' })).toBe(textPath);
    await writeFileForRenderer({ path: binaryPath, content: new Uint8Array([1, 2, 3]) });

    expect(fs.readFileSync(textPath, 'utf8')).toBe('hello');
    expect([...fs.readFileSync(binaryPath)]).toEqual([1, 2, 3]);
  });

  it('writes the content when a mode is given, also over an existing file', async () => {
    const filePath = path.join(dir, 'key.json');
    await writeFileForRenderer({ path: filePath, content: 'a long first version of the content', mode: 0o600 });
    await writeFileForRenderer({ path: filePath, content: 'short', mode: 0o600 });

    expect(fs.readFileSync(filePath, 'utf8')).toBe('short');
    expect(fs.readdirSync(dir)).toEqual(['key.json']);
  });

  it.each([-1, 0o1000, 1.5, Number.NaN])('rejects the mode %s and writes nothing', async mode => {
    const filePath = path.join(dir, 'rejected.txt');

    await expect(writeFileForRenderer({ path: filePath, content: 'x', mode })).rejects.toThrow('file mode');

    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it.each([undefined, 0o600])(
    'keeps an existing file as it was, and leaves nothing behind, when the write fails (mode %s)',
    async mode => {
      const filePath = path.join(dir, 'key.json');
      fs.writeFileSync(filePath, 'previous key');

      // Not a string or bytes: the write throws after the target was chosen
      await expect(writeFileForRenderer({ path: filePath, content: 5 as never, mode })).rejects.toThrow();

      expect(fs.readFileSync(filePath, 'utf8')).toBe('previous key');
      expect(fs.readdirSync(dir)).toEqual(['key.json']);
    },
  );

  describePosix('permissions and links', () => {
    it('creates the file readable and writable by its owner only when the mode is 0o600', async () => {
      const filePath = path.join(dir, 'key.json');

      await writeFileForRenderer({ path: filePath, content: 'secret', mode: 0o600 });

      expect(modeOf(filePath)).toBe(0o600);
    });

    it('gives the mode even when the process umask would allow more', async () => {
      const filePath = path.join(dir, 'key.json');
      const previous = process.umask(0);
      try {
        await writeFileForRenderer({ path: filePath, content: 'secret', mode: 0o600 });
      } finally {
        process.umask(previous);
      }

      expect(modeOf(filePath)).toBe(0o600);
    });

    it('replaces an existing file with wider permissions by one that only its owner can read', async () => {
      const filePath = path.join(dir, 'key.json');
      fs.writeFileSync(filePath, 'old');
      fs.chmodSync(filePath, 0o644);

      await writeFileForRenderer({ path: filePath, content: 'secret', mode: 0o600 });

      expect(modeOf(filePath)).toBe(0o600);
      expect(fs.readFileSync(filePath, 'utf8')).toBe('secret');
    });

    it('does not write through a hard link: the other name keeps its content and permissions', async () => {
      const shared = path.join(dir, 'shared.txt');
      const filePath = path.join(dir, 'key.json');
      fs.writeFileSync(shared, 'shared content');
      fs.chmodSync(shared, 0o644);
      fs.linkSync(shared, filePath);

      await writeFileForRenderer({ path: filePath, content: 'secret', mode: 0o600 });

      expect(fs.readFileSync(shared, 'utf8')).toBe('shared content');
      expect(modeOf(shared)).toBe(0o644);
      expect(fs.readFileSync(filePath, 'utf8')).toBe('secret');
      expect(modeOf(filePath)).toBe(0o600);
    });

    it('does not write through a symbolic link: the file it pointed to is left alone', async () => {
      const target = path.join(dir, 'target.txt');
      const filePath = path.join(dir, 'key.json');
      fs.writeFileSync(target, 'target content');
      fs.symlinkSync(target, filePath);

      await writeFileForRenderer({ path: filePath, content: 'secret', mode: 0o600 });

      expect(fs.readFileSync(target, 'utf8')).toBe('target content');
      expect(fs.lstatSync(filePath).isSymbolicLink()).toBe(false);
      expect(fs.readFileSync(filePath, 'utf8')).toBe('secret');
    });

    it('does not change how a file is written when no mode is given', async () => {
      const filePath = path.join(dir, 'plain.txt');
      const previous = process.umask(0o022);
      try {
        await writeFileForRenderer({ path: filePath, content: 'x' });
      } finally {
        process.umask(previous);
      }

      expect(modeOf(filePath)).toBe(0o644);
    });
  });
});
