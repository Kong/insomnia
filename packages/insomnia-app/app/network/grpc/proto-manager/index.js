// @flow

import type { ProtoFile } from '../../../models/proto-file';
import { showAlert, showError } from '../../../ui/components/modals';
import * as models from '../../../models';
import React from 'react';
import type { ProtoDirectory } from '../../../models/proto-directory';
import * as db from '../../../common/database';
import selectFileOrFolder from '../../../common/select-file-or-folder';
import ingestProtoDirectory from './ingest-proto-directory';
import fs from 'fs';
import path from 'path';
import * as protoLoader from '../proto-loader';

export async function deleteFile(protoFile: ProtoFile, callback: string => void): Promise<void> {
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

export async function deleteDirectory(
  protoDirectory: ProtoDirectory,
  callback: (Array<string>) => void,
): Promise<void> {
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

export async function addDirectory(workspaceId: string): Promise<void> {
  const bufferId = await db.bufferChanges();
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

    const createdDir = await ingestProtoDirectory(filePath, workspaceId);

    // Show warning if no files found
    if (!createdDir) {
      showAlert({
        title: 'No files found',
        message: `No .proto files were found under ${filePath}.`,
      });
    }

    // TODO: validate all of the imported proto files

    await db.flushChanges(bufferId);
  } catch (e) {
    await db.flushChanges(bufferId, true);
    showError({ error: e });
  }
}

async function _readFile(): Promise<{ fileName: string, fileContents: string } | null> {
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

    // Read contents
    const contents = await fs.promises.readFile(filePath, 'utf-8');
    const name = path.basename(filePath);

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

    return { fileName: name, fileContents: contents };
  } catch (e) {
    showError({ error: e });
  }
}

export async function addFile(workspaceId: string, callback: string => void): Promise<void> {
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

export async function updateFile(protoFile: ProtoFile, callback: string => void): Promise<void> {
  const result = await _readFile();
  if (result) {
    const updatedFile = await models.protoFile.update(protoFile, {
      name: result.fileName,
      protoText: result.fileContents,
    });
    callback(updatedFile._id);
  }
}

export async function renameFile(protoFile: ProtoFile, name: string): Promise<void> {
  await models.protoFile.update(protoFile, { name });
}
