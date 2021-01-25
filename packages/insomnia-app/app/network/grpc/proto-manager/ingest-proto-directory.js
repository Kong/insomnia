// @flow

import * as models from '../../../models';
import type { ProtoDirectory } from '../../../models/proto-directory';
import path from 'path';
import fs from 'fs';

const _parseDir = async (entryPath: string, dirParentId: string): Promise<boolean> => {
  const result = await ingestProtoDirectory(entryPath, dirParentId);
  return Boolean(result);
};

const _parseFile = async (entryPath: string, dirParentId: string): Promise<boolean> => {
  const extension = path.extname(entryPath);

  // Ignore if not a .proto file
  if (extension !== '.proto') {
    return false;
  }

  const contents = await fs.promises.readFile(entryPath, 'utf-8');
  const name = path.basename(entryPath);

  await models.protoFile.create({
    name,
    parentId: dirParentId,
    protoText: contents,
  });

  return true;
};

const ingestProtoDirectory = async (
  dirPath: string,
  dirParentId: string,
): Promise<ProtoDirectory | null> => {
  // Check exists
  if (!fs.existsSync(dirPath)) {
    return null;
  }

  // Create dir in database

  const newDirId = models.protoDirectory.createId();

  // Read contents
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

  // Loop and read all entries
  let filesFound = false;
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullEntryPath = path.resolve(dirPath, entry.name);
    const result = await (entry.isDirectory()
      ? _parseDir(fullEntryPath, newDirId)
      : _parseFile(fullEntryPath, newDirId));

    filesFound = filesFound || result;
  }

  // Only create the directory if a .proto file is found in the tree
  if (filesFound) {
    const createdProtoDir = await models.protoDirectory.create({
      _id: newDirId,
      name: path.basename(dirPath),
      parentId: dirParentId,
    });
    return createdProtoDir;
  }

  return null;
};

export default ingestProtoDirectory;
