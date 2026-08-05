import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { BaseModel, ProtoDirectory, ProtoFile, Workspace } from 'insomnia-data';
import { models } from 'insomnia-data';

import { database as db } from '../../common/database';

const { isProtoDirectory } = models.protoDirectory;
const { isProtoFile } = models.protoFile;

interface WriteResult {
  filePath: string;
  dirs: string[];
}

const sanitizeName = (name: string): string => {
  const base = path.basename(name);
  return !base || base === '..' || base === '.' ? '_' : base;
};

const assertWithinTempRoot = (tempRoot: string, candidatePath: string): void => {
  const relative = path.relative(tempRoot, candidatePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Proto path escapes temporary directory: "${candidatePath}"`);
  }
};

const recursiveWriteProtoDirectory = async (
  dir: ProtoDirectory,
  descendants: BaseModel[],
  currentDirPath: string,
  tempRoot: string,
): Promise<string[]> => {
  const dirPath = path.join(currentDirPath, sanitizeName(dir.name));
  assertWithinTempRoot(tempRoot, dirPath);
  fs.mkdirSync(dirPath, { recursive: true });
  // Get and write proto files
  const files = descendants.filter(isProtoFile).filter(f => f.parentId === dir._id);
  await Promise.all(
    files.map(protoFile => {
      const fullPath = path.join(dirPath, sanitizeName(protoFile.name));
      assertWithinTempRoot(tempRoot, fullPath);
      if (fs.existsSync(fullPath)) {
        return;
      }
      return fs.promises.writeFile(fullPath, protoFile.protoText);
    }),
  );
  // Get and write subdirectories
  const createdDirs = await Promise.all(
    descendants
      .filter(f => isProtoDirectory(f) && f.parentId === dir._id)
      .map(f => recursiveWriteProtoDirectory(f, descendants, dirPath, tempRoot)),
  );
  return [dirPath, ...createdDirs.flat()];
};

export const writeProtoFile = async (protoFile: ProtoFile): Promise<WriteResult> => {
  // Find all ancestors
  const ancestors = await db.withAncestors<ProtoFile | ProtoDirectory | Workspace>(protoFile, [
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
      c => isProtoDirectory(c) && c.parentId === ancestors.find(models.workspace.isWorkspace)._id,
    );
    if (!ancestors.find(models.workspace.isWorkspace) || !rootAncestorProtoDirectory) {
      // should never happen
      return {
        filePath: path.join(
          ...ancestorDirectories
            .map(f => path.basename(f.name))
            .reverse()
            .slice(1),
          path.basename(protoFile.name),
        ),
        dirs: [],
      };
    }
    // Find all descendants of the root ancestor directory
    const descendants = await db.getWithDescendants(rootAncestorProtoDirectory);
    const tempRoot = path.join(
      os.tmpdir(),
      'insomnia-grpc',
      `${rootAncestorProtoDirectory._id}.${rootAncestorProtoDirectory.modified}`,
    );
    const treeRootDirs = await recursiveWriteProtoDirectory(
      rootAncestorProtoDirectory,
      descendants,
      tempRoot,
      tempRoot,
    );
    return {
      filePath: path.join(
        ...ancestorDirectories
          .map(f => path.basename(f.name))
          .reverse()
          .slice(1),
        path.basename(protoFile.name),
      ),
      dirs: treeRootDirs,
    };
  }
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
};
