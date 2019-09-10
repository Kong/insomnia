// @flow
import path from 'path';
import * as db from '../../common/database';
import * as models from '../../models';
import stringifyJSON from 'json-stable-stringify';
import Stat from './stat';

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

    const { type, id } = this._parsePath(filePath);

    if (id === null || type === null) {
      throw new Error(`Cannot read from directory or missing ${filePath}`);
    }

    const doc = await db.get(type, id);

    if (!doc || (doc: any).isPrivate) {
      throw new Error(`Cannot find doc ${filePath}`);
    }

    if (doc.type !== models.workspace.type) {
      const ancestors = await db.withAncestors(doc);
      if (!ancestors.find(d => d.type === models.workspace.type)) {
        throw new Error(`Not found under workspace ${filePath}`);
      }
    }

    const raw = Buffer.from(stringifyJSON(doc, { space: '  ' }), 'utf8');

    if (options.encoding) {
      return raw.toString(options.encoding);
    } else {
      return raw;
    }
  }

  async writeFile(filePath: string, data: Buffer | string, ...x: Array<any>): Promise<void> {
    filePath = path.normalize(filePath);
    const { id, type } = this._parsePath(filePath);
    const doc = JSON.parse(data.toString());

    if (id !== doc._id) {
      throw new Error(`Doc _id does not match file path ${doc._id} != ${id || 'null'}`);
    }

    if (type !== doc.type) {
      throw new Error(`Doc type does not match file path ${doc.type} != ${type || 'null'}`);
    }

    await db.upsert(doc, true);
  }

  async unlink(filePath: string, ...x: Array<any>): Promise<void> {
    filePath = path.normalize(filePath);
    const { id, type } = this._parsePath(filePath);

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

    const MODELS = [
      models.workspace.type,
      models.environment.type,
      models.requestGroup.type,
      models.request.type,
      models.apiSpec.type,
    ];

    const { type, id } = this._parsePath(filePath);

    let docs = [];
    let otherFolders = [];
    if (id === null && type === null) {
      otherFolders = MODELS;
    } else if (type !== null && id === null) {
      const workspace = await db.get(models.workspace.type, this._workspaceId);
      const children = await db.withDescendants(workspace);
      docs = children.filter(d => d.type === type && !(d: any).isPrivate);
    } else {
      throw new Error(`file path is not a directory ${filePath}`);
    }

    const ids = docs.map(d => `${d._id}.json`);
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
    } catch (err) {}

    if (fileBuff === null) {
      try {
        dir = await this.readdir(filePath);
      } catch (err) {
        // Nothing
      }
    }

    if (!fileBuff && !dir) {
      throw new Error(`Not found ${filePath}`);
    }

    if (fileBuff) {
      const doc = JSON.parse(fileBuff.toString());
      return new Stat({
        type: 'file',
        mode: 0o777,
        size: fileBuff.length,
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

  async readlink(filePath: string, ...x: Array<any>) {
    return this.readFile(filePath, ...x);
  }

  async lstat(filePath: string, ...x: Array<any>) {
    return this.stat(filePath, ...x);
  }

  async rmdir(filePath: string, ...x: Array<any>) {
    throw new Error('NeDBPlugin rmdir not supported');
  }

  async symlink(targetPath: string, filePath: string, ...x: Array<any>) {
    throw new Error('NeDBPlugin symlink not supported');
  }

  _parsePath(filePath: string): { type: string | null, id: string | null } {
    filePath = path.normalize(filePath);

    const [type, idRaw] = filePath.split(/\//g).filter(s => s !== '');

    const id = typeof idRaw === 'string' ? idRaw.replace(/\.json$/, '') : idRaw;

    return {
      type: type || null,
      id: id || null,
    };
  }
}
