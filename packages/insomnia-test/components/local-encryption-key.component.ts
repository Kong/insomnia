import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { ModalComponent } from "./modal.component";
import { PreferencesTabComponent } from "./preferences-tab.component";

/**
 * The "Local Encryption Key" section of Preferences > General: Copy Key and
 * Export Key, each behind a confirmation modal, plus the notice shown when
 * this session has no key. Assumes `PreferencesComponent.open()` has already
 * shown the dialog.
 */
export class LocalEncryptionKeyComponent extends PreferencesTabComponent {
  private get panel(): Locator {
    return this.dialog.getByTestId("local-encryption-key-panel");
  }

  get copyButton(): Locator {
    return this.panel.getByTestId("local-encryption-key-copy");
  }

  get exportButton(): Locator {
    return this.panel.getByTestId("local-encryption-key-export");
  }

  /** The "could not be loaded in this session" notice. */
  get unavailableNotice(): Locator {
    return this.panel.getByTestId("local-encryption-key-unavailable");
  }

  /** The "Keep this key private & use it only on this machine" confirmation. */
  get confirmation(): ModalComponent {
    return new ModalComponent(
      this.page,
      this.page.getByRole("dialog").filter({ hasText: "use it only on this machine" }),
    );
  }

  /** The error dialog a failed Export Key opens, e.g. "Could not export the local encryption key". */
  get errorDialog(): ModalComponent {
    return new ModalComponent(this.page, this.page.getByRole("dialog").filter({ hasText: /^Could not/ }));
  }

  /** Waits until the panel has asked the main process and settled on enabled or disabled buttons. */
  async waitUntilSettled(): Promise<void> {
    await expect(this.panel).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    // While the main process has not answered yet the buttons are disabled with no notice, like when no key exists
    await expect
      .poll(async () => (await this.copyButton.isEnabled()) || (await this.unavailableNotice.isVisible()), {
        timeout: DEFAULT_TIMEOUT,
      })
      .toBe(true);
  }

  /** Whether Copy Key and Export Key are both enabled. */
  async areButtonsEnabled(): Promise<boolean> {
    return (await this.copyButton.isEnabled()) && (await this.exportButton.isEnabled());
  }
}
