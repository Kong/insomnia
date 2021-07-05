import path from 'path';
import { database as db } from '../../common/database';
import * as models from '../../models';
import YAML from 'yaml';
import Stat from './stat';
import { GIT_INSOMNIA_DIR_NAME } from './git-vcs';
import parseGitPath from './parse-git-path';
import { BufferEncoding } from './utils';
import { SystemError } from './system-error';
import { BaseModel } from '../../models';
import { forceWorkspaceScopeToDesign } from './force-workspace-scope-to-design';

export class NeDBClient {
  _workspaceId: string;

  constructor(workspaceId: string) {
    if (!workspaceId) {
      throw new Error('Cannot use NeDBClient without workspace ID');
    }

    this._workspaceId = workspaceId;
  }

  static createClient(workspaceId: string) {
    return {
      promises: new NeDBClient(workspaceId),
    };
  }

  async readFile(
    filePath: string,
    options?: BufferEncoding | { encoding?: BufferEncoding },
  ) {
    filePath = path.normalize(filePath);
    options = options || {};

    if (typeof options === 'string') {
      options = {
        encoding: options,
      };
    }

    const { root, type, id } = parseGitPath(filePath);

    if (root === null || id === null || type === null) {
      throw this._errMissing(filePath);
    }

    const doc = await db.get(type, id);

    if (!doc || doc.isPrivate) {
      throw this._errMissing(filePath);
    }

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
    const raw = Buffer.from(YAML.stringify(doc), 'utf8');

    if (options.encoding) {
      return raw.toString(options.encoding);
    } else {
      return raw;
    }
  }

  async writeFile(filePath: string, data: Buffer | string) {
    filePath = path.normalize(filePath);
    const { root, id, type } = parseGitPath(filePath);

    if (root !== GIT_INSOMNIA_DIR_NAME) {
      console.log(`[git] Ignoring external file ${filePath}`);
      return;
    }

    const doc: BaseModel = YAML.parse(data.toString());

    if (id !== doc._id) {
      throw new Error(`Doc _id does not match file path [${doc._id} != ${id || 'null'}]`);
    }

    if (type !== doc.type) {
      throw new Error(`Doc type does not match file path [${doc.type} != ${type || 'null'}]`);
    }

    forceWorkspaceScopeToDesign(doc);

    await db.upsert(doc, true);
  }

  async unlink(filePath: string) {
    filePath = path.normalize(filePath);
    const { id, type } = parseGitPath(filePath);

    if (!id || !type) {
      throw new Error(`Cannot unlink file ${filePath}`);
    }

    const doc = await db.get(type, id);

    if (!doc) {
      return;
    }

    await db.unsafeRemove(doc, true);
  }

  async readdir(filePath: string) {
    filePath = path.normalize(filePath);
    const { root, type, id } = parseGitPath(filePath);
    let docs: BaseModel[] = [];
    let otherFolders: string[] = [];

    if (root === null && id === null && type === null) {
      otherFolders = [GIT_INSOMNIA_DIR_NAME];
    } else if (id === null && type === null) {
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
      ];
    } else if (type !== null && id === null) {
      const workspace = await db.get(models.workspace.type, this._workspaceId);
      const children = await db.withDescendants(workspace);
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
      const doc: BaseModel = YAML.parse(fileBuff.toString());
      return new Stat({
        type: 'file',
        mode: 0o777,
        size: fileBuff.length,
        // @ts-expect-error should be number instead of string https://nodejs.org/api/fs.html#fs_stats_ino
        ino: doc._id,
        mtimeMs: doc.modified,
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
    // Dirs in NeDB can't be removed, so we'll just pretend like it succeeded
    return Promise.resolve();
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
