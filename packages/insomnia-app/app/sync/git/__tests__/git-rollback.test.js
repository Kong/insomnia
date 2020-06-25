// @flow
import path from 'path';
import GitVCS, { GIT_CLONE_DIR, GIT_INSOMNIA_DIR } from '../git-vcs';
import { setupDateMocks } from './util';
import { MemPlugin } from '../mem-plugin';
import type { FileWithStatus } from '../git-rollback';
import { gitRollback } from '../git-rollback';
jest.mock('path');

describe('git rollback', () => {
  describe('mocked', () => {
    const removeMock = jest.fn().mockResolvedValue();
    const unlinkMock = jest.fn().mockResolvedValue();
    const undoPendingChangesMock = jest.fn().mockResolvedValue();
    let vcs: $Shape<GitVCS> = {};

    beforeEach(() => {
      jest.resetAllMocks();
      const fsMock = { promises: { unlink: unlinkMock } };
      vcs = {
        getFs: jest.fn().mockReturnValue(fsMock),
        remove: removeMock,
        undoPendingChanges: undoPendingChangesMock,
      };
    });

    it('should remove and delete added and *added files', async () => {
      const aTxt = 'a.txt';
      const bTxt = 'b.txt';

      const files: Array<FileWithStatus> = [
        { filePath: aTxt, status: 'added' },
        { filePath: bTxt, status: '*added' },
      ];

      await gitRollback(vcs, files);

      expect(unlinkMock).toHaveBeenCalledTimes(2);
      expect(unlinkMock).toHaveBeenNthCalledWith(1, aTxt);
      expect(unlinkMock).toHaveBeenNthCalledWith(2, bTxt);

      expect(removeMock).toHaveBeenCalledTimes(2);
      expect(removeMock).toHaveBeenNthCalledWith(1, aTxt);
      expect(removeMock).toHaveBeenNthCalledWith(2, bTxt);

      expect(undoPendingChangesMock).not.toHaveBeenCalled();
    });

    it('should undo pending changes for non-added files', async () => {
      const aTxt = 'a.txt';
      const bTxt = 'b.txt';

      const files: Array<FileWithStatus> = [
        { filePath: aTxt, status: 'modified' },
        { filePath: bTxt, status: 'deleted' },
      ];

      await gitRollback(vcs, files);

      expect(unlinkMock).toHaveBeenCalledTimes(0);
      expect(removeMock).toHaveBeenCalledTimes(0);

      expect(undoPendingChangesMock).toHaveBeenCalledTimes(1);
      expect(undoPendingChangesMock).toHaveBeenCalledWith(expect.arrayContaining([aTxt, bTxt]));
    });

    it('should remove, delete, and undo appropriately depending on status', async () => {
      const aTxt = 'a.txt';
      const bTxt = 'b.txt';
      const cTxt = 'c.txt';
      const dTxt = 'd.txt';

      const files: Array<FileWithStatus> = [
        { filePath: aTxt, status: 'added' },
        { filePath: bTxt, status: '*added' },
        { filePath: cTxt, status: 'modified' },
        { filePath: dTxt, status: 'deleted' },
      ];

      await gitRollback(vcs, files);

      expect(unlinkMock).toHaveBeenCalledTimes(2);
      expect(unlinkMock).toHaveBeenNthCalledWith(1, aTxt);
      expect(unlinkMock).toHaveBeenNthCalledWith(2, bTxt);

      expect(removeMock).toHaveBeenCalledTimes(2);
      expect(removeMock).toHaveBeenNthCalledWith(1, aTxt);
      expect(removeMock).toHaveBeenNthCalledWith(2, bTxt);

      expect(undoPendingChangesMock).toHaveBeenCalledTimes(1);
      expect(undoPendingChangesMock).toHaveBeenCalledWith(expect.arrayContaining([cTxt, dTxt]));
    });
  });

  describe.each(['win32', 'posix'])('integration using path.%s', type => {
    let fooTxt = '';
    let barTxt = '';
    let bazTxt = '';
    beforeAll(() => {
      path.__mockPath(type);
      fooTxt = path.join(GIT_INSOMNIA_DIR, 'foo.txt');
      barTxt = path.join(GIT_INSOMNIA_DIR, 'bar.txt');
      bazTxt = path.join(GIT_INSOMNIA_DIR, 'baz.txt');
    });

    afterAll(() => jest.restoreAllMocks());
    beforeEach(setupDateMocks);

    it('should rollback files as expected', async () => {
      const originalContent = 'original';

      const fs = MemPlugin.createPlugin();
      await fs.promises.mkdir(GIT_INSOMNIA_DIR);
      await fs.promises.writeFile(fooTxt, 'foo');
      await fs.promises.writeFile(barTxt, 'bar');
      await fs.promises.writeFile(bazTxt, originalContent);

      const vcs = new GitVCS();
      await vcs.init(GIT_CLONE_DIR, fs);

      // Commit
      await vcs.setAuthor('Karen Brown', 'karen@example.com');
      await vcs.add(bazTxt);
      await vcs.commit('First commit!');

      // Edit file
      await fs.promises.writeFile(bazTxt, 'changedContent');

      // foo is staged, bar is unstaged, but both are untracked (thus, new to git)
      await vcs.add(`${GIT_INSOMNIA_DIR}/bar.txt`);
      const fooStatus = await vcs.status(fooTxt);
      const barStatus = await vcs.status(barTxt);
      const bazStatus = await vcs.status(bazTxt);

      expect(fooStatus).toBe('*added');
      expect(barStatus).toBe('added');
      expect(bazStatus).toBe('*modified');

      const files: Array<FileWithStatus> = [
        { filePath: fooTxt, status: fooStatus },
        { filePath: barTxt, status: barStatus },
        { filePath: bazTxt, status: bazStatus },
      ];

      // Remove both
      await gitRollback(vcs, files);

      // Ensure git doesn't know about the two files anymore
      expect(await vcs.status(fooTxt)).toBe('absent');
      expect(await vcs.status(barTxt)).toBe('absent');
      expect(await vcs.status(bazTxt)).toBe('unmodified');

      // Ensure the two files have been removed from the fs (memplugin)
      await expect(fs.promises.readFile(fooTxt)).rejects.toThrowError(
        `ENOENT: no such file or directory, scandir '${fooTxt}'`,
      );
      await expect(fs.promises.readFile(barTxt)).rejects.toThrowError(
        `ENOENT: no such file or directory, scandir '${barTxt}'`,
      );

      expect((await fs.promises.readFile(bazTxt)).toString()).toBe(originalContent);
    });
  });
});
