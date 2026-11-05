import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import git from 'isomorphic-git';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { fsClient } from '../fs-client';

describe('fsClient path containment', () => {
  let root: string;
  let base: string;
  let outside: string;

  beforeEach(async () => {
    root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-fsclient-'));
    base = path.join(root, 'base');
    outside = path.join(root, 'outside');
    await fs.promises.mkdir(outside);
  });

  afterEach(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  const escapingPaths = ['../escape.txt', './../escape.txt', 'a/../../escape.txt', '../outside/escape.txt', 'sub/../../outside/escape.txt'];

  it.each(escapingPaths)('rejects writeFile to %s and creates nothing outside base', async p => {
    const client = fsClient(base);
    await expect(client.promises.writeFile(p, 'pwn')).rejects.toThrow();
    expect(fs.existsSync(path.join(root, 'escape.txt'))).toBe(false);
    expect(fs.existsSync(path.join(outside, 'escape.txt'))).toBe(false);
  });

  it.each(['../newdir', './../newdir'])('rejects mkdir of %s', async p => {
    const client = fsClient(base);
    await expect(client.promises.mkdir(p)).rejects.toThrow();
    expect(fs.existsSync(path.join(root, 'newdir'))).toBe(false);
  });

  it('rejects unlink, rmdir, readFile, readdir, stat, lstat and readlink outside base', async () => {
    await fs.promises.writeFile(path.join(root, 'secret.txt'), 's');
    const client = fsClient(base);
    await expect(client.promises.unlink('../secret.txt')).rejects.toThrow();
    expect(fs.existsSync(path.join(root, 'secret.txt'))).toBe(true);
    await expect(client.promises.rmdir('../outside')).rejects.toThrow();
    expect(fs.existsSync(outside)).toBe(true);
    await expect(client.promises.readFile('../secret.txt')).rejects.toThrow();
    await expect(client.promises.readdir('..')).rejects.toThrow();
    await expect(client.promises.stat('../secret.txt')).rejects.toThrow();
    await expect(client.promises.lstat('../secret.txt')).rejects.toThrow();
    await expect(client.promises.readlink('../secret.txt')).rejects.toThrow();
  });

  it('still allows normal nested paths, dot paths and inner dot-dot segments', async () => {
    const client = fsClient(base);
    await client.promises.mkdir('a');
    await client.promises.writeFile('./a/f.txt', 'ok');
    await client.promises.writeFile('a/../g.txt', 'ok2');
    await client.promises.writeFile('/h.txt', 'ok3');
    expect(await client.promises.readFile('a/f.txt', 'utf8')).toBe('ok');
    expect(fs.readFileSync(path.join(base, 'g.txt'), 'utf8')).toBe('ok2');
    expect(fs.readFileSync(path.join(base, 'h.txt'), 'utf8')).toBe('ok3');
    expect(await client.promises.readdir('.')).toContain('a');
  });

  // End to end: isomorphic-git does not validate tree entry names, so a tree
  // entry named `..` produces `./../x` write paths on checkout.
  it('isomorphic-git checkout of a tree containing a ".." entry does not write outside base', async () => {
    const client = fsClient(base);
    const dir = '.';
    await git.init({ fs: client, dir, defaultBranch: 'main' });
    const blob = await git.writeBlob({ fs: client, dir, blob: Buffer.from('pwned') });
    const inner = await git.writeTree({ fs: client, dir, tree: [{ mode: '100644', path: 'pwn.txt', oid: blob, type: 'blob' }] });
    const rootTree = await git.writeTree({ fs: client, dir, tree: [{ mode: '040000', path: '..', oid: inner, type: 'tree' }] });
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
    expect(fs.existsSync(path.join(root, 'pwn.txt'))).toBe(false);
    expect(fs.existsSync(path.join(base, '..', 'pwn.txt'))).toBe(false);
  });
});
