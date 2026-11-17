import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { services } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { database as db } from '../../../common/database';
import { getInsomniaV5DataExport } from '../../../common/insomnia-v5';
import { getCanonicalInsomniaFileContent } from '../canonical-file';
import { RepoFileWatcherRegistry } from '../repo-file-watcher';

vi.mock('../canonical-file', async importOriginal => {
  const actual = await importOriginal<{ getCanonicalInsomniaFileContent: typeof getCanonicalInsomniaFileContent }>();
  return { ...actual, getCanonicalInsomniaFileContent: vi.fn(actual.getCanonicalInsomniaFileContent) };
});

const REPO_ID = 'git_repo_patch';
const PROJECT_ID = 'proj_patch';
const WORKSPACE_ID = 'wrk_patch';
const FILE = 'insomnia.wrk_patch.yaml';

const collectionYaml = (collection = `collection:
  # kept, and so is this order
  - url: https://example.com/b
    name: B
    meta:
      id: req_b
      created: 2000
      modified: 2000
    method: GET
  - url: https://example.com/a
    name: A
    meta:
      id: req_a
      created: 1000
      modified: 1000
    method: GET`) => `type: collection.insomnia.rest/5.0
schema_version: "5.1"
name: Hand Edited
meta:
  id: ${WORKSPACE_ID}
  created: 1000
  modified: 1000
${collection}
environments:
  name: Base Environment
  meta:
    id: env_patch
    created: 1000
    modified: 1000
    isPrivate: false
`;

describe('RepoFileWatcher DB→FS patching', () => {
  let repoDir: string;
  let registry: RepoFileWatcherRegistry;
  let absPath: string;

  const writeRepoFile = async (content: string) => {
    await fs.promises.writeFile(absPath, content, 'utf8');
    // Keep the DB "older" than the file so the startup guard does not write first.
    const future = new Date(Date.now() + 60_000);
    await fs.promises.utimes(absPath, future, future);
  };

  const readRepoFile = () => fs.promises.readFile(absPath, 'utf8');

  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
    await services.project.create({ _id: PROJECT_ID, name: 'Patch Project' });
    await services.workspace.create({ _id: WORKSPACE_ID, name: 'Hand Edited', parentId: PROJECT_ID });
    const meta = await services.workspaceMeta.getOrCreateByParentId(WORKSPACE_ID);
    await services.workspaceMeta.update(meta, { gitFilePath: FILE, gitFileLastSyncTime: 1000 });

    repoDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-repo-watcher-patch-'));
    absPath = path.join(repoDir, FILE);
    registry = new RepoFileWatcherRegistry({ onDbSynced: vi.fn(), onProblemsChanged: vi.fn() });
  });

  afterEach(async () => {
    registry.stopAll();
    await fs.promises.rm(repoDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('leaves a hand-edited file alone when opening the project', async () => {
    await writeRepoFile(collectionYaml());

    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);
    await registry.flushNow(REPO_ID);

    expect(await readRepoFile()).toBe(collectionYaml());
  });

  it('rewrites only the request the UI changed', async () => {
    await writeRepoFile(collectionYaml());
    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);

    const request = await services.request.getById('req_a');
    await services.request.update(request!, { name: 'A renamed' });
    await registry.flushNow(REPO_ID);

    const after = await readRepoFile();
    expect(after).toContain('  # kept, and so is this order');
    // req_b is untouched: its whole block is byte-identical and still comes first
    expect(after).toContain(`  - url: https://example.com/b
    name: B
    meta:
      id: req_b
      created: 2000
      modified: 2000
    method: GET`);
    expect(after).toContain('    name: A renamed');
    expect(after.indexOf('name: B')).toBeLessThan(after.indexOf('name: A renamed'));
  });

  it('does not replay an imported file through a scratch database on later edits', async () => {
    await writeRepoFile(collectionYaml());
    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);
    vi.mocked(getCanonicalInsomniaFileContent).mockClear();

    await services.request.update((await services.request.getById('req_a'))!, { name: 'A renamed' });
    await registry.flushNow(REPO_ID);
    await services.request.update((await services.request.getById('req_b'))!, { name: 'B renamed' });
    await registry.flushNow(REPO_ID);

    const after = await readRepoFile();
    expect(after).toContain('  # kept, and so is this order');
    expect(after).toContain('    name: A renamed');
    expect(after).toContain('    name: B renamed');
    // The base comes from the import, then from each write; the patch is verified structurally.
    expect(getCanonicalInsomniaFileContent).not.toHaveBeenCalled();
  });

  it('writes what a whole-file export would write when the file is canonical', async () => {
    await services.workspace.update((await services.workspace.getById(WORKSPACE_ID))!, { scope: 'collection' });
    await services.environment.getOrCreateForParentId(WORKSPACE_ID);
    await services.request.create({ _id: 'req_m', parentId: WORKSPACE_ID, name: 'M', url: 'https://example.com/m' });
    await services.request.create({ _id: 'req_z', parentId: WORKSPACE_ID, name: 'Z', url: 'https://example.com/z' });
    const exportNow = async () =>
      (await getInsomniaV5DataExport({ workspaceId: WORKSPACE_ID, includePrivateEnvironments: false }))!;
    await writeRepoFile(await exportNow());
    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);

    // A new folder with a request in it, and a request between the existing ones.
    await services.requestGroup.create({ _id: 'fld_new', parentId: WORKSPACE_ID, name: 'New Folder' });
    await services.request.create({ _id: 'req_in', parentId: 'fld_new', name: 'Inside', url: 'https://example.com/in' });
    await services.request.create({ _id: 'req_p', parentId: WORKSPACE_ID, name: 'P', url: 'https://example.com/p' });
    await registry.flushNow(REPO_ID);

    const written = await readRepoFile();
    expect(written).toBe(await exportNow());
    expect(written).toContain('name: New Folder');
    expect(written).toContain('name: Inside');
  });

  it('keeps the file intact across two edits in a row', async () => {
    await writeRepoFile(collectionYaml());
    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);

    await services.request.update((await services.request.getById('req_a'))!, { name: 'A first' });
    await registry.flushNow(REPO_ID);

    await services.request.update((await services.request.getById('req_b'))!, { name: 'B second' });
    await registry.flushNow(REPO_ID);

    const after = await readRepoFile();
    expect(after).toContain('  # kept, and so is this order');
    expect(after).toContain('    name: A first');
    expect(after).toContain('    name: B second');
    expect(after.indexOf('name: B second')).toBeLessThan(after.indexOf('name: A first'));
  });

  it('removes only the request the UI deleted', async () => {
    await writeRepoFile(collectionYaml());
    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);

    const request = await services.request.getById('req_b');
    await services.request.remove(request!);
    await registry.flushNow(REPO_ID);

    const after = await readRepoFile();
    expect(after).not.toContain('id: req_b');
    expect(after).not.toContain('https://example.com/b');
    expect(after).toContain('    name: A');
    expect(after).toContain('  # kept, and so is this order');
  });

  it('adds a request without disturbing the others', async () => {
    await writeRepoFile(collectionYaml());
    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);

    await services.request.create({
      parentId: WORKSPACE_ID,
      name: 'C',
      url: 'https://example.com/c',
      method: 'GET',
    });
    await registry.flushNow(REPO_ID);

    const after = await readRepoFile();
    expect(after).toContain('    name: C');
    expect(after).toContain('    name: B');
    expect(after).toContain('    name: A');
    expect(after).toContain('  # kept, and so is this order');
    // Inserted after its canonical predecessor (B), so between B and A.
    expect(after.indexOf('name: B')).toBeLessThan(after.indexOf('name: C'));
    expect(after.indexOf('name: C')).toBeLessThan(after.indexOf('name: A'));
  });

  it('keeps a field the author deleted from the file', async () => {
    const withoutMethod = collectionYaml().replace('    method: GET\n  - url: https://example.com/a', '  - url: https://example.com/a');
    await writeRepoFile(withoutMethod);
    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);
    await registry.flushNow(REPO_ID);

    expect(await readRepoFile()).toBe(withoutMethod);
  });
  it('leaves a file that is not an Insomnia file untouched', async () => {
    const foreign = 'openapi: 3.0.0\ninfo:\n  title: Not ours\n';
    await writeRepoFile(foreign);

    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);
    await registry.flushNow(REPO_ID);

    expect(await readRepoFile()).toBe(foreign);
  });

  it('does not write a patch that would not reproduce the DB state', async () => {
    // Two nodes carry the same `meta.id`, so patching one leaves the other in
    // place and the replay no longer matches the DB.
    const duplicated = collectionYaml().replace(
      'environments:',
      `  - url: https://example.com/a-copy
    name: A copy
    meta:
      id: req_a
      created: 1000
      modified: 1000
    method: GET
environments:`,
    );
    await writeRepoFile(duplicated);
    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);

    const request = await services.request.getById('req_a');
    await services.request.update(request!, { name: 'A renamed' });
    await registry.flushNow(REPO_ID);

    expect(await readRepoFile()).toBe(duplicated);
  });

  it('reports a file it cannot patch and leaves it untouched', async () => {
    const flow = collectionYaml(
      'collection: [{url: https://example.com/a, name: A, meta: {id: req_a, created: 1000, modified: 1000}, method: GET}]',
    );
    await writeRepoFile(flow);
    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);

    await services.request.update((await services.request.getById('req_a'))!, { name: 'A renamed' });
    await registry.flushNow(REPO_ID);

    expect(await readRepoFile()).toBe(flow);
    expect(registry.getProblems(REPO_ID)).toEqual([
      expect.objectContaining({ kind: 'write-blocked', message: 'Could not patch the YAML file, leaving it untouched' }),
    ]);
  });

  it('does not re-read a renamed file when the DB has not changed since', async () => {
    await writeRepoFile(collectionYaml());
    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);

    const meta = await services.workspaceMeta.getByParentId(WORKSPACE_ID);
    await services.workspaceMeta.update(meta!, { gitFilePath: 'renamed.yaml' });
    await registry.flushNow(REPO_ID);
    const renamedPath = path.join(repoDir, 'renamed.yaml');
    expect(fs.existsSync(renamedPath)).toBe(true);
    expect(fs.existsSync(absPath)).toBe(false);

    const readFile = vi.spyOn(fs.promises, 'readFile');
    try {
      await registry.flushNow(REPO_ID);
      expect(readFile.mock.calls.filter(([file]) => path.normalize(String(file)) === path.normalize(renamedPath))).toEqual([]);
    } finally {
      readFile.mockRestore();
    }
  });

  it('writes a cleared and a multi-line workspace description into a 4-space file', async () => {
    const fourSpace = collectionYaml()
      .replace(/^( *)(- )?/gm, (_, indent: string, dash?: string) => indent.repeat(2) + (dash ? '-   ' : ''))
      .replace('    modified: 1000\ncollection:', '    modified: 1000\n    description: hello\ncollection:');
    await writeRepoFile(fourSpace);
    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);

    const workspace = await services.workspace.getById(WORKSPACE_ID);
    await services.workspace.update(workspace!, { description: '' });
    await registry.flushNow(REPO_ID);

    const cleared = await readRepoFile();
    // The exporter keeps an empty string, so clearing is a value change.
    expect(cleared).toBe(fourSpace.replace('    description: hello\n', '    description: ""\n'));
    expect(registry.getProblems(REPO_ID)).toEqual([]);

    await services.workspace.update((await services.workspace.getById(WORKSPACE_ID))!, {
      description: 'line one\nline two',
    });
    await registry.flushNow(REPO_ID);

    expect(await readRepoFile()).toBe(
      cleared.replace('    description: ""\n', '    description: |-\n      line one\n      line two\n'),
    );
    expect(registry.getProblems(REPO_ID)).toEqual([]);
  });
});

const FIXTURE_DIR = path.join(__dirname, '..', '..', '..', 'common', '__fixtures__', 'insomnia-v5-roundtrip');
const fixtures = fs
  .readdirSync(FIXTURE_DIR)
  .filter(file => file.endsWith('.yaml'))
  .filter(file => /^type: .*insomnia/.test(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8')));

describe('RepoFileWatcher leaves untouched files byte-identical', () => {
  it.each(fixtures)('%s', async fixture => {
    await db.init({ inMemoryOnly: true }, true);
    await services.project.create({ _id: PROJECT_ID, name: 'Patch Project' });
    const repoDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-repo-watcher-fixture-'));
    const registry = new RepoFileWatcherRegistry({ onDbSynced: vi.fn(), onProblemsChanged: vi.fn() });

    try {
      const content = fs.readFileSync(path.join(FIXTURE_DIR, fixture), 'utf8');
      const absPath = path.join(repoDir, fixture);
      await fs.promises.writeFile(absPath, content, 'utf8');

      await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);

      // Liveness: the fixture was actually imported, so the unchanged file is
      // the writer's decision and not a skipped import.
      const workspaces = await services.workspace.list({ parentId: PROJECT_ID });
      expect(workspaces).toHaveLength(1);

      await registry.flushNow(REPO_ID);

      expect(await fs.promises.readFile(absPath, 'utf8')).toBe(content);

      // The flush above stops at the "DB did not change" gate. A change in the
      // app goes through delta, patch and verification, and must touch only
      // the line it changed.
      await services.workspace.update(workspaces[0], { name: 'Renamed by the app' });
      await registry.flushNow(REPO_ID);

      expect(await fs.promises.readFile(absPath, 'utf8')).toBe(content.replace(/^name: .*$/m, 'name: Renamed by the app'));
      expect(registry.getProblems(REPO_ID)).toEqual([]);
    } finally {
      registry.stopAll();
      await fs.promises.rm(repoDir, { recursive: true, force: true });
    }
  });
});
