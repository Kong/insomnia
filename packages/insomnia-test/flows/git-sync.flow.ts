import { Commit } from "../models/commit";
import { BaseFlow } from "./base.flow";

export class GitSyncFlow extends BaseFlow {
  /**
   * Checks out `branch` directly from the Git Sync dropdown's branch list.
   * @param branch - The branch to check out
   */
  async switchBranch(branch: string): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.switchBranch(branch);
  }

  /**
   * Stages all changes, commits with `message` (no push), and reads back
   * the resulting commit's id from History.
   * @param message - The commit message
   * @returns The created Commit, with `id` populated
   */
  async commit(message: string): Promise<Commit> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.openCommitDialog();
    await gitSyncPage.commit(message);

    await gitSyncPage.openHistory();
    const latest = await gitSyncPage.getLatestCommit();
    await gitSyncPage.closeHistory();

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
   * @param message - The commit message
   * @returns The created Commit, with `id` populated
   */
  async commitAndPush(message: string): Promise<Commit> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.openCommitDialog();
    await gitSyncPage.commitAndPush(message);

    await gitSyncPage.openHistory();
    const latest = await gitSyncPage.getLatestCommit();
    await gitSyncPage.closeHistory();

    return this.assertCreated(
      latest
        ? Object.assign(new Commit(latest.message), { id: latest.id })
        : undefined,
      message,
    );
  }

  /**
   * Discards every uncommitted local change.
   */
  async discardAllChanges(): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.openCommitDialog();
    await gitSyncPage.discardAllChanges();
  }

  /**
   * Creates `branch` from the current branch, which switches to it
   * immediately.
   * @param branch - The new branch's name
   */
  async createBranch(branch: string): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.openBranchesDialog();
    await gitSyncPage.createBranch(branch);
    await gitSyncPage.closeBranchesDialog();
  }

  /**
   * Merges `branch` into whichever branch is currently checked out.
   * @param branch - The branch to merge in
   */
  async mergeBranch(branch: string): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.openBranchesDialog();
    await gitSyncPage.mergeBranch(branch);
    await gitSyncPage.closeBranchesDialog();
  }

  /**
   * Checks out `switchToBranch` (since a branch can't be deleted while
   * checked out) and deletes `branch`.
   * @param branch - The branch to delete
   * @param switchToBranch - The branch to check out first; defaults to "master"
   */
  async deleteBranch(branch: string, switchToBranch = "master"): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.openBranchesDialog();
    await gitSyncPage.checkoutBranch(switchToBranch);
    await gitSyncPage.deleteBranch(branch);
    await gitSyncPage.closeBranchesDialog();
  }
}
