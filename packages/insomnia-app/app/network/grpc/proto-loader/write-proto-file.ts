import path from 'path';
import os from 'os';
import mkdirp from 'mkdirp';
import fs from 'fs';
import { isProtoFile, ProtoFile } from '../../../models/proto-file';
import { isProtoDirectory, ProtoDirectory } from '../../../models/proto-directory';
import { database as db } from '../../../common/database';
import * as models from '../../../models';
import type { BaseModel } from '../../../models';
import { isWorkspace, Workspace } from '../../../models/workspace';

const getProtoTempFileName = ({ _id, modified }: ProtoFile): string => `${_id}.${modified}.proto`;

const getProtoTempDirectoryName = ({ _id, modified }: ProtoDirectory): string =>
  `${_id}.${modified}`;

interface WriteResult {
  filePath: string;
  dirs: string[];
}

const writeIndividualProtoFile = async (protoFile: ProtoFile): Promise<WriteResult> => {
  // Create temp folder
  const rootDir = path.join(os.tmpdir(), 'insomnia-grpc');
  mkdirp.sync(rootDir);
  const filePath = getProtoTempFileName(protoFile);
  const result = {
    filePath,
    dirs: [rootDir],
  };
  // Check if file already exists
  const fullPath = path.join(rootDir, filePath);

  if (fs.existsSync(fullPath)) {
    return result;
  }

  // Write file
  await fs.promises.writeFile(fullPath, protoFile.protoText);
  return result;
};

const writeNestedProtoFile = async (protoFile: ProtoFile, dirPath: string) => {
  // Check if file already exists
  const fullPath = path.join(dirPath, protoFile.name);

  if (fs.existsSync(fullPath)) {
    return;
  }

  // Write file
  await fs.promises.writeFile(fullPath, protoFile.protoText);
};

const writeProtoFileTree = async (
  ancestors: (ProtoDirectory | Workspace)[],
): Promise<string[]> => {
  // Find the ancestor workspace
  const ancestorWorkspace = ancestors.find(isWorkspace);

  // Find the root ancestor directory
  const rootAncestorProtoDirectory = ancestors.find(
    // @ts-expect-error -- TSCONVERSION ancestor workspace can be undefined
    c => isProtoDirectory(c) && c.parentId === ancestorWorkspace._id,
  );

  if (!ancestorWorkspace || !rootAncestorProtoDirectory) {
    // should never happen
    return [];
  }

  // Find all descendants of the root ancestor directory
  const descendants = await db.withDescendants(rootAncestorProtoDirectory);

  // Recursively write the root ancestor directory children
  const tempDirPath = path.join(
    os.tmpdir(),
    'insomnia-grpc',
    getProtoTempDirectoryName(rootAncestorProtoDirectory),
  );

  const dirs = await recursiveWriteProtoDirectory(
    rootAncestorProtoDirectory,
    descendants,
    tempDirPath,
  );

  return dirs;
};

const recursiveWriteProtoDirectory = async (
  dir: ProtoDirectory,
  descendants: BaseModel[],
  currentDirPath: string,
): Promise<string[]> => {
  // Increment folder path
  const dirPath = path.join(currentDirPath, dir.name);
  mkdirp.sync(dirPath);
  // Get and write proto files
  const files = descendants.filter(isProtoFile).filter(f => f.parentId === dir._id);
  await Promise.all(files.map(f => writeNestedProtoFile(f, dirPath)));
  // Get and write subdirectories
  const subDirs = descendants.filter(f => isProtoDirectory(f) && f.parentId === dir._id);
  const createdDirs = await Promise.all(
    subDirs.map(f => recursiveWriteProtoDirectory(f, descendants, dirPath)),
  );
  return [dirPath, ...createdDirs.flat()];
};

const writeProtoFile = async (protoFile: ProtoFile): Promise<WriteResult> => {
  // Find all ancestors
  const ancestors = await db.withAncestors(protoFile, [
    models.protoDirectory.type,
    models.workspace.type,
  ]);
  const ancestorDirectories = ancestors.filter(isProtoDirectory);

  // Is this file part of a directory?
  if (ancestorDirectories.length) {
    // Write proto file tree from root directory
    const treeRootDirs = await writeProtoFileTree(ancestors);
    // Get all ancestor directories excluding the root (ignore the first entry after reversing the array)
    const subDirs = ancestorDirectories
      .map(f => f.name)
      .reverse()
      .slice(1);
    const filePath = path.join(...subDirs, protoFile.name);
    return {
      filePath,
      dirs: treeRootDirs,
    };
  } else {
    // Write single file
    return writeIndividualProtoFile(protoFile);
  }
};

export default writeProtoFile;
