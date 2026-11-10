import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Collection } from "@package/models/collection";
import type { Cookie } from "@package/models/cookie";
import type { EventStreamRequest } from "@package/models/event-stream-request";
import type { HttpRequest } from "@package/models/http-request";
import { expect } from "@playwright/test";

import { BaseFlow } from "./base.flow";

export type CookieTarget =
  | Collection
  | HttpRequest
  | EventStreamRequest;

export class CookieFlow extends BaseFlow {
  /**
   * Reads the current cookie jar, opening it from `item`'s location.
   */
  private async get(item: CookieTarget): Promise<Cookie[]> {
    await this.openTarget(item);

    await this.pageManager.cookiePage.open();
    const cookies = await this.pageManager.cookiePage.getCookies();
    await this.pageManager.cookiePage.close();
    return cookies;
  }

  /**
   * Replaces the entire cookie jar with `cookies`, opening the jar from
   * `item`'s location, then reads it back.
   */
  async link<T extends CookieTarget>(
    item: T,
    cookies: Cookie[],
  ): Promise<Cookie[]> {
    await this.openTarget(item);

    await this.pageManager.cookiePage.open();
    await this.pageManager.cookiePage.setCookies(cookies);
    await this.pageManager.cookiePage.close();
    await this.waitForPersisted(item, cookies);

    // The freshly opened list can briefly render pre-edit rows (e.g. the
    // default `foo=bar`), so poll until it reflects what was just written.
    let list: Cookie[] = [];
    await expect(async () => {
      list = await this.get(item);
      expect(list).toEqual(
        expect.arrayContaining(
          cookies.map((c) =>
            expect.objectContaining({ key: c.key, value: c.value }),
          ),
        ),
      );
    }).toPass({ timeout: DEFAULT_TIMEOUT });
    return list;
  }

  /**
   * Polls the app's `CookieJar` documents until it contains
   * every one of `cookies` by key/value, re-running the whole
   * open→setCookies→close write once per mismatch. The dialog's unmount
   * can cancel the app's debounced save, so a lost cookie write has to be
   * repeated, not only waited for.
   */
  private async waitForPersisted(
    item: CookieTarget,
    cookies: Cookie[],
  ): Promise<void> {
    const isPersisted = async (): Promise<boolean> => {
      const persisted = (
        await this.pageManager.findDocs("insomnia.CookieJar.db")
      ).flatMap((doc) => doc.cookies ?? []);

      return cookies.every((cookie) =>
        persisted.some(
          (c: any) => c.key === cookie.key && c.value === cookie.value,
        ),
      );
    };

    await expect(async () => {
      if (!(await isPersisted())) {
        await this.openTarget(item);
        await this.pageManager.cookiePage.open();
        await this.pageManager.cookiePage.setCookies(cookies);
        await this.pageManager.cookiePage.close();
      }
      expect(await isPersisted()).toBe(true);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
  }

  private async openTarget(item: CookieTarget): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(item);
    await workspace.clickNode(node);
  }
}
