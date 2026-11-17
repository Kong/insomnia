import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { services } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeProtoFile } from '../write-proto-file.node';

// ProtoFile/ProtoDirectory docs are cloud-synced, so a teammate (or anyone able to push to the
// project) controls their `_id` and `modified`. Those values are interpolated into on-disk names.
describe('writeProtoFile with attacker-controlled synced ids', () => {
  let sandbox: string;
  let tmpRoot: string;

  beforeEach(() => {
    sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'proto-id-containment-')));
    tmpRoot = path.join(sandbox, 'tmp');
    fs.mkdirSync(tmpRoot);
    vi.spyOn(os, 'tmpdir').mockReturnValue(tmpRoot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(sandbox, { recursive: true, force: true });
  });

  const listAll = (dir: string): string[] =>
    fs.readdirSync(dir, { recursive: true }).map(String);

  it('does not write a single proto file outside insomnia-grpc when _id contains ../', async () => {
    const w = await services.workspace.create();
    const pf = await services.protoFile.create({
      _id: 'pf_../../../escaped',
      parentId: w._id,
      protoText: 'syntax = "proto3";',
    });

    await expect(writeProtoFile(pf)).rejects.toThrow();

    expect(listAll(sandbox).filter(f => f.endsWith('.proto'))).toEqual([]);
  });

  it('does not write outside insomnia-grpc when modified contains ../', async () => {
    const w = await services.workspace.create();
    const pf = await services.protoFile.create({ parentId: w._id, protoText: 'x' });

    await expect(writeProtoFile({ ...pf, modified: '/../../escaped' as unknown as number })).rejects.toThrow();

    expect(listAll(sandbox).filter(f => f.endsWith('.proto'))).toEqual([]);
  });

  it('does not create directories outside insomnia-grpc when root directory _id contains ../', async () => {
    const w = await services.workspace.create();
    const pd = await services.protoDirectory.create({
      _id: 'pd_../../../escaped-dir',
      parentId: w._id,
      name: 'dir',
    });
    const pf = await services.protoFile.create({ parentId: pd._id, name: 'a.proto', protoText: 'x' });

    await expect(writeProtoFile(pf)).rejects.toThrow();

    expect(fs.existsSync(path.join(tmpRoot, 'escaped-dir.' + pd.modified))).toBe(false);
    expect(listAll(sandbox).filter(f => f.includes('escaped'))).toEqual([]);
  });

  it('still writes a normally-id\'d proto file', async () => {
    const w = await services.workspace.create();
    const pf = await services.protoFile.create({ parentId: w._id, protoText: 'syntax = "proto3";' });

    const result = await writeProtoFile(pf);

    expect(fs.readFileSync(path.join(tmpRoot, 'insomnia-grpc', result.filePath), 'utf8')).toBe(pf.protoText);
  });
});
