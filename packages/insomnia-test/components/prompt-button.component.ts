import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * `base/prompt-button.tsx`: a button that needs a second click to confirm
 * (default → "Click to confirm" → loading → "Done"). `root` is the button.
 * The first click is `preventDefault`/`stopPropagation`'d, so it is safe
 * inside a dropdown.
 */
export class PromptButtonComponent extends BaseComponent {
  async clickAndConfirm(confirmMessage = "Click to confirm"): Promise<void> {
    await this.root.click();
    await expect(this.root).toContainText(confirmMessage, {
      timeout: DEFAULT_TIMEOUT,
    });
    await this.root.click();
  }

  async isAskingForConfirmation(confirmMessage = "Click to confirm"): Promise<boolean> {
    return (await this.root.innerText()).includes(confirmMessage);
  }
}
