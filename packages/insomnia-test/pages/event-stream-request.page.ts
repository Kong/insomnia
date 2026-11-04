import { RequestPage } from "./request.page";

export class EventStreamRequestPage extends RequestPage {
  protected readonly urlBarId = "request-url-bar";

  /**
   * Navigates to the event-stream request pane, then installs a
   * `db.changes` listener (once per window) that increments
   * `window.__saveCount` each time a "Request" document is saved — used by
   * tests to assert save behavior without polling the UI. Repeat calls
   * only reset the counter.
   */
  async navigate(): Promise<void> {
    await super.navigate();
    await this.page.evaluate(() => {
      (window as any).__saveCount = 0;
      if ((window as any).__saveCountListenerInstalled) return;
      (window as any).__saveCountListenerInstalled = true;
      (window as any).main.on(
        "db.changes",
        (_: unknown, changes: [string, { type: string }][]) => {
          for (const [, doc] of changes) {
            if (doc.type === "Request") {
              (window as any).__saveCount++;
            }
          }
        },
      );
    });
  }
}
