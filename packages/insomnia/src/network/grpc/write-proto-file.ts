import type { ProtoDirectory, ProtoFile, Workspace } from '~/insomnia-data';

import { database as db } from '../../common/database';
import type { BaseModel } from '../../models';
import * as models from '../../models';

const { isProtoDirectory } = models.protoDirectory;
const { isProtoFile } = models.protoFile;

interface WriteResult {
  filePath: string;
  dirs: string[];
}

const recursiveWriteProtoDirectory = async (
  dir: ProtoDirectory,
  descendants: BaseModel[],
  currentDirPath: string,
): Promise<string[]> => {
  const dirPath = window.path.join(currentDirPath, dir.name);
  await window.main.mkdir({ path: dirPath });
  const files = descendants.filter(isProtoFile).filter(f => f.parentId === dir._id);
  await Promise.all(
    files.map(async protoFile => {
      const fullPath = window.path.join(dirPath, protoFile.name);
      if (await window.main.fileExists({ path: fullPath })) {
        return;
      }
      await window.main.writeFile({ path: fullPath, content: protoFile.protoText });
    }),
  );
  const createdDirs = await Promise.all(
    descendants
      .filter(f => isProtoDirectory(f) && f.parentId === dir._id)
      .map(f => recursiveWriteProtoDirectory(f, descendants, dirPath)),
  );
  return [dirPath, ...createdDirs.flat()];
};

export const writeProtoFile = async (protoFile: ProtoFile): Promise<WriteResult> => {
  const ancestors = await db.withAncestors<ProtoFile | ProtoDirectory | Workspace>(protoFile, [
    models.protoDirectory.type,
    models.workspace.type,
  ]);
  const ancestorDirectories = ancestors.filter(isProtoDirectory);

  if (ancestorDirectories.length) {
    const rootAncestorProtoDirectory = ancestors.find(
      // @ts-expect-error -- TSCONVERSION ancestor workspace can be undefined
      c => isProtoDirectory(c) && c.parentId === ancestors.find(models.workspace.isWorkspace)._id,
    );
    if (!ancestors.find(models.workspace.isWorkspace) || !rootAncestorProtoDirectory) {
      return {
        filePath: window.path.join(
          ...ancestorDirectories
            .map(f => f.name)
            .reverse()
            .slice(1),
          protoFile.name,
        ),
        dirs: [],
      };
    }
    const descendants = await db.getWithDescendants(rootAncestorProtoDirectory);
    const treeRootDirs = await recursiveWriteProtoDirectory(
      rootAncestorProtoDirectory,
      descendants,
      window.path.join(
        window.app.getPath('temp'),
        'insomnia-grpc',
        `${rootAncestorProtoDirectory._id}.${rootAncestorProtoDirectory.modified}`,
      ),
    );
    return {
      filePath: window.path.join(
        ...ancestorDirectories
          .map(f => f.name)
          .reverse()
          .slice(1),
        protoFile.name,
      ),
      dirs: treeRootDirs,
    };
  }

  const rootDir = window.path.join(window.app.getPath('temp'), 'insomnia-grpc');
  await window.main.mkdir({ path: rootDir });

  const filePath = `${protoFile._id}.${protoFile.modified}.proto`;
  const result = { filePath, dirs: [rootDir] };

  const fullPath = window.path.join(rootDir, filePath);
  if (await window.main.fileExists({ path: fullPath })) {
    return result;
  }
  await window.main.writeFile({ path: fullPath, content: protoFile.protoText });
  return result;
};
