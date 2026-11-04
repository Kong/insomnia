import type { Locator, Page } from "@playwright/test";

import { BaseComponent } from "./base.component";
import { TabsComponent } from "./tabs.component";

/**
 * Response pane viewers (`panes/response-pane.tsx`, `viewers/*`): the tab
 * set plus the status/size/time tags. `root` is `[data-testid="response-pane"]`.
 */
export class ResponseViewerComponent extends BaseComponent {
  constructor(page: Page, root?: Locator) {
    super(page, root ?? page.getByTestId("response-pane"));
  }

  get tabs(): TabsComponent {
    return new TabsComponent(this.page, this.root);
  }
}
