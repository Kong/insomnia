import { expect } from "@playwright/test";

import { ContextMenuItem } from "../enums/context-menu-items";
import { DEFAULT_TIMEOUT } from "../misc/constants";
import type { MockRoute, MockRouteHistoryEntry } from "../models/mock-route";
import { MockServer } from "../models/mock-server";
import type { Project } from "../models/project";
import type { Response } from "../models/response";
import { BaseFlow } from "./base.flow";

export class MockServerFlow extends BaseFlow {
  /**
   * Creates a self-hosted Mock Server under `parent` through the project's
   * create menu and the create dialog, then re-reads it from the tree.
   * @param parent - The project to create the Mock Server under
   * @param server - The Mock Server to create, including its self-hosted URL
   * @returns The created Mock Server, with `id` populated
   */
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
   * @param item - The Mock Server's name, or an object with `name`/`id`
   * @returns The found Mock Server (its `url` isn't shown in the tree, so it's left empty), with `id` populated
   */
  async get(item: string | { name: string; id?: string }): Promise<MockServer> {
    const identity = typeof item === "string" ? { name: item } : item;
    const node = await this.pageManager.workspacePage.findItemNode(identity);
    this.assertCreated(node, identity.name);
    return Object.assign(new MockServer(identity.name, ""), { id: node!._id });
  }

  /**
   * Duplicates `server` through its context menu's "Duplicate / Move"
   * dialog.
   * @param server - The Mock Server to duplicate
   * @param newName - The name to give the copy
   * @param targetProject - The project to put the copy in; the source's own project if omitted
   * @returns The copy, with `id` populated
   */
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
   * @param server - The Mock Server to export
   * @param path - Absolute path the exported file should be written to
   */
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
   * @param server - The Mock Server to open
   */
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
   * @param server - The Mock Server to add the route to
   * @param route - The route to create
   * @returns The created route, with `id` populated
   */
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
   * @param route - The route (with `id`) whose response to configure
   */
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
   * @param route - The route (with `id`) to edit
   * @param changes - The new path and/or method
   * @returns The route with the changes applied
   */
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
   * @param route - The route (with `id`) to delete
   */
  async deleteRoute(route: MockRoute): Promise<void> {
    await this.pageManager.mockServerPage.deleteRoute(route.id!);
  }

  /**
   * Opens `server` and lists the paths of the routes in its sidebar.
   * @param server - The Mock Server to read
   * @returns The route paths currently listed
   */
  async getRoutePaths(server: MockServer): Promise<string[]> {
    await this.open(server);
    return this.pageManager.mockServerPage.getRoutePaths();
  }

  /**
   * Opens `route` and reads the method and path its URL bar shows.
   * @param route - The route (with `id`) to open
   * @returns The method and path shown
   */
  async getRoute(route: MockRoute): Promise<{ method: string; path: string }> {
    const mockServerPage = this.pageManager.mockServerPage;

    await mockServerPage.openRoute(route.id!);
    return mockServerPage.getOpenRoute();
  }

  /**
   * Opens `route` and reads its full URL on the mock server out of the
   * "Show URL" dialog.
   * @param route - The route (with `id`) to read
   * @returns The route's full mock URL
   */
  async getUrl(route: MockRoute): Promise<string> {
    const mockServerPage = this.pageManager.mockServerPage;

    await mockServerPage.openRoute(route.id!);
    return mockServerPage.showUrl();
  }

  /**
   * Opens `route`, clicks "Test" and reads the response the mock server
   * answered with.
   * @param route - The route (with `id`) to test
   * @returns The response shown in the response pane
   */
  async test(route: MockRoute): Promise<Response> {
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
   * @param server - The Mock Server to add the route to
   * @param path - The route path to use instead of the one pre-filled from the response URL
   * @returns The created route, with `id` and `path` populated
   */
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
   * @param server - The Mock Server holding `route`
   * @param route - The route (with `id`) to overwrite
   */
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
   * @param route - The route (with `id`) to read
   * @returns The logged requests, newest first
   */
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
