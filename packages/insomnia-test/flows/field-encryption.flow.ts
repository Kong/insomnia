import { ModalComponent } from "@package/components/modal.component";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { step } from "@package/misc/step";
import { expect } from "@playwright/test";

import { BaseFlow } from "./base.flow";

type Answer = "continue" | "cancel";

/**
 * The user-facing side of the local database field encryption: the Local
 * Encryption Key section of Preferences (Copy Key / Export Key) and the two
 * startup dialogs — A "The local encryption key is not available" and B
 * "Some encrypted data could not be decrypted".
 */
export class FieldEncryptionFlow extends BaseFlow {
  // --- Preferences > General > Local Encryption Key ---------------------

  /** Opens Preferences and waits until the Local Encryption Key section has settled. */
  @step()
  async openKeyPanel(): Promise<void> {
    const { preferences, localEncryptionKey } = this.pageManager;
    await preferences.open();
    await localEncryptionKey.waitUntilSettled();
  }

  @step()
  async closeKeyPanel(): Promise<void> {
    await this.pageManager.preferences.close();
  }

  /** Whether Copy Key and Export Key are enabled in the open panel. */
  @step()
  async areKeyButtonsEnabled(): Promise<boolean> {
    return this.pageManager.localEncryptionKey.areButtonsEnabled();
  }

  /** The notice shown instead of a usable key, or undefined when the key is available. */
  @step()
  async getKeyUnavailableNotice(): Promise<string | undefined> {
    const notice = this.pageManager.localEncryptionKey.unavailableNotice;
    return (await notice.isVisible()) ? (await notice.innerText()).trim() : undefined;
  }

  /**
   * Copy Key: clicks it, reads the confirmation's text, answers it, and
   * returns what was on the confirmation and, for "continue", what the
   * button then shows.
   */
  @step()
  async copyKey(answer: Answer = "continue"): Promise<{ warning: string; buttonText: string }> {
    const { localEncryptionKey } = this.pageManager;
    await localEncryptionKey.copyButton.click();
    const warning = await this.readConfirmationAndAnswer(answer);
    if (answer === "continue") {
      await expect(localEncryptionKey.copyButton).toContainText("Copied", { timeout: DEFAULT_TIMEOUT });
    }
    return { warning, buttonText: (await localEncryptionKey.copyButton.innerText()).trim() };
  }

  /**
   * Export Key: clicks it and answers the confirmation. The native save
   * dialog that follows is stubbed to resolve `filePath` — or, when
   * `filePath` is undefined, to a cancelled dialog. Resolves with the
   * confirmation's text and the file name the save dialog suggested.
   */
  @step()
  async exportKey(
    answer: Answer = "continue",
    filePath?: string,
  ): Promise<{ warning: string; suggestedPath: string | undefined }> {
    const { localEncryptionKey } = this.pageManager;
    const app = this.context.electronApp!;
    await app.evaluate(({ dialog }, target) => {
      (globalThis as any).__saveDialogOptions = undefined;
      dialog.showSaveDialog = (async (...args: any[]) => {
        (globalThis as any).__saveDialogOptions = args.at(-1);
        return target
          ? { canceled: false, filePath: target }
          : { canceled: true, filePath: undefined };
      }) as unknown as typeof dialog.showSaveDialog;
    }, filePath);
    await localEncryptionKey.exportButton.click();
    const warning = await this.readConfirmationAndAnswer(answer);
    if (answer === "cancel") return { warning, suggestedPath: undefined };
    await expect
      .poll(() => app.evaluate(() => (globalThis as any).__saveDialogOptions), {
        timeout: DEFAULT_TIMEOUT,
      })
      .toBeTruthy();
    const options = await app.evaluate(() => (globalThis as any).__saveDialogOptions);
    return { warning, suggestedPath: options?.defaultPath };
  }

  private async readConfirmationAndAnswer(answer: Answer): Promise<string> {
    const { confirmation } = this.pageManager.localEncryptionKey;
    await confirmation.expectOpen();
    const warning = (await confirmation.root.innerText()).trim();
    await confirmation.clickButton(answer === "continue" ? "I understand, continue" : "Cancel", false);
    await confirmation.waitForHidden();
    return warning;
  }

  /** The text currently on the system clipboard of the app. */
  @step()
  async readClipboard(): Promise<string> {
    return this.context.electronApp!.evaluate(({ clipboard }) => clipboard.readText());
  }

  @step()
  async writeClipboard(text: string): Promise<void> {
    await this.context.electronApp!.evaluate(({ clipboard }, t) => clipboard.writeText(t), text);
  }

  /** Whether an error dialog (e.g. "Could not export the local encryption key") is open. */
  @step()
  async hasErrorDialog(): Promise<boolean> {
    return this.pageManager.localEncryptionKey.errorDialog.root.isVisible();
  }

  /**
   * Asserts the app shows nothing about the field encryption: no dialog (so not the startup dialogs A and B either),
   * no progress bar. Used after a launch that migrated the data, which is meant to go unnoticed.
   */
  @step()
  async expectNoEncryptionUi(): Promise<void> {
    const { window, fieldEncryptionIssue } = this.pageManager;
    await expect(new ModalComponent(window).root).toHaveCount(0);
    await expect(window.getByRole("progressbar")).toHaveCount(0);
    await expect(fieldEncryptionIssue.root).toHaveCount(0);
  }

  /** Asserts neither startup dialog (A or B) is open; `when` names the moment in the failure message. */
  @step()
  async expectNoIssueDialog(when: string): Promise<void> {
    await expect(this.pageManager.fieldEncryptionIssue.root, `no decryption dialog ${when}`).toHaveCount(0);
  }

  // --- Startup dialogs A and B -------------------------------------------

  /** Waits for the startup dialog and reports which one it is. */
  @step()
  async waitForIssue(): Promise<"degraded" | "decryptionFailed"> {
    return this.pageManager.fieldEncryptionIssue.kind();
  }

  /** Asserts that no startup dialog is open (and stays closed for a moment). */
  @step()
  async expectNoIssue(): Promise<void> {
    await expect(this.pageManager.fieldEncryptionIssue.root).toHaveCount(0, { timeout: DEFAULT_TIMEOUT });
  }

  /** Dialog B's list: one entry per affected document with its field paths. */
  @step()
  async getAffectedFields(): Promise<{ label: string; paths: string[] }[]> {
    return this.pageManager.fieldEncryptionIssue.affectedFields();
  }

  /** Whether the open dialog ignores Esc and a click outside. */
  @step()
  async issueSurvivesEscapeAndOutsideClick(): Promise<boolean> {
    return this.pageManager.fieldEncryptionIssue.survivesEscapeAndOutsideClick();
  }

  /** Dialog B: "Reset affected fields". */
  @step()
  async resetAffectedFields(): Promise<void> {
    const issue = this.pageManager.fieldEncryptionIssue;
    await issue.clickResetFields();
    await issue.waitForHidden();
  }

  /** Dialog A "Continue" / dialog B "Continue without decryption". */
  @step()
  async continueAnyway(): Promise<void> {
    const issue = this.pageManager.fieldEncryptionIssue;
    await issue.clickContinue();
    await issue.waitForHidden();
  }

  /** Whether dialog A offers "Reset local encryption key". */
  @step()
  async canResetLocalKey(): Promise<boolean> {
    return this.pageManager.fieldEncryptionIssue.hasResetKeyButton();
  }

  /**
   * Dialog A: "Reset local encryption key". The native confirmation that
   * follows is answered by a stub.
   *
   * `confirm: false` answers its Cancel button and resolves with the
   * confirmation's buttons and message; the dialog stays open.
   *
   * `confirm: true` answers "Reset Key and Restart": the app quits by itself
   * (its own relaunch is suppressed so that the test controls the next
   * start — follow with `AppFlow.relaunch()`), and this resolves once it has.
   */
  async resetLocalKey(confirm: false): Promise<{ buttons: string[]; message: string }>;
  async resetLocalKey(confirm: true): Promise<void>;
  @step()
  async resetLocalKey(confirm: boolean): Promise<{ buttons: string[]; message: string } | void> {
    const app = this.context.electronApp!;
    await app.evaluate(({ app: electronApp, dialog }, response) => {
      (globalThis as any).__resetKeyDialog = undefined;
      dialog.showMessageBox = (async (...args: any[]) => {
        const options = args.at(-1);
        (globalThis as any).__resetKeyDialog = { buttons: options.buttons, message: options.message };
        return { response, checkboxChecked: false };
      }) as unknown as typeof dialog.showMessageBox;
      if (response !== 0) electronApp.relaunch = () => {};
    }, confirm ? 1 : 0);

    if (confirm) {
      const closed = app.waitForEvent("close", { timeout: DEFAULT_TIMEOUT });
      await this.pageManager.fieldEncryptionIssue.clickResetKey();
      await closed;
      return;
    }
    await this.pageManager.fieldEncryptionIssue.clickResetKey();
    await expect
      .poll(() => app.evaluate(() => (globalThis as any).__resetKeyDialog), { timeout: DEFAULT_TIMEOUT })
      .toBeTruthy();
    return app.evaluate(() => (globalThis as any).__resetKeyDialog);
  }
}
