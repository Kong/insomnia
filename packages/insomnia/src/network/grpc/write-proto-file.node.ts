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

// `_id` and `modified` come from synced docs and are interpolated into on-disk names, so they must
// be a single safe path segment (no separators, no `..`).
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const SAFE_MODIFIED_PATTERN = /^[0-9]+$/;
const toVersionedSegment = (doc: Pick<BaseModel, '_id' | 'modified'>): string => {
  if (!SAFE_ID_PATTERN.test(String(doc._id)) || !SAFE_MODIFIED_PATTERN.test(String(doc.modified))) {
    throw new Error(`Unsafe proto document id or modified timestamp: "${doc._id}.${doc.modified}"`);
  }
  return `${doc._id}.${doc.modified}`;
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
      toVersionedSegment(rootAncestorProtoDirectory),
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

  const filePath = `${toVersionedSegment(protoFile)}.proto`;
  const result = {
    filePath,
    dirs: [rootDir],
  };
  // Check if file already exists
  const fullPath = path.join(rootDir, filePath);
  assertWithinTempRoot(rootDir, fullPath);
  if (fs.existsSync(fullPath)) {
    return result;
  }
  // Write file
  await fs.promises.writeFile(fullPath, protoFile.protoText);
  return result;
};
