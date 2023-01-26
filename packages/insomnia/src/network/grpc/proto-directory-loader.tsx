import fs from 'fs';
import path from 'path';

import * as models from '../../models';
import type { ProtoDirectory } from '../../models/proto-directory';

interface IngestResult {
  createdDir?: ProtoDirectory | null;
  createdIds: string[];
  error?: Error | null;
}

export class ProtoDirectoryLoader {
  createdIds: string[] = [];
  rootDirPath: string;
  workspaceId: string;

  constructor(rootDirPath: string, workspaceId: string) {
    this.rootDirPath = rootDirPath;
    this.workspaceId = workspaceId;
  }

  async _parseDir(entryPath: string, parentId: string) {
    const result = await this._ingest(entryPath, parentId);
    return Boolean(result);
  }

  async _parseFile(entryPath: string, parentId: string) {
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
    const entries = await fs.promises.readdir(dirPath, {
      withFileTypes: true,
    });
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

  async load() {
    try {
      const createdDir = await this._ingest(this.rootDirPath, this.workspaceId);
      return {
        createdDir,
        createdIds: this.createdIds,
        error: null,
      } as IngestResult;
    } catch (error) {
      return {
        createdDir: null,
        createdIds: this.createdIds,
        error,
      } as IngestResult;
    }
  }
}
