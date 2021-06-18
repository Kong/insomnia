import { isProtoFile, ProtoFile } from '../../../models/proto-file';
import { showAlert, showError } from '../../../ui/components/modals';
import * as models from '../../../models';
import React from 'react';
import type { ProtoDirectory } from '../../../models/proto-directory';
import { database as db } from '../../../common/database';
import { selectFileOrFolder } from '../../../common/select-file-or-folder';
import ingestProtoDirectory from './ingest-proto-directory';
import fs from 'fs';
import path from 'path';
import * as protoLoader from '../proto-loader';

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

    const result = await ingestProtoDirectory(filePath, workspaceId);
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

    for (const file of loadedFiles) {
      try {
        await protoLoader.loadMethods(file);
      } catch (e) {
        showError({
          title: 'Invalid Proto File',
          message: `The file ${file.name} could not be parsed`,
          error: e,
        });
        rollback = true;
        return;
      }
    }
  } catch (e) {
    rollback = true;
    showError({
      error: e,
    });
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
      await protoLoader.loadMethodsFromPath(filePath);
    } catch (e) {
      showError({
        title: 'Invalid Proto File',
        message: `The file ${filePath} and could not be parsed`,
        error: e,
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
  } catch (e) {
    showError({
      error: e,
    });
  }
  return undefined;
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

export async function renameFile(protoFile: ProtoFile, name: string) {
  await models.protoFile.update(protoFile, {
    name,
  });
}
