import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import path from "node:path";

import type { ConflictResolution } from "@package/enums/conflict-resolution";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { step } from "@package/misc/step";
import { Commit } from "@package/models/commit";
import { expect } from "@playwright/test";

import { BaseFlow } from "./base.flow";

export class GitSyncFlow extends BaseFlow {

  /**
   * Stages all changes, commits with `message` (no push), and reads back
   * the resulting commit's id from History.
   */
  @step()
  async commit(message: string): Promise<Commit> {
    const { gitSyncPage, gitCommitDialogPage, gitHistoryDialogPage } = this.pageManager;
    await gitSyncPage.openCommitDialog();
    await gitCommitDialogPage.commit(message);

    await gitSyncPage.openHistory();
    const latest = await gitHistoryDialogPage.getLatestCommit();
    await gitHistoryDialogPage.closeHistory();

    return this.assertCreated(
      latest
        ? Object.assign(new Commit(latest.message), { id: latest.id })
        : undefined,
      message,
    );
  }

  /**
   * Stages all changes, commits with `message`, then pushes, and reads
   * back the resulting commit's id from History.
   */
  @step()
  async commitAndPush(message: string): Promise<Commit> {
    const { gitSyncPage, gitCommitDialogPage, gitHistoryDialogPage } = this.pageManager;
    await gitSyncPage.openCommitDialog();
    await gitCommitDialogPage.commitAndPush(message);

    await gitSyncPage.openHistory();
    const latest = await gitHistoryDialogPage.getLatestCommit();
    await gitHistoryDialogPage.closeHistory();

    return this.assertCreated(
      latest
        ? Object.assign(new Commit(latest.message), { id: latest.id })
        : undefined,
      message,
    );
  }

  /**
   * Pulls the current branch from the remote via the Git Sync dropdown.
   */
  @step()
  async pull(): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.pull();
  }

  /**
   * Pulls the current branch, expecting the "Resolve conflicts" modal to
   * open, and reads the names of the conflicted files it lists without
   * resolving anything.
   */
  @step()
  async pullExpectingConflicts(): Promise<string[]> {
    const { gitSyncPage, gitBranchesDialogPage } = this.pageManager;
    await gitSyncPage.pull();
    return gitBranchesDialogPage.getConflictedFiles();
  }

  /**
   * Resolves every conflict in the open "Resolve conflicts" modal by taking
   * the same side for each, and waits for the modal to close.
   */
  @step()
  async resolvePullConflicts(version: ConflictResolution): Promise<void> {
    const { gitBranchesDialogPage } = this.pageManager;
    await gitBranchesDialogPage.resolveMergeConflicts(version);
  }

  /**
   * Reads whether the "Resolve conflicts" modal is open and whether an
   * Insomnia validation error is shown — for asserting that a pull
   * finished on its own.
   */
  @step()
  async getPullIssues(): Promise<{ conflictModalOpen: boolean; validationErrorShown: boolean }> {
    const { gitBranchesDialogPage } = this.pageManager;
    return {
      conflictModalOpen: await gitBranchesDialogPage.isMergeConflictsDialogOpen(),
      validationErrorShown: await gitBranchesDialogPage.isValidationErrorShown(),
    };
  }

  /**
   * Reads a file from the local Git Sync clone, or `undefined` if it
   * doesn't exist.
   */
  readRepoFile(repoPath: string, file: string): string | undefined {
    const target = path.join(repoPath, file);
    return fs.existsSync(target) ? fs.readFileSync(target, "utf8") : undefined;
  }

  /**
   * Lists the names of the entries at the root of the local Git Sync clone.
   */
  listRepoFiles(repoPath: string): string[] {
    return fs.readdirSync(repoPath);
  }

  /**
   * Waits for a file to exist in the local Git Sync clone — and, when
   * `content` is given, to hold exactly that content.
   */
  @step()
  async waitForRepoFile(repoPath: string, file: string, content?: string): Promise<void> {
    await (content === undefined
      ? expect.poll(() => this.readRepoFile(repoPath, file), { timeout: DEFAULT_TIMEOUT }).toBeDefined()
      : expect.poll(() => this.readRepoFile(repoPath, file), { timeout: DEFAULT_TIMEOUT }).toBe(content));
  }

  /**
   * Waits for a file in the local Git Sync clone to contain `text` — for
   * Insomnia files the app may rewrite, where exact content can't be asserted.
   */
  @step()
  async waitForRepoFileContaining(repoPath: string, file: string, text: string): Promise<void> {
    await expect
      .poll(() => this.readRepoFile(repoPath, file), { timeout: DEFAULT_TIMEOUT })
      .toContain(text);
  }

  /**
   * Waits for a file to be gone from the local Git Sync clone.
   */
  @step()
  async waitForRepoFileDeleted(repoPath: string, file: string): Promise<void> {
    await expect
      .poll(() => this.readRepoFile(repoPath, file), { timeout: DEFAULT_TIMEOUT })
      .toBeUndefined();
  }

  /**
   * Waits for the local Git Sync clone to have no uncommitted changes.
   */
  @step()
  async waitForCleanWorktree(repoPath: string): Promise<void> {
    await expect
      .poll(
        () => execFileSync("git", ["status", "--porcelain"], { cwd: repoPath }).toString().trim(),
        { timeout: DEFAULT_TIMEOUT },
      )
      .toBe("");
  }
}
