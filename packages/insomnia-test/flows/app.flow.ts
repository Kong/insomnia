import { ModalComponent } from "@package/components/modal.component";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import {
  collectHiddenWindowCoverage,
  collectWindowCoverage,
  startWindowCoverage,
  trackHiddenWindowCoverage,
} from "@package/misc/coverage";
import type { FlowContext } from "@package/misc/flow-context";
import { launchInsomniaElectron } from "@package/misc/launch";
import { step } from "@package/misc/step";
import { expect } from "@playwright/test";
import type { Page } from "playwright-core";

import { BaseFlow } from "./base.flow";

export class AppFlow extends BaseFlow {
  /**
   * Closes the current Electron app and relaunches a fresh one against
   * the same `dataPath`/env (`SessionContext.launchConfig`) — for proving
   * state survives an app restart, not just a page reload. Rewires
   * `context`/`pageManager` onto the new app in place, so the same
   * `user.flowManager`/`user.pageManager` instances keep working.
   */
  @step()
  async restart(): Promise<Page> {
    const config = this.context.launchConfig;
    if (!config) {
      throw new Error(
        "AppFlow.restart() requires the SessionContext to have been constructed with a launchConfig — see misc/fixtures.ts's `user` fixture",
      );
    }

    await collectWindowCoverage(
      await this.context.electronApp!.firstWindow({
        timeout: DEFAULT_TIMEOUT,
      }),
    );
    await collectHiddenWindowCoverage(this.context.electronApp!);
    await this.context.electronApp!.close();
    return this.launchAgain(config);
  }

  /**
   * Starts the app again after it quit by itself (e.g. "Reset local
   * encryption key" restarts it), against the same `dataPath`/env as
   * `restart()`. Unlike `restart()`, it does not close the previous app.
   */
  @step()
  async relaunch(): Promise<Page> {
    const config = this.context.launchConfig;
    if (!config) {
      throw new Error(
        "AppFlow.relaunch() requires the SessionContext to have been constructed with a launchConfig — see misc/fixtures.ts's `user` fixture",
      );
    }
    return this.launchAgain(config);
  }

  private async launchAgain(
    config: NonNullable<FlowContext["launchConfig"]>,
  ): Promise<Page> {
    const app = await launchInsomniaElectron(config);
    trackHiddenWindowCoverage(app);

    const win = await app.firstWindow({ timeout: DEFAULT_TIMEOUT });
    await win.waitForLoadState(undefined, { timeout: DEFAULT_TIMEOUT });
    win.setDefaultTimeout(DEFAULT_TIMEOUT);
    await startWindowCoverage(win);
    await app.evaluate(({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows().find((w) =>
        w.isVisible(),
      );
      mainWindow?.maximize();
    });

    this.context.setElectronApp(app);
    this.pageManager.setWindow(win);
    await this.pageManager.workspacePage.navigate();

    return win;
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
