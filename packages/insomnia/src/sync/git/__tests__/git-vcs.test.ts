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
      await fsClient.promises.writeFile(yamlFile, 'name: base env\n');
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
      await fsClient.promises.writeFile(yamlFile, 'name: local env\n');
      await fsClient.promises.writeFile(gitignoreFile, 'node_modules\ndist\n');
      const status2 = await GitVCS.status();
      await GitVCS.stageChanges(status2.unstaged);
      await GitVCS.commit('Local changes');

      // Switch to origin/main and make different changes
      await git.checkout({ fs: fsClient, dir: GIT_CLONE_DIR, ref: 'origin/main' });
      await fsClient.promises.writeFile(yamlFile, 'name: remote env\n');
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
      expect(result).toEqual({ autoResolved: true });

      // Non-YAML files should be resolved to the remote (theirs) version
      const gitignoreContent = (await fsClient.promises.readFile(gitignoreFile)).toString();
      expect(gitignoreContent).toBe('node_modules\nbuild\n');

      const readmeContent = (await fsClient.promises.readFile(readmeFile)).toString();
      expect(readmeContent).toBe('# Project\nRemote changes\n');
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
