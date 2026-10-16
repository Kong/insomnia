import * as fs from "node:fs";
import path from "node:path";

import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT } from "../misc/constants";
import type { Collection } from "../models/collection";
import type { Cookie } from "../models/cookie";
import type { EventStreamRequest } from "../models/event-stream-request";
import type { GraphQLRequest } from "../models/graphql-request";
import type { GrpcRequest } from "../models/grpc-request";
import type { HttpRequest } from "../models/http-request";
import type { SocketIORequest } from "../models/socket-io-request";
import type { WebSocketRequest } from "../models/websocket-request";
import { BaseFlow } from "./base.flow";

export type CookieTarget =
  | Collection
  | HttpRequest
  | EventStreamRequest
  | GraphQLRequest
  | GrpcRequest
  | SocketIORequest
  | WebSocketRequest;

export class CookieFlow extends BaseFlow {
  /**
   * Reads the current cookie jar, opening it from `item`'s location.
   * @param item - The Collection/request whose location the Cookie Jar dialog is opened from
   * @returns The current cookie jar
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
   * @param item - The Collection/request whose location the Cookie Jar dialog is opened from
   * @param cookies - The full set of cookies the jar should contain afterward
   * @returns The cookie jar read back after setting
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
   * Polls the on-disk `CookieJar` NeDB file directly until it contains
   * every one of `cookies` by key/value, re-running the whole
   * open→setCookies→close write once per mismatch. The dialog's unmount
   * can cancel the app's debounced save, so a lost cookie write has to be
   * repeated, not only waited for.
   * @param item - The Collection/request whose location the Cookie Jar dialog is opened from, for a retry
   * @param cookies - The cookies that must all be present in the persisted jar
   */
  private async waitForPersisted(
    item: CookieTarget,
    cookies: Cookie[],
  ): Promise<void> {
    const dataPath = await this.flowManager.getDataPath();
    const dbPath = path.join(dataPath, "insomnia.CookieJar.db");

    const isPersisted = (): boolean => {
      const latestById = new Map<string, any>();
      for (const line of fs
        .readFileSync(dbPath, "utf8")
        .split("\n")
        .filter(Boolean)) {
        const doc = JSON.parse(line);
        latestById.set(doc._id, doc);
      }
      const persisted = [...latestById.values()]
        .filter((doc) => !doc.$$deleted)
        .flatMap((doc) => doc.cookies ?? []);

      return cookies.every((cookie) =>
        persisted.some(
          (c: any) => c.key === cookie.key && c.value === cookie.value,
        ),
      );
    };

    await expect(async () => {
      if (!isPersisted()) {
        await this.openTarget(item);
        await this.pageManager.cookiePage.open();
        await this.pageManager.cookiePage.setCookies(cookies);
        await this.pageManager.cookiePage.close();
      }
      expect(isPersisted()).toBe(true);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
  }

  private async openTarget(item: CookieTarget): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(item);
    await workspace.clickNode(node);
  }
}
