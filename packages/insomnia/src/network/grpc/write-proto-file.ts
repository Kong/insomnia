import fs from 'fs';
import os from 'os';
import path from 'path';

import { database as db } from '../../common/database';
import type { BaseModel } from '../../models';
import * as models from '../../models';
import { isProtoDirectory, ProtoDirectory } from '../../models/proto-directory';
import { isProtoFile, ProtoFile } from '../../models/proto-file';
import { isWorkspace } from '../../models/workspace';

interface WriteResult {
  filePath: string;
  dirs: string[];
}

const recursiveWriteProtoDirectory = async (
  dir: ProtoDirectory,
  descendants: BaseModel[],
  currentDirPath: string,
): Promise<string[]> => {
  // Increment folder path
  const dirPath = path.join(currentDirPath, dir.name);
  fs.mkdirSync(dirPath, { recursive: true });
  // Get and write proto files
  const files = descendants.filter(isProtoFile).filter(f => f.parentId === dir._id);
  await Promise.all(files.map(protoFile => {
    const fullPath = path.join(dirPath, protoFile.name);
    if (fs.existsSync(fullPath)) {
      return;
    }
    fs.promises.writeFile(fullPath, protoFile.protoText);
  }));
  // Get and write subdirectories
  const createdDirs = await Promise.all(
    descendants.filter(f => isProtoDirectory(f) && f.parentId === dir._id).map(f => recursiveWriteProtoDirectory(f, descendants, dirPath)),
  );
  return [dirPath, ...createdDirs.flat()];
};

export const writeProtoFile = async (protoFile: ProtoFile): Promise<WriteResult> => {
  // Find all ancestors
  const ancestors = await db.withAncestors(protoFile, [
    models.protoDirectory.type,
    models.workspace.type,
  ]);
  const ancestorDirectories = ancestors.filter(isProtoDirectory);

  // Is this file part of a directory?
  if (ancestorDirectories.length) {
    // Write proto file tree from root directory
    // Find the root ancestor directory
    const rootAncestorProtoDirectory = ancestors.find(
      // @ts-expect-error -- TSCONVERSION ancestor workspace can be undefined
      c => isProtoDirectory(c) && c.parentId === ancestors.find(isWorkspace)._id,
    );
    if (!ancestors.find(isWorkspace) || !rootAncestorProtoDirectory) {
      // should never happen
      return {
        filePath: path.join(...ancestorDirectories
          .map(f => f.name)
          .reverse()
          .slice(1), protoFile.name),
        dirs: [],
      };
    }
    // Find all descendants of the root ancestor directory
    const descendants = await db.withDescendants(rootAncestorProtoDirectory);
    const treeRootDirs = await recursiveWriteProtoDirectory(
      rootAncestorProtoDirectory,
      descendants,
      path.join(
        os.tmpdir(),
        'insomnia-grpc',
        `${rootAncestorProtoDirectory._id}.${rootAncestorProtoDirectory.modified}`,
      ),
    );
    return {
      filePath: path.join(...ancestorDirectories
        .map(f => f.name)
        .reverse()
        .slice(1), protoFile.name),
      dirs: treeRootDirs,
    };
  } else {
    // Write single file
    // Create temp folder
    const rootDir = path.join(os.tmpdir(), 'insomnia-grpc');
    fs.mkdirSync(rootDir, { recursive: true });

    const filePath = `${protoFile._id}.${protoFile.modified}.proto`;
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
  }
};
