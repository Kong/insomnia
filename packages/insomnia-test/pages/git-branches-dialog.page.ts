import { ModalComponent } from "@package/components/modal.component";
import { TableComponent } from "@package/components/table.component";

import { BasePage } from "./base.page";

/**
 * The Git "Branches" modal (create / checkout / delete / merge) and the
 * "Resolve conflicts" modal a merge can open. Opened from the Git Sync
 * dropdown via `GitSyncPage.openBranchesDialog()`.
 */
export class GitBranchesDialogPage extends BasePage {
  private readonly branchesModal = new ModalComponent(
    this.page,
    this.page.getByRole("dialog", { name: "Branches" }),
  );
  private readonly mergeConflictsModal = new ModalComponent(
    this.page,
    this.page.getByRole("dialog", { name: "Resolve conflicts" }),
  );

  /**
   * Waits for the Branches modal to be visible.
   */
  async navigate(): Promise<void> {
    await this.branchesModal.waitForVisible();
  }

  /**
   * Resolves every conflicted file listed in the "Resolve conflicts" modal
   * by taking the same side for each (via "Take all current/incoming
   * changes" in the merge editor, confirming the prompt), then submits and waits for the modal to
   * close. Call after `mergeBranch()` or `pull()` hit conflicts.
   */
  async resolveMergeConflicts(version: "Current" | "Incoming"): Promise<void> {
    await this.mergeConflictsModal.waitForVisible();
    const rows = new TableComponent(
      this.page,
      this.mergeConflictsModal.root.getByRole("grid", { name: "Conflicted changes" }),
    ).rows;
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      await rows.nth(i).click();
      await this.mergeConflictsModal.root
        .getByRole("button", {
          name: `Take all ${version.toLowerCase()} changes`,
        })
        .click();
      await this.page.getByRole("button", { name: "Confirm" }).click();
    }
    await this.mergeConflictsModal.root
      .getByRole("button", { name: "Resolve conflicts" })
      .click();
    await this.mergeConflictsModal.waitForHidden();
  }

  /**
   * Whether the "Resolve conflicts" modal is currently open.
   */
  async isMergeConflictsDialogOpen(): Promise<boolean> {
    return this.mergeConflictsModal.root.isVisible();
  }

  /**
   * Whether an Insomnia schema-validation error ("Invalid input") is
   * currently shown on screen, e.g. after a pull tried to parse a file that
   * isn't an Insomnia file.
   */
  async isValidationErrorShown(): Promise<boolean> {
    return this.page.getByText("Invalid input").isVisible();
  }

  /**
   * Waits for the "Resolve conflicts" modal and reads the file names listed
   * in its "Conflicted changes" grid, without resolving anything.
   */
  async getConflictedFiles(): Promise<string[]> {
    await this.mergeConflictsModal.waitForVisible();
    const rows = new TableComponent(
      this.page,
      this.mergeConflictsModal.root.getByRole("grid", { name: "Conflicted changes" }),
    ).rows;
    return (await rows.allInnerTexts()).map((text) => text.trim());
  }
}
