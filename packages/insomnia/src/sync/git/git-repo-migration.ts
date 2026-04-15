/**
 * Git Repository Structure Migration
 *
 * Migrates existing on-disk git repositories from the old layout to the new
 * layout that lets users run native Git CLI commands directly against the repo.
 *
 * Old layout:
 *   {baseDir}/git/          ← git internals (isomorphic-git used 'git' as gitdir)
 *   {baseDir}/other/        ← non-YAML files
 *   (Insomnia YAML was virtual / DB-only)
 *
 * New layout:
 *   {baseDir}/.git/         ← standard git internals
 *   {baseDir}/<file>        ← non-YAML files at root
 *   {baseDir}/insomnia.{id}.yaml  ← Insomnia YAML on disk AND in DB
 *
 * The migration is:
 *  1. Idempotent – guarded by an ElectronStorage flag per repository.
 *  2. Best-effort – errors are logged but never fatal; the app still loads.
 *  3. Run once at repository load time (before VCS initialisation).
 */

import fs from 'node:fs';
import path from 'node:path';

import { models, services, type Workspace, type WorkspaceMeta } from '~/insomnia-data';

import { database as db } from '../../common/database';
import { getInsomniaV5DataExport } from '../../common/insomnia-v5';
import { initElectronStorage } from '../../main/window-utils';

const MIGRATION_KEY_PREFIX = 'GIT_STRUCTURE_V2_';

function getMigrationKey(gitRepositoryId: string): string {
  return `${MIGRATION_KEY_PREFIX}${gitRepositoryId}`;
}

function hasMigrated(gitRepositoryId: string): boolean {
  const storage = initElectronStorage();
  return Boolean(storage.getItem<number>(getMigrationKey(gitRepositoryId)));
}

function markMigrated(gitRepositoryId: string): void {
  const storage = initElectronStorage();
  storage.setItem(getMigrationKey(gitRepositoryId), 1);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Recursively move everything inside `srcDir` into `destDir`, then remove
 * `srcDir`. Files that already exist at the destination are overwritten.
 */
async function moveDirectoryContents(srcDir: string, destDir: string): Promise<void> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(srcDir, { withFileTypes: true });
  } catch {
    return; // srcDir doesn't exist or isn't readable
  }

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      await fs.promises.mkdir(destPath, { recursive: true });
      await moveDirectoryContents(srcPath, destPath);
      try {
        await fs.promises.rmdir(srcPath);
      } catch {
        // Ignore if dir not empty (shouldn't happen after recursive move)
      }
    } else {
      await fs.promises.rename(srcPath, destPath).catch(async () => {
        // Cross-device rename falls back to copy + delete
        await fs.promises.copyFile(srcPath, destPath);
        await fs.promises.unlink(srcPath);
      });
    }
  }

  try {
    await fs.promises.rmdir(srcDir);
  } catch {
    // Not empty or already gone — ignore
  }
}

/**
 * Check whether a directory exists.
 */
async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Exported migration entry point
// ---------------------------------------------------------------------------

/**
 * Migrate the on-disk structure of a git repository to the new layout.
 * Safe to call on every app load — it is a no-op if already done.
 *
 * @param baseDir          Absolute path to the repository root
 *                         (e.g. `{userData}/version-control/git/{gitRepositoryId}`)
 * @param projectId        The project that owns this repository
 * @param gitRepositoryId  Used for the idempotency guard key
 */
export async function migrateRepoStructureIfNeeded(
  baseDir: string,
  projectId: string,
  gitRepositoryId: string,
): Promise<void> {
  if (hasMigrated(gitRepositoryId)) {
    return;
  }

  console.log(`[git-migration] Starting structure migration for repo ${gitRepositoryId}`);

  try {
    // Step 1: Rename git/ → .git/
    const oldGitDir = path.join(baseDir, 'git');
    const newGitDir = path.join(baseDir, '.git');

    if ((await dirExists(oldGitDir)) && !(await dirExists(newGitDir))) {
      console.log('[git-migration] Renaming git/ → .git/');
      await fs.promises.rename(oldGitDir, newGitDir).catch(async () => {
        // Fallback for cross-device issues (unlikely since same volume, but safe)
        await fs.promises.mkdir(newGitDir, { recursive: true });
        await moveDirectoryContents(oldGitDir, newGitDir);
      });
    }

    // Step 2: Collapse other/ → repo root
    const otherDir = path.join(baseDir, 'other');
    if (await dirExists(otherDir)) {
      console.log('[git-migration] Moving other/ contents to repo root');
      await moveDirectoryContents(otherDir, baseDir);
    }

    // Step 3: Flush all Insomnia YAML workspaces to disk so they become real files.
    // This is a best-effort bootstrap; the routable FS client will keep disk in sync
    // for all subsequent Git operations.
    await _flushWorkspacesToDisk(baseDir, projectId);

    markMigrated(gitRepositoryId);
    console.log(`[git-migration] Migration complete for repo ${gitRepositoryId}`);
  } catch (err) {
    console.error('[git-migration] Migration failed (non-fatal):', err);
  }
}

/**
 * Write any workspace in `projectId` that doesn't yet have an on-disk YAML
 * file to `baseDir`. This bootstraps the dual-sync state for existing repos.
 */
async function _flushWorkspacesToDisk(baseDir: string, projectId: string): Promise<void> {
  const workspaces = await db.find<Workspace>(models.workspace.type, { parentId: projectId });

  for (const workspace of workspaces) {
    const workspaceMeta = await db.findOne<WorkspaceMeta>(models.workspaceMeta.type, {
      parentId: workspace._id,
    });

    // Determine the target file name
    const gitFilePath: string = workspaceMeta?.gitFilePath || `insomnia.${workspace._id}.yaml`;

    const absPath = path.join(baseDir, gitFilePath);

    // Don't overwrite an existing file — trust disk as the primary store
    try {
      await fs.promises.access(absPath);
      continue; // file already exists
    } catch {
      // file does not exist — write it
    }

    try {
      const yamlContent = await getInsomniaV5DataExport({
        workspaceId: workspace._id,
        includePrivateEnvironments: false,
      });

      await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
      await fs.promises.writeFile(absPath, yamlContent, 'utf8');
      console.log('[git-migration] Flushed workspace to disk:', absPath);

      // Ensure workspaceMeta records the correct gitFilePath
      if (workspaceMeta && !workspaceMeta.gitFilePath) {
        await services.workspaceMeta.update(workspaceMeta, { gitFilePath });
      } else if (!workspaceMeta) {
        const meta = await services.workspaceMeta.getOrCreateByParentId(workspace._id);
        await services.workspaceMeta.update(meta, { gitFilePath });
      }
    } catch (err) {
      console.warn('[git-migration] Could not flush workspace', workspace._id, err);
    }
  }
}
