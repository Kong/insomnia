import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator } from "@playwright/test";
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

/** A `ToggleButton` that exposes state through `aria-pressed`. */
export class PressedToggleComponent extends BaseComponent {
  async isOn(): Promise<boolean> {
    return (await this.root.getAttribute("aria-pressed")) === "true";
  }

  async set(enabled: boolean): Promise<void> {
    if ((await this.isOn()) === enabled) return;
    await this.root.click();
    await expect(this.root).toHaveAttribute("aria-pressed", String(enabled), {
      timeout: DEFAULT_TIMEOUT,
    });
  }
}

/** Text-labelled enable button, e.g. a certificate row's "Enabled"/"Disabled". */
export class EnabledLabelToggleComponent extends BaseComponent {
  get button(): Locator {
    return this.root.getByRole("button", { name: /^(Enabled|Disabled)$/ });
  }

  async isOn(): Promise<boolean> {
    return (await this.button.innerText()) === "Enabled";
  }

  async set(enabled: boolean): Promise<void> {
    if ((await this.isOn()) === enabled) return;
    await this.button.click();
    await expect(this.button).toHaveText(enabled ? "Enabled" : "Disabled", {
      timeout: DEFAULT_TIMEOUT,
    });
  }
}

/** react-aria `Switch` (`base/switch.tsx`), `role="switch"`. */
export class SwitchComponent extends BaseComponent {
  get control(): Locator {
    return this.root.getByRole("switch");
  }

  async isOn(): Promise<boolean> {
    return this.control.isChecked();
  }

  async set(enabled: boolean): Promise<void> {
    await this.control.setChecked(enabled);
  }
}

/** react-aria `Checkbox` (`base/checkbox.tsx`). `root` contains the checkbox. */
export class CheckboxComponent extends BaseComponent {
  get control(): Locator {
    return this.root.getByRole("checkbox");
  }

  async isChecked(): Promise<boolean> {
    return this.control.isChecked();
  }

  async set(checked: boolean): Promise<void> {
    await this.control.setChecked(checked);
  }
}

/** react-aria `RadioGroup`. `root` is the group (or any ancestor of it). */
export class RadioGroupComponent extends BaseComponent {
  radio(name: string | RegExp): Locator {
    return this.root.getByRole("radio", { name });
  }

  async select(name: string | RegExp): Promise<void> {
    await this.radio(name).check();
  }

  async selected(): Promise<string | null> {
    const checked = this.root.getByRole("radio", { checked: true });
    if ((await checked.count()) === 0) return null;
    return (await checked.first().evaluate(
      (el) => (el as HTMLInputElement).labels?.[0]?.innerText ?? el.getAttribute("aria-label"),
    ))?.trim() ?? null;
  }
}
