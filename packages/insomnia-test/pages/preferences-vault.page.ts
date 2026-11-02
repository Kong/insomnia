import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT } from "../misc/constants";
import { PreferencesTabPage } from "./preferences-tab.page";

/**
 * The vault key controls on the Preferences dialog's General tab (Security
 * section): generating a key and the "Enter vault key" modal.
 */
export class PreferencesVaultPage extends PreferencesTabPage {
  /**
   * Clicks "Generate Vault Key" (General tab, Security section) and waits
   * for the freshly-generated key to render. Only shown when no vault salt
   * exists yet for this session — see `openEnterVaultKeyModal()` for the
   * already-salted case.
   */
  async generateVaultKey(): Promise<string> {
    await this.dialog
      .getByRole("button", { name: "Generate Vault Key" })
      .click();
    const panel = this.dialog.getByTestId("VaultKeyDisplayPanel");
    let value = "";
    await expect(async () => {
      value = (await panel.innerText()).trim();
      expect(value.length).toBeGreaterThan(0);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
    return value;
  }

  /**
   * Reads the General tab's currently-displayed vault key, once already
   * unlocked (see `generateVaultKey()`/`enterVaultKey()`).
   */
  async getVaultKey(): Promise<string> {
    return (
      await this.dialog.getByTestId("VaultKeyDisplayPanel").innerText()
    ).trim();
  }

  /**
   * Clicks "Enter Vault Key" (General tab, Security section) and waits for
   * the input-vault-key-modal to appear. Only shown once a vault salt
   * exists for this session but the local vault key doesn't (e.g. after a
   * re-login) — see `generateVaultKey()` for the no-salt-yet case.
   */
  async openEnterVaultKeyModal(): Promise<void> {
    await this.dialog.getByRole("button", { name: "Enter Vault Key" }).click();
    await expect(this.page.getByTestId("input-vault-key-modal")).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Fills the open input-vault-key-modal's "Vault Key Input" field. Must be
   * called with `openEnterVaultKeyModal()` already open.
   */
  async fillVaultKeyInput(key: string): Promise<void> {
    await this.page.getByLabel("Vault Key Input").fill(key);
  }

  /**
   * Clicks "Unlock" in the open input-vault-key-modal, submitting whatever
   * was filled via `fillVaultKeyInput()`.
   */
  async clickUnlockVaultKey(): Promise<void> {
    await this.page.getByRole("button", { name: "Unlock" }).click();
  }

  /**
   * Reports whether the input-vault-key-modal is currently open — `false`
   * means a just-submitted `clickUnlockVaultKey()` succeeded and the modal
   * closed itself.
   */
  private async isEnterVaultKeyModalOpen(): Promise<boolean> {
    return this.page.getByTestId("input-vault-key-modal").isVisible();
  }

  /**
   * Reads the open input-vault-key-modal's validation error text (e.g.
   * "Invalid vault key, please check and input again"). Empty if no error
   * is currently shown.
   */
  private async getVaultKeyModalError(): Promise<string> {
    return (
      (await this.page
        .getByTestId("input-vault-key-modal")
        .getByTestId("input-vault-key-error")
        .textContent()) ?? ""
    ).trim();
  }

  /**
   * Waits for a just-clicked "Unlock" to resolve to its final outcome —
   * either the modal closing on its own (key accepted) or the error field
   * settling on a message (key rejected). Same wait-past-a-stale-read shape
   * as `waitForNewPluginOutcome()`.
   */
  async waitForVaultKeyUnlockOutcome(): Promise<string | null> {
    let error: string | null = null;
    await expect(async () => {
      if (!(await this.isEnterVaultKeyModalOpen())) {
        error = null;
        return;
      }
      const current = await this.getVaultKeyModalError();
      expect(current).not.toBe("");
      error = current;
    }).toPass({ timeout: DEFAULT_TIMEOUT });
    return error;
  }

  /**
   * Closes the input-vault-key-modal via its own "X" close button, without
   * closing Preferences itself. A no-op if the modal already closed on its
   * own (e.g. after a successful `clickUnlockVaultKey()`).
   * Unlike most dialogs in this app, this one has no `isDismissable`
   * overlay behavior — Escape does nothing — so it is closed through its
   * "Close" button (rendered in its title row).
   */
  async closeEnterVaultKeyModal(): Promise<void> {
    const modal = this.page.getByTestId("input-vault-key-modal");
    if (!(await this.isEnterVaultKeyModalOpen())) return;
    await modal.getByRole("button", { name: "Close" }).click();
    await expect(modal).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Resets the vault key from within the open input-vault-key-modal via its
   * "Reset Vault Key" confirm button (first click arms it, second/dblclick
   * confirms), waits for the modal to show the freshly-generated
   * replacement key, then dismisses the modal via its "OK" button. Must be
   * called with `openEnterVaultKeyModal()` already open.
   */
  async resetVaultKeyFromModal(): Promise<string> {
    const modal = this.page.getByTestId("input-vault-key-modal");
    await modal.getByRole("button", { name: "Reset Vault Key" }).dblclick();
    const panel = modal.getByTestId("VaultKeyDisplayPanel");
    let value = "";
    await expect(async () => {
      value = (await panel.innerText()).trim();
      expect(value.length).toBeGreaterThan(0);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
    await modal.getByRole("button", { name: "OK" }).click();
    await expect(modal).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    return value;
  }
}
