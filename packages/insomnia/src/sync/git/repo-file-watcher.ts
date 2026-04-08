/**
 * RepoFileWatcher
 *
 * Watches an on-disk git repository directory for changes to Insomnia YAML
 * files made by external tools (native git CLI, VS Code, etc.) and imports
 * them back into the NeDB database so the Insomnia UI stays in sync.
 *
 * Strategy:
 *  - Primary:  `fs.watch` with `recursive: true` (Windows + macOS).
 *              On Linux, individual subdirectories are watched manually because
 *              Node's `fs.watch` does not support `recursive` there.
 *  - Fallback: Periodic polling (default 10 s) compares mtime against the last
 *              known sync time so no change is ever permanently missed.
 *
 * Write-loop prevention:
 *  When Insomnia itself writes a YAML file (e.g. via git pull / merge), it
 *  calls `suppressPath` before the write and `unsuppressPath` after. Events
 *  for suppressed paths are silently dropped.
 */

import fs from 'node:fs';
import path from 'node:path';

import { database as db } from '../../common/database';
import { InsomniaFileTypeValues } from '../../common/import-v5-parser';
import { getInsomniaV5DataExport, tryImportV5Data } from '../../common/insomnia-v5';
import { canSync } from '../../models';
import * as models from '../../models';
import { isWorkspace } from '../../models/workspace';
import type { WorkspaceMeta } from '../../models/workspace-meta';

const POLL_INTERVAL_MS = 10_000;
const DEBOUNCE_MS = 300;
const GIT_DIR = '.git';

class RepoFileWatcher {
  private readonly repoDir: string;
  private readonly projectId: string;

  private fsWatchers: fs.FSWatcher[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  /** mtime (ms) of the last successful import for each absolute file path */
  private lastSyncMtime = new Map<string, number>();
  /** Paths currently being written by Insomnia – watcher events are dropped for these */
  private suppressedPaths = new Set<string>();
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** True while Insomnia is writing YAML to disk – prevents the onChange flush from looping */
  private isFlushing = false;
  /** Debounce timer for the DB→disk outbound flush */
  private flushDebounce: ReturnType<typeof setTimeout> | null = null;
  /** Set to true by stop() so async callbacks can bail out cleanly */
  private stopped = false;

  constructor(repoDir: string, projectId: string) {
    this.repoDir = repoDir;
    this.projectId = projectId;

    this.startFsWatch();
    this.startPolling();
    this.registerDbChangeListener();
    // Populate initial mtimes so that future external changes (e.g. git restore)
    // can be detected by comparing disk mtime against this baseline.
    this.initSyncMtimes().catch(err => {
      console.warn('[repo-file-watcher] init mtime scan error:', err);
    });
  }

  stop(): void {
    this.stopped = true;

    for (const w of this.fsWatchers) {
      try {
        w.close();
      } catch {
        // ignore
      }
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    for (const t of this.debounceTimers.values()) {
      clearTimeout(t);
    }

    if (this.flushDebounce) {
      clearTimeout(this.flushDebounce);
    }
  }

  /**
   * Suppress watcher events for `filePath` to prevent write loops when Insomnia
   * itself is writing the file. Call `unsuppress` once the write is done.
   */
  suppress(filePath: string): void {
    this.suppressedPaths.add(path.normalize(filePath));
  }

  /** Resume watching a previously suppressed path. */
  unsuppress(filePath: string): void {
    this.suppressedPaths.delete(path.normalize(filePath));
  }

  // ---------------------------------------------------------------------------
  // Private methods
  // ---------------------------------------------------------------------------

  /**
   * Register a database onChange listener that flushes workspace YAML to disk
   * whenever synced documents change (DB → disk direction).
   *
   * This is the counterpart to the fs.watch flow (disk → DB). Without this,
   * changes made through the Insomnia UI would update the DB but leave stale
   * files on disk, so isomorphic-git would see no diff.
   */
  private registerDbChangeListener(): void {
    db.onChange(changes => {
      // Drop if watcher was stopped or if we're in the middle of a flush (loop guard)
      if (this.stopped || this.isFlushing) {
        return;
      }

      // Only react to changes for syncable documents
      const hasSyncableChange = changes.some(([, doc]) => canSync(doc));
      if (!hasSyncableChange) {
        return;
      }

      // Debounce: coalesce rapid bursts (e.g. importing a large collection) into one flush
      if (this.flushDebounce) {
        clearTimeout(this.flushDebounce);
      }
      this.flushDebounce = setTimeout(() => {
        this.flushDebounce = null;
        this.flushProjectWorkspacesToDisk().catch(err => {
          console.warn('[repo-file-watcher] DB→disk flush error:', err);
        });
      }, DEBOUNCE_MS);
    });
  }

  /**
   * Re-export every workspace in the project to its on-disk YAML file.
   * Called after DB changes so that `git status` / `git diff` reflect the
   * current database state.
   */
  private async flushProjectWorkspacesToDisk(): Promise<void> {
    // Guard: skip if the watcher was stopped or a previous flush is still running
    if (this.stopped || this.isFlushing) {
      return;
    }

    this.isFlushing = true;
    try {
      const workspaces = await db.find(models.workspace.type, { parentId: this.projectId });

      for (const workspace of workspaces) {
        const workspaceMeta = await db.findOne<WorkspaceMeta>(models.workspaceMeta.type, {
          parentId: workspace._id,
        });

        const gitFilePath: string = workspaceMeta?.gitFilePath || `insomnia.${workspace._id}.yaml`;
        const absPath = path.normalize(path.join(this.repoDir, gitFilePath));

        // Before overwriting, check whether the file was externally modified
        // (e.g. via `git restore`) since we last tracked it. If the disk mtime is
        // newer than our baseline, defer to the disk version by importing it into
        // the DB and skipping the write — this respects the user's git operation.
        const lastKnownMtime = this.lastSyncMtime.get(absPath);
        if (lastKnownMtime !== undefined) {
          try {
            const diskStat = await fs.promises.stat(absPath);
            if (diskStat.mtimeMs > lastKnownMtime) {
              await this.importFile(absPath);
              continue;
            }
          } catch {
            // File doesn't exist on disk yet — proceed to write it.
          }
        }

        // Suppress the path so the fs.watch event triggered by our own write
        // does not reimport the file we just wrote.
        this.suppressedPaths.add(absPath);
        try {
          const yamlContent = await getInsomniaV5DataExport({
            workspaceId: workspace._id,
            includePrivateEnvironments: false,
          });

          await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
          await fs.promises.writeFile(absPath, yamlContent, 'utf8');

          // Update the tracked mtime so the polling loop doesn't re-import the file
          const stat = await fs.promises.stat(absPath);
          this.lastSyncMtime.set(absPath, stat.mtimeMs);
        } catch (err) {
          console.warn('[repo-file-watcher] Could not flush workspace to disk:', workspace._id, err);
        } finally {
          // Unsuppress after a short delay to let the fs.watch event fire and be dropped
          setTimeout(() => this.suppressedPaths.delete(absPath), DEBOUNCE_MS * 2);
        }
      }
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Scan all YAML files in the repo directory and record their current mtimes as
   * the initial baseline. This lets `flushProjectWorkspacesToDisk` detect files
   * that are subsequently modified externally (e.g. via `git restore`) by
   * comparing against this snapshot.
   */
  private async initSyncMtimes(): Promise<void> {
    await this.scanMtimes(this.repoDir);
  }

  private async scanMtimes(dir: string): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === GIT_DIR) {
          continue;
        }
        await this.scanMtimes(absPath);
      } else if (entry.isFile() && entry.name.endsWith('.yaml')) {
        try {
          const stat = await fs.promises.stat(absPath);
          this.lastSyncMtime.set(path.normalize(absPath), stat.mtimeMs);
        } catch {
          // ignore
        }
      }
    }
  }

  private startFsWatch(): void {
    try {
      // On Windows and macOS, `recursive: true` covers the whole tree in one call.
      // On Linux this option is silently ignored, so we fall back to watching the
      // root directory only and rely on polling to catch deep changes.
      const watcher = fs.watch(this.repoDir, { recursive: true }, (_eventType, filename) => {
        if (!filename) {
          return;
        }
        const absPath = path.join(this.repoDir, filename);
        this.scheduleImport(absPath);
      });

      watcher.on('error', err => {
        console.warn('[repo-file-watcher] fs.watch error:', err);
      });

      this.fsWatchers.push(watcher);
    } catch (err) {
      console.warn('[repo-file-watcher] Could not start fs.watch, relying on polling only:', err);
    }
  }

  private startPolling(): void {
    this.pollTimer = setInterval(() => {
      this.pollDirectory(this.repoDir).catch(err => {
        console.warn('[repo-file-watcher] poll error:', err);
      });
    }, POLL_INTERVAL_MS);
  }

  private async pollDirectory(dir: string): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip .git internals
        if (entry.name === GIT_DIR) {
          continue;
        }
        await this.pollDirectory(absPath);
      } else if (entry.isFile() && entry.name.endsWith('.yaml')) {
        try {
          const stat = await fs.promises.stat(absPath);
          const lastMtime = this.lastSyncMtime.get(absPath) ?? 0;
          if (stat.mtimeMs > lastMtime) {
            await this.importFile(absPath);
          }
        } catch {
          // File may have been removed between readdir and stat; ignore.
        }
      }
    }
  }

  private scheduleImport(absPath: string): void {
    // Only process YAML files outside .git
    if (!absPath.endsWith('.yaml')) {
      return;
    }
    if (this.isInGitDir(absPath)) {
      return;
    }

    // Debounce: discard previous timer for this path
    const existing = this.debounceTimers.get(absPath);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(absPath);
      this.importFile(absPath).catch(err => {
        console.warn('[repo-file-watcher] import error for', absPath, err);
      });
    }, DEBOUNCE_MS);

    this.debounceTimers.set(absPath, timer);
  }

  private isInGitDir(absPath: string): boolean {
    const rel = path.relative(this.repoDir, absPath);
    return rel.startsWith(GIT_DIR + path.sep) || rel === GIT_DIR;
  }

  private async importFile(absPath: string): Promise<void> {
    const normalised = path.normalize(absPath);

    // Drop events for paths Insomnia is currently writing
    if (this.suppressedPaths.has(normalised)) {
      return;
    }

    let content: string;
    try {
      content = await fs.promises.readFile(absPath, 'utf8');
    } catch {
      // File deleted or not readable; ignore
      return;
    }

    // Skip files that don't look like Insomnia V5 YAML
    const firstLine = content.split('\n')[0].trim();
    const isInsomniaFile = InsomniaFileTypeValues.some(t => firstLine.includes(t));
    if (!isInsomniaFile) {
      return;
    }

    // Skip files that contain Git conflict markers — they are not importable yet
    const lines = content.split('\n');
    if (lines.some(l => l.startsWith('<<<<<<<') || l.startsWith('>>>>>>>'))) {
      console.warn('[repo-file-watcher] Skipping conflicted file:', absPath);
      return;
    }

    const { data: docs, error } = tryImportV5Data(content);
    if (error || !docs) {
      console.warn('[repo-file-watcher] Failed to parse', absPath, error);
      return;
    }

    const bufferId = await db.bufferChanges();
    try {
      for (const doc of docs) {
        if (isWorkspace(doc)) {
          doc.parentId = this.projectId;
          // Update workspaceMeta with the relative file path so routing still works
          const relPath = path.relative(this.repoDir, absPath);
          const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(doc._id);
          await models.workspaceMeta.update(workspaceMeta, {
            gitFilePath: relPath.split(path.sep).join(path.posix.sep),
          });
        }
        await db.update(doc);
      }

      // Record the mtime so polling doesn't re-import the same version
      try {
        const stat = await fs.promises.stat(absPath);
        this.lastSyncMtime.set(normalised, stat.mtimeMs);
      } catch {
        // ignore stat failure
      }
    } finally {
      await db.flushChanges(bufferId);
    }
  }
}

// ---------------------------------------------------------------------------
// Module-level registry & public API
// ---------------------------------------------------------------------------

/** Per-repo-id watcher instances */
const watchers = new Map<string, RepoFileWatcher>();

/**
 * Start watching `repoDir` for external YAML changes.
 * Safe to call multiple times for the same repoId; subsequent calls are no-ops.
 */
export function startWatcher(repoId: string, repoDir: string, projectId: string): void {
  if (watchers.has(repoId)) {
    return;
  }
  watchers.set(repoId, new RepoFileWatcher(repoDir, projectId));
}

/** Stop watching and clean up resources for a given repoId. */
export function stopWatcher(repoId: string): void {
  const watcher = watchers.get(repoId);
  if (!watcher) {
    return;
  }
  watcher.stop();
  watchers.delete(repoId);
}

/**
 * Suppress watcher events for `filePath` to prevent write loops when Insomnia
 * itself is writing the file. Call `unsuppressPath` once the write is done.
 */
export function suppressPath(repoId: string, filePath: string): void {
  watchers.get(repoId)?.suppress(filePath);
}

/** Resume watching a previously suppressed path. */
export function unsuppressPath(repoId: string, filePath: string): void {
  watchers.get(repoId)?.unsuppress(filePath);
}
