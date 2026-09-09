import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { fsClient } from '../fs-client';

describe('fsClient', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-fs-client-test-'));
  });

  afterEach(() => {
    fs.rmSync(basePath, { recursive: true, force: true });
  });

  it('reads and writes files relative to basePath', async () => {
    const client = fsClient(basePath);
    await client.promises.writeFile('foo.txt', 'hello');
    expect((await client.promises.readFile('foo.txt')).toString()).toBe('hello');
    expect(fs.readFileSync(path.join(basePath, 'foo.txt'), 'utf8')).toBe('hello');
  });

  it('rejects a path that resolves outside basePath', async () => {
    const client = fsClient(basePath);
    await expect(client.promises.readFile('..')).rejects.toThrow('escapes the repository directory');
    await expect(client.promises.writeFile('../evil.txt', 'x')).rejects.toThrow('escapes the repository directory');
  });

  it('rejects a deep traversal path', async () => {
    const client = fsClient(basePath);
    await expect(client.promises.readFile('../../../etc/passwd')).rejects.toThrow('escapes the repository directory');
  });

  it('rejects a symlink whose own location resolves outside basePath', async () => {
    const client = fsClient(basePath);
    await expect(client.promises.symlink('link', '..')).rejects.toThrow('escapes the repository directory');
  });

  it('allows a symlink whose target content points outside basePath', async () => {
    const client = fsClient(basePath);
    await client.promises.symlink('../shared/config.json', 'link');
    expect(fs.readlinkSync(path.join(basePath, 'link'))).toBe('../shared/config.json');
  });

  it('still allows nested paths that stay inside basePath', async () => {
    const client = fsClient(basePath);
    await client.promises.mkdir('nested', { recursive: true });
    await client.promises.writeFile('nested/foo.txt', 'hello');
    expect((await client.promises.readFile('nested/foo.txt')).toString()).toBe('hello');
  });
});
