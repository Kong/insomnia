import type { Locator, Page } from "@playwright/test";

import { BaseComponent } from "./base.component";
import { CodeEditorComponent } from "./code-editor.component";
import { TabsComponent } from "./tabs.component";

export type ResponseTab =
  | "preview"
  | "headers"
  | "cookies"
  | "test-results"
  | "mock-response"
  | "timeline";

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

  async switchTab(tab: ResponseTab): Promise<void> {
    await this.tabs.switchTo(tab);
  }

  get statusTag(): Locator {
    return this.root.getByTestId("response-status-tag");
  }

  async statusText(): Promise<string> {
    return (await this.statusTag.innerText()).trim();
  }

  /** Read-only code viewer in the preview tab. */
  get previewEditor(): CodeEditorComponent {
    return new CodeEditorComponent(this.page, this.tabs.panel.first());
  }

  async previewBody(): Promise<string> {
    await this.switchTab("preview");
    return this.previewEditor.getValue();
  }

  /** Header rows of the headers tab as `{ name: value }`. */
  async headers(): Promise<Record<string, string>> {
    await this.switchTab("headers");
    const rows = this.tabs.panel.getByRole("row");
    const out: Record<string, string> = {};
    for (const cells of await rows.evaluateAll((els) =>
      els.map((el) =>
        Array.from(el.querySelectorAll("td,th,[role='gridcell']")).map(
          (c) => c.textContent?.trim() ?? "",
        ),
      ),
    )) {
      if (cells.length >= 2) out[cells[0]] = cells[1];
    }
    return out;
  }
}
