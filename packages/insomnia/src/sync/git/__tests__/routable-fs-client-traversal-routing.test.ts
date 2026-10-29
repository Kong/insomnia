import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { PromiseFsClient } from 'isomorphic-git';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fsClient } from '../fs-client';
import { projectRoutableFSClient } from '../project-routable-fs-client';
import { routableFSClient } from '../routable-fs-client';

const makeSpyClient = () => {
  const promises: any = {};
  const calls = {
    symlink: vi.fn(async (..._args: any[]) => {}),
    other: vi.fn(async (..._args: any[]) => {}),
  };
  promises.symlink = calls.symlink;
  promises.readFile = calls.other;
  promises.writeFile = calls.other;
  promises.mkdir = calls.other;
  return { client: { promises } as PromiseFsClient, calls };
};

const factories = {
  routableFSClient,
  projectRoutableFSClient,
};

describe.each(Object.entries(factories))('%s traversal in routing decisions', (_name, factory) => {
  let root: string;
  let base: string;

  beforeEach(async () => {
    root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-routable-'));
    base = path.join(root, 'base');
  });

  afterEach(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  const smuggling = [
    '.insomnia/../../escape.txt',
    './.git/../../escape.txt',
    '.git/../../escape.txt',
    '.git/a/../../../escape.txt',
    '/.git/../../escape.txt',
  ];

  it.each(smuggling)('cannot write outside the base dir via %s', async p => {
    // Mirrors main/git-service.ts: each routed prefix maps to a contained fsClient.
    const routable = factory(fsClient(path.join(base, 'other')), {
      '.git': fsClient(base),
      '.insomnia': fsClient(path.join(base, 'ins')),
    }).promises;

    await routable.writeFile(p, 'pwn').catch(() => {});

    expect(fs.existsSync(path.join(root, 'escape.txt'))).toBe(false);
    expect(fs.existsSync(path.join(base, 'escape.txt'))).toBe(false);
    expect(fs.existsSync(path.join(base, '..', 'escape.txt'))).toBe(false);
  });

  it('normalizes before prefix matching so a traversal path is not handed to the prefix client', async () => {
    const def = makeSpyClient();
    const ins = makeSpyClient();
    const routable = factory(def.client, { '.insomnia': ins.client }).promises;

    await routable.writeFile('.insomnia/../../x', 'a');

    expect(ins.calls.other).not.toHaveBeenCalled();
    expect(def.calls.other).toHaveBeenCalledWith(path.normalize('../x'), 'a');
  });
});
