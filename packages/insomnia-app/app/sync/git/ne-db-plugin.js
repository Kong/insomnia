// @flow
import path from 'path';
import * as db from '../../common/database';
import * as models from '../../models';
import YAML from 'yaml';
import Stat from './stat';
import { GIT_INSOMNIA_DIR_NAME } from './git-vcs';
import parseGitPath from './parse-git-path';

export default class NeDBPlugin {
  _workspaceId: string;

  constructor(workspaceId: string) {
    if (!workspaceId) {
      throw new Error('Cannot use NeDBPlugin without workspace ID');
    }
    this._workspaceId = workspaceId;
  }

  static createPlugin(workspaceId: string) {
    return {
      promises: new NeDBPlugin(workspaceId),
    };
  }

  async readFile(
    filePath: string,
    options?: buffer$Encoding | { encoding?: buffer$Encoding },
  ): Promise<Buffer | string> {
    filePath = path.normalize(filePath);

    options = options || {};
    if (typeof options === 'string') {
      options = { encoding: options };
    }

    const { root, type, id } = parseGitPath(filePath);

    if (root === null || id === null || type === null) {
      throw this._errMissing(filePath);
    }

    const doc = await db.get(type, id);

    if (!doc || (doc: any).isPrivate) {
      throw this._errMissing(filePath);
    }

    // It would be nice to be able to add this check here but we can't since
    // isomorphic-git may have just deleted the workspace from the FS. This
    // happens frequently during branch checkouts and merges
    //
    // if (doc.type !== models.workspace.type) {
    //   const ancestors = await db.withAncestors(doc);
    //   if (!ancestors.find(d => d.type === models.workspace.type)) {
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

  async writeFile(filePath: string, data: Buffer | string, ...x: Array<any>): Promise<void> {
    filePath = path.normalize(filePath);
    const { root, id, type } = parseGitPath(filePath);

    if (root !== GIT_INSOMNIA_DIR_NAME) {
      console.log(`[git] Ignoring external file ${filePath}`);
      return;
    }

    const doc = YAML.parse(data.toString());

    if (id !== doc._id) {
      throw new Error(`Doc _id does not match file path [${doc._id} != ${id || 'null'}]`);
    }

    if (type !== doc.type) {
      throw new Error(`Doc type does not match file path [${doc.type} != ${type || 'null'}]`);
    }

    await db.upsert(doc, true);
  }

  async unlink(filePath: string, ...x: Array<any>): Promise<void> {
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

  async readdir(filePath: string, ...x: Array<any>): Promise<Array<string>> {
    filePath = path.normalize(filePath);

    const { root, type, id } = parseGitPath(filePath);

    let docs = [];
    let otherFolders = [];
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
      docs = children.filter(d => d.type === type && !(d: any).isPrivate);
    } else {
      throw this._errMissing(filePath);
    }

    const ids = docs.map(d => `${d._id}.yml`);

    return [...ids, ...otherFolders].sort();
  }

  async mkdir(filePath: string, ...x: Array<any>) {
    throw new Error('NeDBPlugin is not writable');
  }

  async stat(filePath: string, ...x: Array<any>): Promise<Stat> {
    filePath = path.normalize(filePath);

    let fileBuff: Buffer | string | null = null;
    let dir: Array<string> | null = null;
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
      const doc = YAML.parse(fileBuff.toString());
      return new Stat({
        type: 'file',
        mode: 0o777,
        size: fileBuff.length,
        ino: doc._id, // should be number instead of string https://nodejs.org/api/fs.html#fs_stats_ino I think flow should have detected this
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

  async readlink(filePath: string, ...x: Array<any>): Promise<Buffer | string> {
    return this.readFile(filePath, ...x);
  }

  async lstat(filePath: string, ...x: Array<any>): Promise<Stat> {
    return this.stat(filePath, ...x);
  }

  async rmdir(dir: string, ...x: Array<any>): Promise<void> {
    // Dirs in NeDB can't be removed, so we'll just pretend like it succeeded
    return Promise.resolve();
  }

  async symlink(targetPath: string, filePath: string, ...x: Array<any>): Promise<void> {
    throw new Error('NeDBPlugin symlink not supported');
  }

  _errMissing(filePath: string): Error {
    const e: ErrnoError = new Error(`ENOENT: no such file or directory, scandir '${filePath}'`);
    e.errno = -2;
    e.code = 'ENOENT';
    e.syscall = 'scandir';
    e.path = filePath;
    return e;
  }
}
