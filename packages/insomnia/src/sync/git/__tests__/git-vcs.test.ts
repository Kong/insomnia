import * as git from 'isomorphic-git';
import path from 'path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import GitVCS, { GIT_CLONE_DIR, GIT_INSOMNIA_DIR } from '../git-vcs';
import { MemClient } from '../mem-client';
import { setupDateMocks } from './util';

describe('Git-VCS', () => {
  const fooTxt = 'foo.txt';
  const barTxt = 'bar.txt';

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(setupDateMocks);

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
      });
      await GitVCS.setAuthor('Karen Brown', 'karen@example.com');

      // foo.txt and bar.txt should be in the unstaged list
      const status = await GitVCS.status();
      expect(status.staged).toEqual([]);
      expect(status.unstaged).toEqual([{
        'name': '',
        'path': '.insomnia/bar.txt',
        'status': [0, 2, 0],
      },
      {
        'name': '',
        'path': '.insomnia/foo.txt',
        'status': [0, 2, 0],
        },
      ]);

      const fooStatus = status.unstaged.find(f => f.path.includes(fooTxt));

      fooStatus && await GitVCS.stageChanges([fooStatus]);
      const status2 = await GitVCS.status();
      expect(status2.staged).toEqual([{
        'name': '',
        'path': '.insomnia/foo.txt',
        'status': [0, 2, 2],
      }]);
      expect(status2.unstaged).toEqual([
        {
          'name': '',
          'path': '.insomnia/bar.txt',
          'status': [0, 2, 0],
        },
      ]);

      const barStatus = status2.unstaged.find(f => f.path.includes(barTxt));

      barStatus && await GitVCS.stageChanges([barStatus]);
      const status3 = await GitVCS.status();
      expect(status3.staged).toEqual([
        {
          'name': '',
          'path': '.insomnia/bar.txt',
          'status': [0, 2, 2],
        },
        {
          'name': '',
          'path': '.insomnia/foo.txt',
          'status': [0, 2, 2],
        },
      ]);

      const fooStatus3 = status3.staged.find(f => f.path.includes(fooTxt));
      fooStatus3 && await GitVCS.unstageChanges([fooStatus3]);
      const status4 = await GitVCS.status();
      expect(status4).toEqual({
        staged: [{
          'name': '',
          'path': '.insomnia/bar.txt',
          'status': [0, 2, 2],
        }],
        unstaged: [
          {
          'name': '',
          'path': '.insomnia/foo.txt',
          'status': [0, 2, 0],
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
      });
      await GitVCS.setAuthor('Karen Brown', 'karen@example.com');
      expect(await GitVCS.log()).toEqual([]);
    });

    it('commit file', async () => {
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
      });

      await GitVCS.setAuthor('Karen Brown', 'karen@example.com');

      const status = await GitVCS.status();
      const fooStatus = status.unstaged.find(f => f.path.includes(fooTxt));
      fooStatus && await GitVCS.stageChanges([fooStatus]);

      const status2 = await GitVCS.status();

      expect(status2.staged).toEqual([{
        'name': '',
        'path': '.insomnia/foo.txt',
        'status': [0, 2, 2],
      }]);
      expect(status2.unstaged).toEqual([
        {
        'name': '',
        'path': '.insomnia/bar.txt',
          'status': [
            0,
            2,
            0,
          ],
        },
      ]);

      await GitVCS.commit('First commit!');

      const status3 = await GitVCS.status();

      expect(status3.staged).toEqual([]);
      expect(status3.unstaged).toEqual([
        {
        'name': '',
        'path': '.insomnia/bar.txt',
          'status': [
            0,
            2,
            0,
          ],
        },
      ]);

      expect(await GitVCS.log()).toEqual([
        {
          commit: {
            author: {
              email: 'karen@example.com',
              name: 'Karen Brown',
              timestamp: 1000000000,
              timezoneOffset: 0,
            },
            committer: {
              email: 'karen@example.com',
              name: 'Karen Brown',
              timestamp: 1000000000,
              timezoneOffset: 0,
            },
            message: 'First commit!\n',
            parent: [],
            tree: '14819d8019f05edb70a29850deb09a4314ad0afc',
          },
          oid: '76f804a23eef9f52017bf93f4bc0bfde45ec8a93',
          payload: `tree 14819d8019f05edb70a29850deb09a4314ad0afc
author Karen Brown <karen@example.com> 1000000000 +0000
committer Karen Brown <karen@example.com> 1000000000 +0000

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
      });
      await GitVCS.setAuthor('Karen Brown', 'karen@example.com');
      const status = await GitVCS.status();
      const fooStatus = status.unstaged.find(f => f.path.includes(fooTxt));
      fooStatus && await GitVCS.stageChanges([fooStatus]);
      await GitVCS.commit('First commit!');
      expect((await GitVCS.log()).length).toBe(1);
      await GitVCS.checkout('new-branch');
      expect((await GitVCS.log()).length).toBe(1);
      const status2 = await GitVCS.status();
      const barStatus = status2.unstaged.find(f => f.path.includes(barTxt));
      barStatus && await GitVCS.stageChanges([barStatus]);
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
      const fsClient = MemClient.createClient();
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await fsClient.promises.mkdir(folder);
      await fsClient.promises.writeFile(folderBarTxt, originalContent);

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
      });
      // Commit
      await GitVCS.setAuthor('Karen Brown', 'karen@example.com');

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
        'staged': [],
        'unstaged': [
          {
            'name': '',
            'path': '.insomnia/folder/bar.txt',
            'status': [1, 2, 1],
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
      // Expect original doc to have reverted
      expect((await fsClient.promises.readFile(folderBarTxt)).toString()).toBe(originalContent);
    });

    it('should remove pending changes from select tracked files', async () => {
      const foo1Txt = path.join(GIT_INSOMNIA_DIR, 'foo1.txt');
      const foo2Txt = path.join(GIT_INSOMNIA_DIR, 'foo2.txt');
      const foo3Txt = path.join(GIT_INSOMNIA_DIR, 'foo3.txt');
      const files = [foo1Txt, foo2Txt, foo3Txt];
      const originalContent = 'content';
      const changedContent = 'changedContent';
      const fsClient = MemClient.createClient();
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
      });
      // Write to all files
      await Promise.all(files.map(f => fsClient.promises.writeFile(f, originalContent)));
      // Commit all files
      await GitVCS.setAuthor('Karen Brown', 'karen@example.com');
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
        'staged': [],
        'unstaged': [
          {
            'name': '',
            'path': '.insomnia/foo3.txt',
            'status': [1, 2, 1],
          },
        ],
      });
      // Expect original doc to have reverted for foo1 and foo2
      expect((await fsClient.promises.readFile(foo1Txt)).toString()).toBe(originalContent);
      expect((await fsClient.promises.readFile(foo2Txt)).toString()).toBe(originalContent);
      expect((await fsClient.promises.readFile(foo3Txt)).toString()).toBe(changedContent);
    });
  });
});
