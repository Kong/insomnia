import { step } from "@package/misc/step";

import { BaseFlow } from "./base.flow";

export class GitSyncFlow extends BaseFlow {
  /**
   * Stages all changes, commits with `message`, then pushes.
   */
  @step()
  async commitAndPush(message: string): Promise<void> {
    const { gitSyncPage, gitCommitDialogPage } = this.pageManager;
    await gitSyncPage.openCommitDialog();
    await gitCommitDialogPage.commitAndPush(message);
  }
}
