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

import { BrowserWindow } from 'electron';
import YAML from 'yaml';

import type { Workspace, WorkspaceMeta } from '~/insomnia-data';
import { models, services } from '~/insomnia-data';
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
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Debounce timer for the DB→disk outbound flush */
  private flushDebounce: ReturnType<typeof setTimeout> | null = null;
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

    if (this.flushDebounce) {
      clearTimeout(this.flushDebounce);
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

    // Cancel any pending debounced flush — we're doing it immediately
    if (this.flushDebounce) {
      clearTimeout(this.flushDebounce);
      this.flushDebounce = null;
    }

    // Cancel all pending debounced imports and enqueue them immediately.
    // This ensures all external changes are in the queue before we flush,
    // preventing the flush from overwriting un-imported external edits.
    for (const [absPath, timer] of this.debounceTimers) {
      clearTimeout(timer);
      this.debounceTimers.delete(absPath);
      this.queue.enqueue(() => this.importFile(absPath));
    }

    this.queue.enqueue(() => this.flushProjectWorkspacesToDisk());
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
    const workspaces = await services.workspace.findByParentId(this.projectId);

    await Promise.all(
      workspaces.map(async workspace => {
        try {
          const meta = await services.workspaceMeta.getByParentId(workspace._id);
          const gitFilePath = meta?.gitFilePath ?? `insomnia.${workspace._id}.yaml`;
          const absPath = path.resolve(this.repoDir, gitFilePath);

          // Path-traversal guard
          const rel = path.relative(this.repoDir, absPath);
          if (rel.startsWith('..') || path.isAbsolute(rel)) return;

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
          const newStat = await fs.promises.stat(absPath);
          this.lastSyncMtime.set(normalised, newStat.mtimeMs);

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
  async importAllFiles(): Promise<void> {
    if (this.stopped) {
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
    this.queue.enqueue(() => this.removeOrphanedWorkspaces(yamlFiles));

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

      const hasSyncableChange = changes.some(([, doc]) => models.canSync(doc));
      if (!hasSyncableChange) {
        return;
      }

      // Debounce: coalesce rapid bursts into one flush
      if (this.flushDebounce) {
        clearTimeout(this.flushDebounce);
      }
      this.flushDebounce = setTimeout(() => {
        this.flushDebounce = null;
        this.queue.enqueue(() => this.flushProjectWorkspacesToDisk());
        this.queue.enqueue(() => this.flushProjectLintRulesetToDisk());
      }, DEBOUNCE_MS);
    });
  }

  /**
   * Re-export every workspace in the project to its on-disk YAML file.
   * Skips writes when the exported content is identical to what was last
   * written (content-hash dedup), or when the target file currently has a
   * blocking import problem that the user must resolve first.
   */
  private async flushProjectWorkspacesToDisk(): Promise<void> {
    const entries = await this.getWorkspacesWithMeta();
    const currentWorkspaceIds = new Set(entries.map(({ workspace }) => workspace._id));

    // Find deleted workspaces and remove their files from disk.
    for (const [workspaceId, absPath] of Array.from(this.lastKnownGitFilePath.entries())) {
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

        // Skip writing if the content hasn't changed
        if (this.lastWrittenHash.get(absPath) === hash) {
          continue;
        }

        await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
        await fs.promises.writeFile(absPath, yamlContent, 'utf8');

        // New file written successfully — now safe to remove the old one
        if (isRename) {
          await this.removeWorkspaceFileFromDisk(workspace._id, previousAbsPath);
        }

        // Record hash + mtime so the FS→DB side skips this echo
        this.lastWrittenHash.set(absPath, hash);
        this.lastKnownGitFilePath.set(workspace._id, absPath);
        const stat = await fs.promises.stat(absPath);
        this.lastSyncMtime.set(absPath, stat.mtimeMs);
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
    const yamlFiles = await this.collectYamlFiles(dir);
    const seenPaths = new Set<string>(yamlFiles);

    for (const absPath of yamlFiles) {
      try {
        const stat = await fs.promises.stat(absPath);
        const lastMtime = this.lastSyncMtime.get(absPath) ?? 0;
        if (stat.mtimeMs > lastMtime) {
          this.queue.enqueue(() => this.importFile(absPath));
        }
      } catch {
        // File may have been removed between readdir and stat
      }
    }

    // Detect deletions: check tracked files that no longer exist on disk
    for (const [trackedPath] of this.lastSyncMtime) {
      if (!seenPaths.has(trackedPath)) {
        this.queue.enqueue(() => this.importFile(trackedPath));
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
    // ── Check if file still exists ───────────────────────────────────
    let fileStat: fs.Stats;
    try {
      fileStat = await fs.promises.stat(absPath);
    } catch {
      await this.handleFileDeletion(normalised);
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
    const firstLine = content.split('\n')[0].trim();
    if (!InsomniaFileTypeValues.some(t => firstLine.includes(t))) {
      return null;
    }

    if (content.split('\n').some(l => l.startsWith('<<<<<<<') || l.startsWith('>>>>>>>'))) {
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
    const deletedDocs = originDocs.filter(
      originDoc => !docs.some(d => d._id === originDoc._id) && models.canSync(originDoc),
    );
    for (const doc of deletedDocs) {
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

    // Find the workspace whose gitFilePath matches this deleted file
    const entries = await this.getWorkspacesWithMeta();
    for (const { workspace, meta } of entries) {
      if (meta?.gitFilePath === relPath) {
        console.log('[repo-file-watcher] File deleted, removing workspace:', workspace._id, relPath);
        await this.removeWorkspaceWithDescendants(workspace);
        this.notifyRenderer();
        break;
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
        await db.unsafeRemove(doc);
      }
    } finally {
      await db.flushChanges(bufferId);
    }
  }

  /** Fetch all workspaces in this project together with their metadata. */
  private async getWorkspacesWithMeta(): Promise<{ workspace: Workspace; meta: WorkspaceMeta | undefined }[]> {
    const workspaces = await db.find<Workspace>(models.workspace.type, { parentId: this.projectId });
    const results: { workspace: Workspace; meta: WorkspaceMeta | undefined }[] = [];
    for (const workspace of workspaces) {
      const meta = await db.findOne<WorkspaceMeta>(models.workspaceMeta.type, {
        parentId: workspace._id,
      });
      results.push({ workspace, meta });
    }
    return results;
  }

  private isInGitDir(absPath: string): boolean {
    const rel = path.relative(this.repoDir, absPath);
    return rel.startsWith(GIT_DIR + path.sep) || rel === GIT_DIR;
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
    for (const entry of entries) {
      const absPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === GIT_DIR) {
          continue;
        }
        const nested = await this.collectYamlFiles(absPath);
        result.push(...nested);
      } else if (entry.isFile() && entry.name.endsWith('.yaml')) {
        result.push(path.normalize(absPath));
      }
    }
    return result;
  }

  /**
   * Remove workspaces from the DB whose YAML file no longer exists on disk.
   * Handles the case where a workspace was deleted on the remote and the user
   * pulls / checks out a branch that doesn't contain it.
   */
  private async removeOrphanedWorkspaces(currentDiskFiles: string[]): Promise<void> {
    const diskFileSet = new Set(currentDiskFiles.map(f => path.normalize(f)));
    const entries = await this.getWorkspacesWithMeta();
    for (const { workspace, meta } of entries) {
      if (!meta?.gitFilePath) {
        continue;
      }

      const absPath = path.normalize(path.join(this.repoDir, meta.gitFilePath));
      if (!diskFileSet.has(absPath)) {
        // Workspace YAML no longer on disk — remove from DB
        console.log('[repo-file-watcher] Removing orphaned workspace:', workspace._id);
        await this.removeWorkspaceWithDescendants(workspace);
      }
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
  importAllFiles(repoId: string): Promise<void> {
    const watcher = this.watchers.get(repoId);
    if (!watcher) {
      return Promise.resolve();
    }
    return watcher.importAllFiles();
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

/** Default notifier that broadcasts to all Electron BrowserWindows. */
export function createElectronNotifier(): WatcherNotifier {
  return {
    onDbSynced: () => {
      for (const w of BrowserWindow.getAllWindows()) {
        w.webContents.send('git.db-synced');
      }
    },
    onProblemsChanged: payload => {
      for (const w of BrowserWindow.getAllWindows()) {
        w.webContents.send('git.file-problems-changed', payload);
      }
    },
  };
}
