// @flow

import * as models from '../../../models';
import type { ProtoDirectory } from '../../../models/proto-directory';
import path from 'path';
import fs from 'fs';

const _parseDir = async (entryPath: string, dirParentId: string): Promise<boolean> => {
  const result = await ingestProtoDirectory(entryPath, dirParentId);
  return result.some(c => c);
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
  // Create dir in database
  const createdProtoDir = await models.protoDirectory.create({
    name: path.basename(dirPath),
    parentId: dirParentId,
  });

  // Read contents
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

  // Loop and read all entries
  const parsePromises: Array<Promise<boolean>> = entries.map(entry => {
    const fullEntryPath = path.resolve(dirPath, entry.name);
    return entry.isDirectory()
      ? _parseDir(fullEntryPath, createdProtoDir._id)
      : _parseFile(fullEntryPath, createdProtoDir._id);
  });

  const filesFound = await Promise.all(parsePromises);

  // Delete the directory if no .proto file is found in the tree
  if (!filesFound.some(c => c)) {
    await models.protoDirectory.remove(createdProtoDir);
    return null;
  }

  return createdProtoDir;
};

export default ingestProtoDirectory;
