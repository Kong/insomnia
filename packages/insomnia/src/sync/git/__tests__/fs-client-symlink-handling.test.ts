import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import git from 'isomorphic-git';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { fsClient } from '../fs-client';

describe('fsClient symlink handling', () => {
  let root: string;
  let base: string;
  let outside: string;

  beforeEach(async () => {
    root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-fsclient-link-'));
    base = path.join(root, 'base');
    outside = path.join(root, 'outside');
    await fs.promises.mkdir(outside);
  });

  afterEach(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  // isomorphic-git calls symlink(target, filepath) with the stored blob text as target.
  it('creates the link at filepath with the target text stored verbatim', async () => {
    const client = fsClient(base);
    await client.promises.symlink('../shared/x', 'link');
    expect(fs.readlinkSync(path.join(base, 'link'))).toBe('../shared/x');
    expect(await client.promises.readlink('link')).toBe('../shared/x');
    await client.promises.symlink('inner/file.txt', 'rel');
    expect(fs.readlinkSync(path.join(base, 'rel'))).toBe('inner/file.txt');
  });

  it('does not create a link location outside base', async () => {
    const client = fsClient(base);
    await expect(client.promises.symlink('anything', '../evil-link')).rejects.toThrow();
    expect(fs.existsSync(path.join(root, 'evil-link'))).toBe(false);
    expect(fs.lstatSync(base).isDirectory()).toBe(true);
  });

  it('refuses writes, mkdir and reads through a symlinked directory that points outside base', async () => {
    const client = fsClient(base);
    await client.promises.symlink(outside, 'esc');
    await expect(client.promises.writeFile('esc/pwn.txt', 'x')).rejects.toThrow();
    await expect(client.promises.mkdir('esc/sub')).rejects.toThrow();
    expect(fs.readdirSync(outside)).toEqual([]);
    fs.writeFileSync(path.join(outside, 'secret.txt'), 's');
    await expect(client.promises.readFile('esc/secret.txt')).rejects.toThrow();
    await expect(client.promises.unlink('esc/secret.txt')).rejects.toThrow();
    expect(fs.existsSync(path.join(outside, 'secret.txt'))).toBe(true);
  });

  it('refuses writing through a symlinked leaf, including a dangling one, pointing outside base', async () => {
    const client = fsClient(base);
    fs.writeFileSync(path.join(outside, 'target.txt'), 'orig');
    await client.promises.symlink(path.join(outside, 'target.txt'), 'leaf');
    await expect(client.promises.writeFile('leaf', 'pwn')).rejects.toThrow();
    expect(fs.readFileSync(path.join(outside, 'target.txt'), 'utf8')).toBe('orig');
    await client.promises.symlink(path.join(outside, 'new.txt'), 'dangling');
    await expect(client.promises.writeFile('dangling', 'pwn')).rejects.toThrow();
    expect(fs.existsSync(path.join(outside, 'new.txt'))).toBe(false);
  });

  it('allows an outward-pointing link to be created, inspected and removed without following it', async () => {
    const client = fsClient(base);
    await client.promises.symlink(outside, 'esc');
    expect((await client.promises.lstat('esc')).isSymbolicLink()).toBe(true);
    expect(await client.promises.readlink('esc')).toBe(outside);
    await client.promises.unlink('esc');
    expect(fs.existsSync(path.join(base, 'esc'))).toBe(false);
    expect(fs.existsSync(outside)).toBe(true);
  });

  it('allows writes through symlinks that stay inside base', async () => {
    const client = fsClient(base);
    await client.promises.mkdir('real');
    await client.promises.symlink('real', 'alias');
    await client.promises.writeFile('alias/ok.txt', 'ok');
    expect(fs.readFileSync(path.join(base, 'real', 'ok.txt'), 'utf8')).toBe('ok');
  });

  it('works when basePath itself is reached through a symlink', async () => {
    fs.mkdirSync(base);
    const linkedBase = path.join(root, 'linked-base');
    fs.symlinkSync(base, linkedBase);
    const client = fsClient(linkedBase);
    await client.promises.writeFile('ok.txt', 'ok');
    expect(fs.readFileSync(path.join(base, 'ok.txt'), 'utf8')).toBe('ok');
  });

  it('isomorphic-git checkout of a symlink entry followed by a file beneath it does not write outside base', async () => {
    const client = fsClient(base);
    const dir = '.';
    await git.init({ fs: client, dir, defaultBranch: 'main' });
    const linkBlob = await git.writeBlob({ fs: client, dir, blob: Buffer.from(outside) });
    const fileBlob = await git.writeBlob({ fs: client, dir, blob: Buffer.from('pwned') });
    const inner = await git.writeTree({ fs: client, dir, tree: [{ mode: '100644', path: 'pwn.txt', oid: fileBlob, type: 'blob' }] });
    // Git tree names are unique, so use a second directory entry that is processed after the link.
    const rootTree = await git.writeTree({
      fs: client,
      dir,
      tree: [
        { mode: '120000', path: 'esc', oid: linkBlob, type: 'blob' },
        { mode: '100644', path: 'esc2', oid: fileBlob, type: 'blob' },
        { mode: '040000', path: 'esc-dir', oid: inner, type: 'tree' },
      ],
    });
    const commit = await git.writeCommit({
      fs: client,
      dir,
      commit: {
        message: 'evil',
        tree: rootTree,
        parent: [],
        author: { name: 'a', email: 'a@a', timestamp: 1, timezoneOffset: 0 },
        committer: { name: 'a', email: 'a@a', timestamp: 1, timezoneOffset: 0 },
      },
    });
    await git.writeRef({ fs: client, dir, ref: 'refs/heads/main', value: commit, force: true });
    try {
      await git.checkout({ fs: client, dir, ref: 'main', force: true });
    } catch {
      // checkout is expected to fail once the escaping entry is refused
    }
    expect(fs.readdirSync(outside)).toEqual([]);
    // the link itself must have been written verbatim in base
    expect(fs.readlinkSync(path.join(base, 'esc'))).toBe(outside);
  });
});
