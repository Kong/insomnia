import path from 'node:path';

import * as git from 'isomorphic-git';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import GitVCS, { GIT_CLONE_DIR, GIT_INSOMNIA_DIR } from '../git-vcs';
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
              timestamp: 1000080000,
              timezoneOffset: 0,
            },
            committer: {
              email: 'karen@example.com',
              name: 'Karen Brown',
              timestamp: 1000080000,
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
});
