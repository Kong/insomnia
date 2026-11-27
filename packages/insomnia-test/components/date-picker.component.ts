import type { Locator } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * react-aria `DatePicker` (`base/date-picker.tsx`,
 * `aria-label="Insomnia Date Picker"`). Fields are `spinbutton` segments
 * (month/day/year/hour/minute…).
 */
export class DatePickerComponent extends BaseComponent {
  segment(name: string | RegExp): Locator {
    return this.root.getByRole("spinbutton", { name });
  }

  /** Types each segment in order, e.g. `{ month: "1", day: "2", year: "2030" }`. */
  async fill(values: Record<string, string>): Promise<void> {
    for (const [name, value] of Object.entries(values)) {
      await this.segment(new RegExp(name, "i")).click();
      await this.root.page().keyboard.type(value);
    }
  }

  async openCalendar(): Promise<void> {
    await this.root.getByRole("button").click();
  }
}
