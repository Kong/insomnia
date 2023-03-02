import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as git from 'isomorphic-git';
import path from 'path';

import GitVCS, { GIT_CLONE_DIR, GIT_INSOMNIA_DIR } from '../git-vcs';
import { MemClient } from '../mem-client';
import { setupDateMocks } from './util';

describe('Git-VCS', () => {
  let fooTxt = '';
  let barTxt = '';

  beforeAll(() => {
    fooTxt = path.join(GIT_INSOMNIA_DIR, 'foo.txt');
    barTxt = path.join(GIT_INSOMNIA_DIR, 'bar.txt');
  });

  afterAll(() => jest.restoreAllMocks());

  beforeEach(setupDateMocks);

  describe('common operations', () => {
    it('listFiles()', async () => {
      const fsClient = MemClient.createClient();

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
      });
      await GitVCS.setAuthor('Karen Brown', 'karen@example.com');
      // No files exist yet
      const files1 = await GitVCS.listFiles();
      expect(files1).toEqual([]);
      // File does not exist in git index
      await fsClient.promises.writeFile('foo.txt', 'bar');
      const files2 = await GitVCS.listFiles();
      expect(files2).toEqual([]);
    });

    it('stage and unstage file', async () => {
      const fsClient = MemClient.createClient();
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await fsClient.promises.writeFile(fooTxt, 'foo');
      await fsClient.promises.writeFile(barTxt, 'bar');
      // Files outside namespace should be ignored
      await fsClient.promises.writeFile('/other.txt', 'other');

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
      });
      await GitVCS.setAuthor('Karen Brown', 'karen@example.com');
      expect(await GitVCS.status(barTxt)).toBe('*added');
      expect(await GitVCS.status(fooTxt)).toBe('*added');
      await GitVCS.add(fooTxt);
      expect(await GitVCS.status(barTxt)).toBe('*added');
      expect(await GitVCS.status(fooTxt)).toBe('added');
      await GitVCS.remove(fooTxt);
      expect(await GitVCS.status(barTxt)).toBe('*added');
      expect(await GitVCS.status(fooTxt)).toBe('*added');
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
      await fsClient.promises.writeFile(fooTxt, 'foo');
      await fsClient.promises.writeFile(barTxt, 'bar');
      await fsClient.promises.writeFile('other.txt', 'should be ignored');

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
      });
      await GitVCS.setAuthor('Karen Brown', 'karen@example.com');
      await GitVCS.add(fooTxt);
      await GitVCS.commit('First commit!');
      expect(await GitVCS.status(barTxt)).toBe('*added');
      expect(await GitVCS.status(fooTxt)).toBe('unmodified');
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
      await fsClient.promises.unlink(fooTxt);
      expect(await GitVCS.status(barTxt)).toBe('*added');
      expect(await GitVCS.status(fooTxt)).toBe('*deleted');
      await GitVCS.remove(fooTxt);
      expect(await GitVCS.status(barTxt)).toBe('*added');
      expect(await GitVCS.status(fooTxt)).toBe('deleted');
      await GitVCS.remove(fooTxt);
      expect(await GitVCS.status(barTxt)).toBe('*added');
      expect(await GitVCS.status(fooTxt)).toBe('deleted');
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
      await GitVCS.add(fooTxt);
      await GitVCS.commit('First commit!');
      expect((await GitVCS.log()).length).toBe(1);
      await GitVCS.checkout('new-branch');
      expect((await GitVCS.log()).length).toBe(1);
      await GitVCS.add(barTxt);
      await GitVCS.commit('Second commit!');
      expect((await GitVCS.log()).length).toBe(2);
      await GitVCS.checkout('main');
      expect((await GitVCS.log()).length).toBe(1);
    });
  });

  describe('push()', () => {
    it('should throw an exception when push response contains errors', async () => {
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
      await fsClient.promises.writeFile(fooTxt, originalContent);
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
      await GitVCS.add(fooTxt);
      await GitVCS.add(folderBarTxt);
      await GitVCS.commit('First commit!');
      // Change the file
      await fsClient.promises.writeFile(fooTxt, 'changedContent');
      await fsClient.promises.writeFile(folderBarTxt, 'changedContent');
      expect(await GitVCS.status(fooTxt)).toBe('*modified');
      expect(await GitVCS.status(folderBarTxt)).toBe('*modified');
      // Undo
      await GitVCS.undoPendingChanges();
      // Ensure git doesn't recognize a change anymore
      expect(await GitVCS.status(fooTxt)).toBe('unmodified');
      expect(await GitVCS.status(folderBarTxt)).toBe('unmodified');
      // Expect original doc to have reverted
      expect((await fsClient.promises.readFile(fooTxt)).toString()).toBe(originalContent);
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
      await Promise.all(files.map(f => GitVCS.add(f, originalContent)));
      await GitVCS.commit('First commit!');
      // Change all files
      await Promise.all(files.map(f => fsClient.promises.writeFile(f, changedContent)));
      await Promise.all(files.map(() => expect(GitVCS.status(foo1Txt)).resolves.toBe('*modified')));
      // Undo foo1 and foo2, but not foo3
      await GitVCS.undoPendingChanges([foo1Txt, foo2Txt]);
      expect(await GitVCS.status(foo1Txt)).toBe('unmodified');
      expect(await GitVCS.status(foo2Txt)).toBe('unmodified');
      // Expect original doc to have reverted for foo1 and foo2
      expect((await fsClient.promises.readFile(foo1Txt)).toString()).toBe(originalContent);
      expect((await fsClient.promises.readFile(foo2Txt)).toString()).toBe(originalContent);
      // Expect changed content for foo3
      expect(await GitVCS.status(foo3Txt)).toBe('*modified');
      expect((await fsClient.promises.readFile(foo3Txt)).toString()).toBe(changedContent);
    });
  });

  describe('readObjectFromTree()', () => {
    it('reads an object from tree', async () => {
      const fsClient = MemClient.createClient();
      const dir = path.join(GIT_INSOMNIA_DIR, 'dir');
      const dirFooTxt = path.join(dir, 'foo.txt');
      await fsClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await fsClient.promises.mkdir(dir);
      await fsClient.promises.writeFile(dirFooTxt, 'foo');

      await GitVCS.init({
        uri: '',
        repoId: '',
        directory: GIT_CLONE_DIR,
        fs: fsClient,
      });
      await GitVCS.setAuthor('Karen Brown', 'karen@example.com');
      await GitVCS.add(dirFooTxt);
      await GitVCS.commit('First');
      await fsClient.promises.writeFile(dirFooTxt, 'foo bar');
      await GitVCS.add(dirFooTxt);
      await GitVCS.commit('Second');
      const log = await GitVCS.log();
      expect(await GitVCS.readObjFromTree(log[0].commit.tree, dirFooTxt)).toBe('foo bar');
      expect(await GitVCS.readObjFromTree(log[1].commit.tree, dirFooTxt)).toBe('foo');
      // Some extra checks
      expect(await GitVCS.readObjFromTree(log[1].commit.tree, 'missing')).toBe(null);
      expect(await GitVCS.readObjFromTree('missing', 'missing')).toBe(null);
    });
  });
});
