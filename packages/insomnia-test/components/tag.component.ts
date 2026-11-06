import type { Locator } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * Response/request tags (`tags/*`): status, method, size, time, url. Only
 * the status tag has a test id; others are found by scope + text.
 */
export class StatusTagComponent extends BaseComponent {
  async text(): Promise<string> {
    return (await this.root.getByTestId("response-status-tag").innerText()).trim();
  }

  get tag(): Locator {
    return this.root.getByTestId("response-status-tag");
  }
}

/** A `.tag` pill (size / time / method). Hover shows a detail tooltip. */
export class PillTagComponent extends BaseComponent {
  async text(): Promise<string> {
    return (await this.root.innerText()).trim();
  }
}
