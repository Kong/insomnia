import { step } from "@package/misc/step";
import { Commit } from "@package/models/commit";

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
  async resolvePullConflicts(version: "Current" | "Incoming"): Promise<void> {
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
}
