import type { PromiseFsClient } from 'isomorphic-git';
import path from 'path';
import YAML from 'yaml';

import { database as db } from '../../common/database';
import type { InsomniaFile } from '../../common/import-v5-parser';
import { getInsomniaV5DataExport, importInsomniaV5Data } from '../../common/insomnia-v5';
import * as models from '../../models';
import { isWorkspace, type Workspace } from '../../models/workspace';
import type { WorkspaceMeta } from '../../models/workspace-meta';
import Stat from './stat';
import { SystemError } from './system-error';

/**
 * A fs client to access workspace data stored in NeDB as files.
 * Used by isomorphic-git
 * https://isomorphic-git.org/docs/en/fs#implementing-your-own-fs
 */
export class GitProjectNeDBClient {
  _projectId: string;

  constructor(projectId: string) {
    this._projectId = projectId;
  }

  static createClient(projectId: string): PromiseFsClient {
    return {
      promises: new GitProjectNeDBClient(projectId),
    };
  }

  async readFile(
    filePath: string,
    options?: BufferEncoding | { encoding?: BufferEncoding },
  ) {
    if (!filePath.endsWith('.yaml')) {
      throw this._errMissing(filePath);
    }

    filePath = path.normalize(filePath);
    options = options || {};

    if (typeof options === 'string') {
      options = {
        encoding: options,
      };
    }

    try {
      const workspaceId = await this.getWorkspaceIdFromFilePath(filePath);
      console.log('[git-project-nedb] reading file', { filePath, found: Boolean(workspaceId) });
      if (!workspaceId) {
        throw this._errMissing(filePath);
      }

      const workspaceFile = await getInsomniaV5DataExport(workspaceId);

      const raw = Buffer.from(workspaceFile, 'utf8');

      if (options.encoding) {
        return raw.toString(options.encoding);
      } else {
        return raw;
      }
    } catch (err) {
      throw this._errMissing(filePath);
    }
  }

  async writeFile(filePath: string, data: Buffer | string) {
    filePath = path.normalize(filePath);

    if (!filePath.endsWith('.yaml')) {
      throw this._errMissing(filePath);
    }

    const dataStr = data.toString();

    const doesFileContainInsomniaV5FormatTypeString = dataStr.split('\n')[0].trim().includes('insomnia.rest');

    if (!doesFileContainInsomniaV5FormatTypeString) {
      throw this._errMissing(filePath);
    }

    // Skip the file if there is a conflict marker
    if (dataStr.split('\n').includes('=======')) {
      return;
    }
    const dataToImport = importInsomniaV5Data(dataStr);

    const bufferId = await db.bufferChanges();

    for (const doc of dataToImport) {
      if (isWorkspace(doc)) {
        console.log('[git] setting workspace parent to be that of the active project', { original: doc.parentId, new: this._projectId });
        // Whenever we write a workspace into nedb we should set the parentId to be that of the current project
        // This is because the parentId (or a project) is not synced into git, so it will be cleared whenever git writes the workspace into the db, thereby removing it from the project on the client
        // In order to reproduce this bug, comment out the following line, then clone a repository into a local project, then open the workspace, you'll notice it will have moved into the default project
        doc.parentId = this._projectId;

        const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(doc._id);
        await models.workspaceMeta.update(workspaceMeta, { gitFilePath: filePath });
      }

      await db.upsert(doc, true);
    }

    await db.flushChanges(bufferId);
  }

  async unlink(filePath: string) {
    filePath = path.normalize(filePath);
    const workspaceId = await this.getWorkspaceIdFromFilePath(filePath);

    if (!workspaceId) {
      throw this._errMissing(filePath);
    }

    const doc = await db.get(models.workspace.type, workspaceId);

    if (!doc) {
      return;
    }

    await db.unsafeRemove(doc, true);
  }

  async readdir(filePath: string) {
    filePath = path.normalize(filePath);
    const workspaces = await db.find<Workspace>(models.workspace.type, { parentId: this._projectId });
    const workspaceMetas = await db.find<WorkspaceMeta>(models.workspaceMeta.type, {
      parentId: {
        $in: workspaces.map(w => w._id),
      },
    });

    const hasDirectoryInsomniaFiles = workspaceMetas.some(({ gitFilePath }) => gitFilePath && path.dirname(gitFilePath) === filePath);

    if (hasDirectoryInsomniaFiles) {
      const workspacePaths = workspaceMetas
        // Filter out workspaces that don't have a gitFilePath or are not in the directory
        .filter(workspaceMeta => workspaceMeta.gitFilePath && path.dirname(workspaceMeta.gitFilePath) === filePath)
        // Return the basename of the paths
        .map(workspaceMeta => path.basename(workspaceMeta.gitFilePath!));
      return workspacePaths;
    }

    throw this._errMissing(filePath);
  }

  async mkdir() {
    throw new Error('NeDBClient is not writable');
  }

  async stat(filePath: string) {
    filePath = path.normalize(filePath);
    let fileBuff: Buffer | string | null = null;
    let dir: string[] | null = null;
    try {
      fileBuff = await this.readFile(filePath);
    } catch (err) {
      // console.log('[nedb] Failed to read file', err);
    }

    if (fileBuff === null) {
      try {
        dir = await this.readdir(filePath);
      } catch (err) {
        // console.log('[nedb] Failed to read dir', err);
      }
    }

    if (!fileBuff && !dir) {
      throw this._errMissing(filePath);
    }

    if (fileBuff) {
      const doc: InsomniaFile = YAML.parse(fileBuff.toString());
      return new Stat({
        type: 'file',
        mode: 0o777,
        size: fileBuff.length,
        // @ts-expect-error should be number instead of string https://nodejs.org/api/fs.html#fs_stats_ino
        ino: doc?.meta?.id,
        mtimeMs: doc?.meta?.modified || 0,
      });
    } else {
      return new Stat({
        type: 'dir',
        mode: 0o777,
        size: 0,
        ino: 0,
        mtimeMs: 0,
      });
    }
  }

  async readlink(filePath: string, ...x: any[]) {
    return this.readFile(filePath, ...x);
  }

  async lstat(filePath: string) {
    return this.stat(filePath);
  }

  async rmdir() {
    throw new Error('NeDBClient symlink not supported');
  }

  async symlink() {
    throw new Error('NeDBClient symlink not supported');
  }

  _errMissing(filePath: string) {
    return new SystemError({
      message: `ENOENT: no such file or directory, scandir '${filePath}'`,
      errno: -2,
      code: 'ENOENT',
      syscall: 'scandir',
      path: filePath,
    });
  }

  async getWorkspaceIdFromFilePath(filePath: string) {
    filePath = path.normalize(filePath);

    const workspaceMeta = await db.find<WorkspaceMeta>(models.workspaceMeta.type, {
      gitFilePath: filePath,
    });

    if (workspaceMeta.length === 0) {
      return null;
    }

    return workspaceMeta[0].parentId;
  }
}
