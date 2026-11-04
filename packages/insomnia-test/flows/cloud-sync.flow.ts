import { step } from "@package/misc/step";
import type { Project } from "@package/models/project";

import { BaseFlow } from "./base.flow";

export class CloudSyncFlow extends BaseFlow {
  /**
   * Navigates into `project`'s own dashboard (its file/collection grid),
   * where synced, local-only, and unsynced remote files are all shown as
   * cards side by side.
   */
  @step()
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
  @step()
  async fetch(name: string): Promise<void> {
    const { cloudSyncPage } = this.pageManager;
    await cloudSyncPage.backToAllProjects();
    await cloudSyncPage.fetchUnsyncedWorkspace(name);
  }


  /**
   * Stages `requestName`, commits with `message`, then pushes.
   */
  @step()
  async commitAndPush(requestName: string, message: string): Promise<void> {
    const { cloudSyncPage, cloudSyncCommitDialogPage } = this.pageManager;
    await cloudSyncPage.openCommitDialog();
    await cloudSyncCommitDialogPage.commitAndPush(requestName, message);
  }







  /**
   * Deletes an unsynced remote file directly from its project dashboard
   * card — opens the "Delete file" confirmation dialog and confirms it,
   * archiving the backend project by its own id (no local pull required).
   * Requires `openProjectDashboard()` to have already navigated there.
   */
  @step()
  async deleteUnsyncedFile(name: string): Promise<void> {
    const { cloudSyncFileDeletePage } = this.pageManager;
    await cloudSyncFileDeletePage.openFileDeleteDialog(name);
    await cloudSyncFileDeletePage.confirmFileDelete();
  }
}
