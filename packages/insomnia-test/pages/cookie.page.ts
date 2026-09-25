import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import type { Cookie } from "../models/cookie";
import { BasePage } from "./base.page";

const FIELD_SAVE_DELAY = 500;

function parseCookieLine(line: string): Cookie {
  const [pair, ...attrs] = line.split("; ");
  const separator = pair.indexOf("=");
  const cookie: Cookie = {
    key: pair.slice(0, separator),
    value: pair.slice(separator + 1),
  };
  for (const attr of attrs) {
    if (attr === "Secure") cookie.secure = true;
    else if (attr === "HttpOnly") cookie.httpOnly = true;
    else {
      const [name, value] = attr.split("=");
      if (name === "Domain") cookie.domain = value;
      else if (name === "Path") cookie.path = value;
      else if (name === "Expires") cookie.expires = value;
    }
  }
  return cookie;
}

export class CookiePage extends BasePage {
  private readonly editDialog = this.page.getByRole("dialog", {
    name: "Manage Cookies",
  });
  private readonly listDialog = this.page.getByRole("dialog", {
    name: "Cookies Modal",
  });

  /**
   * Closes the cookie list dialog via its "Done" button and waits for it
   * to disappear.
   */
  async close(): Promise<void> {
    await this.listDialog.getByRole("button", { name: "Done" }).click();
    await this.listDialog.waitFor({
      state: "hidden",
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Clicks "Delete All" to remove every cookie, but only if the button
   * is enabled (it's disabled when the list is already empty). The button
   * requires confirmation: the first click turns it into "Confirm", which
   * must be clicked again before it reverts back to "Delete All".
   */
  private async deleteAll(): Promise<void> {
    const button = this.listDialog.getByRole("button", { name: "Delete All" });
    if (!(await button.isEnabled())) return;
    await button.click();

    const confirm = this.listDialog.getByRole("button", { name: "Confirm" });
    if (!(await confirm.isEnabled())) return;
    await confirm.click();
  }

  /**
   * Reads and parses every cookie row currently shown in the list
   * dialog. Rows whose visible text doesn't contain a `key=value` line
   * are skipped.
   * @returns The parsed cookies currently displayed
   */
  async getCookies(): Promise<Cookie[]> {
    const rows = this.rows();
    const count = await rows.count();
    const cookies: Cookie[] = [];
    for (let i = 0; i < count; i++) {
      const lines = (await rows.nth(i).innerText())
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const cookieLine = lines.find((line) => line.includes("="));
      if (cookieLine) cookies.push(parseCookieLine(cookieLine));
    }
    return cookies;
  }

  /**
   * Waits for the "Cookies Modal" dialog to become visible, confirming
   * the cookie list page is ready for interaction.
   */
  async navigate(): Promise<void> {
    await this.listDialog.waitFor({
      state: "visible",
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Opens the cookie list dialog via the "Add Cookies" button and waits
   * for it to become visible.
   */
  async open(): Promise<void> {
    await this.page.getByRole("button", { name: "Add Cookies" }).click();
    await this.navigate();
  }

  /**
   * Replaces the entire cookie list: deletes all existing cookies, then
   * adds each of the given cookies one at a time via the "Add Cookie" +
   * edit-cookie dialog flow. Waits for the row count to actually grow by
   * one after each "Add Cookie" click before touching `rows().first()` —
   * without it, a slow re-render can leave the previous iteration's row
   * still sitting in that slot, so the new cookie's fields get written
   * into it instead of a fresh row (silently clobbering the prior cookie).
   * @param cookies - The cookies to set as the new complete list
   */
  async setCookies(cookies: Cookie[]): Promise<void> {
    await this.deleteAll();
    for (const cookie of cookies) {
      const countBeforeAdd = await this.rows().count();
      await this.listDialog.getByRole("button", { name: "Add Cookie" }).click();
      await expect(this.rows()).toHaveCount(countBeforeAdd + 1, {
        timeout: DEFAULT_TIMEOUT,
      });
      await this.rows().first().getByRole("button", { name: "Edit" }).click();
      await this.editCookie(cookie);
    }
  }

  /**
   * Edits an already-listed cookie via the edit dialog's "Raw" tab,
   * replacing its entire cookie-string in one field instead of the
   * structured per-attribute fields the "Friendly" tab exposes.
   *
   * The Raw field's `onChange` parses the string via an async IPC call
   * before it lands in the dialog's state; clicking "Done" before that
   * resolves submits the pre-edit cookie unchanged (same species of lost
   * write as `waitForPersisted` above works around for the Friendly tab).
   * So this retries the whole fill-and-submit until the list actually
   * shows the parsed result, instead of trusting a fixed delay to beat it.
   * @param existingKey - The current `key` of the cookie row to edit
   * @param rawCookieString - The full raw cookie string to set, e.g. "foo=bar; Domain=example.com; Path=/"
   */
  async editCookieRaw(
    existingKey: string,
    rawCookieString: string,
  ): Promise<void> {
    const expectedCookie = parseCookieLine(rawCookieString);

    await expect(async () => {
      await this.rows()
        .filter({ hasText: existingKey })
        .getByRole("button", { name: "Edit" })
        .click();
      await this.editDialog.waitFor({
        state: "visible",
        timeout: DEFAULT_TIMEOUT,
      });

      await this.editDialog.getByRole("tab", { name: "Raw" }).click();
      await this.editDialog
        .getByLabel("Raw Cookie String")
        .fill(rawCookieString);
      await this.page.waitForTimeout(FIELD_SAVE_DELAY);

      await this.editDialog.getByRole("button", { name: "Done" }).click();
      await this.editDialog.waitFor({
        state: "hidden",
        timeout: DEFAULT_TIMEOUT,
      });

      const cookies = await this.getCookies();
      expect(cookies).toContainEqual(expect.objectContaining(expectedCookie));
    }).toPass({ timeout: DEFAULT_TIMEOUT });
  }

  private async editCookie(cookie: Cookie): Promise<void> {
    await this.editDialog.waitFor({
      state: "visible",
      timeout: DEFAULT_TIMEOUT,
    });

    await this.fillField("CookieKey", cookie.key);
    await this.fillField("CookieValue", cookie.value);
    if (cookie.domain) await this.fillField("CookieDomain", cookie.domain);
    if (cookie.path) await this.fillField("CookiePath", cookie.path);
    if (cookie.expires) await this.fillExpires(new Date(cookie.expires));
    if (cookie.secure) {
      await this.editDialog.getByRole("checkbox", { name: "Secure" }).check();
      await this.page.waitForTimeout(FIELD_SAVE_DELAY);
    }
    if (cookie.httpOnly) {
      await this.editDialog.getByRole("checkbox", { name: "HttpOnly" }).check();
      await this.page.waitForTimeout(FIELD_SAVE_DELAY);
    }
    if (cookie.hostOnly) {
      await this.editDialog.getByRole("checkbox", { name: "HostOnly" }).check();
      await this.page.waitForTimeout(FIELD_SAVE_DELAY);
    }

    await this.editDialog.getByRole("button", { name: "Done" }).click();
    await this.editDialog.waitFor({
      state: "hidden",
      timeout: DEFAULT_TIMEOUT,
    });
  }

  private async fillExpires(expires: Date): Promise<void> {
    const pad = (n: number) => String(n).padStart(2, "0");
    const value =
      `${expires.getFullYear()}-${pad(expires.getMonth() + 1)}-${pad(expires.getDate())}` +
      `T${pad(expires.getHours())}:${pad(expires.getMinutes())}`;

    const input = this.editDialog.locator(
      '[data-testid="CookieExpires"] input',
    );
    await input.fill(value);
    await this.page.keyboard.press("Tab");
    await this.page.waitForTimeout(FIELD_SAVE_DELAY);
  }

  private async fillField(testId: string, text: string): Promise<void> {
    const field = this.editDialog.locator(`[data-testid="${testId}"]`);
    await field.locator(".CodeMirror-lines").click();
    await this.setCodeMirrorValue(field.locator(".CodeMirror"), text);
    await this.page.keyboard.press("Tab");
    await this.page.waitForTimeout(FIELD_SAVE_DELAY);
  }

  private rows(): Locator {
    return this.listDialog.getByRole("option");
  }
}
