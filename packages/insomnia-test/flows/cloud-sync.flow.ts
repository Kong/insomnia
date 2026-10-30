import { DeleteMode } from "../enums/delete-mode";
import type { Project } from "../models/project";
import { BaseFlow } from "./base.flow";

export class CloudSyncFlow extends BaseFlow {
  /**
   * Navigates into `project`'s own dashboard (its file/collection grid),
   * where synced, local-only, and unsynced remote files are all shown as
   * cards side by side.
   */
  async openProjectDashboard(project: Project): Promise<void> {
    const { workspacePage, cloudSyncPage } = this.pageManager;
    const node = await workspacePage.requireItemNode({ name: project.name });
    await workspacePage.clickNode(node);
    await cloudSyncPage.waitForDashboardLoaded();
  }

  /**
   * Fetches a workspace that only exists on the Cloud Sync backend into
   * the local sidebar and navigates into it.
   */
  async fetch(name: string): Promise<void> {
    const { cloudSyncPage } = this.pageManager;
    await cloudSyncPage.backToAllProjects();
    await cloudSyncPage.fetchUnsyncedWorkspace(name);
  }

  /**
   * Discards every uncommitted local change on the current Cloud-synced
   * workspace.
   */
  async discardAllChanges(): Promise<void> {
    const { cloudSyncPage } = this.pageManager;
    await cloudSyncPage.discardAllChanges();
  }

  /**
   * Stages `requestName`, commits with `message`, then pushes.
   */
  async commitAndPush(requestName: string, message: string): Promise<void> {
    const { cloudSyncPage } = this.pageManager;
    await cloudSyncPage.openCommitDialog();
    await cloudSyncPage.commitAndPush(requestName, message);
  }

  /**
   * Stages `requestName` and commits with `message`, without pushing.
   */
  async commit(requestName: string, message: string): Promise<void> {
    const { cloudSyncPage } = this.pageManager;
    await cloudSyncPage.openCommitDialog();
    await cloudSyncPage.commit(requestName, message);
  }

  /**
   * Restores the snapshot with commit message `message` from the current
   * workspace's History.
   */
  async restoreSnapshot(message: string): Promise<void> {
    const { cloudSyncPage } = this.pageManager;
    await cloudSyncPage.openHistory();
    await cloudSyncPage.restoreSnapshot(message);
    await cloudSyncPage.closeHistory();
  }

  /**
   * Creates a new branch named `branch` off whichever branch is
   * currently checked out on the current Cloud-synced workspace.
   */
  async createBranch(branch: string): Promise<void> {
    const { cloudSyncPage } = this.pageManager;
    await cloudSyncPage.openBranchesDialog();
    await cloudSyncPage.createBranch(branch);
    await cloudSyncPage.closeBranchesDialog();
  }

  /**
   * Merges `branch` into whichever branch is currently checked out on
   * the current Cloud-synced workspace.
   */
  async mergeBranch(branch: string): Promise<void> {
    const { cloudSyncPage } = this.pageManager;
    await cloudSyncPage.openBranchesDialog();
    await cloudSyncPage.mergeBranch(branch);
    await cloudSyncPage.closeBranchesDialog();
  }

  /**
   * Merges `branch` into whichever branch is currently checked out,
   * expecting conflicts, and resolves all of them by taking the same side.
   */
  async mergeBranchResolvingConflicts(
    branch: string,
    version: "Current" | "Incoming",
  ): Promise<string[]> {
    const { cloudSyncPage } = this.pageManager;
    await cloudSyncPage.openBranchesDialog();
    await cloudSyncPage.mergeBranch(branch);
    const conflicts = await cloudSyncPage.resolveMergeConflicts(version);
    await cloudSyncPage.closeBranchesDialog();
    return conflicts;
  }

  /**
   * Deletes workspace `name` — either "Remove Local Copy" only (leaving
   * it intact on the Cloud Sync backend, still fetchable as unsynced
   * afterward) or "Delete Permanently" (removed both locally and on the
   * backend).
   */
  async delete(name: string, mode: DeleteMode): Promise<void> {
    const { cloudSyncPage } = this.pageManager;
    await cloudSyncPage.openDeleteWorkspaceDialog(name);
    await (mode === DeleteMode.Local ? cloudSyncPage.deleteWorkspaceLocalOnly() : cloudSyncPage.deleteWorkspacePermanently());
  }

  /**
   * Deletes an unsynced remote file directly from its project dashboard
   * card — opens the "Delete file" confirmation dialog and confirms it,
   * archiving the backend project by its own id (no local pull required).
   * Requires `openProjectDashboard()` to have already navigated there.
   */
  async deleteUnsyncedFile(name: string): Promise<void> {
    const { cloudSyncPage } = this.pageManager;
    await cloudSyncPage.openFileDeleteDialog(name);
    await cloudSyncPage.confirmFileDelete();
  }
}
