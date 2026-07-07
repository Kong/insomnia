/**
 * RepoFileWatcher — Bidirectional sync between on-disk Git repo and NeDB.
 *
 * Two pipelines, one serial queue:
 *
 *   FS → DB  (inbound)
 *     External tools (git CLI, VS Code, manual edits) modify YAML files on disk.
 *     Detected via `fs.watch` (primary) and periodic polling (fallback, 10 s).
 *     The file is parsed and upserted into NeDB. Orphaned DB documents that no
 *     longer appear in the YAML are removed.
 *
 *   DB → FS  (outbound)
 *     The Insomnia UI changes a synced document in NeDB. A `db.onChange` listener
 *     re-exports the workspace YAML and writes it to disk so that `git status` /
 *     `git diff` reflect the change.
 *
 * Initialisation (self-contained via `create()`):
 *   1. Load workspace→file mappings from DB (for rename detection).
 *   2. Import **all** YAML files from disk into the DB.  This populates the
 *      mtime + content-hash tracking maps as a side-effect.
 *   3. Start fs.watch, polling, and the DB→FS change listener.
 *
 *   Because step 2 runs before step 3, the watchers never fire for files that
 *   were already imported — there is no ordering trap for callers.
 *
 * Loop prevention (content-hash + serial queue):
 *   All sync work is routed through a single serial {@link SyncQueue}. Tasks
 *   execute one at a time — an import and a flush can never race.
 *
 *   When the DB→FS flush writes a file, it records the SHA-256 of the content it
 *   wrote in `lastWrittenHash`. When the FS→DB import reads a file, it computes
 *   the hash and compares:
 *     • Match   → our own write echoing back via fs.watch — skip.
 *     • No match → genuine external change — import.
 *
 *   `lastSyncMtime` is kept as a cheap fast-path: if the mtime hasn't changed
 *   since the last sync, the file is skipped without even reading it.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { BaseModel, Workspace, WorkspaceMeta } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import YAML from 'yaml';

import type { WorkspaceFileIssue } from '~/main/git-service';

import { database as db } from '../../common/database';
import { InsomniaFileTypeValues } from '../../common/import-v5-parser';
import { getInsomniaV5DataExport, tryImportV5Data } from '../../common/insomnia-v5';
import { SyncQueue } from './sync-queue';

const POLL_INTERVAL_MS = 10_000;
const DEBOUNCE_MS = 300;
const GIT_DIR = '.git';

export type FileIssueKind = 'conflict' | 'parse-error';

export interface FileIssue {
  /** Absolute path to the problematic file. */
  filePath: string;
  /** Relative path from the repo root (posix separators). */
  relPath: string;
  /** What went wrong. */
  kind: FileIssueKind;
  /** Human-readable detail (e.g. parser error message). */
  message: string;
}

export interface FileProblemsChangedPayload {
  repoId: string;
  problems: FileIssue[];
  workspaceIssues: WorkspaceFileIssue[];
  /** True when the main process is suppressing conflict display (e.g. SyncMergeModal is open). */
  conflictsSuppressed: boolean;
}

/** Compute a SHA-256 hex digest of a string. */
function contentHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Path-traversal guard: returns true when `absPath` resolves outside `repoDir`.
 *
 * A plain `rel.startsWith('..')` check would also reject legitimate in-repo
 * paths whose relative path merely begins with `..` (e.g. a file named
 * `..foo.yaml`). Only treat the path as an escape when the relative path is
 * exactly `..` or a `..` path segment (`../...`).
 */
function isPathOutsideRepo(repoDir: string, absPath: string): boolean {
  const rel = path.relative(repoDir, absPath);
  return rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
}

export interface WatcherNotifier {
  onDbSynced: () => void;
  onProblemsChanged: (payload: FileProblemsChangedPayload) => void;
}

class RepoFileWatcher {
  private readonly repoId: string;
  private readonly repoDir: string;
  private readonly projectId: string;
  private readonly notifier: WatcherNotifier;

  private fsWatchers: fs.FSWatcher[] = [];
  private fsWatchActive = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Per-workspace debounce timers for the DB→disk outbound flush */
  private flushDebounces = new Map<string, ReturnType<typeof setTimeout>>();
  /** Debounce timer for the project-level lint ruleset (.spectral.yaml) flush */
  private flushRulesetDebounce: ReturnType<typeof setTimeout> | null = null;
  /** Set to true by stop() so async callbacks can bail out cleanly */
  private stopped = false;

  /**
   * Serial queue — every FS→DB import and DB→FS flush is enqueued here.
   * Guarantees at most one sync task runs at a time.
   */
  private queue = new SyncQueue();

  /** mtime (ms) of the last successful sync for each normalised absolute path. */
  private lastSyncMtime = new Map<string, number>();

  /**
   * SHA-256 of the YAML content last written to disk by the DB→FS flush.
   * Used by the FS→DB import to detect and skip echo events (our own writes).
   */
  private lastWrittenHash = new Map<string, string>();

  /**
   * Last known absolute path for each workspace, keyed by workspace _id.
   * Used to detect gitFilePath renames so the old file can be removed.
   */
  private lastKnownGitFilePath = new Map<string, string>();

  /** In-memory docId → workspaceId lookup to avoid repeated DB traversals. */
  private docToWorkspace = new Map<string, string>();

  /**
   * Files that could not be imported due to conflicts or parse errors.
   * Keyed by normalised absolute path. Cleared when the file is
   * successfully imported or deleted.
   */
  private problemFiles = new Map<string, FileIssue>();

  private constructor(repoId: string, repoDir: string, projectId: string, notifier: WatcherNotifier) {
    this.repoId = repoId;
    this.repoDir = repoDir;
    this.projectId = projectId;
    this.notifier = notifier;
  }

  static async create(
    repoId: string,
    repoDir: string,
    projectId: string,
    notifier: WatcherNotifier,
  ): Promise<RepoFileWatcher> {
    const watcher = new RepoFileWatcher(repoId, repoDir, projectId, notifier);

    // 1. Load workspace-to-file mappings from the DB for rename detection.
    await watcher.loadKnownGitFilePaths();

    // 1b. If the DB has newer data than what’s on disk (e.g. the user edited
    //     requests on the old app during a downgrade), write fresh YAML to
    //     disk BEFORE importing so those edits are not silently overwritten.
    await watcher.flushNewerDbWorkspacesToDisk();

    // 2. Import all YAML files into the DB so it reflects disk state.
    //    This populates lastSyncMtime + lastWrittenHash as a side-effect,
    //    which prevents step 3's watchers from re-importing the same files.
    await watcher.importAllFiles();

    // 3. Start watching for ongoing changes (fs.watch + polling + DB listener).
    //    Safe to start now because tracking state is already populated.
    watcher.startFsWatch();
    watcher.startPolling();
    watcher.registerDbChangeListener();

    return watcher;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  stop(): void {
    this.stopped = true;
    this.queue.stop();

    for (const w of this.fsWatchers) {
      try {
        w.close();
      } catch {
        /* ignore */
      }
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    for (const t of this.debounceTimers.values()) {
      clearTimeout(t);
    }

    for (const t of this.flushDebounces.values()) {
      clearTimeout(t);
    }

    if (this.flushRulesetDebounce) {
      clearTimeout(this.flushRulesetDebounce);
    }
  }

  /**
   * Force an immediate DB→FS flush, bypassing the debounce timer.
   * Resolves once all currently-enqueued work (including the flush) is done.
   *
   * The git service should call this before any git operation (status, diff,
   * pull, merge, checkout, commit) to ensure the working tree is up-to-date.
   */
  async flushNow(): Promise<void> {
    if (this.stopped) {
      return;
    }

    // Cancel any pending debounced flushes — we're doing it immediately
    for (const timer of this.flushDebounces.values()) {
      clearTimeout(timer);
    }
    this.flushDebounces.clear();

    if (this.flushRulesetDebounce) {
      clearTimeout(this.flushRulesetDebounce);
      this.flushRulesetDebounce = null;
    }

    // Cancel all pending debounced imports and enqueue them immediately.
    // This ensures all external changes are in the queue before we flush,
    // preventing the flush from overwriting un-imported external edits.
    for (const [absPath, timer] of this.debounceTimers) {
      clearTimeout(timer);
      this.debounceTimers.delete(absPath);
      this.queue.enqueue(() => this.importFile(absPath));
    }

    this.queue.enqueue(() => this.flushWorkspacesToDisk());
    this.queue.enqueue(() => this.flushProjectLintRulesetToDisk());
    await this.queue.waitUntilDone();
  }

  /**
   * For each workspace linked to this project, if the DB was modified more
   * recently than the on-disk YAML, write fresh YAML to disk before the
   * initial `importAllFiles` scan.
   *
   * This prevents the stale-YAML-wins problem that occurs when:
   *   1. User downgrades (old app has no RepoFileWatcher — DB changes aren\u2019t flushed to disk).
   *   2. User edits requests via the old app (DB updated, no YAML written).
   *   3. User re-upgrades; without this guard those edits would be silently lost.
   *
   * Written files are recorded in `lastWrittenHash` / `lastSyncMtime` so that
   * `importAllFiles` skips them (they are already up-to-date).
   */
  private async flushNewerDbWorkspacesToDisk(): Promise<void> {
    const workspaces = await services.workspace.listByParentId(this.projectId);

    await Promise.all(
      workspaces.map(async workspace => {
        try {
          const meta = await services.workspaceMeta.getByParentId(workspace._id);
          const gitFilePath = meta?.gitFilePath ?? `insomnia.${workspace._id}.yaml`;
          const absPath = path.resolve(this.repoDir, gitFilePath);

          // Path-traversal guard
          if (isPathOutsideRepo(this.repoDir, absPath)) return;

          // Get the most recently modified DB document in this workspace\u2019s tree
          const allDocs = await db.getWithDescendants(workspace);
          let maxDbModified: number = workspace.modified ?? 0;
          for (const doc of allDocs) {
            const m = (doc as { modified?: number }).modified ?? 0;
            if (m > maxDbModified) maxDbModified = m;
          }

          // Compare against the on-disk mtime
          let fileMtime = 0;
          try {
            const stat = await fs.promises.stat(absPath);
            fileMtime = stat.mtimeMs;
          } catch {
            // File doesn\u2019t exist yet \u2014 nothing to do; importAllFiles will handle creation.
            return;
          }

          if (maxDbModified <= fileMtime) return; // disk is up-to-date

          // DB is newer \u2014 write fresh YAML so importAllFiles doesn\u2019t overwrite it
          const yamlContent = await getInsomniaV5DataExport({
            workspaceId: workspace._id,
            includePrivateEnvironments: false,
          });
          if (!yamlContent?.trim()) return;

          await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
          await fs.promises.writeFile(absPath, yamlContent, 'utf8');

          const hash = contentHash(yamlContent);
          const normalised = path.normalize(absPath);
          this.lastWrittenHash.set(normalised, hash);
          this.lastSyncMtime.set(normalised, Date.now() + 1);

          console.log(
            '[repo-file-watcher] DB newer than disk for workspace',
            workspace._id,
            '— flushed to',
            gitFilePath,
          );
        } catch (err) {
          console.warn('[repo-file-watcher] flushNewerDbWorkspacesToDisk error for workspace', workspace._id, err);
        }
      }),
    );
  }

  /**
   * Import all YAML files in the repo directory into the DB.
   *
   * Always bypasses the mtime fast-path (`forceRead`) so every file is read
   * and compared by content-hash. This makes the method safe to call at any
   * point — regardless of what tracking state has already been recorded.
   *
   * Also detects workspace YAML files that were removed from disk (e.g. deleted
   * on the remote) and removes the corresponding workspaces from the DB.
   */
  async importAllFiles(options: { removeLocalOnlyOrphans?: boolean } = {}): Promise<void> {
    if (this.stopped) {
      return;
    }

    // If the whole repo folder is gone (deleted/moved/unmounted), an empty disk
    // must NOT be read as "every file was deleted" — that would wipe the DB.
    // Treat the repo as temporarily unavailable and skip syncing.
    if (!(await this.repoDirIsAvailable())) {
      console.warn(
        '[repo-file-watcher] Repo directory unavailable — skipping import to avoid data loss:',
        this.repoDir,
      );
      return;
    }

    const yamlFiles = await this.collectYamlFiles(this.repoDir);

    // Import each file through the queue so they serialise with any
    // concurrent flush that may still be pending.
    // forceRead=true bypasses the mtime fast-path so every file is
    // actually read and imported regardless of tracking state.
    for (const absPath of yamlFiles) {
      this.queue.enqueue(() => this.importFile(absPath, true));
    }

    // Detect deleted files: workspaces in DB whose YAML is no longer on disk.
    this.queue.enqueue(() => this.removeOrphanedWorkspaces(yamlFiles, options.removeLocalOnlyOrphans));

    await this.queue.waitUntilDone();
  }

  // ---------------------------------------------------------------------------
  // DB → FS direction (outbound)
  // ---------------------------------------------------------------------------

  /**
   * Register a database onChange listener that flushes workspace YAML to disk
   * whenever synced documents change.
   */
  private registerDbChangeListener(): void {
    db.onChange(changes => {
      if (this.stopped) {
        return;
      }

      const affectedWorkspaceIds = new Set<string>();
      let lintRulesetChanged = false;

      for (const [, doc] of changes) {
        if (!models.canSync(doc)) {
          continue;
        }
        // The project lint ruleset is parented to the project, not a workspace.
        // It flushes to .spectral.yaml on its own — keep it out of the workspace
        // resolution below so it doesn't fall into the "flush all" branch.
        if (models.projectLintRuleset.isProjectLintRuleset(doc)) {
          if (doc.parentId === this.projectId) {
            lintRulesetChanged = true;
          }
          continue;
        }
        const workspaceId = this.resolveWorkspaceId(doc);
        if (workspaceId) {
          affectedWorkspaceIds.add(workspaceId);
        } else {
          // Cannot determine workspace — conservatively flush all known workspaces
          for (const wsId of this.lastKnownGitFilePath.keys()) {
            affectedWorkspaceIds.add(wsId);
          }
          break;
        }
      }

      if (lintRulesetChanged) {
        // Debounce: coalesce rapid ruleset edits into one flush
        if (this.flushRulesetDebounce) {
          clearTimeout(this.flushRulesetDebounce);
        }
        this.flushRulesetDebounce = setTimeout(() => {
          this.flushRulesetDebounce = null;
          this.queue.enqueue(() => this.flushProjectLintRulesetToDisk());
        }, DEBOUNCE_MS);
      }

      if (affectedWorkspaceIds.size === 0) {
        return;
      }

      for (const workspaceId of affectedWorkspaceIds) {
        const existing = this.flushDebounces.get(workspaceId);
        if (existing) {
          clearTimeout(existing);
        }
        const timer = setTimeout(() => {
          this.flushDebounces.delete(workspaceId);
          this.queue.enqueue(() => this.flushWorkspacesToDisk(new Set([workspaceId])));
        }, DEBOUNCE_MS);
        this.flushDebounces.set(workspaceId, timer);
      }
    });
  }

  private resolveWorkspaceId(doc: BaseModel): string | undefined {
    if (models.workspace.isWorkspace(doc)) {
      return doc.parentId === this.projectId ? doc._id : undefined;
    }
    const cached = this.docToWorkspace.get(doc._id);
    if (cached) return cached;
    // Direct child of a known workspace?
    if (this.lastKnownGitFilePath.has(doc.parentId)) {
      this.docToWorkspace.set(doc._id, doc.parentId);
      return doc.parentId;
    }
    // Grandchild — parent's workspace is already in the map
    const parentWs = this.docToWorkspace.get(doc.parentId);
    if (parentWs) {
      this.docToWorkspace.set(doc._id, parentWs);
      return parentWs;
    }
    return undefined;
  }

  /**
   * Re-export workspaces in the project to their on-disk YAML files.
   * When `workspaceIds` is provided, only those workspaces are processed.
   * Skips writes when the exported content is identical to what was last
   * written (content-hash dedup), or when the target file currently has a
   * blocking import problem that the user must resolve first.
   */
  private async flushWorkspacesToDisk(workspaceIds?: Set<string>): Promise<void> {
    const entries = await this.getWorkspacesWithMeta(workspaceIds);
    const currentWorkspaceIds = new Set(entries.map(({ workspace }) => workspace._id));

    // Find deleted workspaces within scope and remove their files from disk.
    const scopedIds = workspaceIds ?? new Set(this.lastKnownGitFilePath.keys());
    for (const [workspaceId, absPath] of this.lastKnownGitFilePath) {
      if (!scopedIds.has(workspaceId)) {
        continue;
      }
      if (currentWorkspaceIds.has(workspaceId)) {
        continue;
      }
      await this.removeWorkspaceFileFromDisk(workspaceId, absPath);
    }

    for (const { workspace, meta } of entries) {
      if (this.stopped) {
        return;
      }

      const gitFilePath: string = meta?.gitFilePath || `insomnia.${workspace._id}.yaml`;
      const absPath = path.normalize(path.join(this.repoDir, gitFilePath));

      if (isPathOutsideRepo(this.repoDir, absPath)) {
        continue;
      }

      if (this.hasProblem(absPath)) {
        continue;
      }

      // Detect gitFilePath rename: if the path changed, we'll delete the old
      // file *after* the new one is successfully written to avoid data loss.
      const previousAbsPath = this.lastKnownGitFilePath.get(workspace._id);
      const isRename = previousAbsPath && previousAbsPath !== absPath;

      try {
        const yamlContent = await getInsomniaV5DataExport({
          workspaceId: workspace._id,
          includePrivateEnvironments: false,
        });

        const hash = contentHash(yamlContent);

        if (this.lastWrittenHash.get(absPath) === hash) {
          continue;
        }

        await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
        await fs.promises.writeFile(absPath, yamlContent, 'utf8');

        if (isRename) {
          await this.removeWorkspaceFileFromDisk(workspace._id, previousAbsPath);
        }

        this.lastWrittenHash.set(absPath, hash);
        this.lastKnownGitFilePath.set(workspace._id, absPath);
        // Use Date.now() — always >= the actual mtime of the file just written, saves a stat() syscall
        this.lastSyncMtime.set(absPath, Date.now());
      } catch (err) {
        console.warn('[repo-file-watcher] Could not flush workspace to disk:', workspace._id, err);
      }
    }
  }

  private async flushProjectLintRulesetToDisk(): Promise<void> {
    if (this.stopped) {
      return;
    }

    const absPath = path.normalize(path.join(this.repoDir, '.spectral.yaml'));
    const ruleset = await services.projectLintRuleset.getByParentId(this.projectId);

    try {
      if (!ruleset) {
        // Ruleset removed from the DB — remove the file if we were tracking it.
        if (this.lastWrittenHash.has(absPath) || this.lastSyncMtime.has(absPath)) {
          await fs.promises.rm(absPath, { force: true });
          this.lastWrittenHash.delete(absPath);
          this.lastSyncMtime.delete(absPath);
        }
        return;
      }

      const hash = contentHash(ruleset.rulesetContent);
      if (this.lastWrittenHash.get(absPath) === hash) {
        return;
      }

      await fs.promises.writeFile(absPath, ruleset.rulesetContent, 'utf8');
      this.lastWrittenHash.set(absPath, hash);
      const stat = await fs.promises.stat(absPath);
      this.lastSyncMtime.set(absPath, stat.mtimeMs);
    } catch (err) {
      console.warn('[repo-file-watcher] Could not flush project lint ruleset to disk:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // FS → DB direction (inbound)
  // ---------------------------------------------------------------------------

  private startFsWatch(): void {
    try {
      const watcher = fs.watch(this.repoDir, { recursive: true }, (_eventType, filename) => {
        if (!filename) {
          return;
        }
        const absPath = path.join(this.repoDir, filename);
        this.scheduleImport(absPath);
      });

      watcher.on('error', err => {
        console.warn('[repo-file-watcher] fs.watch error, falling back to polling:', err);
        // The watcher can no longer be relied upon for fs events. Drop the
        // fs.watch flag and start the polling fallback so we don't end up with
        // neither reliable events nor polling.
        this.fsWatchActive = false;
        this.startPolling();
      });

      this.fsWatchers.push(watcher);
      this.fsWatchActive = true;
    } catch (err) {
      console.warn('[repo-file-watcher] Could not start fs.watch, relying on polling only:', err);
    }
  }

  private startPolling(): void {
    // Skip when fs.watch is active (polling is only a fallback), when polling is
    // already running, or after the watcher has been stopped.
    if (this.fsWatchActive || this.pollTimer || this.stopped) {
      return;
    }
    this.pollTimer = setInterval(() => {
      this.pollDirectory(this.repoDir).catch(err => {
        console.warn('[repo-file-watcher] poll error:', err);
      });
    }, POLL_INTERVAL_MS);
  }

  private async pollDirectory(dir: string): Promise<void> {
    // Don't sync when the repo folder is gone — see importAllFiles. This prevents
    // the deletion-detection loop below from wiping the DB when the folder was
    // deleted/unmounted rather than its files individually removed.
    if (!(await this.repoDirIsAvailable())) {
      return;
    }

    // Check known files for mtime changes or deletions — no readdir
    for (const [absPath, lastMtime] of this.lastSyncMtime) {
      try {
        // Use lstat (not stat) so symlinks are detected rather than followed.
        // importFile/readIfChanged ignore symlinks, so following the link here
        // would compare the target's mtime and enqueue an import that always
        // skips — repeated every poll. Skip symlinks to suppress that churn.
        const stat = await fs.promises.lstat(absPath);
        if (stat.isSymbolicLink()) {
          continue;
        }
        if (stat.mtimeMs > lastMtime) {
          this.queue.enqueue(() => this.importFile(absPath));
        }
      } catch {
        this.queue.enqueue(() => this.importFile(absPath));
      }
    }

    // Scan once for new yaml files not yet tracked
    const yamlFiles = await this.collectYamlFiles(dir);
    for (const absPath of yamlFiles) {
      if (!this.lastSyncMtime.has(absPath)) {
        this.queue.enqueue(() => this.importFile(absPath));
      }
    }
  }

  private scheduleImport(absPath: string): void {
    if (this.stopped || !absPath.endsWith('.yaml') || this.isInGitDir(absPath)) {
      return;
    }

    const existing = this.debounceTimers.get(absPath);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(absPath);
      this.queue.enqueue(() => this.importFile(absPath));
    }, DEBOUNCE_MS);

    this.debounceTimers.set(absPath, timer);
  }

  private isSpectralRulesetPath(normalisedPath: string): boolean {
    return (
      path.basename(normalisedPath) === '.spectral.yaml' &&
      path.normalize(path.dirname(normalisedPath)) === path.normalize(this.repoDir)
    );
  }

  private isSpectralRulesetFile(normalisedPath: string, content: string): boolean {
    if (!this.isSpectralRulesetPath(normalisedPath)) {
      return false;
    }
    try {
      const parsedContent = YAML.parse(content);
      return (
        !!parsedContent && typeof parsedContent === 'object' && ('extends' in parsedContent || 'rules' in parsedContent)
      );
    } catch {
      return false;
    }
  }

  /**
   * Read a YAML file from disk and import its documents into the DB.
   *
   * Loop prevention:
   *  1. mtime fast-path — if mtime is unchanged, skip without reading.
   *  2. content-hash   — if the file hash matches `lastWrittenHash`, the file
   *     was written by our own DB→FS flush; skip.
   *
   * Orphan deletion:
   *  When an existing workspace is reimported, DB documents that no longer
   *  appear in the YAML are removed (e.g. a request deleted on the remote).
   */
  private async importFile(absPath: string, forceRead = false): Promise<void> {
    const normalised = path.normalize(absPath);

    const result = await this.readIfChanged(absPath, normalised, forceRead);
    if (!result) {
      return;
    }

    this.lastWrittenHash.set(normalised, result.hash);
    this.lastSyncMtime.set(normalised, result.mtimeMs);

    if (this.isSpectralRulesetFile(normalised, result.content)) {
      await services.projectLintRuleset.upsert(this.projectId, { rulesetContent: result.content });
      this.notifyRenderer();
      return;
    }

    const docs = this.parseAndValidate(absPath, normalised, result.content);
    if (!docs) {
      return;
    }

    await this.deleteOrphans(docs);
    await this.upsertDocs(absPath, normalised, result.mtimeMs, docs);

    this.notifyRenderer();
  }

  /**
   * Read a file from disk if it has changed since the last sync.
   * Returns the content, its hash, and the mtime — or null if skipped.
   */
  private async readIfChanged(
    absPath: string,
    normalised: string,
    forceRead = false,
  ): Promise<{ content: string; hash: string; mtimeMs: number } | null> {
    // ── Check if file still exists and is not a symlink ──────────────
    let fileStat: fs.Stats;
    try {
      fileStat = await fs.promises.lstat(absPath);
    } catch {
      // Only treat a missing file as a real deletion when the repo folder itself
      // still exists. If the whole folder is gone (deleted/unmounted) we must not
      // remove the workspace from the DB — the repo is unavailable, not emptied.
      if (await this.repoDirIsAvailable()) {
        await this.handleFileDeletion(normalised);
      }
      return null;
    }

    if (fileStat.isSymbolicLink()) {
      return null;
    }

    if (fileStat.isSymbolicLink()) {
      return null;
    }

    // ── Fast-path: mtime unchanged → skip ────────────────────────────
    // Bypassed when forceRead is true (e.g. importAllFiles after git
    // operations) so every file is always read and compared by content.
    if (!forceRead) {
      const lastMtime = this.lastSyncMtime.get(normalised);
      if (lastMtime !== undefined && fileStat.mtimeMs <= lastMtime) {
        return null;
      }
    }

    // ── Read file ────────────────────────────────────────────────────
    let content: string;
    try {
      content = await fs.promises.readFile(absPath, 'utf8');
    } catch {
      await this.handleFileDeletion(normalised);
      return null;
    }

    // ── Content-hash dedup: skip if this is our own write ────────────
    const hash = contentHash(content);
    if (this.lastWrittenHash.get(normalised) === hash) {
      this.lastSyncMtime.set(normalised, fileStat.mtimeMs);
      return null;
    }

    return { content, hash, mtimeMs: fileStat.mtimeMs };
  }

  /**
   * Validate and parse YAML content. Returns parsed documents or null
   * if the content is not valid Insomnia V5 YAML (with problems tracked).
   */
  private parseAndValidate(
    absPath: string,
    normalised: string,
    content: string,
  ): ReturnType<typeof tryImportV5Data>['data'] | null {
    const nl = content.indexOf('\n');
    const firstLine = (nl === -1 ? content : content.slice(0, nl)).trim();
    if (!InsomniaFileTypeValues.some(t => firstLine.includes(t))) {
      return null;
    }

    if (/^(?:<{7}|>{7})/m.test(content)) {
      this.addProblem(normalised, {
        filePath: absPath,
        relPath: this.toPosixRelPath(absPath),
        kind: 'conflict',
        message: 'File contains Git conflict markers and cannot be imported.',
      });
      return null;
    }

    const { data: docs, error } = tryImportV5Data(content);
    if (error || !docs) {
      this.addProblem(normalised, {
        filePath: absPath,
        relPath: this.toPosixRelPath(absPath),
        kind: 'parse-error',
        message: typeof error === 'string' ? error : `Failed to parse: ${String(error)}`,
      });
      return null;
    }

    this.clearProblem(normalised);
    return docs;
  }

  /** Remove DB documents that no longer appear in the imported YAML. */
  private async deleteOrphans(docs: NonNullable<ReturnType<typeof tryImportV5Data>['data']>): Promise<void> {
    const workspace = docs.find(models.workspace.isWorkspace) as Workspace | undefined;
    if (!workspace) {
      return;
    }
    const existingWorkspace = await services.workspace.getById(workspace._id);
    if (!existingWorkspace) {
      return;
    }
    const originDocs = await db.getWithDescendants(existingWorkspace);
    const importedIds = new Set(docs.map(d => d._id));
    const deletedDocs = originDocs.filter(o => !importedIds.has(o._id) && models.canSync(o));
    for (const doc of deletedDocs) {
      this.docToWorkspace.delete(doc._id);
      await db.unsafeRemove(doc);
    }
  }

  /** Upsert parsed documents into the DB and update tracking state. */
  private async upsertDocs(
    absPath: string,
    normalised: string,
    syncTime: number,
    docs: NonNullable<ReturnType<typeof tryImportV5Data>['data']>,
  ): Promise<void> {
    const workspaceDoc = docs.find(models.workspace.isWorkspace) as Workspace | undefined;
    const workspaceId = workspaceDoc?._id;

    const bufferId = await db.bufferChanges();
    try {
      for (const doc of docs) {
        if (models.workspace.isWorkspace(doc)) {
          doc.parentId = this.projectId;
          const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(doc._id);
          await services.workspaceMeta.update(workspaceMeta, {
            gitFilePath: this.toPosixRelPath(absPath),
            gitFileLastSyncTime: syncTime,
          });
          this.lastKnownGitFilePath.set(doc._id, normalised);
        }
        if (workspaceId) {
          this.docToWorkspace.set(doc._id, workspaceId);
        }
        await db.update(doc);
      }
    } finally {
      await db.flushChanges(bufferId);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Handle a YAML file that was deleted from disk.
   * Finds the workspace whose `gitFilePath` maps to this path and removes
   * it (plus all descendants) from the DB.
   */
  private async handleFileDeletion(normalised: string): Promise<void> {
    // Only act if we were previously tracking this file
    if (!this.lastSyncMtime.has(normalised) && !this.lastWrittenHash.has(normalised)) {
      return;
    }

    // The lint ruleset file was deleted — remove the ProjectLintRuleset record.
    if (this.isSpectralRulesetPath(normalised)) {
      await services.projectLintRuleset.remove(this.projectId);
      this.lastSyncMtime.delete(normalised);
      this.lastWrittenHash.delete(normalised);
      this.clearProblem(normalised);
      this.notifyRenderer();
      return;
    }

    const relPath = this.toPosixRelPath(normalised);

    // Find the workspace whose path matches the deleted file — O(workspaces) map scan,
    // avoids a full getWorkspacesWithMeta() DB fetch.
    let workspaceIdToDelete: string | undefined;
    for (const [wsId, wsPath] of this.lastKnownGitFilePath) {
      if (wsPath === normalised) {
        workspaceIdToDelete = wsId;
        break;
      }
    }
    if (workspaceIdToDelete) {
      const workspace = await services.workspace.getById(workspaceIdToDelete);
      if (workspace) {
        console.log('[repo-file-watcher] File deleted, removing workspace:', workspace._id, relPath);
        await this.removeWorkspaceWithDescendants(workspace);
        this.notifyRenderer();
      }
    }

    // Clean up tracking maps
    this.lastSyncMtime.delete(normalised);
    this.lastWrittenHash.delete(normalised);
    this.clearProblem(normalised);
  }

  private cleanupRemovedWorkspaceFileTracking(workspaceId: string, normalisedPath: string): void {
    if (this.lastKnownGitFilePath.get(workspaceId) === normalisedPath) {
      this.lastKnownGitFilePath.delete(workspaceId);
    }
    this.lastSyncMtime.delete(normalisedPath);
    this.lastWrittenHash.delete(normalisedPath);
    this.clearProblem(normalisedPath);
  }

  private async removeWorkspaceFileFromDisk(workspaceId: string, normalisedPath: string): Promise<void> {
    try {
      await fs.promises.unlink(normalisedPath);
      console.log('[repo-file-watcher] Removed workspace file from disk:', workspaceId, normalisedPath);
      this.cleanupRemovedWorkspaceFileTracking(workspaceId, normalisedPath);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        // Old file may already be gone — that's fine.
        this.cleanupRemovedWorkspaceFileTracking(workspaceId, normalisedPath);
        return;
      }

      console.warn('[repo-file-watcher] Failed to remove workspace file from disk:', workspaceId, normalisedPath, err);
    }
  }

  /** Convert an absolute path to a posix-style path relative to the repo root. */
  private toPosixRelPath(absPath: string): string {
    return path.relative(this.repoDir, absPath).split(path.sep).join(path.posix.sep);
  }

  /** Remove a workspace and all its descendants from the DB inside a buffered batch. */
  private async removeWorkspaceWithDescendants(workspace: Workspace): Promise<void> {
    const descendants = await db.getWithDescendants(workspace);
    const bufferId = await db.bufferChanges();
    try {
      for (const doc of descendants) {
        this.docToWorkspace.delete(doc._id);
        await db.unsafeRemove(doc);
      }
    } finally {
      await db.flushChanges(bufferId);
    }
    this.docToWorkspace.delete(workspace._id);
  }

  /** Fetch workspaces in this project together with their metadata. When `filterIds` is provided, only those workspaces are returned. */
  private async getWorkspacesWithMeta(
    filterIds?: Set<string>,
  ): Promise<{ workspace: Workspace; meta: WorkspaceMeta | undefined }[]> {
    const query = filterIds ? { parentId: this.projectId, _id: { $in: [...filterIds] } } : { parentId: this.projectId };
    const workspaces = await services.workspace.list(query);
    if (workspaces.length === 0) {
      return [];
    }
    const metas = await services.workspaceMeta.list({ parentId: { $in: workspaces.map(w => w._id) } });
    const metaByParent = new Map(metas.map(m => [m.parentId, m]));
    return workspaces.map(workspace => ({ workspace, meta: metaByParent.get(workspace._id) }));
  }

  private isInGitDir(absPath: string): boolean {
    const rel = path.relative(this.repoDir, absPath);
    return rel.startsWith(GIT_DIR + path.sep) || rel === GIT_DIR;
  }

  /**
   * Whether the repository's working-tree directory still exists on disk.
   *
   * When the user deletes/moves the folder (or unmounts its drive) the disk
   * appears empty. We must NOT interpret that as "all files deleted" and wipe the
   * database — instead we treat the repo as temporarily unavailable and skip
   * syncing, so the project's collections survive (and re-sync if the folder
   * returns).
   */
  private async repoDirIsAvailable(): Promise<boolean> {
    try {
      return (await fs.promises.stat(this.repoDir)).isDirectory();
    } catch {
      return false;
    }
  }

  /** Recursively collect all `.yaml` files under `dir` as normalised absolute paths, skipping `.git`. */
  private async collectYamlFiles(dir: string): Promise<string[]> {
    const result: string[] = [];
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return result;
    }
    const subDirectories: string[] = [];
    for (const entry of entries) {
      const absPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== GIT_DIR) {
          subDirectories.push(absPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.yaml')) {
        result.push(path.normalize(absPath));
      }
    }
    const nested = await Promise.all(subDirectories.map(d => this.collectYamlFiles(d)));
    for (const n of nested) {
      result.push(...n);
    }
    return result;
  }

  /**
   * Reconcile DB workspaces whose YAML file is not present on disk.
   *
   *  • Previously-synced workspace (has `gitFileLastSyncTime`): the YAML was
   *    deleted on the remote / is absent from the checked-out branch — remove
   *    the workspace from the DB.
   *  • Never-synced workspace (no `gitFileLastSyncTime`): this is local-only
   *    content (e.g. created before a repo was connected, or not yet committed).
   *    It is NOT an orphan — write it to disk so it is preserved and can be
   *    committed. Without this, connecting an empty repo to a project that
   *    already has local data would silently delete that data.
   *
   * `removeLocalOnlyOrphans` overrides the preservation above: when the missing
   * file is the result of an explicit user action (e.g. discarding an untracked,
   * never-committed workspace), the workspace should be removed rather than
   * resurrected back to disk.
   */
  private async removeOrphanedWorkspaces(currentDiskFiles: string[], removeLocalOnlyOrphans = false): Promise<void> {
    const diskFileSet = new Set(currentDiskFiles.map(f => path.normalize(f)));
    const entries = await this.getWorkspacesWithMeta();
    for (const { workspace, meta } of entries) {
      if (!meta?.gitFilePath) {
        continue;
      }

      const absPath = path.normalize(path.join(this.repoDir, meta.gitFilePath));
      if (diskFileSet.has(absPath)) {
        continue;
      }

      if (!meta.gitFileLastSyncTime && !removeLocalOnlyOrphans) {
        // Local-only content never synced to git — preserve it instead of deleting.
        await this.flushWorkspaceToDisk(workspace, absPath);
        continue;
      }

      // Workspace YAML no longer on disk — remove from DB
      console.log('[repo-file-watcher] Removing orphaned workspace:', workspace._id);
      await this.removeWorkspaceWithDescendants(workspace);
    }
  }

  /**
   * Write a workspace's current DB state to its on-disk YAML file and record
   * tracking state so the FS→DB import skips the echo. Used to preserve
   * local-only workspaces (never synced to git) that are not yet on disk.
   */
  private async flushWorkspaceToDisk(workspace: Workspace, absPath: string): Promise<void> {
    // Path-traversal guard
    const rel = path.relative(this.repoDir, absPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return;
    }

    try {
      const yamlContent = await getInsomniaV5DataExport({
        workspaceId: workspace._id,
        includePrivateEnvironments: false,
      });
      if (!yamlContent?.trim()) {
        return;
      }

      await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
      await fs.promises.writeFile(absPath, yamlContent, 'utf8');

      const normalised = path.normalize(absPath);
      this.lastWrittenHash.set(normalised, contentHash(yamlContent));
      const stat = await fs.promises.stat(absPath);
      this.lastSyncMtime.set(normalised, stat.mtimeMs);
      this.lastKnownGitFilePath.set(workspace._id, normalised);

      console.log(
        '[repo-file-watcher] Preserved local-only workspace on disk:',
        workspace._id,
        this.toPosixRelPath(absPath),
      );
    } catch (err) {
      console.warn('[repo-file-watcher] Could not preserve local-only workspace on disk:', workspace._id, err);
    }
  }

  /**
   * Load existing workspace → gitFilePath mappings from the DB so rename
   * detection works from the start.
   *
   * Note: we intentionally do NOT pre-scan file mtimes here. The initial
   * {@link importAllFiles} call in {@link create} populates both
   * `lastSyncMtime` and `lastWrittenHash` as a side-effect of importing.
   * Pre-scanning mtimes would cause `importAllFiles` to skip files it
   * hasn't actually imported yet.
   */
  private async loadKnownGitFilePaths(): Promise<void> {
    const entries = await this.getWorkspacesWithMeta();
    for (const { workspace, meta } of entries) {
      if (meta?.gitFilePath) {
        const absPath = path.normalize(path.join(this.repoDir, meta.gitFilePath));
        if (isPathOutsideRepo(this.repoDir, absPath)) {
          continue;
        }
        this.lastKnownGitFilePath.set(workspace._id, absPath);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Problem tracking
  // ---------------------------------------------------------------------------

  /** Record a problem (conflict or parse error) for the given file path. */
  private addProblem(normalised: string, issue: FileIssue): void {
    this.problemFiles.set(normalised, issue);
    console.warn(`[repo-file-watcher] ${issue.kind}: ${issue.relPath} — ${issue.message}`);
    this.notifyProblemsChanged();
  }

  /** Clear a previously recorded problem for the given file path. */
  private clearProblem(normalised: string): void {
    if (this.problemFiles.delete(normalised)) {
      this.notifyProblemsChanged();
    }
  }

  /** Return a snapshot of all current file problems. */
  getProblems(): FileIssue[] {
    return Array.from(this.problemFiles.values());
  }

  /** Return true when a normalized file path currently has a blocking import problem. */
  private hasProblem(normalisedPath: string): boolean {
    return this.problemFiles.has(normalisedPath);
  }

  /** Return the current problems mapped to workspace-level issues. */
  getWorkspaceIssues(): WorkspaceFileIssue[] {
    const absPathToWorkspaceId = new Map<string, string>();

    for (const [workspaceId, absPath] of this.lastKnownGitFilePath.entries()) {
      absPathToWorkspaceId.set(path.normalize(absPath), workspaceId);
    }

    return Array.from(this.problemFiles.entries()).flatMap<WorkspaceFileIssue>(([normalisedPath, issue]) => {
      const workspaceId = absPathToWorkspaceId.get(normalisedPath);
      if (!workspaceId) {
        return [];
      }

      return [
        {
          workspaceId,
          gitRepositoryId: this.repoId,
          relPath: issue.relPath,
          kind: issue.kind,
          message: issue.message,
        },
      ];
    });
  }

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------

  /** Notify the renderer that the DB was synced from disk. */
  private notifyRenderer(): void {
    this.notifier.onDbSynced();
  }

  /** Notify the renderer that the set of file problems changed. */
  private notifyProblemsChanged(): void {
    this.notifier.onProblemsChanged({
      repoId: this.repoId,
      problems: this.getProblems(),
      workspaceIssues: this.getWorkspaceIssues(),
      conflictsSuppressed: false,
    });
  }
}

// ---------------------------------------------------------------------------
// Registry — manages per-repo watcher instances
// ---------------------------------------------------------------------------

export class RepoFileWatcherRegistry {
  private watchers = new Map<string, RepoFileWatcher>();
  /** Tracks in-flight create() calls to prevent duplicate watchers. */
  private pending = new Map<string, Promise<void>>();
  private readonly notifier: WatcherNotifier;

  constructor(notifier: WatcherNotifier) {
    this.notifier = notifier;
  }

  /**
   * Start watching `repoDir` for external YAML changes.
   * Safe to call multiple times for the same repoId; concurrent calls
   * for the same repoId coalesce into a single create.
   */
  async startWatcher(repoId: string, repoDir: string, projectId: string): Promise<void> {
    if (this.watchers.has(repoId)) {
      return;
    }

    // If a create is already in flight for this repoId, wait for it
    const inflight = this.pending.get(repoId);
    if (inflight) {
      await inflight;
      return;
    }

    const promise = RepoFileWatcher.create(repoId, repoDir, projectId, this.notifier)
      .then(watcher => {
        this.watchers.set(repoId, watcher);
      })
      .finally(() => {
        this.pending.delete(repoId);
      });

    this.pending.set(repoId, promise);
    await promise;
  }

  /** Stop watching and clean up resources for a given repoId. */
  stopWatcher(repoId: string): void {
    const watcher = this.watchers.get(repoId);
    if (!watcher) {
      return;
    }
    watcher.stop();
    this.watchers.delete(repoId);
  }

  /** Stop all active watchers. Useful for app shutdown. */
  stopAll(): void {
    for (const watcher of this.watchers.values()) {
      watcher.stop();
    }
    this.watchers.clear();
  }

  /**
   * Force an immediate DB→FS flush for the given repo, then wait for all
   * pending sync work to complete.
   *
   * Call before any git operation (status, diff, pull, merge, checkout, commit)
   * to ensure the working tree reflects the latest DB state.
   */
  flushNow(repoId: string): Promise<void> {
    const watcher = this.watchers.get(repoId);
    if (!watcher) {
      return Promise.resolve();
    }
    return watcher.flushNow();
  }

  /**
   * Import all YAML files in the repo directory into the DB.
   *
   * Call after bulk git operations (clone, pull, merge, checkout) so the DB
   * reflects the new disk state. Content-hash dedup makes repeated calls cheap.
   */
  importAllFiles(repoId: string, options: { removeLocalOnlyOrphans?: boolean } = {}): Promise<void> {
    const watcher = this.watchers.get(repoId);
    if (!watcher) {
      return Promise.resolve();
    }
    return watcher.importAllFiles(options);
  }

  /**
   * Return a snapshot of all current file problems (conflicts, parse errors)
   * for the given repo. Returns an empty array if the watcher is not running.
   */
  getProblems(repoId: string): FileIssue[] {
    const watcher = this.watchers.get(repoId);
    if (!watcher) {
      return [];
    }
    return watcher.getProblems();
  }
}
