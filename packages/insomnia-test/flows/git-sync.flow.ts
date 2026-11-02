import { GitChangeList } from "@package/enums/git-change-list";
import { GitDiffView } from "@package/enums/git-diff-view";
import { step } from "@package/misc/step";
import { Commit } from "@package/models/commit";

import { BaseFlow } from "./base.flow";

export class GitSyncFlow extends BaseFlow {
  /**
   * Checks out `branch` directly from the Git Sync dropdown's branch list.
   */
  @step()
  async switchBranch(branch: string): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.switchBranch(branch);
  }

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
   * Reads the file names currently listed as staged and unstaged in the
   * Commit modal, then closes it.
   */
  @step()
  async getChanges(): Promise<{ staged: string[]; unstaged: string[] }> {
    const { gitSyncPage, gitCommitDialogPage } = this.pageManager;
    await gitSyncPage.openCommitDialog();
    const staged = await gitCommitDialogPage.getStagedChanges();
    const unstaged = await gitCommitDialogPage.getUnstagedChanges();
    await gitCommitDialogPage.closeCommitDialog();
    return { staged, unstaged };
  }

  /**
   * Stages each of `fileNames` individually from the Commit modal, then
   * closes it.
   */
  @step()
  async stageChanges(fileNames: string[]): Promise<void> {
    const { gitSyncPage, gitCommitDialogPage } = this.pageManager;
    await gitSyncPage.openCommitDialog();
    for (const fileName of fileNames) {
      await gitCommitDialogPage.stageChange(fileName);
    }
    await gitCommitDialogPage.closeCommitDialog();
  }

  /**
   * Unstages each of `fileNames` individually from the Commit modal, then
   * closes it.
   */
  @step()
  async unstageChanges(fileNames: string[]): Promise<void> {
    const { gitSyncPage, gitCommitDialogPage } = this.pageManager;
    await gitSyncPage.openCommitDialog();
    for (const fileName of fileNames) {
      await gitCommitDialogPage.unstageChange(fileName);
    }
    await gitCommitDialogPage.closeCommitDialog();
  }

  /**
   * Commits only what is already staged (nothing is staged for you),
   * closes the Commit modal if it's still open, and reads the resulting
   * commit back from History.
   */
  @step()
  async commitStaged(message: string): Promise<Commit> {
    const { gitSyncPage, gitCommitDialogPage, gitHistoryDialogPage } = this.pageManager;
    await gitSyncPage.openCommitDialog();
    await gitCommitDialogPage.commitStaged(message);
    await gitCommitDialogPage.waitForNothingStaged();
    if (await gitCommitDialogPage.isCommitDialogOpen()) {
      await gitCommitDialogPage.closeCommitDialog();
    }

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
   * Discards every uncommitted local change.
   */
  @step()
  async discardAllChanges(): Promise<void> {
    const { gitSyncPage, gitCommitDialogPage } = this.pageManager;
    await gitSyncPage.openCommitDialog();
    await gitCommitDialogPage.discardAllChanges();
  }

  /**
   * Creates `branch` from the current branch, which switches to it
   * immediately.
   */
  @step()
  async createBranch(branch: string): Promise<void> {
    const { gitSyncPage, gitBranchesDialogPage } = this.pageManager;
    await gitSyncPage.openBranchesDialog();
    await gitBranchesDialogPage.createBranch(branch);
    await gitBranchesDialogPage.closeBranchesDialog();
  }

  /**
   * Attempts to create `branch` from the Branches modal and reads back the
   * validation error the app shows instead, then closes the modal.
   */
  @step()
  async createBranchExpectingError(branch: string): Promise<string> {
    const { gitSyncPage, gitBranchesDialogPage } = this.pageManager;
    await gitSyncPage.openBranchesDialog();
    await gitBranchesDialogPage.submitNewBranch(branch);
    const error = await gitBranchesDialogPage.getNewBranchError();
    await gitBranchesDialogPage.closeBranchesDialog();
    return error;
  }

  /**
   * Reads the local and remote-only branch lists from the Branches modal,
   * then closes it.
   */
  @step()
  async getBranches(): Promise<{ local: string[]; remote: string[] }> {
    const { gitSyncPage, gitBranchesDialogPage } = this.pageManager;
    await gitSyncPage.openBranchesDialog();
    const local = await gitBranchesDialogPage.getLocalBranches();
    const remote = await gitBranchesDialogPage.getRemoteBranches();
    await gitBranchesDialogPage.closeBranchesDialog();
    return { local, remote };
  }

  /**
   * Fetches `branch` (a branch that exists only on the remote) and checks
   * it out via the Branches modal.
   */
  @step()
  async checkoutRemoteBranch(branch: string): Promise<void> {
    const { gitSyncPage, gitBranchesDialogPage } = this.pageManager;
    await gitSyncPage.openBranchesDialog();
    await gitBranchesDialogPage.checkoutRemoteBranch(branch);
    await gitBranchesDialogPage.closeBranchesDialog();
  }

  /**
   * Fetches from the remote via the Git Sync dropdown.
   */
  @step()
  async fetch(): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.fetch();
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
   * Pushes the current branch's commits to the remote via the Git Sync
   * dropdown's standalone "Push" action.
   */
  @step()
  async push(): Promise<void> {
    const { gitSyncPage } = this.pageManager;
    await gitSyncPage.push();
  }

  /**
   * Merges `branch` into whichever branch is currently checked out.
   */
  @step()
  async mergeBranch(branch: string): Promise<void> {
    const { gitSyncPage, gitBranchesDialogPage } = this.pageManager;
    await gitSyncPage.openBranchesDialog();
    await gitBranchesDialogPage.mergeBranch(branch);
    await gitBranchesDialogPage.closeBranchesDialog();
  }

  /**
   * Merges `branch` into the current branch, expecting conflicts, and
   * resolves all of them by taking the same side.
   */
  @step()
  async mergeBranchResolvingConflicts(
    branch: string,
    version: "Current" | "Incoming",
  ): Promise<void> {
    const { gitSyncPage, gitBranchesDialogPage } = this.pageManager;
    await gitSyncPage.openBranchesDialog();
    await gitBranchesDialogPage.mergeBranch(branch);
    await gitBranchesDialogPage.resolveMergeConflicts(version);
    await gitBranchesDialogPage.closeBranchesDialog();
  }

  /**
   * Checks out `switchToBranch` (since a branch can't be deleted while
   * checked out) and deletes `branch`.
   */
  @step()
  async deleteBranch(branch: string, switchToBranch = "master"): Promise<void> {
    const { gitSyncPage, gitBranchesDialogPage } = this.pageManager;
    await gitSyncPage.openBranchesDialog();
    await gitBranchesDialogPage.checkoutBranch(switchToBranch);
    await gitBranchesDialogPage.deleteBranch(branch);
    await gitBranchesDialogPage.closeBranchesDialog();
  }

  /**
   * Like `commitStaged()`, but for staged files with unknown fields: after
   * clicking Commit, continues past the "Unrecognized Fields" confirmation
   * before reading the resulting commit back from History.
   */
  @step()
  async commitStagedConfirmingUnknownFields(message: string): Promise<Commit> {
    const { gitSyncPage, gitCommitDialogPage, gitHistoryDialogPage } = this.pageManager;
    await gitSyncPage.openCommitDialog();
    await gitCommitDialogPage.commitStaged(message);
    await gitCommitDialogPage.confirmUnknownFieldsCommit();
    await gitCommitDialogPage.waitForCommitToFinish();
    if (await gitCommitDialogPage.isCommitDialogOpen()) {
      await gitCommitDialogPage.closeCommitDialog();
    }

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
   * Opens a file's diff and discards it, confirming the dialog, without
   * waiting for the file to leave the unstaged list (so it also works for a
   * change that comes straight back), then closes the modal.
   */
  @step()
  async discardChangeAfterReview(fileName: string): Promise<void> {
    const { gitSyncPage, gitCommitDialogPage } = this.pageManager;
    await gitSyncPage.openCommitDialog();
    await gitCommitDialogPage.openChangeDiff(GitChangeList.Unstaged, fileName);
    await gitCommitDialogPage.openDiscardConfirmation(fileName);
    await gitCommitDialogPage.confirmDiscard();
    await gitCommitDialogPage.closeCommitDialog();
  }

  /**
   * Opens the Commit modal (if it isn't already open), selects a file in
   * the given list and switches its diff pane to the Visual (Beta) view.
   */
  @step()
  async openVisualDiff(list: GitChangeList, fileName: string): Promise<void> {
    const { gitSyncPage, gitCommitDialogPage } = this.pageManager;
    if (!(await gitCommitDialogPage.isCommitDialogOpen())) {
      await gitSyncPage.openCommitDialog();
    }
    await gitCommitDialogPage.openChangeDiff(list, fileName);
    await gitCommitDialogPage.switchDiffView(GitDiffView.Visual);
  }

  /**
   * Stages one entity from its card in the Visual view of an unstaged file.
   */
  @step()
  async stageEntity(fileName: string, entityName: string, typeLabel?: string): Promise<void> {
    const { gitCommitDialogPage } = this.pageManager;
    await this.openVisualDiff(GitChangeList.Unstaged, fileName);
    await gitCommitDialogPage.stageEntity(entityName, typeLabel);
  }

  /**
   * Unstages one entity from its card in the Visual view of a staged file.
   */
  @step()
  async unstageEntity(fileName: string, entityName: string, typeLabel?: string): Promise<void> {
    const { gitCommitDialogPage } = this.pageManager;
    await this.openVisualDiff(GitChangeList.Staged, fileName);
    await gitCommitDialogPage.unstageEntity(entityName, typeLabel);
  }

  /**
   * Discards one entity from its card in the Visual view of an unstaged
   * file, confirming the prompt.
   */
  @step()
  async discardEntity(fileName: string, entityName: string, typeLabel?: string): Promise<void> {
    const { gitCommitDialogPage } = this.pageManager;
    await this.openVisualDiff(GitChangeList.Unstaged, fileName);
    await gitCommitDialogPage.startEntityDiscard(entityName, typeLabel);
    await gitCommitDialogPage.confirmEntityDiscard(entityName, typeLabel);
  }
}
