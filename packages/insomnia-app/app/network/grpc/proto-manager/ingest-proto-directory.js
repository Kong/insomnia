// @flow

import * as models from '../../../models';
import type { ProtoDirectory } from '../../../models/proto-directory';
import path from 'path';
import fs from 'fs';

type IngestResult = {
  createdDir?: ProtoDirectory | null,
  createdIds: Array<string>,
  error?: Error,
};

class ProtoDirectoryLoader {
  constructor(rootDirPath: string, workspaceId: string) {
    this.rootDirPath = rootDirPath;
    this.workspaceId = workspaceId;
    this.createdIds = [];
  }

  async _parseDir(entryPath: string, parentId: string): Promise<boolean> {
    const result = await this._ingest(entryPath, parentId);
    return Boolean(result);
  }

  async _parseFile(entryPath: string, parentId: string): Promise<boolean> {
    const extension = path.extname(entryPath);

    // Ignore if not a .proto file
    if (extension !== '.proto') {
      return false;
    }

    const contents = await fs.promises.readFile(entryPath, 'utf-8');
    const name = path.basename(entryPath);

    const { _id } = await models.protoFile.create({
      name,
      parentId,
      protoText: contents,
    });

    this.createdIds.push(_id);

    return true;
  }

  async _ingest(dirPath: string, parentId: string): Promise<ProtoDirectory | null> {
    // Check exists
    if (!fs.existsSync(dirPath)) {
      return null;
    }

    const newDirId = models.protoDirectory.createId();

    // Read contents
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    // Loop and read all entries
    let filesFound = false;
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const fullEntryPath = path.resolve(dirPath, entry.name);
      const result = await (entry.isDirectory()
        ? this._parseDir(fullEntryPath, newDirId)
        : this._parseFile(fullEntryPath, newDirId));

      filesFound = filesFound || result;
    }

    // Only create the directory if a .proto file is found in the tree
    if (filesFound) {
      const createdProtoDir = await models.protoDirectory.create({
        _id: newDirId,
        name: path.basename(dirPath),
        parentId,
      });
      this.createdIds.push(createdProtoDir._id);
      return createdProtoDir;
    }

    return null;
  }

  async load(): Promise<IngestResult> {
    try {
      const createdDir = await this._ingest(this.rootDirPath, this.workspaceId);
      return { createdDir, createdIds: this.createdIds, error: null };
    } catch (error) {
      return { createdDir: null, createdIds: this.createdIds, error };
    }
  }
}

const ingestProtoDirectory = async (dirPath: string, workspaceId: string): Promise<IngestResult> =>
  new ProtoDirectoryLoader(dirPath, workspaceId).load();

export default ingestProtoDirectory;
