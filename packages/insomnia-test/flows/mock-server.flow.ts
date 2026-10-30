import { expect } from "@playwright/test";

import { ContextMenuItem } from "../enums/context-menu-items";
import { DEFAULT_TIMEOUT } from "../misc/constants";
import { step } from "../misc/step";
import type { MockRoute, MockRouteHistoryEntry } from "../models/mock-route";
import { MockServer } from "../models/mock-server";
import type { Project } from "../models/project";
import type { ResponseView } from "../models/response";
import { BaseFlow } from "./base.flow";

export class MockServerFlow extends BaseFlow {
  /**
   * Creates a self-hosted Mock Server under `parent` through the project's
   * create menu and the create dialog, then re-reads it from the tree.
   */
  @step()
  async create(parent: Project, server: MockServer): Promise<MockServer> {
    const workspace = this.pageManager.workspacePage;
    const mockServerPage = this.pageManager.mockServerPage;

    const node = await workspace.resolveNode(parent);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.MockServer);
    await workspace.setNewItemName(server.name);
    await mockServerPage.setSelfHostedUrl(server.url);
    await workspace.clickCreate();

    return this.get(server.name);
  }

  /**
   * Finds a Mock Server's tree node by name/id and returns it as a model.
   */
  @step()
  async get(item: string | { name: string; id?: string }): Promise<MockServer> {
    const identity = typeof item === "string" ? { name: item } : item;
    const node = await this.pageManager.workspacePage.findItemNode(identity);
    this.assertCreated(node, identity.name);
    return Object.assign(new MockServer(identity.name, ""), { id: node!._id });
  }

  /**
   * Duplicates `server` through its context menu's "Duplicate / Move"
   * dialog.
   */
  @step()
  async duplicate(
    server: MockServer,
    newName: string,
    targetProject?: Project,
  ): Promise<MockServer> {
    const workspace = this.pageManager.workspacePage;

    const node = await workspace.resolveNode(server);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.DuplicateWorkspace);
    await workspace.setDuplicateName(newName);
    await workspace.selectDuplicateProject(targetProject?.name);
    await workspace.clickDuplicate();

    return this.get(newName);
  }

  /**
   * Exports `server` (as an Insomnia v5 YAML file) through its context
   * menu's "Export" item, writing it to `path`.
   */
  @step()
  async export(server: MockServer, path: string): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const exportPage = this.pageManager.exportPage;

    const node = await workspace.resolveNode(server);
    await exportPage.stubSaveFileLocation(path);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.Export);
  }

  /**
   * Opens `server`'s Mock Server view.
   */
  @step()
  async open(server: MockServer): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const mockServerPage = this.pageManager.mockServerPage;

    const node = await workspace.resolveNode(server);
    await workspace.clickNode(node);
    await mockServerPage.navigate();
  }

  /**
   * Opens `server`, creates `route` through the "New Mock Route" dialog and
   * then, if it carries any, configures its response (status code/text,
   * body type, body and headers).
   */
  @step()
  async createRoute(server: MockServer, route: MockRoute): Promise<MockRoute> {
    const mockServerPage = this.pageManager.mockServerPage;

    await this.open(server);
    const id = await mockServerPage.createRoute(route.path, route.method);

    const created = { ...route, id };
    await this.setResponse(created);
    return created;
  }

  /**
   * Opens `route` and fills in whichever response fields it carries —
   * status code, status text, body type, body and headers — then moves
   * focus off the last edited editor so it pushes to the server.
   */
  @step()
  async setResponse(route: MockRoute): Promise<void> {
    const mockServerPage = this.pageManager.mockServerPage;

    if (
      route.statusCode === undefined &&
      route.statusText === undefined &&
      route.bodyType === undefined &&
      route.body === undefined &&
      route.headers === undefined
    ) {
      return;
    }
    await mockServerPage.openRoute(route.id!);
    if (route.statusCode !== undefined) {
      await mockServerPage.setStatusCode(route.statusCode);
    }
    if (route.statusText !== undefined) {
      await mockServerPage.setStatusText(route.statusText);
    }
    if (route.bodyType !== undefined) {
      await mockServerPage.setBodyType(route.bodyType);
    }
    if (route.body !== undefined) {
      await mockServerPage.setBody(route.body);
    }
    if (route.headers !== undefined) {
      await mockServerPage.setHeaders(route.headers);
    }
    await mockServerPage.blurEditors();
  }

  /**
   * Opens `route` and edits its path and/or method through its action
   * menu's "Edit" dialog.
   */
  @step()
  async editRoute(
    route: MockRoute,
    changes: Pick<MockRoute, "path" | "method">,
  ): Promise<MockRoute> {
    const mockServerPage = this.pageManager.mockServerPage;

    await mockServerPage.editRoute(route.id!, changes);
    return { ...route, ...changes };
  }

  /**
   * Deletes `route` through its action menu and the confirmation dialog.
   */
  @step()
  async deleteRoute(route: MockRoute): Promise<void> {
    await this.pageManager.mockServerPage.deleteRoute(route.id!);
  }

  /**
   * Opens `server` and lists the paths of the routes in its sidebar.
   */
  @step()
  async getRoutePaths(server: MockServer): Promise<string[]> {
    await this.open(server);
    return this.pageManager.mockServerPage.getRoutePaths();
  }

  /**
   * Opens `route` and reads the method and path its URL bar shows.
   */
  @step()
  async getRoute(route: MockRoute): Promise<{ method: string; path: string }> {
    const mockServerPage = this.pageManager.mockServerPage;

    await mockServerPage.openRoute(route.id!);
    return mockServerPage.getOpenRoute();
  }

  /**
   * Opens `route` and reads its full URL on the mock server out of the
   * "Show URL" dialog.
   */
  @step()
  async getUrl(route: MockRoute): Promise<string> {
    const mockServerPage = this.pageManager.mockServerPage;

    await mockServerPage.openRoute(route.id!);
    return mockServerPage.showUrl();
  }

  /**
   * Opens `route`, clicks "Test" and reads the response the mock server
   * answered with.
   */
  @step()
  async test(route: MockRoute): Promise<ResponseView> {
    const mockServerPage = this.pageManager.mockServerPage;
    const responsePage = this.pageManager.responsePage;

    await mockServerPage.openRoute(route.id!);
    await mockServerPage.clickTest();
    await mockServerPage.switchResponseTab("preview");
    return responsePage.get();
  }

  /**
   * On the response `request` currently shows, opens the "→ Mock" tab and
   * creates a new Mock Route on `server` from it.
   */
  @step()
  async createRouteFromResponse(
    server: MockServer,
    path?: string,
  ): Promise<MockRoute> {
    const mockServerPage = this.pageManager.mockServerPage;

    await mockServerPage.openResponseToMock(server.name);
    await mockServerPage.createRouteFromResponse(path);

    const open = await mockServerPage.getOpenRoute();
    const id = await mockServerPage.findRouteId(open.path);
    return { id, path: open.path };
  }

  /**
   * On the response the request currently shows, opens the "→ Mock" tab
   * and overwrites `route` with it.
   */
  @step()
  async overwriteRouteFromResponse(
    server: MockServer,
    route: MockRoute,
  ): Promise<void> {
    const mockServerPage = this.pageManager.mockServerPage;

    await mockServerPage.openResponseToMock(server.name);
    await mockServerPage.overwriteRouteFromResponse(route.id!);
    await mockServerPage.navigate();
  }

  /**
   * Opens `route` and reads the hits its History tab has logged.
   */
  @step()
  async getHistory(route: MockRoute): Promise<MockRouteHistoryEntry[]> {
    const mockServerPage = this.pageManager.mockServerPage;

    await mockServerPage.openRoute(route.id!);
    let history: MockRouteHistoryEntry[] = [];
    await expect(async () => {
      history = await mockServerPage.getHistory();
      expect(history.length).toBeGreaterThan(0);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
    return history;
  }
}
