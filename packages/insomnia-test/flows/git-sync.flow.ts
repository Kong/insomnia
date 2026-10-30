import { GitChangeList } from "../enums/git-change-list";
import { GitDiffView } from "../enums/git-diff-view";
import { Commit } from "../models/commit";
import { BaseFlow } from "./base.flow";

export class GitSyncFlow extends BaseFlow {
  /**
   * Checks out `branch` directly from the Git Sync dropdown's branch list.
   */
  async switchBranch(branch: string): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.switchBranch(branch);
  }

  /**
   * Stages all changes, commits with `message` (no push), and reads back
   * the resulting commit's id from History.
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
   * Reads the file names currently listed as staged and unstaged in the
   * Commit modal, then closes it.
   */
  async getChanges(): Promise<{ staged: string[]; unstaged: string[] }> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.openCommitDialog();
    const staged = await gitSyncPage.getStagedChanges();
    const unstaged = await gitSyncPage.getUnstagedChanges();
    await gitSyncPage.closeCommitDialog();
    return { staged, unstaged };
  }

  /**
   * Stages each of `fileNames` individually from the Commit modal, then
   * closes it.
   */
  async stageChanges(fileNames: string[]): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.openCommitDialog();
    for (const fileName of fileNames) {
      await gitSyncPage.stageChange(fileName);
    }
    await gitSyncPage.closeCommitDialog();
  }

  /**
   * Unstages each of `fileNames` individually from the Commit modal, then
   * closes it.
   */
  async unstageChanges(fileNames: string[]): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.openCommitDialog();
    for (const fileName of fileNames) {
      await gitSyncPage.unstageChange(fileName);
    }
    await gitSyncPage.closeCommitDialog();
  }

  /**
   * Commits only what is already staged (nothing is staged for you),
   * closes the Commit modal if it's still open, and reads the resulting
   * commit back from History.
   */
  async commitStaged(message: string): Promise<Commit> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.openCommitDialog();
    await gitSyncPage.commitStaged(message);
    await gitSyncPage.waitForNothingStaged();
    if (await gitSyncPage.isCommitDialogOpen()) {
      await gitSyncPage.closeCommitDialog();
    }

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
   */
  async createBranch(branch: string): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.openBranchesDialog();
    await gitSyncPage.createBranch(branch);
    await gitSyncPage.closeBranchesDialog();
  }

  /**
   * Attempts to create `branch` from the Branches modal and reads back the
   * validation error the app shows instead, then closes the modal.
   */
  async createBranchExpectingError(branch: string): Promise<string> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.openBranchesDialog();
    await gitSyncPage.submitNewBranch(branch);
    const error = await gitSyncPage.getNewBranchError();
    await gitSyncPage.closeBranchesDialog();
    return error;
  }

  /**
   * Reads the local and remote-only branch lists from the Branches modal,
   * then closes it.
   */
  async getBranches(): Promise<{ local: string[]; remote: string[] }> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.openBranchesDialog();
    const local = await gitSyncPage.getLocalBranches();
    const remote = await gitSyncPage.getRemoteBranches();
    await gitSyncPage.closeBranchesDialog();
    return { local, remote };
  }

  /**
   * Fetches `branch` (a branch that exists only on the remote) and checks
   * it out via the Branches modal.
   */
  async checkoutRemoteBranch(branch: string): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.openBranchesDialog();
    await gitSyncPage.checkoutRemoteBranch(branch);
    await gitSyncPage.closeBranchesDialog();
  }

  /**
   * Fetches from the remote via the Git Sync dropdown.
   */
  async fetch(): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.fetch();
  }

  /**
   * Pulls the current branch from the remote via the Git Sync dropdown.
   */
  async pull(): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.pull();
  }

  /**
   * Pushes the current branch's commits to the remote via the Git Sync
   * dropdown's standalone "Push" action.
   */
  async push(): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.push();
  }

  /**
   * Merges `branch` into whichever branch is currently checked out.
   */
  async mergeBranch(branch: string): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.openBranchesDialog();
    await gitSyncPage.mergeBranch(branch);
    await gitSyncPage.closeBranchesDialog();
  }

  /**
   * Merges `branch` into the current branch, expecting conflicts, and
   * resolves all of them by taking the same side.
   */
  async mergeBranchResolvingConflicts(
    branch: string,
    version: "Current" | "Incoming",
  ): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.openBranchesDialog();
    await gitSyncPage.mergeBranch(branch);
    await gitSyncPage.resolveMergeConflicts(version);
    await gitSyncPage.closeBranchesDialog();
  }

  /**
   * Checks out `switchToBranch` (since a branch can't be deleted while
   * checked out) and deletes `branch`.
   */
  async deleteBranch(branch: string, switchToBranch = "master"): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.openBranchesDialog();
    await gitSyncPage.checkoutBranch(switchToBranch);
    await gitSyncPage.deleteBranch(branch);
    await gitSyncPage.closeBranchesDialog();
  }

  /**
   * Like `commitStaged()`, but for staged files with unknown fields: after
   * clicking Commit, continues past the "Unrecognized Fields" confirmation
   * before reading the resulting commit back from History.
   */
  async commitStagedConfirmingUnknownFields(message: string): Promise<Commit> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.openCommitDialog();
    await gitSyncPage.commitStaged(message);
    await gitSyncPage.confirmUnknownFieldsCommit();
    await gitSyncPage.waitForCommitToFinish();
    if (await gitSyncPage.isCommitDialogOpen()) {
      await gitSyncPage.closeCommitDialog();
    }

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
   * Opens a file's diff and discards it, confirming the dialog, without
   * waiting for the file to leave the unstaged list (so it also works for a
   * change that comes straight back), then closes the modal.
   */
  async discardChangeAfterReview(fileName: string): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.openCommitDialog();
    await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, fileName);
    await gitSyncPage.openDiscardConfirmation(fileName);
    await gitSyncPage.confirmDiscard();
    await gitSyncPage.closeCommitDialog();
  }

  /**
   * Opens the Commit modal (if it isn't already open), selects a file in
   * the given list and switches its diff pane to the Visual (Beta) view.
   */
  async openVisualDiff(list: GitChangeList, fileName: string): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    if (!(await gitSyncPage.isCommitDialogOpen())) {
      await gitSyncPage.openCommitDialog();
    }
    await gitSyncPage.openChangeDiff(list, fileName);
    await gitSyncPage.switchDiffView(GitDiffView.Visual);
  }

  /**
   * Stages one entity from its card in the Visual view of an unstaged file.
   */
  async stageEntity(fileName: string, entityName: string, typeLabel?: string): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await this.openVisualDiff(GitChangeList.Unstaged, fileName);
    await gitSyncPage.stageEntity(entityName, typeLabel);
  }

  /**
   * Unstages one entity from its card in the Visual view of a staged file.
   */
  async unstageEntity(fileName: string, entityName: string, typeLabel?: string): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await this.openVisualDiff(GitChangeList.Staged, fileName);
    await gitSyncPage.unstageEntity(entityName, typeLabel);
  }

  /**
   * Discards one entity from its card in the Visual view of an unstaged
   * file, confirming the prompt.
   */
  async discardEntity(fileName: string, entityName: string, typeLabel?: string): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await this.openVisualDiff(GitChangeList.Unstaged, fileName);
    await gitSyncPage.startEntityDiscard(entityName, typeLabel);
    await gitSyncPage.confirmEntityDiscard(entityName, typeLabel);
  }
}
