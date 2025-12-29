import path from 'node:path';

import type { PromiseFsClient } from 'isomorphic-git';
import YAML from 'yaml';

import { database, database as db } from '../../common/database';
import { extractErrorMessages } from '../../common/import';
import type { InsomniaFile } from '../../common/import-v5-parser';
import { getInsomniaV5DataExport, tryImportV5Data } from '../../common/insomnia-v5';
import * as models from '../../models';
import { isMcp, isWorkspace, type Workspace } from '../../models/workspace';
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

  async readFile(filePath: string, options?: BufferEncoding | { encoding?: BufferEncoding }) {
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
      if (!workspaceId) {
        throw this._errMissing(filePath);
      }

      const workspaceFile = await getInsomniaV5DataExport({ workspaceId, includePrivateEnvironments: false });

      const raw = Buffer.from(workspaceFile, 'utf8');

      if (options.encoding) {
        return raw.toString(options.encoding);
      }
      return raw;
    } catch {
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
    const { data: dataToImport, error } = tryImportV5Data(dataStr);
    if (error) {
      const errorMsg = extractErrorMessages(error);
      console.warn(`[git] Skipping import of ${filePath} due to error: ${errorMsg}.  Fallback to default FS.`);
      throw new Error(`Failed to import data from git file ${filePath}: ${errorMsg}`);
    }

    const bufferId = await db.bufferChanges();

    const workspace = dataToImport.find(isWorkspace) as Workspace | undefined;

    const isExistingWorkspace = workspace && (await models.workspace.getById(workspace._id));

    if (isExistingWorkspace) {
      const originDocs = await database.getWithDescendants(workspace);
      // If the workspace already exists, we need to remove any documents that are not in the new data
      const deletedDocs = originDocs.filter(
        originDoc => !dataToImport.some(doc => doc._id === originDoc._id) && models.canSync(originDoc),
      );
      deletedDocs.forEach(async doc => {
        db.unsafeRemove(doc);
      });
    }

    for (const doc of dataToImport) {
      if (isWorkspace(doc)) {
        console.log('[git] setting workspace parent to be that of the active project', {
          original: doc.parentId,
          new: this._projectId,
        });
        // Whenever we write a workspace into nedb we should set the parentId to be that of the current project
        // This is because the parentId (or a project) is not synced into git, so it will be cleared whenever git writes the workspace into the db, thereby removing it from the project on the client
        // In order to reproduce this bug, comment out the following line, then clone a repository into a local project, then open the workspace, you'll notice it will have moved into the default project
        doc.parentId = this._projectId;

        const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(doc._id);
        await models.workspaceMeta.update(workspaceMeta, { gitFilePath: filePath });
      }

      await db.update(doc);
    }

    await db.flushChanges(bufferId);
  }

  async unlink(filePath: string) {
    filePath = path.normalize(filePath);
    const workspaceId = await this.getWorkspaceIdFromFilePath(filePath);

    if (!workspaceId) {
      throw this._errMissing(filePath);
    }

    const doc = await db.findOne<Workspace>(models.workspace.type, { _id: workspaceId });
    if (!doc) {
      return;
    }

    await db.unsafeRemove<Workspace>(doc);
  }

  async readdir(filePath: string) {
    filePath = path.normalize(filePath);
    // Exclude the mcp workspace since it's not supported in git sync
    const workspaces = (await db.find<Workspace>(models.workspace.type, { parentId: this._projectId })).filter(
      w => !isMcp(w),
    );
    const workspaceMetas = await db.find<WorkspaceMeta>(models.workspaceMeta.type, {
      parentId: {
        $in: workspaces.map(w => w._id),
      },
    });

    const hasDirectoryInsomniaFiles = workspaceMetas.some(
      ({ gitFilePath }) => gitFilePath && path.dirname(gitFilePath) === filePath,
    );

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
    } catch {
      // console.log('[nedb] Failed to read file', err);
    }

    if (fileBuff === null) {
      try {
        dir = await this.readdir(filePath);
      } catch {
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
    }
    return new Stat({
      type: 'dir',
      mode: 0o777,
      size: 0,
      ino: 0,
      mtimeMs: 0,
    });
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

  /**
   * Given a file path, find the workspace ID associated with it.
   * This is used to map a git file path to the corresponding workspace in the database.
   */
  async getWorkspaceIdFromFilePath(filePath: string) {
    // Normalize the file path to ensure consistency (handles OS differences, etc.)
    filePath = path.normalize(filePath);

    // Find all workspaces that belong to the current project
    const workspaces = await db.find<Workspace>(models.workspace.type, {
      parentId: this._projectId,
    });

    // Find workspaceMeta entries that match the file path and belong to one of the found workspaces
    const workspaceMeta = await db.find<WorkspaceMeta>(models.workspaceMeta.type, {
      gitFilePath: filePath,
      parentId: {
        $in: workspaces.map(w => w._id), // Only consider metas for workspaces in this project
      },
    });

    // If no matching workspaceMeta is found, return null (file is not tracked)
    if (workspaceMeta.length === 0) {
      return null;
    }

    // Return the parentId (workspace ID) of the first matching workspaceMeta
    return workspaceMeta[0].parentId;
  }
}
