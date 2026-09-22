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
});
