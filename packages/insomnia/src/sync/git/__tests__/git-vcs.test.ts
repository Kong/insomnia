import path from 'node:path';

import * as git from 'isomorphic-git';
import { afterAll, describe, expect, it, vi } from 'vitest';

import GitVCS, { GIT_CLONE_DIR, GIT_INSOMNIA_DIR, MergeConflictError } from '../git-vcs';
import { MemClient } from '../mem-client';

describe('Git-VCS', () => {
  const fooTxt = 'foo.txt';
  const barTxt = 'bar.txt';

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('common operations', () => {
    it('setAuthor() does not write empty user.name/user.email into git config when no author is resolvable', async () => {
      const fsClient = MemClient.createClient();
      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
      });

      await GitVCS.setAuthor();

      expect(await git.getConfig({ fs: fsClient, dir: GIT_CLONE_DIR, path: 'user.name' })).toBeUndefined();
      expect(await git.getConfig({ fs: fsClient, dir: GIT_CLONE_DIR, path: 'user.email' })).toBeUndefined();
    });

    it('stage and unstage file', async () => {
      // Write the files to the repository directory
      const fsClient = MemClient.createClient();
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await fsClient.promises.writeFile(path.join(GIT_INSOMNIA_DIR, fooTxt), 'foo');
      await fsClient.promises.writeFile(path.join(GIT_INSOMNIA_DIR, barTxt), 'bar');
      await fsClient.promises.writeFile('/other.txt', 'other');

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });

      // foo.txt and bar.txt should be in the unstaged list
      const status = await GitVCS.status();
      expect(status.staged).toEqual([]);
      expect(status.unstaged).toEqual([
        {
          name: '',
          path: '.insomnia/bar.txt',
          status: [0, 2, 0],
          symbol: 'U',
          type: 'untracked',
        },
        {
          name: '',
          path: '.insomnia/foo.txt',
          status: [0, 2, 0],
          symbol: 'U',
          type: 'untracked',
        },
      ]);

      const fooStatus = status.unstaged.find(f => f.path.includes(fooTxt));

      fooStatus && (await GitVCS.stageChanges([fooStatus]));
      const status2 = await GitVCS.status();
      expect(status2.staged).toEqual([
        {
          name: '',
          path: '.insomnia/foo.txt',
          status: [0, 2, 2],
          symbol: 'A',
          type: 'added',
        },
      ]);
      expect(status2.unstaged).toEqual([
        {
          name: '',
          path: '.insomnia/bar.txt',
          status: [0, 2, 0],
          symbol: 'U',
          type: 'untracked',
        },
      ]);

      const barStatus = status2.unstaged.find(f => f.path.includes(barTxt));

      barStatus && (await GitVCS.stageChanges([barStatus]));
      const status3 = await GitVCS.status();
      expect(status3.staged).toEqual([
        {
          name: '',
          path: '.insomnia/bar.txt',
          status: [0, 2, 2],
          symbol: 'A',
          type: 'added',
        },
        {
          name: '',
          path: '.insomnia/foo.txt',
          status: [0, 2, 2],
          symbol: 'A',
          type: 'added',
        },
      ]);

      const fooStatus3 = status3.staged.find(f => f.path.includes(fooTxt));
      fooStatus3 && (await GitVCS.unstageChanges([fooStatus3]));
      const status4 = await GitVCS.status();
      expect(status4).toEqual({
        staged: [
          {
            name: '',
            path: '.insomnia/bar.txt',
            status: [0, 2, 2],
            symbol: 'A',
            type: 'added',
          },
        ],
        unstaged: [
          {
            name: '',
            path: '.insomnia/foo.txt',
            status: [0, 2, 0],
            symbol: 'U',
            type: 'untracked',
          },
        ],
      });
    });

    it('Returns empty log without first commit', async () => {
      const fsClient = MemClient.createClient();

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });
      expect(await GitVCS.log()).toEqual([]);
    });

    it('commit file', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2001-09-10'));
      vi.stubEnv('TZ', 'UTC');
      const fsClient = MemClient.createClient();
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await fsClient.promises.writeFile(path.join(GIT_INSOMNIA_DIR, fooTxt), 'foo');
      await fsClient.promises.writeFile(path.join(GIT_INSOMNIA_DIR, barTxt), 'bar');
      await fsClient.promises.writeFile('other.txt', 'should be ignored');

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });

      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });

      const status = await GitVCS.status();
      const fooStatus = status.unstaged.find(f => f.path.includes(fooTxt));
      fooStatus && (await GitVCS.stageChanges([fooStatus]));

      const status2 = await GitVCS.status();

      expect(status2.staged).toEqual([
        {
          name: '',
          path: '.insomnia/foo.txt',
          status: [0, 2, 2],
          symbol: 'A',
          type: 'added',
        },
      ]);
      expect(status2.unstaged).toEqual([
        {
          name: '',
          path: '.insomnia/bar.txt',
          status: [0, 2, 0],
          symbol: 'U',
          type: 'untracked',
        },
      ]);

      await GitVCS.commit('First commit!');

      const status3 = await GitVCS.status();

      expect(status3.staged).toEqual([]);
      expect(status3.unstaged).toEqual([
        {
          name: '',
          path: '.insomnia/bar.txt',
          status: [0, 2, 0],
          symbol: 'U',
          type: 'untracked',
        },
      ]);

      expect(await GitVCS.log()).toEqual([
        {
          commit: {
            author: {
              email: 'karen@example.com',
              name: 'Karen Brown',
              timestamp: 1_000_080_000,
              timezoneOffset: 0,
            },
            committer: {
              email: 'karen@example.com',
              name: 'Karen Brown',
              timestamp: 1_000_080_000,
              timezoneOffset: 0,
            },
            message: 'First commit!\n',
            parent: [],
            tree: '14819d8019f05edb70a29850deb09a4314ad0afc',
          },
          oid: '56eeab0bb61c367de6f62ade2893cf074480991c',
          payload: `tree 14819d8019f05edb70a29850deb09a4314ad0afc
author Karen Brown <karen@example.com> 1000080000 +0000
committer Karen Brown <karen@example.com> 1000080000 +0000

First commit!
`,
        },
      ]);
      await fsClient.promises.unlink(path.join(GIT_INSOMNIA_DIR, fooTxt));
    });

    it('create branch', async () => {
      const fsClient = MemClient.createClient();
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await fsClient.promises.writeFile(fooTxt, 'foo');
      await fsClient.promises.writeFile(barTxt, 'bar');

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });
      const status = await GitVCS.status();
      const fooStatus = status.unstaged.find(f => f.path.includes(fooTxt));
      fooStatus && (await GitVCS.stageChanges([fooStatus]));
      await GitVCS.commit('First commit!');
      expect((await GitVCS.log()).length).toBe(1);
      await GitVCS.checkout('new-branch');
      expect((await GitVCS.log()).length).toBe(1);
      const status2 = await GitVCS.status();
      const barStatus = status2.unstaged.find(f => f.path.includes(barTxt));
      barStatus && (await GitVCS.stageChanges([barStatus]));
      await GitVCS.commit('Second commit!');
      expect((await GitVCS.log()).length).toBe(2);
      await GitVCS.checkout('main');
      expect((await GitVCS.log()).length).toBe(1);
    });
  });

  describe('fileStatus()', () => {
    it('returns the raw HEAD and index content alongside the migrated content', async () => {
      const collectionYaml = path.join(GIT_INSOMNIA_DIR, 'collection.yaml');
      // A schema 5.0 file: the 5.1 migration removes header ids and adds schema_version
      const oldSchemaContent = `type: collection.insomnia.rest/5.0
name: Test
collection:
  - name: Request
    meta:
      id: req_1
    headers:
      - id: pair_1
        name: X-Test
        value: test
`;
      const fsClient = MemClient.createClient();
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await fsClient.promises.writeFile(collectionYaml, oldSchemaContent);

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });
      const [change] = (await GitVCS.status()).unstaged;
      await GitVCS.stageChanges([change]);
      await GitVCS.commit('First commit!');

      const stagedContent = oldSchemaContent.replace('value: test', 'value: staged');
      await fsClient.promises.writeFile(collectionYaml, stagedContent);
      await GitVCS.stageChanges([change]);
      await fsClient.promises.writeFile(collectionYaml, oldSchemaContent.replace('value: test', 'value: workdir'));

      const fileStatus = await GitVCS.fileStatus(change.path);

      expect(fileStatus.rawHead).toBe(oldSchemaContent);
      expect(fileStatus.rawStage).toBe(stagedContent);
      expect(fileStatus.head).not.toBe(oldSchemaContent);
      expect(fileStatus.head).not.toContain('pair_1');
      expect(fileStatus.stage).not.toContain('pair_1');
    });
  });

  describe('push()', () => {
    it('should throw an exception when push response contains errors', async () => {
      // @ts-expect-error -- mockReturnValue is not typed
      git.push.mockReturnValue({
        ok: ['unpack'],
        errors: ['refs/heads/master pre-receive hook declined'],
      });

      await expect(GitVCS.push()).rejects.toThrowError(
        'Push rejected with errors: ["refs/heads/master pre-receive hook declined"].\n\nGo to View > Toggle DevTools > Console for more information.',
      );
    });

    it('sets up upstream tracking for the current branch on a successful push', async () => {
      // @ts-expect-error -- mockReturnValue is not typed
      git.push.mockReturnValue({ ok: true });

      const fsClient = MemClient.createClient();
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await fsClient.promises.writeFile(path.join(GIT_INSOMNIA_DIR, fooTxt), 'foo');

      await GitVCS.init({
        uri: '',
        repoId: 'test-push-tracking',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });

      const branch = await GitVCS.getCurrentBranch();

      // Tracking config should not exist before the first push (git.init() leaves no upstream).
      expect(await GitVCS.getBranchTrackingRemote()).toBeNull();

      await GitVCS.push();

      expect(await git.getConfig({ fs: fsClient, dir: GIT_CLONE_DIR, path: `branch.${branch}.remote` })).toBe('origin');
      expect(await git.getConfig({ fs: fsClient, dir: GIT_CLONE_DIR, path: `branch.${branch}.merge` })).toBe(
        `refs/heads/${branch}`,
      );
    });

    it('does not clobber an existing fully-configured upstream on push', async () => {
      // @ts-expect-error -- mockReturnValue is not typed
      git.push.mockReturnValue({ ok: true });

      const fsClient = MemClient.createClient();
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await fsClient.promises.writeFile(path.join(GIT_INSOMNIA_DIR, fooTxt), 'foo');

      await GitVCS.init({
        uri: '',
        repoId: 'test-push-no-clobber',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Fares', email: 'fares@example.com' });

      const branch = await GitVCS.getCurrentBranch();
      await git.setConfig({ fs: fsClient, dir: GIT_CLONE_DIR, path: `branch.${branch}.remote`, value: 'upstream' });
      await git.setConfig({
        fs: fsClient,
        dir: GIT_CLONE_DIR,
        path: `branch.${branch}.merge`,
        value: 'refs/heads/custom',
      });

      await GitVCS.push();

      expect(await git.getConfig({ fs: fsClient, dir: GIT_CLONE_DIR, path: `branch.${branch}.remote` })).toBe(
        'upstream',
      );
      expect(await git.getConfig({ fs: fsClient, dir: GIT_CLONE_DIR, path: `branch.${branch}.merge` })).toBe(
        'refs/heads/custom',
      );
    });
  });

  describe('undoPendingChanges()', () => {
    it('should remove pending changes from all tracked files', async () => {
      const folder = path.join(GIT_INSOMNIA_DIR, 'folder');
      const folderBarTxt = path.join(folder, 'bar.txt');
      const originalContent = 'content';
      // Git automatically adds trailing newlines when storing files
      const expectedContent = originalContent + '\n';
      const fsClient = MemClient.createClient();
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await fsClient.promises.mkdir(folder);
      await fsClient.promises.writeFile(folderBarTxt, originalContent);

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      // Commit
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });

      const status = await GitVCS.status();

      const folderStatus = status.unstaged.find(s => s.path.includes(folder));

      if (!folderStatus) {
        throw new Error('c');
      }

      await GitVCS.stageChanges([folderStatus]);
      await GitVCS.commit('First commit!');
      // Change the file
      await fsClient.promises.writeFile(folderBarTxt, 'changedContent');

      const status2 = await GitVCS.status();

      expect(status2).toEqual({
        staged: [],
        unstaged: [
          {
            name: '',
            path: '.insomnia/folder/bar.txt',
            status: [1, 2, 1],
            symbol: 'M',
            type: 'modified',
          },
        ],
      });
      // Discard changes
      await GitVCS.discardChanges(status2.unstaged);

      const status3 = await GitVCS.status();

      // Ensure git doesn't recognize a change anymore
      expect(status3).toEqual({
        staged: [],
        unstaged: [],
      });
      // Expect original doc to have reverted (with Git's trailing newline)
      expect((await fsClient.promises.readFile(folderBarTxt)).toString()).toBe(expectedContent);
    });

    it('should remove pending changes from select tracked files', async () => {
      const foo1Txt = path.join(GIT_INSOMNIA_DIR, 'foo1.txt');
      const foo2Txt = path.join(GIT_INSOMNIA_DIR, 'foo2.txt');
      const foo3Txt = path.join(GIT_INSOMNIA_DIR, 'foo3.txt');
      const files = [foo1Txt, foo2Txt, foo3Txt];
      const originalContent = 'content';
      // Git automatically adds trailing newlines when storing files
      const expectedContent = originalContent + '\n';
      const changedContent = 'changedContent';
      const fsClient = MemClient.createClient();
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      // Write to all files
      await Promise.all(files.map(f => fsClient.promises.writeFile(f, originalContent)));
      // Commit all files
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });
      const status = await GitVCS.status();
      await GitVCS.stageChanges(status.unstaged);
      await GitVCS.commit('First commit!');
      // Change all files
      await Promise.all(files.map(f => fsClient.promises.writeFile(f, changedContent)));

      const status2 = await GitVCS.status();
      // Undo foo1 and foo2, but not foo3
      const changesToUndo = status2.unstaged.filter(change => !change.path.includes(foo3Txt));
      await GitVCS.discardChanges(changesToUndo);
      const status3 = await GitVCS.status();
      expect(status3).toEqual({
        staged: [],
        unstaged: [
          {
            name: '',
            path: '.insomnia/foo3.txt',
            status: [1, 2, 1],
            symbol: 'M',
            type: 'modified',
          },
        ],
      });
      // Expect original doc to have reverted for foo1 and foo2 (with Git's trailing newline)
      expect((await fsClient.promises.readFile(foo1Txt)).toString()).toBe(expectedContent);
      expect((await fsClient.promises.readFile(foo2Txt)).toString()).toBe(expectedContent);
      expect((await fsClient.promises.readFile(foo3Txt)).toString()).toBe(changedContent);
    });

    it('should handle binary files correctly', async () => {
      const binaryFile = path.join(GIT_INSOMNIA_DIR, 'binary.bin');
      const originalContent = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello" in binary
      const fsClient = MemClient.createClient();
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await fsClient.promises.writeFile(binaryFile, originalContent);

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });

      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });
      const status = await GitVCS.status();
      const binaryStatus = status.unstaged.find(s => s.path.includes('binary.bin'));

      if (!binaryStatus) {
        throw new Error('Binary file not found in status');
      }

      await GitVCS.stageChanges([binaryStatus]);
      await GitVCS.commit('Commit binary file');

      // Modify the binary file
      const modifiedContent = Buffer.from([0x57, 0x6f, 0x72, 0x6c, 0x64]); // "World" in binary
      await fsClient.promises.writeFile(binaryFile, modifiedContent);

      const status2 = await GitVCS.status();
      expect(status2.unstaged).toHaveLength(0);

      // Discard changes
      await GitVCS.discardChanges(status2.unstaged);

      // Binary file should be restored exactly
      const restoredContent = await fsClient.promises.readFile(binaryFile);
      expect(Buffer.compare(restoredContent, originalContent)).toBe(1);
    });

    it('should handle multiple file types in one operation', async () => {
      const textFile = path.join(GIT_INSOMNIA_DIR, 'text.txt');
      const yamlFile = path.join(GIT_INSOMNIA_DIR, 'data.yaml');
      const jsonFile = path.join(GIT_INSOMNIA_DIR, 'config.json');

      const fsClient = MemClient.createClient();
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);

      // Create files with different content
      await fsClient.promises.writeFile(textFile, 'simple text');
      await fsClient.promises.writeFile(yamlFile, 'name: test\nvalue: 123\n');
      await fsClient.promises.writeFile(jsonFile, '{"key": "value"}');

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });

      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });
      const status = await GitVCS.status();

      // Stage all files
      await GitVCS.stageChanges(status.unstaged);
      await GitVCS.commit('Commit multiple file types');

      // Modify all files
      await fsClient.promises.writeFile(textFile, 'modified text');
      await fsClient.promises.writeFile(yamlFile, 'name: modified\nvalue: 456\n');
      await fsClient.promises.writeFile(jsonFile, '{"key": "modified"}');

      const status2 = await GitVCS.status();
      expect(status2.unstaged).toHaveLength(3);

      // Discard changes for text and yaml files only
      const changesToDiscard = status2.unstaged.filter(
        change => change.path.includes('text.txt') || change.path.includes('data.yaml'),
      );
      await GitVCS.discardChanges(changesToDiscard);

      const status3 = await GitVCS.status();
      expect(status3.unstaged).toHaveLength(1);
      expect(status3.unstaged[0].path).toContain('config.json');

      // Check that text and yaml files were restored
      expect((await fsClient.promises.readFile(textFile)).toString()).toBe('simple text\n');
      expect((await fsClient.promises.readFile(yamlFile)).toString()).toBe('name: test\nvalue: 123\n');
      // JSON file should still be modified
      expect((await fsClient.promises.readFile(jsonFile)).toString()).toBe('{"key": "modified"}');
    });

    it('should handle nested directory structures', async () => {
      const nestedDir = path.join(GIT_INSOMNIA_DIR, 'nested', 'deep', 'folder');
      const nestedFile = path.join(nestedDir, 'file.txt');
      const originalContent = 'nested content';

      const fsClient = MemClient.createClient();
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await fsClient.promises.mkdir(nestedDir, { recursive: true });
      await fsClient.promises.writeFile(nestedFile, originalContent);

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });

      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });
      const status = await GitVCS.status();
      const nestedStatus = status.unstaged.find(s => s.path.includes('nested'));

      if (!nestedStatus) {
        throw new Error('Nested file not found in status');
      }

      await GitVCS.stageChanges([nestedStatus]);
      await GitVCS.commit('Commit nested file');

      // Modify the nested file
      await fsClient.promises.writeFile(nestedFile, 'modified nested content');

      const status2 = await GitVCS.status();
      expect(status2.unstaged).toHaveLength(1);

      // Discard changes
      await GitVCS.discardChanges(status2.unstaged);

      // Nested file should be restored
      expect((await fsClient.promises.readFile(nestedFile)).toString()).toBe(originalContent + '\n');
    });
  });

  describe('buildManualResolutionFromTrees()', () => {
    it('should collect non-YAML conflicts as autoResolvedConflicts and only return YAML conflicts', async () => {
      const fsClient = MemClient.createClient();
      const yamlFile = path.join(GIT_INSOMNIA_DIR, 'Environment', 'env_1.yaml');
      const gitignoreFile = '.gitignore';

      // Create directories
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await fsClient.promises.mkdir(path.join(GIT_INSOMNIA_DIR, 'Environment'));

      // Create initial files
      await fsClient.promises.writeFile(yamlFile, 'type: collection.insomnia.rest/5.0\nname: base env\n');
      await fsClient.promises.writeFile(gitignoreFile, 'node_modules\n');

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });

      // Stage and commit all files
      const status = await GitVCS.status();
      await GitVCS.stageChanges(status.unstaged);
      await GitVCS.commit('Initial commit');

      // Create origin/main branch to simulate remote
      await git.branch({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'origin/main', checkout: false });

      // Make local changes on main
      await fsClient.promises.writeFile(yamlFile, 'type: collection.insomnia.rest/5.0\nname: local env\n');
      await fsClient.promises.writeFile(gitignoreFile, 'node_modules\ndist\n');
      const status2 = await GitVCS.status();
      await GitVCS.stageChanges(status2.unstaged);
      await GitVCS.commit('Local changes');

      // Switch to origin/main and make different changes
      await git.checkout({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'origin/main' });
      await fsClient.promises.writeFile(yamlFile, 'type: collection.insomnia.rest/5.0\nname: remote env\n');
      await fsClient.promises.writeFile(gitignoreFile, 'node_modules\nbuild\n');
      await git.add({ fs: fsClient, dir: GIT_CLONE_DIR, filepath: yamlFile });
      await git.add({ fs: fsClient, dir: GIT_CLONE_DIR, filepath: gitignoreFile });
      await git.commit({
        fs: fsClient,
        dir: GIT_CLONE_DIR,
        message: 'Remote changes',
        author: { name: 'Remote User', email: 'remote@example.com' },
      });

      // Switch back to main
      await git.checkout({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'main' });

      // Call buildManualResolutionFromTrees — it should throw MergeConflictError
      try {
        await GitVCS.buildManualResolutionFromTrees();
        expect.unreachable('Should have thrown MergeConflictError');
      } catch (err) {
        expect(err).toBeInstanceOf(MergeConflictError);

        const mergeErr = err as MergeConflictError;
        // Only YAML conflicts should appear in the conflicts array
        expect(mergeErr.data.conflicts).toHaveLength(1);
        expect(mergeErr.data.conflicts[0].key).toBe(yamlFile);

        // Non-YAML files should be in autoResolvedConflicts for deferred staging
        expect(mergeErr.data.autoResolvedConflicts).toHaveLength(1);
        expect(mergeErr.data.autoResolvedConflicts[0]).toEqual({
          filepath: gitignoreFile,
          action: 'use-theirs',
        });
      }
    });

    it('should still return Insomnia files with a comment above `type` as conflicts (INS-4332)', async () => {
      const fsClient = MemClient.createClient();
      const deleteModifyFile = 'abcdefghij.yaml';
      const bothModifiedFile = 'klmnopqrst.yaml';
      const insomniaContent = (comment: string, name: string) =>
        `${comment}\ntype: collection.insomnia.rest/5.0\nname: ${name}\n`;

      const writeAndAdd = async (filepath: string, content: string) => {
        await fsClient.promises.writeFile(filepath, content);
        await git.add({ fs: fsClient, dir: GIT_CLONE_DIR, filepath });
      };

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });

      await writeAndAdd(deleteModifyFile, 'type: collection.insomnia.rest/5.0\nname: base\n');
      await writeAndAdd(bothModifiedFile, 'type: collection.insomnia.rest/5.0\nname: base\n');
      await GitVCS.commit('Initial commit');

      await git.branch({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'origin/main', checkout: false });

      // Local: a hand-written comment above `type` in both files
      await writeAndAdd(deleteModifyFile, insomniaContent('# local', 'base'));
      await writeAndAdd(bothModifiedFile, insomniaContent('# local', 'base'));
      await GitVCS.commit('Local changes');

      // Remote: deletes one file and puts a different comment above `type` in the other
      await git.checkout({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'origin/main' });
      await git.remove({ fs: fsClient, dir: GIT_CLONE_DIR, filepath: deleteModifyFile });
      await fsClient.promises.unlink(deleteModifyFile);
      await writeAndAdd(bothModifiedFile, insomniaContent('# remote', 'base'));
      await git.commit({
        fs: fsClient,
        dir: GIT_CLONE_DIR,
        message: 'Remote changes',
        author: { name: 'Remote User', email: 'remote@example.com' },
      });
      await git.checkout({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'main' });

      try {
        await GitVCS.buildManualResolutionFromTrees();
        expect.unreachable('Should have thrown MergeConflictError');
      } catch (err) {
        expect(err).toBeInstanceOf(MergeConflictError);

        const mergeErr = err as MergeConflictError;
        // Both go to the conflict UI; nothing is silently resolved to the remote version
        expect(mergeErr.data.conflicts.map(c => c.key).sort()).toEqual([deleteModifyFile, bothModifiedFile].sort());
        expect(mergeErr.data.autoResolvedConflicts).toEqual([]);
      }
    });

    it('should not auto-resolve an Insomnia file that is no longer valid YAML, it fails instead (INS-4332)', async () => {
      const fsClient = MemClient.createClient();
      const brokenFile = 'abcdefghij.yaml';
      // An unclosed flow sequence: not valid YAML, but still declares an Insomnia file type
      const content = (name: string) => `type: collection.insomnia.rest/5.0\nname: [${name}\n`;

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });

      const writeAndAdd = async (filepath: string, text: string) => {
        await fsClient.promises.writeFile(filepath, text);
        await git.add({ fs: fsClient, dir: GIT_CLONE_DIR, filepath });
      };

      await writeAndAdd(brokenFile, 'type: collection.insomnia.rest/5.0\nname: base\n');
      await GitVCS.commit('Initial commit');
      await git.branch({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'origin/main', checkout: false });
      await writeAndAdd(brokenFile, content('local'));
      await GitVCS.commit('Local changes');
      await git.checkout({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'origin/main' });
      await writeAndAdd(brokenFile, content('remote'));
      await git.commit({
        fs: fsClient,
        dir: GIT_CLONE_DIR,
        message: 'Remote changes',
        author: { name: 'Remote User', email: 'remote@example.com' },
      });
      await git.checkout({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'main' });

      // Reading the file fails the pull. It must not be resolved to the remote version, which would drop the local edit
      await expect(GitVCS.buildManualResolutionFromTrees()).rejects.not.toBeInstanceOf(MergeConflictError);
      expect((await fsClient.promises.readFile(brokenFile)).toString()).toBe(content('local'));
    });

    it('should auto-resolve unrelated YAML files (not Insomnia files) to theirs instead of returning them as conflicts', async () => {
      const fsClient = MemClient.createClient();
      const insomniaFile = '.insomnia/Environment/env_1.yaml';
      const workflowFile = '.github/workflows/main-deployment.yaml';
      // Not valid YAML, e.g. a Helm template: must not make the pull throw
      const helmTemplateFile = 'helm/deployment.yaml';

      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await fsClient.promises.mkdir(path.join(GIT_INSOMNIA_DIR, 'Environment'));
      await fsClient.promises.mkdir('.github');
      await fsClient.promises.mkdir('.github/workflows');
      await fsClient.promises.mkdir('helm');

      const writeAndAdd = async (filepath: string, content: string) => {
        await fsClient.promises.writeFile(filepath, content);
        await git.add({ fs: fsClient, dir: GIT_CLONE_DIR, filepath });
      };

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });

      await writeAndAdd(insomniaFile, 'type: collection.insomnia.rest/5.0\nname: base env\n');
      await writeAndAdd(workflowFile, 'name: Main Deployment\non: base\n');
      await writeAndAdd(helmTemplateFile, 'replicas: {{ .Values.base }}\n');
      await GitVCS.commit('Initial commit');

      await git.branch({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'origin/main', checkout: false });

      await writeAndAdd(insomniaFile, 'type: collection.insomnia.rest/5.0\nname: local env\n');
      await writeAndAdd(workflowFile, 'name: Main Deployment\non: local\n');
      await writeAndAdd(helmTemplateFile, 'replicas: {{ .Values.local }}\n');
      await GitVCS.commit('Local changes');

      await git.checkout({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'origin/main' });
      await writeAndAdd(insomniaFile, 'type: collection.insomnia.rest/5.0\nname: remote env\n');
      await writeAndAdd(workflowFile, 'name: Main Deployment\non: remote\n');
      await writeAndAdd(helmTemplateFile, 'replicas: {{ .Values.remote }}\n');
      await git.commit({
        fs: fsClient,
        dir: GIT_CLONE_DIR,
        message: 'Remote changes',
        author: { name: 'Remote User', email: 'remote@example.com' },
      });
      await git.checkout({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'main' });

      try {
        await GitVCS.buildManualResolutionFromTrees();
        expect.unreachable('Should have thrown MergeConflictError');
      } catch (err) {
        expect(err).toBeInstanceOf(MergeConflictError);

        const mergeErr = err as MergeConflictError;
        // Only the Insomnia file goes to the conflict UI
        expect(mergeErr.data.conflicts.map(c => c.key)).toEqual([insomniaFile]);
        // The unrelated YAML files are resolved to theirs, like any other non-Insomnia file
        expect(mergeErr.data.autoResolvedConflicts).toHaveLength(2);
        expect(mergeErr.data.autoResolvedConflicts).toEqual(
          expect.arrayContaining([
            { filepath: workflowFile, action: 'use-theirs' },
            { filepath: helmTemplateFile, action: 'use-theirs' },
          ]),
        );
      }
    });

    it('should delete non-Insomnia files that the remote deleted and the local side modified (INS-4331)', async () => {
      const fsClient = MemClient.createClient();
      const files = ['README.md', 'main-deployment.yaml'];

      const writeAndAdd = async (filepath: string, content: string) => {
        await fsClient.promises.writeFile(filepath, content);
        await git.add({ fs: fsClient, dir: GIT_CLONE_DIR, filepath });
      };

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });

      for (const file of files) {
        await writeAndAdd(file, 'name: base\n');
      }
      await GitVCS.commit('Initial commit');

      await git.branch({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'origin/main', checkout: false });

      for (const file of files) {
        await writeAndAdd(file, 'name: local\n');
      }
      await GitVCS.commit('Local changes');

      // Remote deletes both files
      await git.checkout({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'origin/main' });
      for (const file of files) {
        await git.remove({ fs: fsClient, dir: GIT_CLONE_DIR, filepath: file });
        await fsClient.promises.unlink(file);
      }
      await git.commit({
        fs: fsClient,
        dir: GIT_CLONE_DIR,
        message: 'Remote deletes',
        author: { name: 'Remote User', email: 'remote@example.com' },
      });
      await git.checkout({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'main' });

      expect(await GitVCS.buildManualResolutionFromTrees()).toMatchObject({ autoResolved: true });

      // The remote deletion is applied: gone from the working directory and from the merge commit
      const tracked = await git.listFiles({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'HEAD' });
      for (const file of files) {
        await expect(fsClient.promises.readFile(file)).rejects.toThrow();
        expect(tracked).not.toContain(file);
      }
    });

    // Only the files both sides changed are conflicts. A change made by one side only must keep that side's state.
    it('should only resolve files both sides changed and keep files only the local side added, edited or deleted', async () => {
      const fsClient = MemClient.createClient();
      const writeAndAdd = async (filepath: string, content: string) => {
        await fsClient.promises.writeFile(filepath, content);
        await git.add({ fs: fsClient, dir: GIT_CLONE_DIR, filepath });
      };

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });

      await writeAndAdd('shared.md', 'base\n');
      await writeAndAdd('local-edited.md', 'base\n');
      await writeAndAdd('local-deleted.md', 'base\n');
      await GitVCS.commit('Initial commit');
      await git.branch({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'origin/main', checkout: false });

      // Local: edits two files, deletes one and adds one the remote never had
      await writeAndAdd('shared.md', 'local edit\n');
      await writeAndAdd('local-edited.md', 'my edit\n');
      await git.remove({ fs: fsClient, dir: GIT_CLONE_DIR, filepath: 'local-deleted.md' });
      await fsClient.promises.unlink('local-deleted.md');
      await writeAndAdd('local-only.md', 'my new notes\n');
      await GitVCS.commit('Local changes');

      // Remote: only edits the shared file
      await git.checkout({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'origin/main' });
      await writeAndAdd('shared.md', 'remote edit\n');
      await git.commit({
        fs: fsClient,
        dir: GIT_CLONE_DIR,
        message: 'Remote changes',
        author: { name: 'Remote User', email: 'remote@example.com' },
      });
      await git.checkout({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'main' });

      const result = await GitVCS.buildManualResolutionFromTrees();

      // Only the file both sides edited is resolved (to the remote version) and reported
      expect(result).toEqual({
        autoResolved: true,
        autoResolvedConflicts: [{ filepath: 'shared.md', action: 'use-theirs' }],
      });
      const read = async (file: string) => (await fsClient.promises.readFile(file)).toString();
      expect(await read('shared.md')).toBe('remote edit\n');
      expect(await read('local-edited.md')).toBe('my edit\n');
      expect(await read('local-only.md')).toBe('my new notes\n');
      await expect(fsClient.promises.readFile('local-deleted.md')).rejects.toThrow();

      const tracked = await git.listFiles({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'HEAD' });
      expect(tracked).toEqual(expect.arrayContaining(['shared.md', 'local-edited.md', 'local-only.md']));
      expect(tracked).not.toContain('local-deleted.md');
    });

    it('should complete the merge when nothing was changed by both sides', async () => {
      const fsClient = MemClient.createClient();
      const writeAndAdd = async (filepath: string, content: string) => {
        await fsClient.promises.writeFile(filepath, content);
        await git.add({ fs: fsClient, dir: GIT_CLONE_DIR, filepath });
      };

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });

      await writeAndAdd('notes.md', 'base\n');
      await GitVCS.commit('Initial commit');
      // The remote has not moved since
      await git.branch({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'origin/main', checkout: false });
      await writeAndAdd('notes.md', 'my edit\n');
      await GitVCS.commit('Local changes');

      // Nothing to resolve, so no empty conflict dialog
      expect(await GitVCS.buildManualResolutionFromTrees()).toEqual({ autoResolved: true, autoResolvedConflicts: [] });
      expect((await fsClient.promises.readFile('notes.md')).toString()).toBe('my edit\n');
    });

    // E.g. a shallow clone where the remote moved several commits ahead: the merge base cannot be found
    it('should still keep files only the local side has when there is no merge base', async () => {
      const fsClient = MemClient.createClient();
      const writeAndAdd = async (filepath: string, content: string) => {
        await fsClient.promises.writeFile(filepath, content);
        await git.add({ fs: fsClient, dir: GIT_CLONE_DIR, filepath });
      };

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });

      await writeAndAdd('shared.md', 'local edit\n');
      await writeAndAdd('local-only.md', 'my new notes\n');
      await GitVCS.commit('Local changes');

      // A remote branch that shares no history with the local one
      const person = { name: 'Remote User', email: 'remote@example.com', timestamp: 1_700_000_000, timezoneOffset: 0 };
      const blob = await git.writeBlob({ fs: fsClient, dir: GIT_CLONE_DIR, blob: Buffer.from('remote edit\n') });
      const tree = await git.writeTree({
        fs: fsClient,
        dir: GIT_CLONE_DIR,
        tree: [{ mode: '100644', path: 'shared.md', oid: blob, type: 'blob' }],
      });
      const remoteCommit = await git.writeCommit({
        fs: fsClient,
        dir: GIT_CLONE_DIR,
        commit: { message: 'Remote root', tree, parent: [], author: person, committer: person },
      });
      await git.writeRef({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'refs/heads/origin/main', value: remoteCommit });

      const result = await GitVCS.buildManualResolutionFromTrees();

      expect(result).toEqual({
        autoResolved: true,
        autoResolvedConflicts: [{ filepath: 'shared.md', action: 'use-theirs' }],
      });
      expect((await fsClient.promises.readFile('shared.md')).toString()).toBe('remote edit\n');
      expect((await fsClient.promises.readFile('local-only.md')).toString()).toBe('my new notes\n');
    });

    it('should auto-complete merge without throwing when all conflicts are non-YAML', async () => {
      const fsClient = MemClient.createClient();
      const gitignoreFile = '.gitignore';
      const readmeFile = 'README.md';

      // Create initial files (no YAML files that conflict)
      await fsClient.promises.writeFile(gitignoreFile, 'node_modules\n');
      await fsClient.promises.writeFile(readmeFile, '# Project\n');

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });

      // Stage and commit all files
      const status = await GitVCS.status();
      await GitVCS.stageChanges(status.unstaged);
      await GitVCS.commit('Initial commit');

      // Create origin/main branch to simulate remote
      await git.branch({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'origin/main', checkout: false });

      // Make local changes on main
      await fsClient.promises.writeFile(gitignoreFile, 'node_modules\ndist\n');
      await fsClient.promises.writeFile(readmeFile, '# Project\nLocal changes\n');
      const status2 = await GitVCS.status();
      await GitVCS.stageChanges(status2.unstaged);
      await GitVCS.commit('Local changes');

      // Switch to origin/main and make different changes
      await git.checkout({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'origin/main' });
      await fsClient.promises.writeFile(gitignoreFile, 'node_modules\nbuild\n');
      await fsClient.promises.writeFile(readmeFile, '# Project\nRemote changes\n');
      await git.add({ fs: fsClient, dir: GIT_CLONE_DIR, filepath: gitignoreFile });
      await git.add({ fs: fsClient, dir: GIT_CLONE_DIR, filepath: readmeFile });
      await git.commit({
        fs: fsClient,
        dir: GIT_CLONE_DIR,
        message: 'Remote changes',
        author: { name: 'Remote User', email: 'remote@example.com' },
      });

      // Switch back to main
      await git.checkout({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'main' });

      // buildManualResolutionFromTrees should NOT throw — all conflicts are non-YAML
      const result = await GitVCS.buildManualResolutionFromTrees();
      expect(result).toMatchObject({ autoResolved: true });
      // The caller gets the list, so it can tell the user which files were resolved without asking
      expect((result as { autoResolvedConflicts: unknown[] }).autoResolvedConflicts).toHaveLength(2);
      expect((result as { autoResolvedConflicts: unknown[] }).autoResolvedConflicts).toEqual(
        expect.arrayContaining([
          { filepath: gitignoreFile, action: 'use-theirs' },
          { filepath: readmeFile, action: 'use-theirs' },
        ]),
      );

      // Non-YAML files should be resolved to the remote (theirs) version
      const gitignoreContent = (await fsClient.promises.readFile(gitignoreFile)).toString();
      expect(gitignoreContent).toBe('node_modules\nbuild\n');

      const readmeContent = (await fsClient.promises.readFile(readmeFile)).toString();
      expect(readmeContent).toBe('# Project\nRemote changes\n');
    });
  });

  // The path a real pull takes for text conflicts: isomorphic-git throws a MergeConflictError, which
  // collectMergeConflicts turns into the conflicts for the merge dialog (buildManualResolutionFromTrees is only
  // the fallback for merges isomorphic-git does not support).
  describe('merge() with conflicts (collectMergeConflicts)', () => {
    const insomniaFile = 'rocket-api.yaml';
    const workflowFile = '.github/workflows/main-deployment.yaml';
    const helmFile = 'helm/values.yaml';

    // Commits `base` on main, then diverges: local edits on main, remote edits on origin/main
    // (a null remote content is a deletion), and ends on main.
    async function setupDivergedRepo(files: { path: string; base: string; local: string; remote: string | null }[]) {
      const fsClient = MemClient.createClient();
      for (const dir of ['.github', '.github/workflows', 'helm']) {
        await fsClient.promises.mkdir(dir);
      }

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });

      const writeAndAdd = async (filepath: string, content: string) => {
        await fsClient.promises.writeFile(filepath, content);
        await git.add({ fs: fsClient, dir: GIT_CLONE_DIR, filepath });
      };

      for (const file of files) {
        await writeAndAdd(file.path, file.base);
      }
      await GitVCS.commit('Initial commit');
      await git.branch({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'origin/main', checkout: false });

      for (const file of files) {
        await writeAndAdd(file.path, file.local);
      }
      await GitVCS.commit('Local changes');

      await git.checkout({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'origin/main' });
      for (const file of files) {
        if (file.remote === null) {
          await git.remove({ fs: fsClient, dir: GIT_CLONE_DIR, filepath: file.path });
          await fsClient.promises.unlink(file.path);
        } else {
          await writeAndAdd(file.path, file.remote);
        }
      }
      await git.commit({
        fs: fsClient,
        dir: GIT_CLONE_DIR,
        message: 'Remote changes',
        author: { name: 'Remote User', email: 'remote@example.com' },
      });
      await git.checkout({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'main' });

      return fsClient;
    }

    const insomniaContent = (name: string) => `type: collection.insomnia.rest/5.0\nname: ${name}\n`;

    it('should only return Insomnia files as conflicts and report the rest as auto-resolved', async () => {
      await setupDivergedRepo([
        {
          path: insomniaFile,
          base: insomniaContent('base'),
          local: insomniaContent('local'),
          remote: insomniaContent('remote'),
        },
        {
          path: workflowFile,
          base: 'name: Main\nruns-on: base\n',
          local: 'name: Main\nruns-on: self-hosted\n',
          remote: 'name: Main\nruns-on: ubuntu-22.04\n',
        },
        { path: helmFile, base: 'replicas: 1\n', local: 'replicas: 5\n', remote: null },
      ]);

      try {
        await GitVCS.merge({ theirsBranch: 'origin/main', allowUncommittedChangesBeforeMerge: true });
        expect.unreachable('Should have thrown MergeConflictError');
      } catch (err) {
        expect(err).toBeInstanceOf(MergeConflictError);

        const mergeErr = err as MergeConflictError;
        expect(mergeErr.data.conflicts.map(c => c.key)).toEqual([insomniaFile]);
        expect(mergeErr.data.autoResolvedConflicts).toHaveLength(2);
        expect(mergeErr.data.autoResolvedConflicts).toEqual(
          expect.arrayContaining([
            { filepath: workflowFile, action: 'use-theirs' },
            { filepath: helmFile, action: 'delete' },
          ]),
        );
      }
    });

    it('should resolve and report non-Insomnia conflicts without opening the merge dialog', async () => {
      const fsClient = await setupDivergedRepo([
        {
          path: workflowFile,
          base: 'name: Main\nruns-on: base\n',
          local: 'name: Main\nruns-on: self-hosted\n',
          remote: 'name: Main\nruns-on: ubuntu-22.04\n',
        },
        { path: helmFile, base: 'replicas: 1\n', local: 'replicas: 5\n', remote: null },
      ]);

      const result = await GitVCS.merge({ theirsBranch: 'origin/main', allowUncommittedChangesBeforeMerge: true });

      expect(result).toMatchObject({ autoResolved: true });
      expect((result as { autoResolvedConflicts: unknown[] }).autoResolvedConflicts).toEqual(
        expect.arrayContaining([
          { filepath: workflowFile, action: 'use-theirs' },
          { filepath: helmFile, action: 'delete' },
        ]),
      );
      // The remote version won: replaced workflow, deleted Helm file, none left in the merge commit
      expect((await fsClient.promises.readFile(workflowFile)).toString()).toBe('name: Main\nruns-on: ubuntu-22.04\n');
      await expect(fsClient.promises.readFile(helmFile)).rejects.toThrow();
      expect(await git.listFiles({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'HEAD' })).not.toContain(helmFile);
    });
  });

  describe('getBranchTrackingRemote', () => {
    it('returns null when no tracking remote is set', async () => {
      const fsClient = MemClient.createClient();
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await fsClient.promises.writeFile(path.join(GIT_INSOMNIA_DIR, fooTxt), 'foo');

      await GitVCS.init({
        uri: '',
        repoId: 'test-remote-info',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });

      const remote = await GitVCS.getBranchTrackingRemote();
      expect(remote).toBeNull();
    });

    it('returns the configured tracking remote', async () => {
      const fsClient = MemClient.createClient();
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await fsClient.promises.writeFile(path.join(GIT_INSOMNIA_DIR, fooTxt), 'foo');

      await GitVCS.init({
        uri: '',
        repoId: 'test-tracking-remote',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });

      // Manually set tracking remote via git config
      const branch = await GitVCS.getCurrentBranch();
      await git.setConfig({
        fs: fsClient,
        dir: GIT_CLONE_DIR,
        path: `branch.${branch}.remote`,
        value: 'upstream',
      });

      const remote = await GitVCS.getBranchTrackingRemote();
      expect(remote).toBe('upstream');
    });
  });

  describe('getBranchRemoteInfo', () => {
    it('returns isOrigin true when no tracking remote is set', async () => {
      const fsClient = MemClient.createClient();
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await fsClient.promises.writeFile(path.join(GIT_INSOMNIA_DIR, fooTxt), 'foo');

      await GitVCS.init({
        uri: '',
        repoId: 'test-branch-info-origin',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });

      const info = await GitVCS.getBranchRemoteInfo();
      expect(info.trackingRemote).toBeNull();
      expect(info.isOrigin).toBe(true);
      expect(info.remoteUrl).toBeNull();
    });

    it('returns isOrigin true when tracking remote is origin', async () => {
      const fsClient = MemClient.createClient();
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await fsClient.promises.writeFile(path.join(GIT_INSOMNIA_DIR, fooTxt), 'foo');

      await GitVCS.init({
        uri: '',
        repoId: 'test-branch-info-explicit-origin',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });

      const branch = await GitVCS.getCurrentBranch();
      await git.setConfig({
        fs: fsClient,
        dir: GIT_CLONE_DIR,
        path: `branch.${branch}.remote`,
        value: 'origin',
      });

      const info = await GitVCS.getBranchRemoteInfo();
      expect(info.trackingRemote).toBe('origin');
      expect(info.isOrigin).toBe(true);
    });

    it('returns isOrigin false when tracking a non-origin remote', async () => {
      const fsClient = MemClient.createClient();
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await fsClient.promises.writeFile(path.join(GIT_INSOMNIA_DIR, fooTxt), 'foo');

      await GitVCS.init({
        uri: '',
        repoId: 'test-branch-info-non-origin',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
        legacyDiff: true,
      });
      await GitVCS.setAuthor({ name: 'Karen Brown', email: 'karen@example.com' });

      const branch = await GitVCS.getCurrentBranch();
      await git.setConfig({
        fs: fsClient,
        dir: GIT_CLONE_DIR,
        path: `branch.${branch}.remote`,
        value: 'upstream',
      });
      await git.setConfig({
        fs: fsClient,
        dir: GIT_CLONE_DIR,
        path: 'remote.upstream.url',
        value: 'https://github.com/other/repo.git',
      });

      const info = await GitVCS.getBranchRemoteInfo();
      expect(info.trackingRemote).toBe('upstream');
      expect(info.isOrigin).toBe(false);
      expect(info.remoteUrl).toBe('https://github.com/other/repo.git');
    });
  });
});
