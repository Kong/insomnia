import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import type { RequestHeader } from "insomnia-data";

import type { HttpMethod } from "../enums/http-method";
import type { MockBodyType } from "../enums/mock-body-type";
import { DEFAULT_TIMEOUT } from "../misc/constants";
import type { MockRouteHistoryEntry } from "../models/mock-route";
import { BasePage } from "./base.page";

type RequestTab = "content-type" | "headers" | "status";
type ResponseTab = "preview" | "headers" | "timeline" | "history";

export class MockServerPage extends BasePage {
  private readonly REQUEST_PANE = '[data-testid="request-pane"]';
  private readonly RESPONSE_PANE = '[data-testid="response-pane"]';
  private readonly BODY_EDITOR = `${this.REQUEST_PANE} #mock-response-body-editor + .CodeMirror`;
  private readonly HISTORY_ROWS = `${this.RESPONSE_PANE} [role="tabpanel"] [class*="grid-cols"] > div`;
  private readonly NEW_ROUTE_BUTTON = 'button:has-text("New Mock Route")';
  private readonly ONE_LINE_EDITOR = '[data-testid="OneLineEditor"]';
  private readonly ROUTE_ROW = '[aria-label="Mock Routes"] [role="row"]';
  private readonly STATUS_CODE_INPUT = "#mock-response-status-code-editor";
  private readonly STATUS_TEXT_INPUT = "#mock-response-status-text-editor";

  /**
   * Waits for the Mock Server view's route sidebar to be visible.
   */
  async navigate(): Promise<void> {
    await expect(
      this.page.getByRole("button", { name: "New Mock Route" }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Fills the "What is your self-hosted mock server URL?" field and makes
   * sure the "Self Hosted Mock" radio is the selected hosting type. Must
   * be called while the create-mock-server dialog is open.
   * @param url - The self-hosted server's base URL
   */
  async setSelfHostedUrl(url: string): Promise<void> {
    const dialog = this.page.getByRole("dialog");
    await dialog.getByRole("radio", { name: /^Self Hosted Mock/ }).check();
    await dialog
      .getByRole("textbox", { name: "What is your self-hosted mock server URL?" })
      .fill(url);
  }

  /**
   * Opens the "New Mock Route" dialog, fills it in and submits it, then
   * waits for the new route to appear in the sidebar and returns the
   * `data-key` it settled onto.
   * @param path - The route path (must begin with `/`)
   * @param method - The HTTP method; left at the dialog's default (GET) if omitted
   * @returns The new route's id
   */
  async createRoute(path: string, method?: HttpMethod): Promise<string> {
    await this.page.locator(this.NEW_ROUTE_BUTTON).first().click();
    const dialog = this.page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Path" }).fill(path);
    if (method) {
      await dialog.locator('select[name="method"]').selectOption(method);
    }
    await dialog.getByRole("button", { name: "New Mock Route" }).click();
    await expect(dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    return this.waitForRouteId(path);
  }

  /**
   * Opens the route's "Edit Mock Route" dialog from its row's action menu,
   * applies whichever of `path`/`method` is given and submits it.
   * @param routeId - The route to edit
   * @param changes - The new path and/or method
   */
  async editRoute(
    routeId: string,
    changes: { path?: string; method?: HttpMethod },
  ): Promise<void> {
    await this.clickRouteAction(routeId, "Edit");
    const dialog = this.page.getByRole("dialog");
    if (changes.path !== undefined) {
      await dialog.getByRole("textbox", { name: "Path" }).fill(changes.path);
    }
    if (changes.method !== undefined) {
      await dialog.locator('select[name="method"]').selectOption(changes.method);
    }
    await dialog.getByRole("button", { name: "Edit Mock Route" }).click();
    await expect(dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Deletes a route through its action menu's "Delete" item and the
   * confirmation dialog, then waits for its row to disappear.
   * @param routeId - The route to delete
   */
  async deleteRoute(routeId: string): Promise<void> {
    await this.clickRouteAction(routeId, "Delete");
    const dialog = this.page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(this.routeRow(routeId)).toBeHidden({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Clicks a route's sidebar row to open it, and waits for its URL bar to
   * show that row's path.
   * @param routeId - The route to open
   */
  async openRoute(routeId: string): Promise<void> {
    await this.routeRow(routeId).click();
    await expect(this.routeRow(routeId)).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: DEFAULT_TIMEOUT },
    );
    await expect(
      this.page.locator(this.REQUEST_PANE).getByRole("button", { name: "Test" }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Reads every route name listed in the sidebar, in order.
   * @returns The route paths currently shown
   */
  async getRoutePaths(): Promise<string[]> {
    return this.page
      .locator(this.ROUTE_ROW)
      .evaluateAll((rows) =>
        rows.map(
          (row) => row.querySelector("span.truncate")?.textContent?.trim() ?? "",
        ),
      );
  }

  /**
   * Reads the method and path shown in the open route's URL bar.
   * @returns The selected route's method and path
   */
  async getOpenRoute(): Promise<{ method: string; path: string }> {
    const bar = this.page
      .locator(this.REQUEST_PANE)
      .locator("div.items-center")
      .first();
    await expect(bar).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    const [method, path] = await Promise.all([
      bar.locator("span.font-medium").innerText(),
      bar.locator("span.font-mono").innerText(),
    ]);
    return { method: method.trim(), path: path.trim() };
  }

  /**
   * Opens the "Show URL" dialog, reads the full mock URL out of it and
   * dismisses it with Cancel.
   * @returns The route's full URL on its mock server
   */
  async showUrl(): Promise<string> {
    await this.page
      .locator(this.REQUEST_PANE)
      .getByRole("button", { name: "Show URL" })
      .click();
    const dialog = this.page.getByRole("dialog");
    await expect(dialog.getByText(/https?:\/\/\S+/)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
    const url = (await dialog.innerText()).match(/https?:\/\/\S+/)![0];
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    return url;
  }

  /**
   * Switches the request pane to one of its tabs.
   * @param tab - The tab's data-key
   */
  async switchRequestTab(tab: RequestTab): Promise<void> {
    await this.page
      .locator(`${this.REQUEST_PANE} [data-key="${tab}"][role="tab"]`)
      .click();
  }

  /**
   * Switches the response pane to one of its tabs.
   * @param tab - The tab's data-key
   */
  async switchResponseTab(tab: ResponseTab): Promise<void> {
    await this.page
      .locator(`${this.RESPONSE_PANE} [data-key="${tab}"][role="tab"]`)
      .click();
  }

  /**
   * Sets the "Mock Status" tab's status code and waits for it to be
   * persisted.
   * @param statusCode - The status code to return
   */
  async setStatusCode(statusCode: number): Promise<void> {
    await this.switchRequestTab("status");
    await this.page.locator(this.STATUS_CODE_INPUT).fill(String(statusCode));
    await this.waitForPersisted(
      ["insomnia.MockRoute.db"],
      (doc) => doc.statusCode === statusCode,
    );
  }

  /**
   * Sets the "Mock Status" tab's status text and waits for it to be
   * persisted.
   * @param statusText - The status text to return
   */
  async setStatusText(statusText: string): Promise<void> {
    await this.switchRequestTab("status");
    await this.page.locator(this.STATUS_TEXT_INPUT).fill(statusText);
    await this.waitForFieldPersisted(
      ["insomnia.MockRoute.db"],
      (doc) => doc.statusText,
      statusText,
    );
  }

  /**
   * Picks a body type from the "Mock Body" tab's dropdown.
   * @param bodyType - The body type to pick
   */
  async setBodyType(bodyType: MockBodyType): Promise<void> {
    await this.switchRequestTab("content-type");
    await this.page
      .locator(`${this.REQUEST_PANE} [role="tabpanel"] button`)
      .filter({ hasText: /^Mock / })
      .first()
      .click();
    await this.page
      .getByRole("menuitem", { name: bodyType, exact: true })
      .click();
  }

  /**
   * Types the mock response body into the "Mock Body" tab's editor and
   * waits for it to be persisted.
   * @param body - The body text to return
   */
  async setBody(body: string): Promise<void> {
    await this.switchRequestTab("content-type");
    await this.setCodeMirrorValue(this.page.locator(this.BODY_EDITOR), body);
    await this.waitForFieldPersisted(
      ["insomnia.MockRoute.db"],
      (doc) => doc.body,
      body,
    );
    await this.page.locator(this.BODY_EDITOR).click();
  }

  /**
   * Replaces the "Mock Headers" tab's rows with `headers`, then waits for
   * every one of them to be persisted.
   * @param headers - The response headers to return
   */
  async setHeaders(headers: RequestHeader[]): Promise<void> {
    await this.switchRequestTab("headers");
    const panel = this.page.locator(`${this.REQUEST_PANE} [role="tabpanel"]`);
    const deleteAll = panel.locator('button:has-text("Delete all")');
    if (await deleteAll.isEnabled()) {
      await deleteAll.click();
    }
    const listbox = panel.locator('[role="listbox"]');
    for (const header of headers) {
      const key = await listbox
        .locator('[role="option"]')
        .last()
        .getAttribute("data-key");
      const row = listbox.locator(`[role="option"][data-key="${key}"]`);
      const name = row.locator(this.ONE_LINE_EDITOR).nth(0).locator(".CodeMirror");
      const value = row.locator(this.ONE_LINE_EDITOR).nth(1).locator(".CodeMirror");
      await this.setCodeMirrorValue(name, header.name);
      await this.waitForRowPersisted(
        ["insomnia.MockRoute.db"],
        (doc) => [doc.headers],
        header.name,
      );
      await this.setCodeMirrorValue(value, header.value);
      if (header.disabled) {
        await row.locator('button[aria-pressed="true"]').click();
      }
      await this.waitForRowPersisted(
        ["insomnia.MockRoute.db"],
        (doc) => [doc.headers],
        header.name,
        (row) =>
          row.value === header.value &&
          Boolean(row.disabled) === Boolean(header.disabled),
      );
      await value.click();
    }
  }

  /**
   * Moves focus off whichever editor was last edited by switching tabs, so
   * the editor's blur handler (which pushes the route to the mock server)
   * has fired. The editors' values are set programmatically, so each
   * setter clicks its editor last to give it the real focus a blur needs.
   */
  async blurEditors(): Promise<void> {
    await this.switchRequestTab("status");
    await this.switchRequestTab("content-type");
  }

  /**
   * Clicks "Test" and waits for a new response to be stored and shown.
   */
  async clickTest(): Promise<void> {
    const before = (await this.readPersistedDocs("insomnia.Response.db")).length;
    await this.page
      .locator(this.REQUEST_PANE)
      .getByRole("button", { name: "Test", exact: true })
      .click();
    await expect(async () => {
      expect(
        (await this.readPersistedDocs("insomnia.Response.db")).length,
      ).toBeGreaterThan(before);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
    await expect(
      this.page.locator(`${this.RESPONSE_PANE} [aria-live="polite"] .tag`).first(),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Reads the History tab's rows (method + full URL of each logged hit).
   * @returns The logged requests, newest first as displayed
   */
  async getHistory(): Promise<MockRouteHistoryEntry[]> {
    await this.switchResponseTab("preview");
    await this.switchResponseTab("history");
    const cells = this.page.locator(this.HISTORY_ROWS);
    await expect(cells.first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    const texts = (await cells.allInnerTexts()).map((text) => text.trim());
    const entries: MockRouteHistoryEntry[] = [];
    for (let i = 5; i + 4 < texts.length; i += 5) {
      entries.push({ method: texts[i], url: texts[i + 4] });
    }
    return entries;
  }

  /**
   * Opens the response pane's "→ Mock" tab on a request that already has a
   * response and picks the Mock Server to put the response into.
   * @param serverName - The target Mock Server's name
   */
  async openResponseToMock(serverName: string): Promise<void> {
    await this.page
      .locator(`${this.RESPONSE_PANE} [data-key="mock-response"][role="tab"]`)
      .click();
    await this.page
      .getByLabel("Choose Mock Server")
      .selectOption({ label: serverName });
  }

  /**
   * On the "→ Mock" tab, creates a new Mock Route from the response: clicks
   * "Create", optionally replaces the path the dialog pre-fills from the
   * response URL, and submits it.
   * @param path - The route path to use instead of the pre-filled one
   */
  async createRouteFromResponse(path?: string): Promise<void> {
    await this.page
      .locator(this.RESPONSE_PANE)
      .getByRole("button", { name: "Create", exact: true })
      .click();
    const dialog = this.page.getByRole("dialog");
    if (path !== undefined) {
      await dialog.getByRole("textbox", { name: "Path" }).fill(path);
    }
    await dialog.getByRole("button", { name: "Create Mock Route" }).click();
    await expect(dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * On the "→ Mock" tab, overwrites an existing Mock Route with the
   * response: picks the route and clicks "Overwrite".
   * @param routeId - The existing route to overwrite
   */
  async overwriteRouteFromResponse(routeId: string): Promise<void> {
    await this.page.getByLabel("Choose Mock Route").selectOption(routeId);
    await this.page
      .locator(this.RESPONSE_PANE)
      .getByRole("button", { name: "Overwrite" })
      .click();
  }

  /**
   * Waits for a route with `path` to be listed in the sidebar and returns
   * its id.
   * @param path - The route path to wait for
   * @returns The route's id
   */
  async findRouteId(path: string): Promise<string> {
    return this.waitForRouteId(path);
  }

  private readonly routeRow = (routeId: string): Locator =>
    this.page.locator(`${this.ROUTE_ROW}[data-key="${routeId}"]`);

  private async clickRouteAction(
    routeId: string,
    action: "Open in New Tab" | "Edit" | "Delete",
  ): Promise<void> {
    const row = this.routeRow(routeId);
    await row.hover();
    await row.getByRole("button", { name: "Mock Route Actions" }).click();
    await this.page
      .getByRole("menuitemradio", { name: action, exact: true })
      .click();
  }

  private async waitForRouteId(path: string): Promise<string> {
    const row = this.page
      .locator(this.ROUTE_ROW)
      .filter({ has: this.page.locator("span.truncate", { hasText: path }) })
      .last();
    await expect(row).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    const key = await this.waitForStableAttribute(row, "data-key");
    return key!;
  }
}
