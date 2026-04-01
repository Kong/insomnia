import { createHash } from 'node:crypto';
import { type FSWatcher, watch } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { InsomniaFileTypeValues } from '~/common/import-v5-parser';
import { getInsomniaV5DataExport, tryImportV5Data } from '~/common/insomnia-v5';
import type { DataStoreOptions, IDatabase, Query } from '~/insomnia-data';
import * as models from '~/models';
import { isDirectoryProject, type Project } from '~/models/project';
import type { AllTypes, BaseModel } from '~/models/types';
import { isWorkspace, type Workspace } from '~/models/workspace';
import type { WorkspaceMeta } from '~/models/workspace-meta';

const WATCH_DEBOUNCE_MS = 150;

type FileProjectConflictType = 'id-conflict' | null;

interface SyncedFileState {
  conflictType: FileProjectConflictType;
  mtimeMs: number;
  originalWorkspaceId: string | null;
  workspaceId: string;
}

interface DirectoryProjectState {
  directoryPath: string;
  fileStates: Map<string, SyncedFileState>;
  initialized: boolean;
  pendingFullScan: boolean;
  pendingPaths: Set<string>;
  scheduledSync?: NodeJS.Timeout;
  syncPromise?: Promise<void>;
  watcher?: FSWatcher;
}

const isCandidateInsomniaFile = (filePath: string, content: string) => {
  if (!filePath.endsWith('.yaml')) {
    return false;
  }

  const firstLine = content.split('\n')[0]?.trim() || '';
  return InsomniaFileTypeValues.some(fileType => firstLine.includes(fileType));
};

const createScopedId = (prefix: string, key: string) => {
  const hash = createHash('sha256').update(key).digest('hex').slice(0, 32);
  return `${prefix}_${hash}`;
};

const collectProjectYamlFiles = async (directoryPath: string): Promise<Map<string, number>> => {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files = new Map<string, number>();

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      const nestedFiles = await collectProjectYamlFiles(entryPath);
      nestedFiles.forEach((mtimeMs, filePath) => files.set(filePath, mtimeMs));
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.yaml')) {
      continue;
    }

    const stat = await fs.stat(entryPath);
    files.set(entryPath, stat.mtimeMs);
  }

  return files;
};

export const createDirectoryProjectDatabase = (
  nedbDatabase: IDatabase<DataStoreOptions>,
): IDatabase<DataStoreOptions> => {
  let syncDepth = 0;
  const projectStates = new Map<string, DirectoryProjectState>();

  const runDuringSync = async <T>(callback: () => Promise<T>) => {
    syncDepth += 1;
    try {
      return await callback();
    } finally {
      syncDepth -= 1;
    }
  };

  const resolveDirectoryProject = async (projectId?: string | null) => {
    if (!projectId) {
      return null;
    }

    const project = await nedbDatabase.findOne<Project>(models.project.type, { _id: projectId });
    return project && isDirectoryProject(project) ? project : null;
  };

  const resolveWorkspaceForDoc = async (doc: BaseModel) => {
    if (isWorkspace(doc)) {
      return doc;
    }

    if (doc.type === models.workspaceMeta.type) {
      return nedbDatabase.findOne<Workspace>(models.workspace.type, { _id: doc.parentId });
    }

    const ancestors = await nedbDatabase.withAncestors<BaseModel>(doc, [models.workspace.type]);
    return ancestors.find(isWorkspace) || null;
  };

  const getProjectWorkspaceState = async (projectId: string) => {
    const workspaces = await nedbDatabase.find<Workspace>(models.workspace.type, { parentId: projectId });
    const workspaceMetas = await nedbDatabase.find<WorkspaceMeta>(models.workspaceMeta.type, {
      parentId: {
        $in: workspaces.map(workspace => workspace._id),
      },
    });

    return {
      workspaceById: new Map(workspaces.map(workspace => [workspace._id, workspace])),
      workspaceMetaById: new Map(workspaceMetas.map(workspaceMeta => [workspaceMeta.parentId || '', workspaceMeta])),
      workspaceMetaByPath: new Map(
        workspaceMetas
          .filter(workspaceMeta => typeof workspaceMeta.gitFilePath === 'string')
          .map(workspaceMeta => [workspaceMeta.gitFilePath!, workspaceMeta]),
      ),
    };
  };

  const getWorkspaceFilePath = async (project: Project, workspace: Workspace) => {
    const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
    return workspaceMeta.gitFilePath || path.join(project.directoryPath!, `insomnia.${workspace._id}.yaml`);
  };

  const disposeProjectState = (projectId: string) => {
    const state = projectStates.get(projectId);
    if (!state) {
      return;
    }

    if (state.scheduledSync) {
      clearTimeout(state.scheduledSync);
    }

    state.watcher?.close();
    projectStates.delete(projectId);
  };

  const scheduleProjectSync = (projectId: string) => {
    const state = projectStates.get(projectId);
    if (!state || state.scheduledSync) {
      return;
    }

    state.scheduledSync = setTimeout(() => {
      state.scheduledSync = undefined;
      void syncProjectFromDisk(projectId);
    }, WATCH_DEBOUNCE_MS);
  };

  const ensureProjectState = (project: Project) => {
    const existingState = projectStates.get(project._id);

    if (existingState && existingState.directoryPath === project.directoryPath) {
      return existingState;
    }

    if (existingState) {
      disposeProjectState(project._id);
    }

    const nextState: DirectoryProjectState = {
      directoryPath: project.directoryPath!,
      fileStates: new Map<string, SyncedFileState>(),
      initialized: false,
      pendingFullScan: true,
      pendingPaths: new Set<string>(),
    };

    projectStates.set(project._id, nextState);
    return nextState;
  };

  const ensureProjectWatcher = (project: Project, state: DirectoryProjectState) => {
    if (state.watcher) {
      return;
    }

    state.watcher = watch(project.directoryPath!, { recursive: true }, (_eventType, fileName) => {
      if (typeof fileName === 'string' && fileName) {
        state.pendingPaths.add(path.join(project.directoryPath!, fileName));
      } else {
        state.pendingFullScan = true;
      }

      scheduleProjectSync(project._id);
    });

    state.watcher.on('error', () => {
      state.pendingFullScan = true;
      scheduleProjectSync(project._id);
    });
  };

  const removeWorkspaceFile = async (workspace: Workspace) => {
    if (syncDepth > 0) {
      return;
    }

    const project = await resolveDirectoryProject(workspace.parentId);
    if (!project) {
      return;
    }

    await runDuringSync(async () => {
      const filePath = await getWorkspaceFilePath(project, workspace);
      await fs.rm(filePath, { force: true });

      const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
      if (
        workspaceMeta.gitFilePath ||
        workspaceMeta.fileProjectConflictType ||
        workspaceMeta.fileProjectOriginalWorkspaceId
      ) {
        await models.workspaceMeta.update(workspaceMeta, {
          fileProjectConflictType: null,
          fileProjectOriginalWorkspaceId: null,
          gitFilePath: null,
        });
      }
    });
  };

  const persistWorkspaceToDirectory = async (workspaceId: string) => {
    if (syncDepth > 0) {
      return;
    }

    const workspace = await nedbDatabase.findOne<Workspace>(models.workspace.type, { _id: workspaceId });
    if (!workspace) {
      return;
    }

    const project = await resolveDirectoryProject(workspace.parentId);
    if (!project) {
      return;
    }

    const state = ensureProjectState(project);
    ensureProjectWatcher(project, state);

    await runDuringSync(async () => {
      const filePath = await getWorkspaceFilePath(project, workspace);
      const content = await getInsomniaV5DataExport({
        workspaceId: workspace._id,
        includePrivateEnvironments: true,
      });

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf8');

      const stat = await fs.stat(filePath);
      const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
      if (workspaceMeta.gitFilePath !== filePath) {
        await models.workspaceMeta.update(workspaceMeta, { gitFilePath: filePath });
      }

      state.fileStates.set(filePath, {
        conflictType: workspaceMeta.fileProjectConflictType,
        mtimeMs: stat.mtimeMs,
        originalWorkspaceId: workspaceMeta.fileProjectOriginalWorkspaceId,
        workspaceId: workspace._id,
      });
    });
  };

  const normalizeImportedDocs = (docs: BaseModel[], filePath: string) => {
    const idMapping = new Map<string, string>();

    for (const doc of docs) {
      const model = models.mustGetModel(doc.type);
      const key = isWorkspace(doc) ? `workspace:${filePath}` : `${filePath}:${doc._id}`;
      idMapping.set(doc._id, createScopedId(model.prefix, key));
    }

    return docs.map(doc => {
      const rewritten = models.rewriteReferences(doc, idMapping);
      return {
        ...rewritten,
        _id: idMapping.get(doc._id)!,
        parentId: doc.parentId ? idMapping.get(doc.parentId) || doc.parentId : doc.parentId,
      } as BaseModel;
    });
  };

  const hasWorkspaceIdConflict = async (filePath: string, workspaceId: string) => {
    const existingWorkspace = await nedbDatabase.findOne<Workspace>(models.workspace.type, { _id: workspaceId });
    if (!existingWorkspace) {
      return false;
    }

    const workspaceMeta = await models.workspaceMeta.getByParentId(existingWorkspace._id);
    return workspaceMeta?.gitFilePath !== filePath;
  };

  const removeFileWorkspace = async (
    projectId: string,
    state: DirectoryProjectState,
    filePath: string,
    workspaceState?: Awaited<ReturnType<typeof getProjectWorkspaceState>>,
  ) => {
    const currentWorkspaceState = workspaceState || (await getProjectWorkspaceState(projectId));
    const workspaceMeta = currentWorkspaceState.workspaceMetaByPath.get(filePath);
    const workspace = workspaceMeta ? currentWorkspaceState.workspaceById.get(workspaceMeta.parentId || '') : null;

    if (workspace) {
      await nedbDatabase.remove(workspace);
    }

    state.fileStates.delete(filePath);
  };

  const syncWorkspaceFromFile = async (
    project: Project,
    state: DirectoryProjectState,
    filePath: string,
    fileContents: string,
    mtimeMs: number,
    workspaceState: Awaited<ReturnType<typeof getProjectWorkspaceState>>,
  ) => {
    if (!isCandidateInsomniaFile(filePath, fileContents)) {
      await removeFileWorkspace(project._id, state, filePath, workspaceState);
      return;
    }

    const { data, error } = tryImportV5Data(fileContents);
    if (error) {
      console.warn(
        `[db] Failed to import local directory project file ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    const rawWorkspace = data.find(isWorkspace);
    if (!rawWorkspace) {
      return;
    }

    const previousFileState = state.fileStates.get(filePath);
    const shouldNormalizeIds =
      previousFileState?.conflictType === 'id-conflict' || (await hasWorkspaceIdConflict(filePath, rawWorkspace._id));
    const normalizedDocs = shouldNormalizeIds ? normalizeImportedDocs(data, filePath) : data;
    const workspaceDoc = normalizedDocs.find(isWorkspace);

    if (!workspaceDoc) {
      return;
    }

    const existingWorkspaceMeta = workspaceState.workspaceMetaByPath.get(filePath);
    const existingWorkspaceForPath = existingWorkspaceMeta
      ? workspaceState.workspaceById.get(existingWorkspaceMeta.parentId || '')
      : null;

    if (existingWorkspaceForPath && existingWorkspaceForPath._id !== workspaceDoc._id) {
      await nedbDatabase.remove(existingWorkspaceForPath);
    }

    const existingWorkspace = await nedbDatabase.findOne<Workspace>(models.workspace.type, { _id: workspaceDoc._id });
    if (existingWorkspace?.parentId === project._id) {
      const originalDocs = await nedbDatabase.getWithDescendants(existingWorkspace);
      const deletedDocs = originalDocs.filter(
        originalDoc =>
          !normalizedDocs.some(importedDoc => importedDoc._id === originalDoc._id) && models.canSync(originalDoc),
      );

      for (const deletedDoc of deletedDocs) {
        await nedbDatabase.unsafeRemove(deletedDoc);
      }
    }

    for (const doc of normalizedDocs) {
      if (isWorkspace(doc)) {
        doc.parentId = project._id;
      }

      await nedbDatabase.update(doc);
    }

    await models.environment.getOrCreateForParentId(workspaceDoc._id);
    await models.cookieJar.getOrCreateForParentId(workspaceDoc._id);
    const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspaceDoc._id);
    await models.workspaceMeta.update(workspaceMeta, {
      fileProjectConflictType: shouldNormalizeIds ? 'id-conflict' : null,
      fileProjectOriginalWorkspaceId: shouldNormalizeIds ? rawWorkspace._id : null,
      gitFilePath: filePath,
    });

    state.fileStates.set(filePath, {
      conflictType: shouldNormalizeIds ? 'id-conflict' : null,
      mtimeMs,
      originalWorkspaceId: shouldNormalizeIds ? rawWorkspace._id : null,
      workspaceId: workspaceDoc._id,
    });
  };

  const syncProjectFromDiskInternal = async (projectId: string) => {
    const project = await resolveDirectoryProject(projectId);
    if (!project) {
      disposeProjectState(projectId);
      return;
    }

    await fs.mkdir(project.directoryPath, { recursive: true });

    const state = ensureProjectState(project);
    ensureProjectWatcher(project, state);

    const currentPendingPaths = new Set(state.pendingPaths);
    state.pendingPaths.clear();
    const shouldRunFullScan = state.pendingFullScan || !state.initialized;
    state.pendingFullScan = false;

    const trackedWorkspaceState = await getProjectWorkspaceState(project._id);
    const bufferId = await nedbDatabase.bufferChangesIndefinitely();

    await runDuringSync(async () => {
      if (shouldRunFullScan) {
        const filesOnDisk = await collectProjectYamlFiles(project.directoryPath);
        const trackedPaths = new Set<string>([
          ...state.fileStates.keys(),
          ...trackedWorkspaceState.workspaceMetaByPath.keys(),
        ]);

        for (const trackedPath of trackedPaths) {
          if (!filesOnDisk.has(trackedPath)) {
            await removeFileWorkspace(project._id, state, trackedPath, trackedWorkspaceState);
          }
        }

        for (const [filePath, mtimeMs] of filesOnDisk.entries()) {
          const knownFileState = state.fileStates.get(filePath);
          if (knownFileState && knownFileState.mtimeMs === mtimeMs) {
            continue;
          }

          const fileContents = await fs.readFile(filePath, 'utf8');
          await syncWorkspaceFromFile(project, state, filePath, fileContents, mtimeMs, trackedWorkspaceState);
        }

        state.initialized = true;
        return;
      }

      for (const pendingPath of currentPendingPaths) {
        try {
          const stat = await fs.stat(pendingPath);
          if (!stat.isFile()) {
            await removeFileWorkspace(project._id, state, pendingPath, trackedWorkspaceState);
            continue;
          }

          const knownFileState = state.fileStates.get(pendingPath);
          if (knownFileState && knownFileState.mtimeMs === stat.mtimeMs) {
            continue;
          }

          const fileContents = await fs.readFile(pendingPath, 'utf8');
          await syncWorkspaceFromFile(project, state, pendingPath, fileContents, stat.mtimeMs, trackedWorkspaceState);
        } catch {
          await removeFileWorkspace(project._id, state, pendingPath, trackedWorkspaceState);
        }
      }
    });

    await nedbDatabase.flushChanges(bufferId);
  };

  const syncProjectFromDisk = async (projectId: string) => {
    if (syncDepth > 0) {
      return;
    }

    const project = await resolveDirectoryProject(projectId);
    if (!project) {
      disposeProjectState(projectId);
      return;
    }

    const state = ensureProjectState(project);
    ensureProjectWatcher(project, state);

    if (state.syncPromise) {
      await state.syncPromise;
      return;
    }

    state.syncPromise = syncProjectFromDiskInternal(projectId).finally(() => {
      const latestState = projectStates.get(projectId);
      if (latestState) {
        latestState.syncPromise = undefined;
        if (latestState.pendingFullScan || latestState.pendingPaths.size > 0) {
          scheduleProjectSync(projectId);
        }
      }
    });

    await state.syncPromise;
  };

  const syncBeforeWorkspaceRead = async <T extends BaseModel>(type: string, query?: Query<T> | string) => {
    if (syncDepth > 0 || !query || typeof query === 'string') {
      return;
    }

    const queryObject = query as Record<string, any>;
    const parentId = queryObject.parentId;

    if (typeof parentId === 'string') {
      await syncProjectFromDisk(parentId);
      return;
    }

    if (Array.isArray(parentId?.$in)) {
      for (const projectId of parentId.$in) {
        if (typeof projectId === 'string') {
          await syncProjectFromDisk(projectId);
        }
      }
      return;
    }

    if (typeof queryObject._id === 'string') {
      if (type === models.project.type) {
        await syncProjectFromDisk(queryObject._id);
        return;
      }

      if (type === models.workspace.type) {
        const workspace = await nedbDatabase.findOne<Workspace>(models.workspace.type, { _id: queryObject._id });
        if (workspace) {
          await syncProjectFromDisk(workspace.parentId);
        }
      }
    }
  };

  const syncBeforeDescendantRead = async (doc: BaseModel) => {
    if (syncDepth > 0) {
      return;
    }

    if (doc.type === models.project.type && isDirectoryProject(doc as Project)) {
      await syncProjectFromDisk(doc._id);
      return;
    }

    const workspace = await resolveWorkspaceForDoc(doc);
    if (workspace) {
      await syncProjectFromDisk(workspace.parentId);
    }
  };

  const syncWorkspaceForDoc = async (doc: BaseModel) => {
    if (syncDepth > 0 || doc.type === models.project.type) {
      return;
    }

    const workspace = await resolveWorkspaceForDoc(doc);
    if (workspace) {
      await persistWorkspaceToDirectory(workspace._id);
    }
  };

  return {
    ...nedbDatabase,
    init: async (config = {}, forceReset = false) => {
      if (forceReset) {
        for (const projectId of projectStates.keys()) {
          disposeProjectState(projectId);
        }
      }

      await nedbDatabase.init(config, forceReset);
    },
    find: async <T extends BaseModel>(
      type: AllTypes,
      query: Query<T> | string = {},
      sort?: Record<string, any>,
      limit?: number,
    ) => {
      if (type === models.workspace.type) {
        await syncBeforeWorkspaceRead(type, query);
      }

      return nedbDatabase.find<T>(type, query, sort, limit);
    },
    findOne: async <T extends BaseModel>(type: AllTypes, query: Query<T> | string = {}, sort?: Record<string, any>) => {
      if (type === models.workspace.type || type === models.project.type) {
        await syncBeforeWorkspaceRead(type, query);
      }

      return nedbDatabase.findOne<T>(type, query, sort);
    },
    insert: async doc => {
      const insertedDoc = await nedbDatabase.insert(doc);
      await syncWorkspaceForDoc(insertedDoc);
      return insertedDoc;
    },
    update: async (doc, patches = []) => {
      const updatedDoc = await nedbDatabase.update(doc, patches);
      await syncWorkspaceForDoc(updatedDoc);
      return updatedDoc;
    },
    remove: async doc => {
      if (isWorkspace(doc)) {
        const project = await resolveDirectoryProject(doc.parentId);
        const filePath = project ? await getWorkspaceFilePath(project, doc) : null;
        await removeWorkspaceFile(doc);
        if (project && filePath) {
          const state = projectStates.get(project._id);
          state?.fileStates.delete(filePath);
        }
      }

      await nedbDatabase.remove(doc);
    },
    removeWhere: async <T extends BaseModel>(type: AllTypes, query: Query<T>) => {
      const docs = await nedbDatabase.find<T>(type, query);
      const removedWorkspaces: Workspace[] = [];
      const workspaceIdsToPersist = new Set<string>();

      for (const doc of docs) {
        if (isWorkspace(doc)) {
          removedWorkspaces.push(doc);
        }

        const workspace = await resolveWorkspaceForDoc(doc);
        if (workspace) {
          workspaceIdsToPersist.add(workspace._id);
        }
      }

      for (const workspace of removedWorkspaces) {
        workspaceIdsToPersist.delete(workspace._id);
        const project = await resolveDirectoryProject(workspace.parentId);
        const filePath = project ? await getWorkspaceFilePath(project, workspace) : null;
        await removeWorkspaceFile(workspace);
        if (project && filePath) {
          projectStates.get(project._id)?.fileStates.delete(filePath);
        }
      }

      await nedbDatabase.removeWhere(type, query);

      for (const workspaceId of workspaceIdsToPersist) {
        await persistWorkspaceToDirectory(workspaceId);
      }
    },
    unsafeRemove: async doc => {
      if (isWorkspace(doc)) {
        const project = await resolveDirectoryProject(doc.parentId);
        const filePath = project ? await getWorkspaceFilePath(project, doc) : null;
        await removeWorkspaceFile(doc);
        if (project && filePath) {
          projectStates.get(project._id)?.fileStates.delete(filePath);
        }
      }

      const workspace = !isWorkspace(doc) ? await resolveWorkspaceForDoc(doc) : null;
      await nedbDatabase.unsafeRemove(doc);

      if (workspace) {
        await persistWorkspaceToDirectory(workspace._id);
      }
    },
    duplicate: async (originalDoc, patch = {}) => {
      const duplicatedDoc = await nedbDatabase.duplicate(originalDoc, patch);
      await syncWorkspaceForDoc(duplicatedDoc);
      return duplicatedDoc;
    },
    getWithDescendants: async (doc, types = []) => {
      await syncBeforeDescendantRead(doc);
      return nedbDatabase.getWithDescendants(doc, types);
    },
  };
};
