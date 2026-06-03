/**
 * NeDB File System Client for Git Operations
 *
 * This module provides a file system client that allows isomorphic-git to read and write
 * workspace data stored in NeDB as if it were regular files. This enables Git operations
 * to work seamlessly with Insomnia's database-backed storage.
 *
 * Key responsibilities:
 * - Implement the isomorphic-git FsClient interface
 * - Convert between file paths and database records
 * - Handle YAML serialization/deserialization
 * - Manage workspace data during Git operations
 *
 */

import path from 'node:path';

import type { BaseModel } from 'insomnia-data';
import { models } from 'insomnia-data';
import type { PromiseFsClient } from 'isomorphic-git';
import YAML from 'yaml';

import { database as db } from '../../common/database';
import { resetKeys } from '../ignore-keys';
import { GIT_INSOMNIA_DIR_NAME } from './git-vcs';
import parseGitPath from './parse-git-path';
import Stat from './stat';
import { SystemError } from './system-error';

/**
 * A fs client to access workspace data stored in NeDB as files.
 * Used by isomorphic-git
 * https://isomorphic-git.org/docs/en/fs#implementing-your-own-fs
 */
export class NeDBClient {
  _workspaceId: string;
  _projectId: string;

  constructor(workspaceId: string, projectId: string) {
    if (!workspaceId) {
      throw new Error('Cannot use NeDBClient without workspace ID');
    }

    this._workspaceId = workspaceId;
    this._projectId = projectId;
  }

  static createClient(workspaceId: string, projectId: string): PromiseFsClient {
    return {
      promises: new NeDBClient(workspaceId, projectId),
    };
  }

  /**
   * Reads a file from the NeDB database as if it were a regular file
   * Converts database records to YAML format for Git operations
   *
   * @param filePath - The file path to read (e.g., '.insomnia/Request/req-123.yml')
   * @param options - Encoding options for the returned data
   * @returns The file contents as a Buffer or string
   * @throws SystemError if file is not found or is private
   */
  async readFile(filePath: string, options?: BufferEncoding | { encoding?: BufferEncoding }) {
    filePath = path.normalize(filePath);
    options = options || {};

    if (typeof options === 'string') {
      options = {
        encoding: options,
      };
    }

    // Parse the file path to extract model type and document ID
    const { root, type, id } = parseGitPath(filePath);

    if (root === null || id === null || type === null) {
      throw this._errMissing(filePath);
    }

    // Find the document in the database
    const doc = await db.findOne(type, { _id: id });

    if (!doc || doc.isPrivate) {
      throw this._errMissing(filePath);
    }

    // When git is reading from NeDb, reset keys we wish to ignore to their original values
    resetKeys(doc);

    // It would be nice to be able to add this check here but we can't since
    // isomorphic-git may have just deleted the workspace from the FS. This
    // happens frequently during branch checkouts and merges
    //
    // if (doc.type !== models.workspace.type) {
    //   const ancestors = await db.withAncestors(doc);
    //   if (!ancestors.find(isWorkspace)) {
    //     throw new Error(`Not found under workspace ${filePath}`);
    //   }
    // }

    // Convert the document to YAML format
    const raw = Buffer.from(YAML.stringify(doc), 'utf8');

    if (options.encoding) {
      return raw.toString(options.encoding);
    }
    return raw;
  }

  /**
   * Writes file data to the NeDB database as if it were a regular file
   * Converts YAML data back to database records during Git operations
   *
   * @param filePath - The file path to write to
   * @param data - The file contents as Buffer or string
   */
  async writeFile(filePath: string, data: Buffer | string) {
    filePath = path.normalize(filePath);
    const { root, id, type } = parseGitPath(filePath);

    // Only process files within the .insomnia directory
    if (root !== GIT_INSOMNIA_DIR_NAME) {
      console.log(`[git] Ignoring external file ${filePath}`);
      return;
    }

    const dataStr = data.toString();

    // Skip the file if there is a conflict marker (Git merge conflict)
    if (dataStr.split('\n').includes('=======')) {
      return;
    }

    // Parse the YAML data back to a database document
    const doc: BaseModel = YAML.parse(dataStr);

    // Validate that the document ID matches the file path
    if (id !== doc._id) {
      throw new Error(`Doc _id does not match file path [${doc._id} != ${id || 'null'}]`);
    }

    // Validate that the document type matches the file path
    if (type !== doc.type) {
      throw new Error(`Doc type does not match file path [${doc.type} != ${type || 'null'}]`);
    }

    // Special handling for workspaces: ensure they stay in the correct project
    if (models.workspace.isWorkspace(doc)) {
      console.log('[git] setting workspace parent to be that of the active project', {
        original: doc.parentId,
        new: this._projectId,
      });
      // Whenever we write a workspace into nedb we should set the parentId to be that of the current project
      // This is because the parentId (or a project) is not synced into git, so it will be cleared whenever git writes the workspace into the db, thereby removing it from the project on the client
      // In order to reproduce this bug, comment out the following line, then clone a repository into a local project, then open the workspace, you'll notice it will have moved into the default project
      doc.parentId = this._projectId;
    }

    // Update the document in the database
    await db.update(doc);
  }

  async unlink(filePath: string) {
    filePath = path.normalize(filePath);
    const { id, type } = parseGitPath(filePath);

    if (!id || !type) {
      throw new Error(`Cannot unlink file ${filePath}`);
    }

    const doc = await db.findOne(type, { _id: id });

    if (!doc) {
      return;
    }

    await db.unsafeRemove(doc);
  }

  // recurses over each .insomnia subfolder, ApiSpec, Workspace, Request etc..
  // and returns a list of all the files/folders which should be in the directory
  // according to the what entities are children of the workspace
  async readdir(filePath: string) {
    filePath = path.normalize(filePath);
    const { root, type, id } = parseGitPath(filePath);
    let docs: BaseModel[] = [];
    let otherFolders: string[] = [];

    if (root === null && id === null && type === null) {
      otherFolders = [GIT_INSOMNIA_DIR_NAME];
    } else if (id === null && type === null) {
      // TODO: It doesn't scale if we add another model which can be sync in the future
      otherFolders = [
        models.workspace.type,
        models.environment.type,
        models.requestGroup.type,
        models.request.type,
        models.apiSpec.type,
        models.unitTestSuite.type,
        models.unitTest.type,
        models.grpcRequest.type,
        models.protoFile.type,
        models.protoDirectory.type,
        models.webSocketRequest.type,
        models.webSocketPayload.type,
        models.mockRoute.type,
        models.mockServer.type,
        models.socketIOPayload.type,
        models.socketIORequest.type,
      ];
    } else if (type !== null && id === null) {
      const workspace = await db.findOne(models.workspace.type, { _id: this._workspaceId });
      const children = workspace ? await db.getWithDescendants(workspace, [type]) : [];
      docs = children.filter(d => d.type === type && !d.isPrivate);
    } else {
      throw this._errMissing(filePath);
    }

    const ids = docs.map(d => `${d._id}.yml`);
    return [...ids, ...otherFolders].sort();
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
      const doc: BaseModel = YAML.parse(fileBuff.toString());
      return new Stat({
        type: 'file',
        mode: 0o777,
        size: fileBuff.length,
        // @ts-expect-error should be number instead of string https://nodejs.org/api/fs.html#fs_stats_ino
        ino: doc._id,
        mtimeMs: doc.modified,
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
    // Dirs in NeDB can't be removed, so we'll just pretend like it succeeded
    return;
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
}
