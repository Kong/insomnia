import { load } from '@grpc/proto-loader';
import fs from 'fs';
import path from 'path';
import React from 'react';

import { database as db } from '../../common/database';
import { selectFileOrFolder } from '../../common/select-file-or-folder';
import * as models from '../../models';
import type { ProtoDirectory } from '../../models/proto-directory';
import { isProtoFile, ProtoFile } from '../../models/proto-file';
import { showAlert, showError } from '../../ui/components/modals';
import { writeProtoFile } from './write-proto-file';

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

export async function deleteFile(protoFile: ProtoFile, callback: (arg0: string) => void) {
  showAlert({
    title: `Delete ${protoFile.name}`,
    message: (
      <span>
        Really delete <strong>{protoFile.name}</strong>? All requests that use this proto file will
        stop working.
      </span>
    ),
    addCancel: true,
    onConfirm: async () => {
      await models.protoFile.remove(protoFile);
      callback(protoFile._id);
    },
  });
}

export async function deleteDirectory(protoDirectory: ProtoDirectory, callback: (arg0: string[]) => void) {
  showAlert({
    title: `Delete ${protoDirectory.name}`,
    message: (
      <span>
        Really delete <strong>{protoDirectory.name}</strong> and all proto files contained within?
        All requests that use these proto files will stop working.
      </span>
    ),
    addCancel: true,
    onConfirm: async () => {
      const descendant = await db.withDescendants(protoDirectory);
      await models.protoDirectory.remove(protoDirectory);
      callback(descendant.map(c => c._id));
    },
  });
}

export async function addDirectory(workspaceId: string) {
  let rollback = false;
  let createdIds: string[];
  const bufferId = await db.bufferChangesIndefinitely();

  try {
    // Select file
    const { filePath, canceled } = await selectFileOrFolder({
      itemTypes: ['directory'],
      extensions: ['proto'],
    });

    // Exit if no file selected
    if (canceled || !filePath) {
      return;
    }

    const result = await new ProtoDirectoryLoader(filePath, workspaceId).load();
    createdIds = result.createdIds;
    const { error, createdDir } = result;

    if (error) {
      showError({
        title: 'Failed to import',
        message: `An unexpected error occurred when reading ${filePath}`,
        error,
      });
      rollback = true;
      return;
    }

    // Show warning if no files found
    if (!createdDir) {
      showAlert({
        title: 'No files found',
        message: `No .proto files were found under ${filePath}.`,
      });
      return;
    }

    // Try parse all loaded proto files to make sure they are valid
    const loadedEntities = await db.withDescendants(createdDir);
    const loadedFiles = loadedEntities.filter(isProtoFile);

    for (const protoFile of loadedFiles) {
      try {
        const { filePath, dirs } = await writeProtoFile(protoFile);
        load(filePath, {
          keepCase: true,
          longs: String,
          enums: String,
          defaults: true,
          oneofs: true,
          includeDirs: dirs });
      } catch (error) {
        showError({
          title: 'Invalid Proto File',
          message: `The file ${protoFile.name} could not be parsed`,
          error,
        });
        rollback = true;
        return;
      }
    }
  } catch (error) {
    rollback = true;
    showError({ error });
  } finally {
    // Fake flushing changes (or, rollback) only prevents change notifications being sent to the UI
    // It does NOT revert changes written to the database, as is typical of a db transaction rollback
    // As such, if rolling back, the created directory needs to be deleted manually
    await db.flushChanges(bufferId, rollback);

    if (rollback) {
      // @ts-expect-error -- TSCONVERSION
      await models.protoDirectory.batchRemoveIds(createdIds);
      // @ts-expect-error -- TSCONVERSION
      await models.protoFile.batchRemoveIds(createdIds);
    }
  }
}
async function _readFile() {
  try {
    // Select file
    const { filePath, canceled } = await selectFileOrFolder({
      itemTypes: ['file'],
      extensions: ['proto'],
    });

    // Exit if no file selected
    if (canceled || !filePath) {
      return;
    }

    // Try parse proto file to make sure the file is valid
    try {
      load(filePath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      });
    } catch (error) {
      showError({
        title: 'Invalid Proto File',
        message: `The file ${filePath} and could not be parsed`,
        error,
      });
      return;
    }

    // Read contents
    const contents = await fs.promises.readFile(filePath, 'utf-8');
    const name = path.basename(filePath);
    return {
      fileName: name,
      fileContents: contents,
    };
  } catch (error) {
    showError({ error });
  }
  return;
}

export async function addFile(workspaceId: string, callback: (arg0: string) => void) {
  const result = await _readFile();

  if (result) {
    const newFile = await models.protoFile.create({
      name: result.fileName,
      parentId: workspaceId,
      protoText: result.fileContents,
    });
    callback(newFile._id);
  }
}

export async function updateFile(protoFile: ProtoFile, callback: (arg0: string) => void) {
  const result = await _readFile();

  if (result) {
    const updatedFile = await models.protoFile.update(protoFile, {
      name: result.fileName,
      protoText: result.fileContents,
    });
    callback(updatedFile._id);
  }
}

export async function renameFile(protoFile: ProtoFile, name?: string) {
  await models.protoFile.update(protoFile, {
    name,
  });
}
