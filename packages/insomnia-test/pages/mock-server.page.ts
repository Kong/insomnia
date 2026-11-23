import { ModalComponent } from "@package/components/modal.component";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

export class MockServerPage extends BasePage {
  /**
   * Waits for the Mock Server view's route sidebar to be visible.
   */
  async navigate(): Promise<void> {
    await expect(
      this.page.getByRole("button", { name: "New Mock Route" }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Fills the "What is your self-hosted mock server URL?" field and makes
   * sure the "Self Hosted Mock" radio is the selected hosting type. Must
   * be called while the create-mock-server dialog is open.
   */
  async setSelfHostedUrl(url: string): Promise<void> {
    const dialog = new ModalComponent(this.page).root;
    const radioName = { name: /^Self Hosted Mock/ };
    const radio = dialog.getByRole("radio", radioName);
    // The radio's <input> is covered by its own label content, so check() can
    // loop on "intercepts pointer events"; click the label card instead.
    if (!(await radio.isChecked())) {
      await dialog.getByTestId("mock-server-type-self-hosted").click();
    }
    await expect(radio).toBeChecked();
    await dialog
      .getByRole("textbox", { name: "What is your self-hosted mock server URL?" })
      .fill(url);
  }
}
