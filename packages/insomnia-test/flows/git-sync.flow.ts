import { step } from "@package/misc/step";
import { Commit } from "@package/models/commit";

import { BaseFlow } from "./base.flow";

export class GitSyncFlow extends BaseFlow {
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
}
