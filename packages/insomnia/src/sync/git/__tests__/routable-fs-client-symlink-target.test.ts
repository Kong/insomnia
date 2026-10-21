import path from 'node:path';

import type { PromiseFsClient } from 'isomorphic-git';
import { describe, expect, it, vi } from 'vitest';

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

describe.each(Object.entries(factories))('%s symlink routing', (_name, factory) => {
  const targets = ['.git/x', '.insomnia/x', '../shared/x', './a/../b', 'a//b/'];

  it.each(targets)('passes symlink target %s verbatim to the client owning the link location', async target => {
    const def = makeSpyClient();
    const git = makeSpyClient();
    const ins = makeSpyClient();
    const routable = factory(def.client, { '.git': git.client, '.insomnia': ins.client }).promises;

    await routable.symlink!(target, 'docs/link');

    expect(def.calls.symlink).toHaveBeenCalledTimes(1);
    expect(def.calls.symlink.mock.calls[0][0]).toBe(target);
    expect(def.calls.symlink.mock.calls[0][1]).toBe(path.normalize('docs/link'));
    expect(git.calls.symlink).not.toHaveBeenCalled();
    expect(ins.calls.symlink).not.toHaveBeenCalled();
  });

  it('routes by the link location, not the target', async () => {
    const def = makeSpyClient();
    const git = makeSpyClient();
    const routable = factory(def.client, { '.git': git.client }).promises;

    await routable.symlink!('../shared/x', './.git/link');

    expect(def.calls.symlink).not.toHaveBeenCalled();
    expect(git.calls.symlink).toHaveBeenCalledWith('../shared/x', path.normalize('.git/link'));
  });
});
