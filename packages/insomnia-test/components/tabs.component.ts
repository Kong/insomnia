import type { Locator } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * A react-aria `Tabs` widget (`basic-components/tabs.tsx`, request/response
 * pane tabs). `root` is the container that holds both the tab list and the
 * `tabpanel`s, e.g. a request pane.
 */
export class TabsComponent extends BaseComponent {
  /** A tab by its `data-key`. */
  tab(key: string): Locator {
    return this.root.locator(`[data-key="${key}"][role="tab"]`);
  }
}
