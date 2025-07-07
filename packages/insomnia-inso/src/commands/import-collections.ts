import fs from 'node:fs';
import path from 'node:path';

import { database } from 'insomnia/src/common/database';
import { importResourcesToProject, scanResources } from 'insomnia/src/common/import';
import { getInsomniaV5DataExport } from 'insomnia/src/common/insomnia-v5';
import { insomniaFetch } from 'insomnia/src/common/insomniaFetch';
import extractPostmanDataDumpHandler from 'insomnia/src/main/ipc/extractPostmanDataDump';
import * as models from 'insomnia/src/models/index';
import { isRemoteProject } from 'insomnia/src/models/project';
import type { Workspace } from 'insomnia/src/models/workspace';
import FileSystemDriver from 'insomnia/src/sync/store/drivers/file-system-driver';
import {
  initializeLocalBackendProjectAndMarkForSync,
  pushSnapshotOnInitialize,
} from 'insomnia/src/sync/vcs/initialize-backend-project';
import { VCS } from 'insomnia/src/sync/vcs/vcs';
import type { ImportEntry } from 'insomnia/src/utils/importers/entities';
import { invariant } from 'insomnia/src/utils/invariant';

import { logger } from '../cli';
import { localAppDir } from '../utils/app-data';

export class UserAbortResolveMergeConflictError extends Error {
  constructor(msg = 'User aborted merge') {
    super(msg);
  }
  name = 'UserAbortResolveMergeConflictError';
}

interface StorageRules {
  enableCloudSync: boolean;
  enableLocalVault: boolean;
  enableGitSync: boolean;
  isOverridden: boolean;
}

const DEFAULT_STORAGE_RULES = {
  enableCloudSync: true,
  enableLocalVault: true,
  enableGitSync: true,
  isOverridden: false,
};
/**
 * Monitor the app import process and export process.
 */

export interface ImportCollectionsOptions {
  from: string;
  toProject?: string;
  toDir?: string;
}

/**
 * Find all import files in a directory
 */
function findImportFiles(from: string): string[] {
  if (!fs.existsSync(from)) {
    throw new Error(`Import source "${from}" does not exist`);
  }

  // If the path is a file, return it directly
  if (fs.statSync(from).isFile()) {
    return [path.resolve(from)];
  }

  const files = fs.readdirSync(from);
  return files
    .filter(
      file =>
        fs.statSync(path.join(from, file)).isFile() &&
        (file.toLowerCase().endsWith('.zip') || file.toLowerCase().endsWith('.json')),
    )
    .map(file => path.join(from, file));
}

/**
 * Process a single import file and extract its contents
 */
async function processImportFile(
  importFilePath: string,
  projectId: string,
  syncNewWorkspaceIfNeeded?: (workspace: Workspace) => Promise<void>,
) {
  logger.log(`Processing: ${path.basename(importFilePath)}`);

  try {
    let allEntries: ImportEntry[] = [];
    if (path.extname(importFilePath).toLowerCase() === '.zip') {
      // Extract Postman data from the zip file
      const result = await extractPostmanDataDumpHandler(null, importFilePath);

      if (result.err || !result.data) {
        logger.error(`Error extracting Postman data dump: ${result.err}`);
        return;
      }

      // Get the collection and environment lists
      const { collectionList, envList } = result.data;
      allEntries = [...collectionList, ...envList];
    } else {
      allEntries.push({
        contentStr: fs.readFileSync(importFilePath, 'utf8'),
        oriFileName: path.basename(importFilePath),
        oriFilePath: importFilePath,
      });
    }

    if (allEntries.length === 0) {
      logger.error(`No entries extracted from ${importFilePath}`);
      return;
    }

    logger.log(`Found ${allEntries.length} entries in ${importFilePath}`);
    // Process resources
    await scanResources(allEntries);

    await importResourcesToProject({
      projectId,
      syncNewWorkspaceIfNeeded,
    });

    logger.log(`Completed processing: ${importFilePath}`);
  } catch (error) {
    logger.error(`Failed to process ${importFilePath}: ${error.message}`, error);
  }
}

async function exportWorkspaces(outputDir: string) {
  const workspaces = await models.workspace.all();
  if (workspaces.length === 0) {
    logger.error('No workspaces found. Cannot import resources.');
    return;
  }

  for await (const workspace of workspaces) {
    // It throws an error if the workspace doesn't have a base environment.
    await models.environment.create({
      parentId: workspace._id,
      name: 'Base Environment',
      data: {},
      isPrivate: false,
    });

    const stringifiedExport = await getInsomniaV5DataExport({
      workspaceId: workspace._id,
      includePrivateEnvironments: true,
    });

    const outputFilePath = path.join(outputDir, `${workspace._id}.yaml`);
    fs.writeFileSync(outputFilePath, stringifiedExport);
  }

  logger.log(`Exported workspaces to ${outputDir}, total: ${workspaces.length} workspaces exported.`);
}

const importToFolder = async (options: { importFiles: string[]; toDir: string }) => {
  const { importFiles, toDir } = options;

  // Some modules are dependent on the database being initialized, just to ensure it doesn't affect the real database.
  const fakeDBPath = path.join(process.cwd(), './tmp/insomnia-fake-db');
  process.env.INSOMNIA_DATA_PATH = fakeDBPath;

  await database.init(models.types(), {
    inMemoryOnly: true,
  });

  // Create target directory if it doesn't exist
  if (!fs.existsSync(toDir)) {
    fs.mkdirSync(toDir, { recursive: true });
  }

  const fakeProjectId = `proj_fake_${Math.random().toString(36).slice(2, 15)}`;

  // Process each import file
  for (const importFile of importFiles) {
    await processImportFile(importFile, fakeProjectId);
  }

  await exportWorkspaces(toDir);
};

async function fetchAndCacheOrganizationStorageRule(organizationId: string): Promise<StorageRules> {
  invariant(organizationId, 'Organization ID is required');

  const { id: sessionId } = await models.userSession.get();

  const res = await insomniaFetch<StorageRules>({
    method: 'GET',
    path: `/v1/organizations/${organizationId}/storage-rule`,
    sessionId,
    onlyResolveOnSuccess: true,
  });

  return res || DEFAULT_STORAGE_RULES;
}

const importToCloudSyncProject = async ({ importFiles, toProject }: { importFiles: string[]; toProject: string }) => {
  process.env['INSOMNIA_DATA_PATH'] = localAppDir;

  await database.init(models.types());

  const { id: sessionId } = await models.userSession.get();
  invariant(sessionId, 'User session not found. Please log in by the Insomnia app.');

  const project = (await models.project.getById(toProject))!;
  invariant(project, `Project with ID "${toProject}" not found`);
  invariant(isRemoteProject(project), `Project with ID "${toProject}" is not a Cloud-Sync project`);

  const driver = FileSystemDriver.create(process.env.INSOMNIA_DATA_PATH);
  const vcs = new VCS(driver, async () => {
    throw new Error(`Merge conflicts detected. Which shouldn't happen in CLI.`);
  });

  const storageRules = await fetchAndCacheOrganizationStorageRule(project.parentId);
  invariant(storageRules, 'Storage rules not found');
  invariant(storageRules.enableCloudSync, 'Cloud sync is not enabled for this organization');

  async function syncNewWorkspaceIfNeeded(newWorkspace: Workspace) {
    const workspaceId = newWorkspace._id;
    // Create default env, cookie jar, and meta
    await models.environment.getOrCreateForParentId(workspaceId);
    await models.cookieJar.getOrCreateForParentId(workspaceId);
    await models.workspaceMeta.getOrCreateByParentId(workspaceId);
    try {
      const vcsInstance = vcs.newInstance();
      await initializeLocalBackendProjectAndMarkForSync({
        vcs: vcsInstance,
        workspace: newWorkspace,
      });
      await pushSnapshotOnInitialize({
        vcs: vcsInstance,
        workspace: newWorkspace,
        project,
      });
    } catch (e) {
      logger.error(e);
    }
  }

  for (const importFile of importFiles) {
    await processImportFile(importFile, toProject, syncNewWorkspaceIfNeeded);
  }
};

/**
 * Main function to handle the import collections command
 */
export async function importCollections(options: ImportCollectionsOptions) {
  const { from, toDir, toProject } = options;

  invariant(from, '--from is required');
  invariant(!(toDir && toProject), 'please specify --toDir or --toProject');
  invariant(!(!toDir && !toProject), 'please specify only one of --toDir or --toProject');

  const importFiles = findImportFiles(from);
  invariant(importFiles.length > 0, `No import files found in "${from}"`);

  logger.info(`Found ${importFiles.length} import file(s) to process`);

  if (toDir) {
    await importToFolder({
      importFiles,
      toDir,
    });
  } else if (toProject) {
    await importToCloudSyncProject({
      importFiles,
      toProject,
    });
  }
}
