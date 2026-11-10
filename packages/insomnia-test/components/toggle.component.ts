import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * Icon-style toggle button: the button's inner icon carries
 * `data-testid="toggle-is-on"` / `"toggle-is-off"` (settings, auth rows).
 */
export class ToggleButtonComponent extends BaseComponent {
  async isOn(): Promise<boolean> {
    return (await this.root.getByTestId("toggle-is-on").count()) > 0;
  }

  /** Clicks only if the state differs, then waits for it to flip. */
  async set(enabled: boolean): Promise<void> {
    if ((await this.isOn()) === enabled) return;
    await this.root.click();
    await expect(async () => {
      expect(await this.isOn()).toBe(enabled);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
  }
}

