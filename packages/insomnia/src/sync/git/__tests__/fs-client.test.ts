import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { fsClient } from '../fs-client';

describe('fsClient symlink containment', () => {
  let basePath: string;

  beforeEach(async () => {
    basePath = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-fs-client-'));
  });

  afterEach(async () => {
    await fs.promises.rm(basePath, { recursive: true, force: true });
  });

  it('creates a symlink whose target stays inside the repo', async () => {
    const client = fsClient(basePath);
    await client.promises.writeFile('real.txt', 'hi');
    await client.promises.symlink('real.txt', 'link.txt');

    const linkAbsPath = path.join(basePath, 'link.txt');
    const stat = await fs.promises.lstat(linkAbsPath);
    expect(stat.isSymbolicLink()).toBe(true);
    expect(await fs.promises.readFile(linkAbsPath, 'utf8')).toBe('hi');
  });

  // Regression: isomorphic-git stats/readdirs the working dir itself as '.'.
  it('allows access to the working directory itself', async () => {
    const client = fsClient(basePath);
    await expect(client.promises.readdir('.')).resolves.toEqual([]);
    await expect(client.promises.stat('.')).resolves.toBeTruthy();
  });

  it('works when basePath is reached through a symlink, but still blocks in-repo symlink escapes', async () => {
    const holder = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-fs-client-holder-'));
    try {
      const linkedBase = path.join(holder, 'base-link');
      await fs.promises.symlink(basePath, linkedBase);
      await fs.promises.symlink(holder, path.join(basePath, 'escape'));

      const client = fsClient(linkedBase);
      await expect(client.promises.readdir('.')).resolves.toBeTruthy();
      await client.promises.writeFile('ok.txt', 'hi');
      expect(await fs.promises.readFile(path.join(basePath, 'ok.txt'), 'utf8')).toBe('hi');
      await expect(client.promises.writeFile('escape/x.txt', 'x')).rejects.toThrow();
    } finally {
      await fs.promises.rm(holder, { recursive: true, force: true });
    }
  });

  // Regression for the Git-Sync symlink write-containment fix: a commit's
  // tree entry can set a symlink target that, once resolved against the
  // repo's working directory, escapes it entirely (e.g. a long chain of
  // `../..` segments). isomorphic-git calls fsClient.promises.symlink with
  // that raw target string — it must never be allowed to create a link that
  // resolves outside basePath.
  it('refuses to create a symlink whose target escapes the repo', async () => {
    const client = fsClient(basePath);
    const outsideDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-fs-client-outside-'));
    try {
      const target = path.join(outsideDir, 'outside.txt');
      const relativeTarget = path.relative(basePath, target);

      await expect(client.promises.symlink(relativeTarget, 'escape.yaml')).rejects.toThrow();

      const linkAbsPath = path.join(basePath, 'escape.yaml');
      await expect(fs.promises.lstat(linkAbsPath)).rejects.toThrow();
    } finally {
      await fs.promises.rm(outsideDir, { recursive: true, force: true });
    }
  });

  it('refuses to read/write a path that escapes the repo via traversal segments', async () => {
    const client = fsClient(basePath);
    await expect(client.promises.writeFile('../escape.txt', 'x')).rejects.toThrow();
    await expect(client.promises.readFile('../../some-other-dir/some-file.txt')).rejects.toThrow();
  });

  // Regression: a directory inside basePath that's already a symlink to
  // somewhere outside it (planted by some mechanism other than this client)
  // must not let reads or writes through it escape basePath, even though
  // the relative path string never contains `..`.
  it('refuses to read/write through a pre-existing symlinked ancestor directory', async () => {
    const outsideDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-fs-client-outside-'));
    try {
      await fs.promises.writeFile(path.join(outsideDir, 'secret.txt'), 'outside-secret');
      await fs.promises.symlink(outsideDir, path.join(basePath, 'linked-dir'));

      const client = fsClient(basePath);
      await expect(client.promises.readFile('linked-dir/secret.txt')).rejects.toThrow();
      await expect(client.promises.writeFile('linked-dir/new-file.txt', 'x')).rejects.toThrow();

      await expect(fs.promises.access(path.join(outsideDir, 'new-file.txt'))).rejects.toThrow();
    } finally {
      await fs.promises.rm(outsideDir, { recursive: true, force: true });
    }
  });

  it('refuses to write through a pre-existing symlinked leaf file', async () => {
    const outsideDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-fs-client-outside-'));
    try {
      const outsideTarget = path.join(outsideDir, 'outside-secret.txt');
      await fs.promises.writeFile(outsideTarget, 'original');
      await fs.promises.symlink(outsideTarget, path.join(basePath, 'leaf-link.txt'));

      const client = fsClient(basePath);
      await expect(client.promises.writeFile('leaf-link.txt', 'new-content')).rejects.toThrow();

      expect(await fs.promises.readFile(outsideTarget, 'utf8')).toBe('original');
    } finally {
      await fs.promises.rm(outsideDir, { recursive: true, force: true });
    }
  });

  it('refuses to read through a pre-existing symlinked leaf file', async () => {
    const outsideDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-fs-client-outside-'));
    try {
      const outsideTarget = path.join(outsideDir, 'outside-secret.txt');
      await fs.promises.writeFile(outsideTarget, 'top-secret-outside-contents');
      await fs.promises.symlink(outsideTarget, path.join(basePath, 'leaf-link.txt'));

      const client = fsClient(basePath);
      await expect(client.promises.readFile('leaf-link.txt', 'utf8')).rejects.toThrow();
    } finally {
      await fs.promises.rm(outsideDir, { recursive: true, force: true });
    }
  });

  it('refuses to stat through a pre-existing symlinked leaf file', async () => {
    const outsideDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-fs-client-outside-'));
    try {
      const outsideTarget = path.join(outsideDir, 'outside-secret.txt');
      await fs.promises.writeFile(outsideTarget, 'top-secret-outside-contents');
      await fs.promises.symlink(outsideTarget, path.join(basePath, 'leaf-link.txt'));

      const client = fsClient(basePath);
      await expect(client.promises.stat('leaf-link.txt')).rejects.toThrow();
    } finally {
      await fs.promises.rm(outsideDir, { recursive: true, force: true });
    }
  });

  it('reads and writes normally through legitimate nested directories with no symlinks', async () => {
    const client = fsClient(basePath);
    await client.promises.mkdir('nested/deeper', { recursive: true });
    await client.promises.writeFile('nested/deeper/file.txt', 'hello');

    expect(await client.promises.readFile('nested/deeper/file.txt', 'utf8')).toBe('hello');
    expect(await fs.promises.readFile(path.join(basePath, 'nested', 'deeper', 'file.txt'), 'utf8')).toBe('hello');

    // A second file in an already-validated directory must still work
    // (exercises the per-instance validated-directory cache).
    await client.promises.writeFile('nested/deeper/other.txt', 'world');
    expect(await client.promises.readFile('nested/deeper/other.txt', 'utf8')).toBe('world');
  });
});
