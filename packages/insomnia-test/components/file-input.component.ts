import type { Locator } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * `base/file-input-button.tsx` ("Choose File") and similar pickers.
 * Electron's native dialog can't be driven, so the owning page/flow must
 * first stub it (see `FlowContext.stubFileChooser`); this component only
 * clicks and reads the button.
 */
export class FileInputComponent extends BaseComponent {
  get button(): Locator {
    return this.root.getByRole("button", { name: "Choose File" });
  }

  async choose(): Promise<void> {
    await this.button.click();
  }
}
