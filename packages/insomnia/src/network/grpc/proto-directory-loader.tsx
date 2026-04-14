import type { ProtoDirectory } from '~/insomnia-data';
import { models, services } from '~/insomnia-data';

const importSecureReadFileModule = async () => {
  const modulePath = '../../main/secure-read-file';
  return import(/* @vite-ignore */ modulePath);
};

const importFsModule = async () => {
  const modulePath = 'node:fs';
  return import(/* @vite-ignore */ modulePath);
};

const importPathModule = async () => {
  const modulePath = 'node:path';
  return import(/* @vite-ignore */ modulePath);
};

type DirectoryEntry = {
  type: 'file' | 'directory';
  name: string;
  path: string;
};

const basename = async (entryPath: string) => {
  if (process.type === 'renderer') {
    return window.path.basename(entryPath);
  }

  return (await importPathModule()).basename(entryPath);
};

const extensionName = async (entryPath: string) => {
  const fileName = await basename(entryPath);
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex >= 0 ? fileName.slice(lastDotIndex) : '';
};

const resolvePath = async (basePath: string, entryName: string) => {
  if (process.type === 'renderer') {
    return window.path.resolve(basePath, entryName);
  }

  return (await importPathModule()).resolve(basePath, entryName);
};

const readDirEntries = async (dirPath: string): Promise<DirectoryEntry[] | null> => {
  if (process.type === 'renderer') {
    try {
      return await window.main.readDir({ path: dirPath });
    } catch {
      return null;
    }
  }

  const fs = await importFsModule();
  if (!fs.existsSync(dirPath)) {
    return null;
  }

  const entryNames: string[] = await fs.promises.readdir(dirPath);
  const entries = await Promise.all(
    entryNames.map(async (name: string) => {
      const entryPath = await resolvePath(dirPath, name);
      const stat = await fs.promises.stat(entryPath);

      if (stat.isDirectory()) {
        return { type: 'directory' as const, name, path: entryPath };
      }

      if (stat.isFile()) {
        return { type: 'file' as const, name, path: entryPath };
      }

      return null;
    }),
  );

  return entries.filter((entry): entry is DirectoryEntry => entry !== null);
};

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
    const extension = await extensionName(entryPath);

    // Ignore if not a .proto file
    if (extension !== '.proto') {
      return false;
    }

    // allow to read the file as it is chosen by user
    const protoText =
      process.type === 'renderer'
        ? await window.main.insecureReadFile({ path: entryPath })
        : await (await importSecureReadFileModule()).insecureReadFile(entryPath);
    const name = await basename(entryPath);
    const { _id } = await services.protoFile.create({
      name,
      parentId,
      protoText,
    });
    this.createdIds.push(_id);
    return true;
  }

  async _ingest(dirPath: string, parentId: string): Promise<ProtoDirectory | null> {
    const entries = await readDirEntries(dirPath);
    if (!entries) {
      return null;
    }

    const newDirId = models.protoDirectory.createId();
    let filesFound = false;

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const result = await (entry.type === 'directory'
        ? this._parseDir(entry.path, newDirId)
        : this._parseFile(entry.path, newDirId));
      filesFound = filesFound || result;
    }

    // Only create the directory if a .proto file is found in the tree
    if (filesFound) {
      const name = await basename(dirPath);
      const createdProtoDir = await services.protoDirectory.create({
        _id: newDirId,
        name,
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
