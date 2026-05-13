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
 *  1. Idempotent – version-stamped via `GitRepository.repoMigrationVersion` in
 *     the DB. When an older app version runs `docUpdate` on the same record it
 *     prunes unknown fields, so the stamp is cleared and the migration re-runs
 *     on the next upgrade (correct behavior after a version rollback).
 *  2. Best-effort – errors are logged but never fatal; the app still loads.
 *  3. Run once at repository load time (before VCS initialization).
 */

import fs from 'node:fs';
import path from 'node:path';

export type MigrationLogger = (level: 'info' | 'warn' | 'error', message: string) => void;

import type { GitRepository, Workspace, WorkspaceMeta } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';

import { getInsomniaV5DataExport } from '../../common/insomnia-v5';
import { CURRENT_MIGRATION_VERSION } from './git-migration-version';

export { CURRENT_MIGRATION_VERSION };

// In-memory guard against concurrent migrations for the same repo within a
// single process. The DB version stamp handles cross-process / cross-session
// idempotency.
const inProgressMigrations = new Set<string>();

// ---------------------------------------------------------------------------
// Idempotency helpers  (DB-backed, version-stamped)
// ---------------------------------------------------------------------------

/**
 * Returns true if the migration has already run at the current version AND
 * the on-disk layout looks correct. The disk check takes precedence so that a
 * downgrade that recreates the old directories is always caught.
 *
 * Accepts a pre-fetched `gitRepo` so the caller avoids an extra DB round-trip.
 */
async function hasMigrated(baseDir: string, gitRepo: GitRepository | null | undefined): Promise<boolean> {
  // Disk override: old layout directories mean migration is definitely needed.
  // Both checks run in parallel — they're independent stat calls.
  const [hasOldGit, hasOldOther] = await Promise.all([
    dirExists(path.resolve(baseDir, 'git')),
    dirExists(path.resolve(baseDir, 'other')),
  ]);
  if (hasOldGit || hasOldOther) return false;

  return (gitRepo?.repoMigrationVersion ?? 0) >= CURRENT_MIGRATION_VERSION;
}

async function markMigrated(gitRepo: GitRepository): Promise<void> {
  await db.docUpdate<GitRepository>(gitRepo, {
    repoMigrationVersion: CURRENT_MIGRATION_VERSION,
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Recursively move everything inside `srcDir` into `destDir`, then remove
 * `srcDir`. Files that already exist at the destination are overwritten.
 * All entries at each level are processed in parallel.
 */
async function moveDirectoryContents(srcDir: string, destDir: string, logger?: MigrationLogger): Promise<void> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(srcDir, { withFileTypes: true });
  } catch {
    return; // srcDir doesn't exist or isn't readable
  }

  await Promise.all(
    entries.map(async entry => {
      const resolvedSrcDir = path.resolve(srcDir);
      const resolvedDestDir = path.resolve(destDir);
      const srcPath = path.resolve(resolvedSrcDir, entry.name);
      const destPath = path.resolve(resolvedDestDir, entry.name);

      // Guard against crafted entry names containing traversal sequences.
      const relSrc = path.relative(resolvedSrcDir, srcPath);
      const relDest = path.relative(resolvedDestDir, destPath);
      if (relSrc.startsWith('..') || path.isAbsolute(relSrc) || relDest.startsWith('..') || path.isAbsolute(relDest)) {
        logger?.('warn', `Skipping entry with unsafe name: ${entry.name}`);
        return;
      }

      if (entry.isDirectory()) {
        await fs.promises.mkdir(destPath, { recursive: true });
        await moveDirectoryContents(srcPath, destPath, logger);
        try {
          await fs.promises.rm(srcPath, { recursive: true });
        } catch {
          // Ignore if already gone
        }
      } else if (entry.isSymbolicLink()) {
        // Preserve symlinks — copyFile would dereference them, losing the link.
        const linkTarget = await fs.promises.readlink(srcPath);
        try {
          await fs.promises.symlink(linkTarget, destPath);
        } catch (err: unknown) {
          // Only ignore EEXIST — any other failure (e.g. permissions) is real.
          if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
        }
        await fs.promises.unlink(srcPath);
      } else {
        const destExists = await fs.promises
          .access(destPath)
          .then(() => true)
          .catch(() => false);
        if (destExists) {
          console.warn('[git-migration] Overwriting existing file during move:', destPath);
          logger?.('warn', `Overwriting existing file during move: ${destPath}`);
        }
        await fs.promises.rename(srcPath, destPath).catch(async () => {
          // Cross-device rename falls back to copy + delete
          await fs.promises.copyFile(srcPath, destPath);
          await fs.promises.unlink(srcPath);
        });
      }
    }),
  );

  try {
    await fs.promises.rm(srcDir, { recursive: true });
  } catch {
    // Ignore if already gone
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

/**
 * Remove `core.worktree` from `.git/config` if present.
 *
 * isomorphic-git does not write `core.worktree`, but a user or an external
 * tool might have added it. After migration the worktree is the default
 * (parent of `.git/`), so any stale entry must be stripped to prevent native
 * git commands from resolving to the wrong path.
 */
async function sanitizeGitConfig(gitDir: string, logger?: MigrationLogger): Promise<void> {
  const configPath = path.resolve(gitDir, 'config');
  try {
    const original = await fs.promises.readFile(configPath, 'utf8');
    const sanitized = original
      .split('\n')
      .filter(line => !/^\s*worktree\s*=/.test(line))
      .join('\n');
    if (sanitized !== original) {
      await fs.promises.writeFile(configPath, sanitized, 'utf8');
      console.log('[git-migration] Removed stale core.worktree from .git/config');
      logger?.('info', 'Removed stale core.worktree from .git/config');
    }
  } catch {
    // Config may not exist yet or is unreadable — not fatal
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
  logger?: MigrationLogger,
): Promise<boolean> {
  // Reject non-absolute paths — a relative baseDir could be used to escape the
  // intended data directory via traversal sequences.
  if (!path.isAbsolute(baseDir)) {
    logger?.('error', `Refusing migration for non-absolute baseDir: ${baseDir}`);
    return false;
  }

  // Fast synchronous guard first — avoids the async DB lookup for concurrent calls.
  if (inProgressMigrations.has(gitRepositoryId)) {
    return true;
  }

  // Fetch the repo record once and reuse it for both the migration check and
  // the version stamp update — avoids two round-trips to NeDB.
  const gitRepo = await db.findOne<GitRepository>(models.gitRepository.type, {
    _id: gitRepositoryId,
  });

  if (await hasMigrated(baseDir, gitRepo)) {
    return true;
  }

  inProgressMigrations.add(gitRepositoryId);

  console.log(`[git-migration] Starting structure migration for repo ${gitRepositoryId}`);
  logger?.('info', 'Starting structure migration');

  let success = false;
  try {
    // Step 1: Rename git/ → .git/
    // If the process was interrupted mid-copy on a previous run, both dirs may
    // exist. In that case we resume the copy rather than skipping.
    const oldGitDir = path.join(baseDir, 'git');
    const newGitDir = path.join(baseDir, '.git');

    if (await dirExists(oldGitDir)) {
      console.log('[git-migration] Renaming git/ → .git/');
      logger?.('info', 'Renaming git/ → .git/');
      // .git already exists — resume copying any remaining files from git/
      await (!(await dirExists(newGitDir))
        ? fs.promises.rename(oldGitDir, newGitDir).catch(async () => {
            // Fallback for cross-device issues (unlikely since same volume, but safe)
            await fs.promises.mkdir(newGitDir, { recursive: true });
            await moveDirectoryContents(oldGitDir, newGitDir, logger);
          })
        : moveDirectoryContents(oldGitDir, newGitDir, logger));

      // Strip stale core.worktree entries — the new layout uses the default.
      await sanitizeGitConfig(newGitDir, logger);
    }

    // Step 2: Collapse other/ → repo root
    const otherDir = path.join(baseDir, 'other');
    if (await dirExists(otherDir)) {
      console.log('[git-migration] Moving other/ contents to repo root');
      logger?.('info', 'Moving other/ contents to repo root');
      await moveDirectoryContents(otherDir, baseDir, logger);
    }

    // Step 3: Flush all Insomnia YAML workspaces to disk so they become real files.
    // This is a best-effort bootstrap; the routable FS client will keep disk in sync
    // for all subsequent Git operations.
    await flushWorkspacesToDisk(baseDir, projectId, logger);

    if (gitRepo) {
      await markMigrated(gitRepo);
    }
    console.log(`[git-migration] Migration complete for repo ${gitRepositoryId}`);
    logger?.('info', 'Migration complete');
    success = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error && err.stack ? `\n${err.stack}` : '';
    console.error('[git-migration] Migration failed (non-fatal):', err);
    logger?.('error', `Migration failed: ${message}${stack}`);
  } finally {
    inProgressMigrations.delete(gitRepositoryId);
  }
  return success;
}

/**
 * Write any workspace in `projectId` that doesn't yet have an on-disk YAML
 * file to `baseDir`. This bootstraps the dual-sync state for existing repos.
 * All workspaces are processed in parallel.
 */
async function flushWorkspacesToDisk(baseDir: string, projectId: string, logger?: MigrationLogger): Promise<void> {
  const workspaces = await db.find<Workspace>(models.workspace.type, { parentId: projectId });

  // Batch-fetch all workspace metadata to avoid N+1 queries.
  const workspaceIds = workspaces.map(w => w._id);
  const allWorkspaceMeta = await db.find<WorkspaceMeta>(models.workspaceMeta.type, {
    parentId: { $in: workspaceIds },
  });
  const metaByWorkspaceId = Object.fromEntries(allWorkspaceMeta.map(m => [m.parentId, m]));

  await Promise.all(
    workspaces.map(async workspace => {
      const workspaceMeta = metaByWorkspaceId[workspace._id] as WorkspaceMeta | undefined;

      // Determine the target file name
      const gitFilePath: string = workspaceMeta?.gitFilePath || `insomnia.${workspace._id}.yaml`;

      // Guard against absolute paths or traversal sequences in stored gitFilePath.
      const absPath = path.resolve(baseDir, gitFilePath);
      if (!absPath.startsWith(baseDir + path.sep)) {
        console.warn('[git-migration] Skipping unsafe gitFilePath:', gitFilePath);
        logger?.('warn', `Skipping unsafe gitFilePath: ${gitFilePath}`);
        return;
      }

      // Don't overwrite an existing file — trust disk as the primary store.
      // Use an atomic write (tmp → rename) so a mid-write crash never leaves a
      // truncated file that blocks future retries.
      const fileAlreadyExists = await fs.promises
        .access(absPath)
        .then(() => true)
        .catch(() => false);

      if (!fileAlreadyExists) {
        try {
          const yamlContent = await getInsomniaV5DataExport({
            workspaceId: workspace._id,
            includePrivateEnvironments: false,
          });

          if (!yamlContent?.trim()) {
            console.warn('[git-migration] Empty export for workspace', workspace._id, '— skipping');
            logger?.('warn', `Empty export for workspace ${workspace._id} — skipping`);
            return;
          }

          const tmpPath = `${absPath}.migration.tmp`;
          await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
          await fs.promises.writeFile(tmpPath, yamlContent, 'utf8');
          await fs.promises.rename(tmpPath, absPath).catch(async err => {
            await fs.promises.unlink(tmpPath).catch(() => {});
            throw err;
          });
          console.log('[git-migration] Flushed workspace to disk:', absPath);
          logger?.('info', `Flushed workspace to disk: ${absPath}`);
        } catch (err) {
          const flushMsg = err instanceof Error ? err.message : String(err);
          console.warn('[git-migration] Could not flush workspace', workspace._id, err);
          logger?.('warn', `Could not flush workspace ${workspace._id}: ${flushMsg}`);
          return; // Skip DB reconciliation if the file was not written
        }
      }

      // Always reconcile the DB — runs whether we just wrote the file or it already
      // existed. This ensures gitFilePath is persisted even if a previous run wrote
      // the file but crashed before updating the DB.
      try {
        if (workspaceMeta && !workspaceMeta.gitFilePath) {
          await db.docUpdate<WorkspaceMeta>(workspaceMeta, { gitFilePath });
        } else if (!workspaceMeta) {
          let meta = await db.findOne<WorkspaceMeta>(models.workspaceMeta.type, {
            parentId: workspace._id,
          });
          if (!meta) {
            meta = await db.docCreate<WorkspaceMeta>(models.workspaceMeta.type, {
              parentId: workspace._id,
            });
          }
          await db.docUpdate<WorkspaceMeta>(meta, { gitFilePath });
        }
      } catch (err) {
        const metaMsg = err instanceof Error ? err.message : String(err);
        console.warn('[git-migration] Could not update workspace metadata for', workspace._id, err);
        logger?.('warn', `Could not update workspace metadata for ${workspace._id}: ${metaMsg}`);
      }
    }),
  );
}
